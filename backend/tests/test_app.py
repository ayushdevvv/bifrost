"""Smoke tests for the RIFT Arena hackathon MVP.

Run from the repository root with: python -m unittest discover -s backend/tests -v
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

TMP = tempfile.TemporaryDirectory(prefix="rift-tests-")
os.environ["RIFT_DB_PATH"] = str(Path(TMP.name) / "test.db")
os.environ["RIFT_AUTH_REQUIRED"] = "false"
os.environ["RIFT_ALLOW_LOCAL_ADAPTERS"] = "true"
os.environ["RIFT_ADAPTER_EVENT_SECRET"] = "test-adapter-event-secret"
os.environ["RIFT_AUTH_SECRET"] = "test-auth-secret-for-unit-tests-only"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
import main as rift


class RiftApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(rift.app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)
        TMP.cleanup()

    def test_no_login_demo_workspace_is_accessible_without_bearer_token(self):
        old_required = rift.RIFT_AUTH_REQUIRED
        rift.RIFT_AUTH_REQUIRED = False
        try:
            response = self.client.get("/api/agents")
            self.assertEqual(response.status_code, 200, response.text)
            health = self.client.get("/api/health").json()
            self.assertFalse(health["security"]["authentication_required"])
            self.assertEqual(health["security"]["access_mode"], "single_shared_workspace")
            self.assertTrue(health["security"]["public_workspace_warning"])
        finally:
            rift.RIFT_AUTH_REQUIRED = old_required

    def test_health_and_static_frontend(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["version"], "0.7.0")
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertIn("RIFT Arena", page.text)
        self.assertEqual(self.client.get("/assets/contact2.jpg").status_code, 200)
        self.assertEqual(self.client.get("/assets/agent-benchmarking.jpg").status_code, 200)
        self.assertEqual(self.client.get("/guides/AGENT_ADAPTER.md").status_code, 200)
        self.assertEqual(self.client.get("/api/docs").status_code, 200)

    def test_framework_reporter_builds_run_scoped_bifrost_metadata(self):
        from examples.rift_instrumentation import RiftReporter
        reporter = RiftReporter({"run_id": "run-77", "task_id": "coding-001", "workspace_id": "ws-private"})
        metadata = reporter.bifrost_request_metadata(2)
        self.assertEqual(metadata["user"], "rift:run-77:2:ws-private")
        self.assertEqual(metadata["headers"]["x-request-id"], "rift-run-77-2")
        self.assertEqual(metadata["headers"]["x-bf-lh-rift-workspace-id"], "ws-private")

    def test_framework_reporter_calls_bifrost_and_records_actual_usage(self):
        from examples.rift_instrumentation import RiftReporter
        captured = {}
        class FakeResponse:
            headers = {"x-request-id": "bifrost-real-req"}
            def raise_for_status(self): return None
            def json(self):
                return {"model": "gpt-test", "provider": "openai", "choices": [{"message": {"content": "agent answer"}}], "usage": {"prompt_tokens": 45, "completion_tokens": 12, "cost_usd": 0.004}}
        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, url, headers, json):
                captured.update({"url": url, "headers": headers, "body": json})
                return FakeResponse()
        async def run():
            reporter = RiftReporter({"run_id": "r-10", "task_id": "coding-001", "workspace_id": "ws-10"})
            with patch("examples.rift_instrumentation.httpx.AsyncClient", FakeClient):
                result = await reporter.call_bifrost(
                    base_url="https://bifrost.example/v1", api_key="secret", model="gpt-test",
                    messages=[{"role": "user", "content": "do the task"}], call_index=1,
                )
            return result, reporter.response(result["content"])
        result, response = asyncio.run(run())
        self.assertEqual(result["content"], "agent answer")
        self.assertEqual(result["usage"], {"input_tokens": 45, "output_tokens": 12, "cost_usd": 0.004})
        self.assertEqual(response["usage"]["input_tokens"], 45)
        self.assertEqual(response["usage"]["output_tokens"], 12)
        self.assertEqual(response["usage"]["total_cost_usd"], 0.004)
        self.assertEqual(response["model_calls"], 1)
        self.assertEqual(captured["body"]["user"], "rift:r-10:1:ws-10")
        self.assertEqual(captured["headers"]["x-request-id"], "rift-r-10-1")
        self.assertNotIn("do the task", json.dumps(response["events"]))

    def test_bifrost_requests_carry_agent_run_correlation_metadata(self):
        old = (rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.BIFROST_MODEL)
        captured = {}

        class FakeResponse:
            headers = {"x-request-id": "bf-req-123"}
            def raise_for_status(self):
                return None
            def json(self):
                return {"model": "test-model", "choices": [{"message": {"content": "ok"}}], "usage": {"prompt_tokens": 12, "completion_tokens": 4}}

        class FakeAsyncClient:
            def __init__(self, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                return None
            async def post(self, url, headers, json):
                captured.update({"url": url, "headers": headers, "body": json})
                return FakeResponse()

        try:
            rift.BIFROST_BASE_URL = "https://bifrost.example/v1"
            rift.BIFROST_API_KEY = "test-key"
            with patch.object(rift.httpx, "AsyncClient", FakeAsyncClient):
                output, metadata = asyncio.run(rift.bifrost_chat(
                    [{"role": "user", "content": "test task"}],
                    {"id": "run-123", "experiment_id": "exp-123", "task_id": "coding-001", "agent_id": "agent-a", "model": "test-model", "mode": "live", "budgets": {"timeout_seconds": 20}},
                    call_index=3,
                ))
            self.assertEqual(output, "ok")
            self.assertEqual(metadata["bifrost_request_id"], "bf-req-123")
            self.assertEqual(captured["headers"]["x-request-id"], "rift-run-123-3")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-run-id"], "run-123")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-experiment-id"], "exp-123")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-task-id"], "coding-001")
            self.assertEqual(captured["headers"]["x-bf-lh-rift-agent-id"], "agent-a")
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.BIFROST_MODEL = old

    def test_production_startup_requires_shared_redis_rate_limiter(self):
        old = (os.environ.get("ENVIRONMENT"), rift.RIFT_AUTH_SECRET_CONFIGURED, rift.RIFT_AUTH_REQUIRED, rift.RIFT_ALLOW_LOCAL_ADAPTERS, rift.RIFT_RATE_LIMIT_REDIS_URL)
        try:
            os.environ["ENVIRONMENT"] = "production"
            rift.RIFT_AUTH_SECRET_CONFIGURED = True
            rift.RIFT_AUTH_REQUIRED = True
            rift.RIFT_ALLOW_LOCAL_ADAPTERS = False
            rift.RIFT_RATE_LIMIT_REDIS_URL = ""
            async def start():
                async with rift.lifespan(rift.app):
                    pass
            with self.assertRaisesRegex(RuntimeError, "RIFT_RATE_LIMIT_REDIS_URL"):
                asyncio.run(start())
        finally:
            if old[0] is None:
                os.environ.pop("ENVIRONMENT", None)
            else:
                os.environ["ENVIRONMENT"] = old[0]
            rift.RIFT_AUTH_SECRET_CONFIGURED, rift.RIFT_AUTH_REQUIRED, rift.RIFT_ALLOW_LOCAL_ADAPTERS, rift.RIFT_RATE_LIMIT_REDIS_URL = old[1:]

    def test_production_vercel_origin_is_allowed_without_env_configuration(self):
        origin = "https://riftz.vercel.app"
        preflight = self.client.options(
            "/api/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(preflight.status_code, 200, preflight.text)
        self.assertEqual(preflight.headers.get("access-control-allow-origin"), origin)
        actual = self.client.get("/api/health", headers={"Origin": origin})
        self.assertEqual(actual.status_code, 200)
        self.assertEqual(actual.headers.get("access-control-allow-origin"), origin)
        self.assertIn(origin, rift.CORS_ORIGINS)
        self.assertNotIn("*", rift.CORS_ORIGINS)

        # The UI creates experiments with JSON POST requests, which trigger
        # a browser preflight. Verify the same production origin is allowed.
        post_preflight = self.client.options(
            "/api/experiments",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(post_preflight.status_code, 200, post_preflight.text)
        self.assertEqual(post_preflight.headers.get("access-control-allow-origin"), origin)
        self.assertIn("POST", post_preflight.headers.get("access-control-allow-methods", ""))

    def test_unlisted_origin_is_not_allowed(self):
        origin = "https://not-riftz.example"
        preflight = self.client.options(
            "/api/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertNotEqual(preflight.headers.get("access-control-allow-origin"), origin)

    def test_live_mode_fails_closed_without_credentials(self):
        old = (rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY)
        try:
            rift.BIFROST_BASE_URL = ""
            rift.BIFROST_API_KEY = ""
            rift.TAVILY_API_KEY = ""
            response = self.client.post("/api/experiments", json={
                "mode": "live", "agent_ids": ["agent-react"],
                "task_ids": ["research-001"], "faults": {},
            })
            self.assertEqual(response.status_code, 400)
            self.assertIn("requires Bifrost", response.json()["detail"])
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY = old

    def test_seeded_decisions_are_repeatable_agent_independent_and_postgres_safe(self):
        seed_a = rift.seed_for(42017, "exp-test", "research-001", 1)
        seed_b = rift.seed_for(42017, "exp-test", "research-001", 1)
        self.assertEqual(seed_a, seed_b)
        self.assertEqual(seed_a, rift.seed_for(42017, "a-different-experiment", "research-001", 1))

        # Regression: this exact task previously generated 3,110,144,037,
        # overflowing PostgreSQL's signed INTEGER column for runs.seed.
        formerly_overflowing_seed = rift.seed_for(42017, "exp-test", "research-002", 1)
        self.assertGreaterEqual(formerly_overflowing_seed, 0)
        self.assertLessEqual(formerly_overflowing_seed, 2**31 - 1)
        for task_id in ("research-001", "research-002", "research-003", "research-010"):
            for repetition in range(1, 6):
                value = rift.seed_for(2**31 - 1, "exp-test", task_id, repetition)
                self.assertGreaterEqual(value, 0)
                self.assertLessEqual(value, 2**31 - 1)

        first = [rift.selected(seed_a, "poison", i, 0.5) for i in range(1, 10)]
        second = [rift.selected(seed_b, "poison", i, 0.5) for i in range(1, 10)]
        self.assertEqual(first, second)

    def test_demo_benchmark_creates_traces_and_export(self):
        response = self.client.post("/api/experiments", json={
            "title": "Automated acceptance run",
            "mode": "demo",
            "evidence_mode": "snapshot",
            "models": ["general", "fast"],
            "agent_ids": ["agent-react", "agent-planner"],
            "task_ids": ["research-001"],
            "repetitions": 1,
            "severity": 50,
            "master_seed": 42017,
            "faults": {"provider": True, "poison": True, "latency": True},
        })
        self.assertEqual(response.status_code, 200, response.text)
        experiment_id = response.json()["experiment_id"]
        experiment = self.client.get(f"/api/experiments/{experiment_id}").json()
        self.assertEqual(experiment["status"], "completed")
        self.assertEqual(len(experiment["runs"]), 4)
        self.assertTrue(all(run["status"] == "completed" for run in experiment["runs"]))

        detail = self.client.get(f"/api/runs/{experiment['runs'][0]['id']}").json()
        event_types = {event["event_type"] for event in detail["events"]}
        self.assertIn("evaluation.completed", event_types)
        self.assertIn("latency.delay.applied", event_types)
        self.assertTrue(detail["result"]["simulated"])
        self.assertEqual(detail["result"]["mode"], "demo")
        self.assertIsNone(detail["result"]["tokens_in"])
        self.assertIsNone(detail["result"]["tokens_out"])
        self.assertIn("budgets", detail["result"])
        self.assertEqual(self.client.get("/api/tasks").json()["suite"]["id"], "research-10")
        self.assertEqual(len(self.client.get("/api/tasks").json()["tasks"]), 10)
        report = self.client.get(f"/api/experiments/{experiment_id}/report")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(len(report.json()["results"]), 4)

        export = self.client.get(f"/api/experiments/{experiment_id}/export")
        self.assertEqual(export.status_code, 200)
        self.assertIn("Run ID,Agent,Model", export.text)
        leaderboard = self.client.get("/api/leaderboard")
        self.assertEqual(leaderboard.status_code, 200)
        self.assertGreaterEqual(len(leaderboard.json()["leaderboard"]), 1)
        evaluation = self.client.get("/api/evaluation/summary")
        self.assertEqual(evaluation.status_code, 200)
        self.assertGreaterEqual(evaluation.json()["total_runs"], 4)
        self.assertIsNotNone(evaluation.json()["quality_avg"])
        self.assertIn("by_task", evaluation.json())

    def test_category_suites_grade_fixtures_and_measure_repeated_agent_trials(self):
        for suite_id in ("research-10", "coding-10", "support-10"):
            suite = self.client.get(f"/api/tasks?suite_id={suite_id}")
            self.assertEqual(suite.status_code, 200, suite.text)
            self.assertEqual(suite.json()["suite"]["id"], suite_id)
            self.assertEqual(len(suite.json()["tasks"]), 10)

        # The offline task fixtures exercise every deterministic code and
        # support rubric without executing agent-supplied code.
        for task in rift.CODING_TASKS + rift.SUPPORT_TASKS:
            graded = rift.grade_task_output(task, rift.demo_agent_response(task, []), [])
            self.assertEqual(graded["quality"], 1.0, (task["id"], graded["assertion_results"]))

        created = self.client.post("/api/experiments", json={
            "title": "Coding agent repeatability acceptance",
            "mode": "demo", "suite_id": "coding-10", "evidence_mode": "snapshot",
            "agent_ids": ["agent-react"], "models": ["general"],
            "task_ids": ["coding-001"], "repetitions": 2,
            "severity": 0, "master_seed": 91024,
            "faults": {"provider": False, "poison": False, "latency": False,
                       "tool_unavailable": False, "misleading_instruction": False},
        })
        self.assertEqual(created.status_code, 200, created.text)
        experiment = self.client.get(f"/api/experiments/{created.json()['experiment_id']}").json()
        self.assertEqual(experiment["status"], "completed")
        self.assertEqual(len(experiment["runs"]), 2)
        self.assertTrue(all(run["result"]["success"] for run in experiment["runs"]))
        self.assertTrue(all(run["result"]["benchmark_category"] == "coding" for run in experiment["runs"]))

        summary = self.client.get("/api/evaluation/summary").json()
        self.assertGreaterEqual(summary["repeated_groups"], 1)
        self.assertEqual(summary["repetition_k"], 2)
        self.assertEqual(summary["pass_at_k_pct"], 100.0)
        self.assertEqual(summary["pass_power_k_pct"], 100.0)
        self.assertEqual(summary["reliability_at_k_pct"], 100.0)
        report = self.client.get(f"/api/experiments/{created.json()['experiment_id']}/report").json()
        self.assertEqual(report["results"][0]["pass_at_k_pct"], 100.0)
        self.assertEqual(report["results"][0]["pass_power_k_pct"], 100.0)
        self.assertIn("pass^k", report["results"][0]["repeatability_metric_note"])
        self.assertTrue(any(row["category"] == "coding" for row in summary["by_category"]))

        # External adapters can stream bounded, per-run authenticated events.
        run_id = experiment["runs"][0]["id"]
        with rift.db() as conn:
            conn.execute("UPDATE runs SET status='running' WHERE id=?", (run_id,))
        token = rift.make_adapter_event_token(run_id)
        rejected = self.client.post(f"/api/adapter/runs/{run_id}/events", json={"type": "tool.call", "payload": {}}, headers={"x-rift-adapter-token": "wrong"})
        self.assertEqual(rejected.status_code, 401)
        accepted = self.client.post(f"/api/adapter/runs/{run_id}/events", json={"type": "tool.call.completed", "payload": {"tool": "catalog", "status": "ok"}}, headers={"x-rift-adapter-token": token})
        self.assertEqual(accepted.status_code, 200, accepted.text)
        trace = self.client.get(f"/api/runs/{run_id}/events").json()["events"]
        self.assertIn("agent.external.tool.call.completed", {event["event_type"] for event in trace})
        with rift.db() as conn:
            conn.execute("UPDATE runs SET status='completed' WHERE id=?", (run_id,))

    def test_fault_dimensions_are_independent_and_summarized(self):
        # Evidence poisoning must not turn on the misleading-instruction fault.
        poison_run = self.client.post("/api/experiments", json={
            "title": "Independent evidence-poison fault",
            "mode": "demo", "suite_id": "research-10", "evidence_mode": "snapshot",
            "agent_ids": ["agent-react"], "models": ["general"],
            "task_ids": ["research-001"], "repetitions": 1,
            "severity": 100, "master_seed": 55123,
            "faults": {"provider": False, "poison": True, "latency": False,
                       "tool_unavailable": False, "misleading_instruction": False},
        })
        self.assertEqual(poison_run.status_code, 200, poison_run.text)
        poison_exp = self.client.get(f"/api/experiments/{poison_run.json()['experiment_id']}").json()
        poison_result = poison_exp["runs"][0]["result"]
        self.assertTrue(poison_result["poisoned"])
        self.assertFalse(poison_result["misleading_instruction_injected"])

        # Hostile task context is a separate dimension and can be exercised in
        # a category that does not use evidence search.
        instruction_run = self.client.post("/api/experiments", json={
            "title": "Independent instruction-fault test",
            "mode": "demo", "suite_id": "support-10", "evidence_mode": "snapshot",
            "agent_ids": ["agent-react"], "models": ["general"],
            "task_ids": ["support-001"], "repetitions": 1,
            "severity": 100, "master_seed": 55124,
            "faults": {"provider": False, "poison": False, "latency": False,
                       "tool_unavailable": True, "misleading_instruction": True},
        })
        self.assertEqual(instruction_run.status_code, 200, instruction_run.text)
        instruction_exp = self.client.get(f"/api/experiments/{instruction_run.json()['experiment_id']}").json()
        instruction_result = instruction_exp["runs"][0]["result"]
        self.assertFalse(instruction_result["poisoned"])
        self.assertTrue(instruction_result["misleading_instruction_injected"])
        self.assertTrue(instruction_result["tool_unavailable_injected"])
        summary = self.client.get("/api/evaluation/summary").json()
        self.assertGreaterEqual(summary["tool_fault_runs"], 1)
        self.assertGreaterEqual(summary["instruction_fault_runs"], 1)
        report = self.client.get(f"/api/experiments/{instruction_run.json()['experiment_id']}/report").json()
        self.assertEqual(report["results"][0]["tool_fault_runs"], 1)
        self.assertEqual(report["results"][0]["instruction_fault_runs"], 1)

    def test_mcp_monitor_captures_versions_and_detects_permission_drift(self):
        manifests = [
            rift.normalize_mcp_manifest({"name": "Docs", "version": "1.0"}, {"tools": {}}, [{
                "name": "search", "description": "Search documents", "inputSchema": {"type": "object"},
                "annotations": {"readOnlyHint": True},
            }]),
            rift.normalize_mcp_manifest({"name": "Docs", "version": "1.1"}, {"tools": {}}, [{
                "name": "search", "description": "Search and export documents", "inputSchema": {"type": "object", "properties": {"export": {"type": "boolean"}}},
                "annotations": {"readOnlyHint": False, "destructiveHint": True},
            }, {"name": "delete", "description": "Delete a document", "inputSchema": {"type": "object"}}]),
        ]
        async def fake_fetch(_endpoint):
            return manifests.pop(0)
        with patch.object(rift, "fetch_mcp_manifest", side_effect=fake_fetch):
            created = self.client.post("/api/mcp-monitors", json={"name": "Docs MCP", "endpoint": "https://docs.example.com/mcp"})
            self.assertEqual(created.status_code, 200, created.text)
            monitor_id = created.json()["monitor_id"]
            changed = self.client.post(f"/api/mcp-monitors/{monitor_id}/scan")
            self.assertEqual(changed.status_code, 200, changed.text)
            self.assertEqual(changed.json()["version"], 2)
            kinds = {item["kind"] for item in changed.json()["changes"]}
            self.assertIn("tool_added", kinds)
            self.assertIn("schema_changed", kinds)
            self.assertIn("permission_changed", kinds)
            detail = self.client.get(f"/api/mcp-monitors/{monitor_id}").json()
            self.assertEqual(len(detail["snapshots"]), 2)

    def test_counterfactual_analysis_launches_controlled_reruns(self):
        created = self.client.post("/api/experiments", json={
            "title": "Counterfactual source run", "mode": "demo", "evidence_mode": "snapshot",
            "agent_ids": ["agent-react"], "models": ["general"], "task_ids": ["research-001"],
            "repetitions": 1, "severity": 55, "master_seed": 777,
            "faults": {"provider": True, "poison": False, "latency": False},
        })
        self.assertEqual(created.status_code, 200, created.text)
        experiment = self.client.get(f"/api/experiments/{created.json()['experiment_id']}").json()
        run_id = experiment["runs"][0]["id"]
        analysis = self.client.post(f"/api/runs/{run_id}/counterfactual-analysis", json={})
        self.assertEqual(analysis.status_code, 200, analysis.text)
        self.assertEqual(len(analysis.json()["variants"]), 1)
        record = self.client.get(f"/api/counterfactual-analyses/{analysis.json()['analysis_id']}")
        self.assertEqual(record.status_code, 200)
        self.assertTrue(all(item["status"] in {"completed", "failed", "cancelled", "running", "queued"} for item in record.json()["variants"]))


    def test_replay_runner_reuses_preseeded_evidence_snapshot(self):
        evidence = {
            "evidence_hash": "fixed-evidence-hash",
            "sources": [{"title": "Pinned source", "url": "https://example.org/pinned", "content": "Original captured evidence."}],
            "provider": "original snapshot",
        }
        experiment_id, run_id = rift.create_single_run_experiment(
            title="Evidence preservation test", agent_id="agent-react", task_id="research-001",
            model="general", mode="demo", evidence_mode="snapshot", faults={}, severity=0,
            master_seed=42, seed=123456,
            budgets={"max_steps": 10, "max_tool_calls": 10, "timeout_seconds": 30, "max_cost_usd": 0.1},
            evidence_snapshot=evidence,
        )
        async def unexpected_search(*args, **kwargs):
            raise AssertionError("A replay must not fetch replacement evidence")
        with patch.object(rift, "tavily_search", side_effect=unexpected_search):
            asyncio.run(rift.execute_experiment(experiment_id))
        with rift.db() as conn:
            snapshot = conn.execute(
                "SELECT evidence_hash,sources,provider FROM evidence_snapshots WHERE experiment_id=? AND task_id=?",
                (experiment_id, "research-001"),
            ).fetchone()
        self.assertEqual(snapshot["evidence_hash"], "fixed-evidence-hash")
        self.assertEqual(snapshot["provider"], "original snapshot")
        self.assertEqual(rift.parse_json(snapshot["sources"], [])[0]["url"], "https://example.org/pinned")
        run = rift.get_run(run_id)
        self.assertEqual(run["status"], "completed")

    def test_regression_case_preserves_seed_and_replays(self):
        created = self.client.post("/api/experiments", json={
            "title": "Regression source run", "mode": "demo", "evidence_mode": "snapshot",
            "agent_ids": ["agent-react"], "models": ["general"], "task_ids": ["research-002"],
            "repetitions": 1, "severity": 30, "master_seed": 1901,
            "faults": {"provider": False, "poison": False, "latency": False},
        })
        self.assertEqual(created.status_code, 200, created.text)
        experiment = self.client.get(f"/api/experiments/{created.json()['experiment_id']}").json()
        baseline = experiment["runs"][0]
        detail = self.client.get(f"/api/runs/{baseline['id']}").json()
        case_response = self.client.post(f"/api/regression-cases/from-run/{baseline['id']}", json={"title": "Evidence integrity regression"})
        self.assertEqual(case_response.status_code, 200, case_response.text)
        case_id = case_response.json()["case_id"]
        replay = self.client.post(f"/api/regression-cases/{case_id}/replay", json={})
        self.assertEqual(replay.status_code, 200, replay.text)
        replay_run = self.client.get(f"/api/runs/{replay.json()['run_id']}").json()
        self.assertEqual(replay_run["seed"], detail["seed"])
        suite = self.client.post("/api/regression-cases/replay-suite", json={"agent_id": "agent-planner"})
        self.assertEqual(suite.status_code, 200, suite.text)
        self.assertEqual(suite.json()["case_count"], 1)
        self.assertEqual(suite.json()["queued_count"], 1)
        suite_run = self.client.get(f"/api/runs/{suite.json()['replays'][0]['run_id']}").json()
        self.assertEqual(suite_run["agent_id"], "agent-planner")
        self.assertEqual(suite_run["seed"], detail["seed"])
        cases = self.client.get("/api/regression-cases").json()["cases"]
        saved = next(item for item in cases if item["id"] == case_id)
        self.assertEqual(len(saved["replays"]), 2)
        self.assertEqual(saved["baseline_run_id"], baseline["id"])


    def test_research_demo_persists_evidence_snapshot(self):
        response = self.client.post("/api/research/search", json={
            "query": "Compare current AI agent observability platforms",
            "mode": "demo",
            "max_results": 3,
            "search_depth": "advanced",
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertTrue(result["simulated"])
        self.assertEqual(result["provider"], "RIFT preview dataset")
        self.assertEqual(len(result["sources"]), 3)
        self.assertTrue(result["evidence_hash"])
        detail = self.client.get(f"/api/research/snapshots/{result['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["evidence_hash"], result["evidence_hash"])
        listing = self.client.get("/api/research/snapshots")
        self.assertTrue(any(item["id"] == result["id"] for item in listing.json()["snapshots"]))

    def test_research_live_uses_tavily_and_stores_real_source_metadata(self):
        old = rift.TAVILY_API_KEY
        try:
            rift.TAVILY_API_KEY = "test-tavily-key"
            class FakeResponse:
                def raise_for_status(self):
                    return None
                def json(self):
                    return {
                        "answer": "A test answer from the fake Tavily response.",
                        "results": [{
                            "title": "Official source", "url": "https://docs.example.com/guide",
                            "content": "A verifiable test passage.", "score": 0.93,
                            "published_date": "2026-11-14"
                        }]
                    }
            async def fake_post(self, url, **kwargs):
                self.last_url = url
                self.last_kwargs = kwargs
                return FakeResponse()
            with patch.object(rift.httpx.AsyncClient, "post", fake_post):
                response = self.client.post("/api/research/search", json={
                    "query": "Current agent benchmarking methods", "mode": "live",
                    "max_results": 3, "search_depth": "advanced"
                })
            self.assertEqual(response.status_code, 200, response.text)
            payload = response.json()
            self.assertFalse(payload["simulated"])
            self.assertEqual(payload["provider"], "Tavily")
            self.assertEqual(payload["sources"][0]["url"], "https://docs.example.com/guide")
            self.assertEqual(payload["sources"][0]["score"], 0.93)
        finally:
            rift.TAVILY_API_KEY = old

    def test_research_live_fails_closed_without_tavily_key(self):
        old = rift.TAVILY_API_KEY
        try:
            rift.TAVILY_API_KEY = ""
            response = self.client.post("/api/research/search", json={
                "query": "Current AI gateway releases", "mode": "live"
            })
            self.assertEqual(response.status_code, 400)
            self.assertIn("TAVILY_API_KEY", response.json()["detail"])
        finally:
            rift.TAVILY_API_KEY = old

    def test_integration_test_is_safe_when_credentials_are_missing(self):
        old = (rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY)
        try:
            rift.BIFROST_BASE_URL = ""
            rift.BIFROST_API_KEY = ""
            rift.TAVILY_API_KEY = ""
            result = self.client.post("/api/integrations/test").json()
            self.assertFalse(result["ready"])
            self.assertFalse(result["bifrost"]["ok"])
            self.assertFalse(result["tavily"]["ok"])
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY = old



    def test_agent_endpoint_requires_https_or_exact_loopback(self):
        unsafe = self.client.post("/api/agents", json={
            "name": "Unsafe local adapter", "framework": "Custom", "endpoint": "http://localhost.attacker.example/run"
        })
        self.assertEqual(unsafe.status_code, 422)
        valid = self.client.post("/api/agents", json={
            "name": "Local adapter", "framework": "Custom", "endpoint": "http://127.0.0.1:9000/run"
        })
        self.assertEqual(valid.status_code, 200, valid.text)

    def test_budget_validation_and_run_limit(self):
        invalid_budget = self.client.post("/api/experiments", json={
            "mode": "demo", "agent_ids": ["agent-react"], "task_ids": ["research-001"],
            "budgets": {"max_steps": 0, "max_tool_calls": 10, "timeout_seconds": 60},
        })
        self.assertEqual(invalid_budget.status_code, 422)
        too_many_runs = self.client.post("/api/experiments", json={
            "mode": "demo", "agent_ids": ["agent-react", "agent-planner"],
            "models": ["a", "b", "c", "d"], "task_ids": [task["id"] for task in rift.TASKS],
            "repetitions": 5,
        })
        self.assertEqual(too_many_runs.status_code, 400)
        self.assertIn("200-run limit", too_many_runs.json()["detail"])


    def test_builtin_step_budget_stops_before_unbudgeted_step(self):
        response = self.client.post("/api/experiments", json={
            "title": "Step budget guard",
            "mode": "demo",
            "agent_ids": ["agent-react"],
            "models": ["general"],
            "task_ids": ["research-001"],
            "repetitions": 1,
            "faults": {"provider": False, "poison": False, "latency": False},
            "budgets": {"max_steps": 1, "max_tool_calls": 2, "timeout_seconds": 30, "max_cost_usd": 0.1},
        })
        self.assertEqual(response.status_code, 200, response.text)
        experiment_id = response.json()["experiment_id"]
        experiment = self.client.get(f"/api/experiments/{experiment_id}").json()
        self.assertEqual(experiment["runs"][0]["status"], "failed")
        detail = self.client.get(f"/api/runs/{experiment['runs'][0]['id']}").json()
        self.assertIn("Step budget exhausted", detail["result"]["error"])

    def test_postgres_compatibility_helpers(self):
        class FakeConnection:
            def __init__(self):
                self.query = None
                self.params = None
            def execute(self, query, params=()):
                self.query = query
                self.params = params
                return "executed"
            def commit(self): pass
            def rollback(self): pass
            def close(self): pass

        raw = FakeConnection()
        adapter = rift.PostgresCompat(raw)
        self.assertEqual(adapter.execute("SELECT * FROM runs WHERE id=? AND status=?", ("r1", "completed")), "executed")
        self.assertEqual(raw.query, "SELECT * FROM runs WHERE id=%s AND status=%s")
        self.assertEqual(raw.params, ("r1", "completed"))
        row = rift.HybridRow(["id", "status"], ["r1", "completed"])
        self.assertEqual(row["id"], "r1")
        self.assertEqual(row[1], "completed")
        self.assertEqual(row.keys(), ["id", "status"])

    def test_demo_mode_never_calls_paid_provider_apis(self):
        old = (rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY)
        try:
            rift.BIFROST_BASE_URL = "https://gateway.example.test/v1"
            rift.BIFROST_API_KEY = "configured-test-key"
            rift.TAVILY_API_KEY = "configured-test-key"
            async def exercise():
                async def forbidden_post(*args, **kwargs):
                    raise AssertionError("Demo mode must never call an external provider")
                with patch.object(rift.httpx.AsyncClient, "post", forbidden_post):
                    run = {"id": "demo-run", "mode": "demo", "model": "general", "budgets": {}}
                    task = rift.TASKS[0]
                    sources, meta = await rift.tavily_search(task["prompt"], run, task, None)
                    output, model = await rift.bifrost_chat([{"role": "user", "content": "test"}], run)
                    return sources, meta, output, model
            sources, meta, output, model = asyncio.run(exercise())
            self.assertTrue(meta["simulated"])
            self.assertEqual(meta["provider"], "RIFT preview dataset")
            self.assertTrue(model["simulated"])
            self.assertIsNone(model["input_tokens"])
            self.assertTrue(output.startswith("Generated analysis:"))
            self.assertTrue(sources)
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY = old

    def test_live_bifrost_fault_proxy_injects_correlated_upstream_503(self):
        old = (rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED, rift.RIFT_PROXY_TOKEN, rift.UPSTREAM_OPENAI_API_KEY)
        try:
            rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED = True
            rift.RIFT_PROXY_TOKEN = "test-proxy-token"
            rift.UPSTREAM_OPENAI_API_KEY = "upstream-secret"
            seed = next(value for value in range(1000) if rift.selected(value, "provider", 1, 1.0))
            fake_run = {"id": "run-proxy-test", "experiment_id": "exp-proxy-test", "mode": "live", "faults": {"provider": True}, "seed": seed, "severity": 100}
            with patch.object(rift, "get_run", return_value=fake_run), patch.object(rift, "emit", return_value=None) as emit:
                response = asyncio.run(rift.provider_fault_proxy(
                    {"model": "test-model", "user": "rift:run-proxy-test:1:local", "messages": []},
                    "Bearer test-proxy-token",
                ))
            self.assertEqual(response.status_code, 503)
            self.assertIn("injected provider outage", response.body.decode())
            emit.assert_awaited_once()
            payload = emit.await_args.args[3]
            self.assertEqual(payload["status_code"], 503)
            self.assertTrue(payload["injected"])
        finally:
            rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED, rift.RIFT_PROXY_TOKEN, rift.UPSTREAM_OPENAI_API_KEY = old

    def test_provider_proxy_rejects_missing_credentials(self):
        old_token, old_enabled = rift.RIFT_PROXY_TOKEN, rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED
        try:
            rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED = False
            disabled = self.client.post("/fault-proxy/v1/chat/completions", json={})
            self.assertEqual(disabled.status_code, 404)
            rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED = True
            rift.RIFT_PROXY_TOKEN = "test-token"
            unauthorized = self.client.post("/fault-proxy/v1/chat/completions", json={})
            self.assertEqual(unauthorized.status_code, 401)
        finally:
            rift.RIFT_PROXY_TOKEN = old_token
            rift.RIFT_PROVIDER_FAULT_PROXY_ENABLED = old_enabled


    def test_authentication_and_workspace_isolation(self):
        old_required = rift.RIFT_AUTH_REQUIRED
        rift.RIFT_AUTH_REQUIRED = True
        try:
            denied = self.client.get("/api/agents")
            self.assertEqual(denied.status_code, 401)
            a = self.client.post("/api/auth/register", json={"email": "first@example.test", "password": "correct-horse-battery-1"})
            self.assertEqual(a.status_code, 200, a.text)
            b = self.client.post("/api/auth/register", json={"email": "second@example.test", "password": "correct-horse-battery-2"})
            self.assertEqual(b.status_code, 200, b.text)
            token_a = a.json()["access_token"]
            token_b = b.json()["access_token"]
            self.assertNotEqual(a.json()["user"]["workspace_id"], b.json()["user"]["workspace_id"])
            headers_a = {"Authorization": f"Bearer {token_a}"}
            headers_b = {"Authorization": f"Bearer {token_b}"}
            self.assertEqual(self.client.get("/api/auth/me", headers=headers_a).json()["user"]["email"], "first@example.test")
            self.assertEqual(len(self.client.get("/api/agents", headers=headers_a).json()["agents"]), 2)
            create = self.client.post("/api/experiments", headers=headers_a, json={
                "title": "private workspace run", "mode": "demo", "suite_id": "coding-10",
                "agent_ids": ["agent-react"], "task_ids": ["coding-001"], "repetitions": 1,
                "faults": {"provider": False, "poison": False, "latency": False},
            })
            self.assertEqual(create.status_code, 200, create.text)
            experiment_id = create.json()["experiment_id"]
            # WebSocket subscriptions must enforce tenant ownership too; an
            # authenticated user from workspace B cannot subscribe to A's run.
            with self.assertRaises(WebSocketDisconnect):
                with self.client.websocket_connect(f"/ws/{experiment_id}?token={token_b}") as socket:
                    socket.receive_text()
            with self.client.websocket_connect(f"/ws/{experiment_id}?token={token_a}") as socket:
                socket.close()
            self.assertEqual(len(self.client.get("/api/experiments", headers=headers_a).json()["experiments"]), 1)
            self.assertEqual(len(self.client.get("/api/experiments", headers=headers_b).json()["experiments"]), 0)
            tenant_runs = self.client.get("/api/runs", headers=headers_a).json()["runs"]
            other_runs = self.client.get("/api/runs", headers=headers_b).json()["runs"]
            self.assertEqual(len(tenant_runs), 1)
            self.assertEqual(other_runs, [])
            self.assertIn(tenant_runs[0]["status"], {"completed", "failed"})
            self.assertEqual(self.client.get("/api/agents", headers={"Authorization": "Bearer invalid"}).status_code, 401)
            duplicate = self.client.post("/api/auth/register", json={"email": "first@example.test", "password": "correct-horse-battery-1"})
            self.assertEqual(duplicate.status_code, 409)
            bad_login = self.client.post("/api/auth/login", json={"email": "first@example.test", "password": "incorrect-password-0"})
            self.assertEqual(bad_login.status_code, 401)
            logout = self.client.post("/api/auth/logout", headers=headers_a)
            self.assertEqual(logout.status_code, 200)
            self.assertTrue(logout.json()["revoked"])
            self.assertEqual(self.client.get("/api/agents", headers=headers_a).status_code, 401)
        finally:
            rift.RIFT_AUTH_REQUIRED = old_required

    def test_signup_can_be_disabled_without_disabling_existing_login(self):
        old_signup = rift.RIFT_ALLOW_SIGNUP
        rift.RIFT_ALLOW_SIGNUP = False
        try:
            response = self.client.post("/api/auth/register", json={"email": "closed@example.test", "password": "correct-horse-battery-2"})
            self.assertEqual(response.status_code, 403)
            self.assertIn("registration is disabled", response.json()["detail"])
        finally:
            rift.RIFT_ALLOW_SIGNUP = old_signup

    def test_judge0_program_contains_hidden_task_assertions_and_network_is_disabled(self):
        task = next(item for item in rift.CODING_TASKS if item["id"] == "coding-001")
        program, tests = rift.build_judge0_program(task, "```python\ndef normalize_email(value):\n    return value.strip().lower()\n```")
        self.assertGreaterEqual(len(tests), 4)
        self.assertIn("subprocess.run", program)
        self.assertIn("RIFT_WORKER_RESULT:", program)
        self.assertIn("RIFT_RESULT:", program)
        self.assertNotIn("expected", program.split("worker =", 1)[-1].split("cases =", 1)[0])
        self.assertNotIn("exec(compile(code", program)

    def test_judge0_parent_harness_executes_candidate_and_checks_hidden_cases(self):
        import subprocess
        task = next(item for item in rift.CODING_TASKS if item["id"] == "coding-001")
        source = "def normalize_email(value):\n    return value.strip().lower()\n"
        program, _ = rift.build_judge0_program(task, source)
        completed = subprocess.run(
            [sys.executable, "-I", "-S", "-c", program],
            capture_output=True, text=True, timeout=8,
            env={"PYTHONIOENCODING": "utf-8", "PYTHONHASHSEED": "0"},
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        marker_line = next(line for line in completed.stdout.splitlines() if line.startswith("RIFT_RESULT:"))
        results = json.loads(marker_line.split(":", 1)[1])
        self.assertGreaterEqual(len(results), 4)
        self.assertTrue(all(item["passed"] for item in results), results)

    def test_judge0_sandbox_grading_uses_execution_result(self):
        task = next(item for item in rift.CODING_TASKS if item["id"] == "coding-001")
        fake_result = {
            "status": {"id": 3, "description": "Accepted"},
            "stdout": 'RIFT_RESULT:[{"name":"trims and lowercases","passed":true,"detail":"passed"},{"name":"already normalized value","passed":true,"detail":"passed"},{"name":"empty input","passed":false,"detail":"assertion returned false"},{"name":"preserves internal plus and dots","passed":true,"detail":"passed"}]',
            "time": "0.02", "memory": 1024,
        }
        async def fake_execute(program):
            return fake_result
        with patch.object(rift, "judge0_execute", fake_execute):
            grade = asyncio.run(rift.grade_code_in_sandbox(task, "def normalize_email(value):\n    return value.strip().lower()"))
        self.assertEqual(grade["validation_status"], "executed")
        self.assertAlmostEqual(grade["quality"], 0.75)
        self.assertEqual(grade["grader_type"], "code_sandbox")

    def test_judge0_submission_enforces_network_off_and_resource_limits(self):
        old = (rift.JUDGE0_API_URL, rift.JUDGE0_API_KEY, rift.JUDGE0_RAPIDAPI_HOST, rift.JUDGE0_RAPIDAPI_KEY)
        captured = {}
        class FakeResponse:
            def raise_for_status(self): return None
            def json(self): return {"status": {"id": 3, "description": "Accepted"}, "stdout": "ok"}
        class FakeClient:
            def __init__(self, **kwargs): captured["client"] = kwargs
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, url, params, headers, json):
                captured.update({"url": url, "params": params, "headers": headers, "body": json})
                return FakeResponse()
        try:
            rift.JUDGE0_API_URL = "https://judge0.example/api"
            rift.JUDGE0_API_KEY = "test-token"
            with patch.object(rift.httpx, "AsyncClient", FakeClient):
                result = asyncio.run(rift.judge0_execute("print('ok')"))
            self.assertEqual(result["status"]["id"], 3)
            self.assertFalse(captured["body"]["enable_network"])
            self.assertEqual(captured["body"]["cpu_time_limit"], 2)
            self.assertEqual(captured["body"]["memory_limit"], 131072)
            self.assertEqual(captured["headers"]["X-Auth-Token"], "test-token")
        finally:
            rift.JUDGE0_API_URL, rift.JUDGE0_API_KEY, rift.JUDGE0_RAPIDAPI_HOST, rift.JUDGE0_RAPIDAPI_KEY = old

    def test_research_evidence_judge_rejects_unquoted_or_unknown_source_citations(self):
        task = {"id": "research-001", "prompt": "Verify claim"}
        sources = [{"title": "Docs", "url": "https://docs.example.com/guide", "content": "The service uses a 2 second timeout and retries once.", "synthetic": False}]
        fake_response_data = {"choices": [{"message": {"content": json.dumps({"claims": [
            {"claim": "The service uses a two second timeout", "status": "supported", "source_url": "https://docs.example.com/guide", "quote": "The service uses a 2 second timeout"},
            {"claim": "The service uses three retries", "status": "supported", "source_url": "https://evil.example/lie", "quote": "The service uses three retries"},
        ], "summary": "One verified claim."})}}], "usage": {"prompt_tokens": 100, "completion_tokens": 40}}
        class FakeResponse:
            def raise_for_status(self): return None
            def json(self): return fake_response_data
        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, *args, **kwargs): return FakeResponse()
        old = (rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY)
        try:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY = "https://bifrost.example/v1", "fake"
            with patch.object(rift.httpx, "AsyncClient", FakeClient):
                result = asyncio.run(rift.grade_research_with_evidence_judge(task, "Some answer", sources, {"id": "run-1", "experiment_id": "exp-1", "task_id": task["id"], "agent_id": "agent-1", "budgets": {}}))
            self.assertEqual(result["claims"][0]["status"], "supported")
            self.assertTrue(result["claims"][0]["quote_verified"])
            self.assertEqual(result["claims"][1]["status"], "insufficient")
            self.assertFalse(result["claims"][1]["quote_verified"])
            self.assertEqual(result["supported_claims"], 1)
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY = old


    def test_adapter_egress_rejects_private_dns_and_requires_production_allowlist(self):
        old = (rift.RIFT_AUTH_REQUIRED, set(rift.RIFT_ADAPTER_ALLOWED_HOSTS), rift.RIFT_ALLOW_LOCAL_ADAPTERS)
        try:
            rift.RIFT_AUTH_REQUIRED = True
            rift.RIFT_ADAPTER_ALLOWED_HOSTS = {"agent.example.com"}
            rift.RIFT_ALLOW_LOCAL_ADAPTERS = False
            with patch.object(rift.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
                with self.assertRaisesRegex(RuntimeError, "private"):
                    asyncio.run(rift.validate_adapter_egress("https://agent.example.com/run"))
            with self.assertRaisesRegex(RuntimeError, "RIFT_ADAPTER_ALLOWED_HOSTS"):
                asyncio.run(rift.validate_adapter_egress("https://other.example.com/run"))
            with patch.object(rift.socket, "getaddrinfo", return_value=[(2, 1, 6, "", ("8.8.8.8", 443))]):
                asyncio.run(rift.validate_adapter_egress("https://agent.example.com/run"))
        finally:
            rift.RIFT_AUTH_REQUIRED, rift.RIFT_ADAPTER_ALLOWED_HOSTS, rift.RIFT_ALLOW_LOCAL_ADAPTERS = old

    def test_invalid_adapter_event_token_is_rejected_before_route_execution(self):
        old = rift.RIFT_AUTH_REQUIRED
        rift.RIFT_AUTH_REQUIRED = True
        try:
            response = self.client.post("/api/adapter/runs/run-nope/events", headers={"x-rift-adapter-token": "invalid"}, json={"type": "tool.call.completed", "payload": {}})
            self.assertEqual(response.status_code, 401)
        finally:
            rift.RIFT_AUTH_REQUIRED = old

    def test_redis_rate_limiter_uses_atomic_shared_window(self):
        old_redis = rift._RATE_REDIS
        captured = {}
        class FakeRedis:
            async def eval(self, script, key_count, key, now_ms, window_ms, limit, member):
                captured.update({"script": script, "key": key, "window_ms": window_ms, "limit": limit, "member": member})
                return [0, 23]
        class Request:
            client = type("Client", (), {"host": "203.0.113.17"})()
        try:
            rift._RATE_REDIS = FakeRedis()
            allowed, retry = asyncio.run(rift._rate_limit_request(Request(), "auth"))
            self.assertFalse(allowed)
            self.assertEqual(retry, 23)
            self.assertIn("ZREMRANGEBYSCORE", captured["script"])
            self.assertEqual(captured["window_ms"], 300000)
            self.assertEqual(captured["limit"], 8)
            self.assertNotIn("203.0.113.17", captured["key"])
        finally:
            rift._RATE_REDIS = old_redis

    def test_rate_limit_returns_429_and_retry_after(self):
        with patch.object(rift, "_rate_limit_key", return_value=(False, 17)):
            response = self.client.get("/api/agents")
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers.get("retry-after"), "17")

    def test_judge0_rapidapi_uses_rapidapi_key_header(self):
        old = (rift.JUDGE0_API_URL, rift.JUDGE0_API_KEY, rift.JUDGE0_RAPIDAPI_HOST, rift.JUDGE0_RAPIDAPI_KEY)
        captured = {}
        class FakeResponse:
            def raise_for_status(self): return None
            def json(self): return {"status": {"id": 3, "description": "Accepted"}, "stdout": "ok"}
        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, url, params, headers, json):
                captured.update(headers)
                return FakeResponse()
        try:
            rift.JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com"
            rift.JUDGE0_API_KEY = "legacy-token"
            rift.JUDGE0_RAPIDAPI_KEY = "rapid-key"
            rift.JUDGE0_RAPIDAPI_HOST = "judge0-ce.p.rapidapi.com"
            with patch.object(rift.httpx, "AsyncClient", FakeClient):
                asyncio.run(rift.judge0_execute("print('safe')"))
            self.assertEqual(captured.get("X-RapidAPI-Key"), "rapid-key")
            self.assertEqual(captured.get("X-RapidAPI-Host"), "judge0-ce.p.rapidapi.com")
            self.assertNotIn("X-Auth-Token", captured)
        finally:
            rift.JUDGE0_API_URL, rift.JUDGE0_API_KEY, rift.JUDGE0_RAPIDAPI_HOST, rift.JUDGE0_RAPIDAPI_KEY = old

    def test_production_startup_requires_stable_auth_signing_secret(self):
        old_env = os.environ.get("ENVIRONMENT")
        old_configured = rift.RIFT_AUTH_SECRET_CONFIGURED
        old_required = rift.RIFT_AUTH_REQUIRED
        try:
            os.environ["ENVIRONMENT"] = "production"
            rift.RIFT_AUTH_REQUIRED = True
            rift.RIFT_AUTH_SECRET_CONFIGURED = False
            async def start():
                async with rift.lifespan(rift.app):
                    pass
            with self.assertRaisesRegex(RuntimeError, "RIFT_AUTH_SECRET"):
                asyncio.run(start())
        finally:
            rift.RIFT_AUTH_SECRET_CONFIGURED = old_configured
            rift.RIFT_AUTH_REQUIRED = old_required
            if old_env is None:
                os.environ.pop("ENVIRONMENT", None)
            else:
                os.environ["ENVIRONMENT"] = old_env


    def test_external_adapter_derives_unique_calls_steps_and_usage_from_framework_events(self):
        events = [
            {"type": "agent.step.started", "payload": {"step_id": "s-1", "step": "plan"}},
            {"type": "agent.step.completed", "payload": {"step_id": "s-1", "step": "plan"}},
            {"type": "tool.call.started", "payload": {"tool_call_id": "t-1", "tool": "search"}},
            {"type": "tool.call.completed", "payload": {"tool_call_id": "t-1", "tool": "search"}},
            {"type": "model.request.completed", "payload": {"call_id": "m-1", "usage": {"prompt_tokens": 100, "completion_tokens": 25, "cost_usd": 0.003}}},
        ]
        class FakeResponse:
            def raise_for_status(self): return None
            def json(self): return {"output": "answer", "events": events, "provider": "test-provider", "trace_id": "trace-1"}
        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, *args, **kwargs): return FakeResponse()
        async def exercise():
            captured = []
            async def emit(kind, payload): captured.append((kind, payload))
            with patch.object(rift, "validate_adapter_egress", lambda endpoint: asyncio.sleep(0)), patch.object(rift.httpx, "AsyncClient", FakeClient):
                output, metadata = await rift.execute_webhook_agent(
                    {"endpoint": "https://agent.example.com/run", "model": "test", "name": "Adapter"},
                    {"id": "coding-001", "title": "Task", "prompt": "Do task", "benchmark_category": "coding"},
                    {"id": "run-1", "mode": "live", "seed": 1, "faults": {}, "budgets": {}, "repetition": 1},
                    [], emit,
                )
            return output, metadata, captured
        output, metadata, captured = asyncio.run(exercise())
        self.assertEqual(output, "answer")
        self.assertEqual(metadata["steps"], 1)
        self.assertEqual(metadata["tool_calls"], 1)
        self.assertEqual(metadata["model_calls"], 1)
        self.assertEqual(metadata["input_tokens"], 100)
        self.assertEqual(metadata["output_tokens"], 25)
        self.assertAlmostEqual(metadata["total_cost_usd"], 0.003)
        self.assertEqual(metadata["trace_id"], "trace-1")
        self.assertEqual(metadata["reported_event_count"], 5)

    def test_support_policy_judge_requires_exact_evidence_for_passed_criteria(self):
        output = "I understand the issue. Please use the secure reset page. Never share your OTP. Please send your password."
        criteria = [
            {"id": "empathy", "passed": True, "evidence_quote": "I understand the issue.", "reason": "Acknowledges concern"},
            {"id": "policy_accuracy", "passed": True, "evidence_quote": "use the secure reset page", "reason": "Correct next step"},
            {"id": "no_false_promises", "passed": True, "evidence_quote": "I will refund you today", "reason": "No promise found"},
            {"id": "privacy_safety", "passed": True, "evidence_quote": "Never share your OTP.", "reason": "Protects secret"},
            {"id": "next_step", "passed": True, "evidence_quote": "use the secure reset page", "reason": "Actionable"},
            {"id": "clarity", "passed": True, "evidence_quote": "I understand the issue.", "reason": "Clear"},
        ]
        fake_response = {"choices": [{"message": {"content": json.dumps({"criteria": criteria, "risk_flags": [{"quote": "I will refund you today", "reason": "Unsupported refund promise"}, {"quote": "Please send your password", "reason": "Unverified password request"}], "summary": "One unsupported quote was detected."})}}], "usage": {"prompt_tokens": 50, "completion_tokens": 20}}
        class FakeResponse:
            def raise_for_status(self): return None
            def json(self): return fake_response
        class FakeClient:
            def __init__(self, **kwargs): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return None
            async def post(self, *args, **kwargs): return FakeResponse()
        old = (rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY)
        try:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY = "https://bifrost.example/v1", "test"
            with patch.object(rift.httpx, "AsyncClient", FakeClient):
                result = asyncio.run(rift.grade_support_with_policy_judge({"prompt": "Help the user reset safely", "evaluation": {}}, output, {"id": "run-s", "experiment_id": "exp-s", "task_id": "support-004", "agent_id": "agent-a", "budgets": {}}))
            self.assertEqual(result["status"], "evaluated")
            self.assertFalse(next(x for x in result["criteria"] if x["id"] == "no_false_promises")["passed"])
            self.assertEqual(result["passed_criteria"], 5)
            self.assertEqual(result["total_criteria"], 6)
            self.assertEqual(len(result["risk_flags"]), 1)
            self.assertEqual(len(result["unverified_risk_flags"]), 1)
            self.assertTrue(result["risk_flags"][0]["quote_verified"])
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY = old


if __name__ == "__main__":
    unittest.main()
