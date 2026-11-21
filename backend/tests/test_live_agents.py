"""Contract tests for the two real-agent publication adapters."""
from __future__ import annotations

import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from examples import live_agents
from tools.publish_live_coding10 import ApiError, assert_real_coding10_records


class LiveAgentAdapterTests(unittest.TestCase):
    def test_tool_outage_is_an_observed_tool_failure_not_a_fake_success(self):
        payload = live_agents.Envelope(
            run_id="run-tool-fault",
            task_id="coding-001",
            task={"objective": "Write a function"},
            environment={"tool_unavailable_injected": True},
        )
        tracker = live_agents.LiveRun(payload)
        valid, message = asyncio.run(tracker.syntax_tool("def answer():\n    return 42\n"))
        self.assertFalse(valid)
        self.assertIn("unavailable", message)
        self.assertEqual(tracker.tools, 1)
        self.assertEqual(tracker.events[-1]["type"], "tool.call.failed")
        self.assertEqual(tracker.events[-1]["payload"]["error_type"], "InjectedToolUnavailable")

    def test_live_agent_calls_bifrost_and_reports_real_usage_metadata(self):
        old = (live_agents.BIFROST_BASE_URL, live_agents.BIFROST_API_KEY, live_agents.BIFROST_MODEL)
        captured = {}

        class FakeResponse:
            headers = {"x-request-id": "bifrost-request-42"}
            def raise_for_status(self):
                return None
            def json(self):
                return {
                    "model": "actual-model-alias",
                    "provider": "openai",
                    "choices": [{"message": {"content": "def answer():\n    return 42"}}],
                    "usage": {"prompt_tokens": 31, "completion_tokens": 11, "cost_usd": 0.00021},
                }

        class FakeClient:
            def __init__(self, **kwargs):
                captured["timeout"] = kwargs.get("timeout")
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                return None
            async def post(self, url, headers, json):
                captured.update({"url": url, "headers": headers, "body": json})
                return FakeResponse()

        try:
            live_agents.BIFROST_BASE_URL = "https://gateway.example/v1"
            live_agents.BIFROST_API_KEY = "test-key"
            live_agents.BIFROST_MODEL = "fallback-model"
            payload = live_agents.Envelope(
                run_id="run-real-agent",
                experiment_id="exp-real-agent",
                agent_id="agent-langgraph",
                workspace_id="local",
                model="actual-model-alias",
                task_id="coding-001",
                task={"objective": "Write a function"},
            )
            tracker = live_agents.LiveRun(payload)
            with patch.object(live_agents.httpx, "AsyncClient", FakeClient):
                answer = asyncio.run(tracker.model_call([{"role": "user", "content": "Write it"}], "test-call"))
            result = tracker.result(answer)
            self.assertIn("def answer", answer)
            self.assertEqual(result["input_tokens"], 31)
            self.assertEqual(result["output_tokens"], 11)
            self.assertEqual(result["cost_usd"], 0.00021)
            self.assertEqual(result["model_calls"], 1)
            self.assertEqual(result["model"], "actual-model-alias")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-run-id"], "run-real-agent")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-experiment-id"], "exp-real-agent")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-task-id"], "coding-001")
            self.assertEqual(captured["body"]["model"], "actual-model-alias")
            self.assertEqual(result["events"][-1]["type"], "model.request.completed")
        finally:
            live_agents.BIFROST_BASE_URL, live_agents.BIFROST_API_KEY, live_agents.BIFROST_MODEL = old

    def test_missing_usage_is_reported_as_unknown_not_zero(self):
        old = (live_agents.BIFROST_BASE_URL, live_agents.BIFROST_API_KEY, live_agents.BIFROST_MODEL)

        class FakeResponse:
            headers = {}
            def raise_for_status(self):
                return None
            def json(self):
                return {"model": "model-without-usage", "choices": [{"message": {"content": "def answer(): return 1"}}]}

        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, *args, **kwargs): return FakeResponse()

        try:
            live_agents.BIFROST_BASE_URL = "https://gateway.example/v1"
            live_agents.BIFROST_API_KEY = "test-key"
            live_agents.BIFROST_MODEL = "fallback-model"
            payload = live_agents.Envelope(run_id="run-no-usage", task_id="coding-001", task={"objective": "Write a function"})
            tracker = live_agents.LiveRun(payload)
            with patch.object(live_agents.httpx, "AsyncClient", FakeClient):
                answer = asyncio.run(tracker.model_call([{"role": "user", "content": "Write it"}], "test-call"))
            result = tracker.result(answer)
            self.assertIsNone(result["input_tokens"])
            self.assertIsNone(result["output_tokens"])
            self.assertIsNone(result["cost_usd"])
        finally:
            live_agents.BIFROST_BASE_URL, live_agents.BIFROST_API_KEY, live_agents.BIFROST_MODEL = old

    def test_publication_runner_rejects_non_live_or_unexecuted_results(self):
        condition = {
            "label": "clean",
            "counts": {"expected_runs": 1},
            "runs": [{
                "agent_name": "Agent A", "task_id": "coding-001", "repetition": 1, "status": "completed",
                "result": {"mode": "live", "simulated": False, "validation_status": "structural_demo_only", "model_calls": 1},
            }],
        }
        with self.assertRaises(ApiError):
            assert_real_coding10_records(condition)

    def test_publication_runner_requires_observed_tool_outage(self):
        condition = {
            "label": "tool-outage",
            "counts": {"expected_runs": 1},
            "runs": [{
                "agent_name": "Agent A", "task_id": "coding-001", "repetition": 1, "status": "completed",
                "result": {"mode": "live", "simulated": False, "validation_status": "executed", "model_calls": 1, "tool_unavailable_injected": False},
            }],
        }
        with self.assertRaises(ApiError):
            assert_real_coding10_records(condition, tool_fault_expected=True)


if __name__ == "__main__":
    unittest.main()
