"""Smoke tests for the RIFT Arena hackathon MVP.

Run from the repository root with: python -m unittest discover -s backend/tests -v
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

TMP = tempfile.TemporaryDirectory(prefix="rift-tests-")
os.environ["RIFT_DB_PATH"] = str(Path(TMP.name) / "test.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
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

    def test_health_and_static_frontend(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        page = self.client.get("/")
        self.assertEqual(page.status_code, 200)
        self.assertIn("RIFT Arena", page.text)
        self.assertEqual(self.client.get("/assets/contact2.jpg").status_code, 200)
        self.assertEqual(self.client.get("/assets/agent-benchmarking.jpg").status_code, 200)
        self.assertEqual(self.client.get("/guides/AGENT_ADAPTER.md").status_code, 200)
        self.assertEqual(self.client.get("/api/docs").status_code, 200)

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
        self.assertEqual(result["provider"], "Demo evidence fixtures")
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
        self.assertIn("80-run limit", too_many_runs.json()["detail"])


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
            self.assertEqual(meta["provider"], "Demo evidence fixtures")
            self.assertTrue(model["simulated"])
            self.assertIsNone(model["input_tokens"])
            self.assertTrue(output.startswith("Demo analysis:"))
            self.assertTrue(sources)
        finally:
            rift.BIFROST_BASE_URL, rift.BIFROST_API_KEY, rift.TAVILY_API_KEY = old

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


if __name__ == "__main__":
    unittest.main()
