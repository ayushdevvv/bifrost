#!/usr/bin/env python3
"""Run and publish a real RIFT Coding-10 benchmark.

The script creates/reuses two externally hosted agent configurations:
- Plain Python one-pass loop
- LangGraph plan -> implement -> validate -> review graph

It launches 2 x 10 tasks x 5 repetitions twice: clean, then with the
agent-side syntax-check tool unavailable. It only writes a report after the
RIFT API returns actual live run records. No fixture or synthetic score is
created by this script.

Required environment:
  RIFT_API_URL          RIFT API base, e.g. https://rift-api.example.com/api
  RIFT_AGENT_BASE_URL   HTTPS base URL of examples.live_agents service
  RIFT_LIVE_MODEL       Bifrost model alias used by both agents
  RIFT_ACCESS_TOKEN     Optional, only if RIFT auth is enabled

The adapter service itself also needs BIFROST_BASE_URL, BIFROST_API_KEY,
BIFROST_MODEL and (recommended for Pareto cost) MODEL_INPUT_COST_PER_1M and
MODEL_OUTPUT_COST_PER_1M.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
TASK_IDS = [f"coding-{index:03d}" for index in range(1, 11)]
TERMINAL = {"completed", "failed", "partial", "cancelled"}


class ApiError(RuntimeError):
    pass


def normalize_api_url(value: str) -> str:
    value = value.rstrip("/")
    if not value:
        raise ApiError("Set RIFT_API_URL, including the /api path.")
    return value if value.endswith("/api") else f"{value}/api"


def request_json(base: str, path: str, method: str = "GET", payload: dict[str, Any] | None = None, token: str = "") -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{base}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:1500]
        raise ApiError(f"{method} {path} returned HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ApiError(f"Could not reach {method} {path}: {exc}") from exc
    try:
        parsed = json.loads(raw.decode("utf-8")) if raw else {}
    except json.JSONDecodeError as exc:
        raise ApiError(f"{method} {path} returned invalid JSON") from exc
    if not isinstance(parsed, dict):
        raise ApiError(f"{method} {path} returned an unexpected response")
    return parsed


def ensure_agent(base: str, token: str, name: str, framework: str, endpoint: str, description: str, color: str) -> str:
    current = request_json(base, "/agents", token=token).get("agents", [])
    for agent in current:
        if agent.get("name") == name and agent.get("endpoint") == endpoint:
            print(f"Reusing agent: {name} ({agent['id']})")
            return str(agent["id"])
    created = request_json(base, "/agents", method="POST", token=token, payload={
        "name": name,
        "kind": "webhook",
        "framework": framework,
        "description": description,
        "model": "Bifrost · live",
        "endpoint": endpoint,
        "color": color,
    })
    agent = created.get("agent") or {}
    if not agent.get("id"):
        raise ApiError(f"RIFT did not return an agent ID for {name}.")
    print(f"Registered agent: {name} ({agent['id']})")
    return str(agent["id"])


def wait_for_experiment(base: str, token: str, experiment_id: str, poll_seconds: int, timeout_seconds: int) -> dict[str, Any]:
    started = time.monotonic()
    last_status = None
    while time.monotonic() - started < timeout_seconds:
        detail = request_json(base, f"/experiments/{experiment_id}", token=token)
        status = str(detail.get("status", "unknown"))
        if status != last_status:
            runs = detail.get("runs", [])
            completed = sum(1 for run in runs if run.get("status") == "completed")
            failed = sum(1 for run in runs if run.get("status") == "failed")
            print(f"{experiment_id}: {status} · {completed} completed · {failed} failed · {len(runs)} total")
            last_status = status
        if status in TERMINAL:
            return detail
        time.sleep(max(2, poll_seconds))
    raise ApiError(f"Timed out waiting for experiment {experiment_id}. It may still be running in RIFT.")


def launch_and_collect(base: str, token: str, title: str, agent_ids: list[str], model: str, repetitions: int, fault_tool: bool, poll_seconds: int, timeout_seconds: int) -> dict[str, Any]:
    fault_label = "tool-outage" if fault_tool else "clean"
    experiment = request_json(base, "/experiments", method="POST", token=token, payload={
        "title": title,
        "mode": "live",
        "suite_id": "coding-10",
        "agent_ids": agent_ids,
        "models": [model],
        "task_ids": TASK_IDS,
        "evidence_mode": "snapshot",
        "repetitions": repetitions,
        "severity": 100 if fault_tool else 0,
        "master_seed": 42017,
        "faults": {
            "provider": False,
            "poison": False,
            "latency": False,
            "tool_unavailable": fault_tool,
            "misleading_instruction": False,
        },
        "budgets": {
            "max_steps": 20,
            "max_tool_calls": 10,
            "timeout_seconds": 150,
            "max_cost_usd": 1.0,
        },
    })
    experiment_id = experiment.get("experiment_id")
    if not experiment_id:
        raise ApiError(f"RIFT did not create the {fault_label} experiment: {experiment}")
    detail = wait_for_experiment(base, token, str(experiment_id), poll_seconds, timeout_seconds)
    report = request_json(base, f"/experiments/{experiment_id}/report", token=token)
    runs = detail.get("runs", [])
    expected = len(agent_ids) * len(TASK_IDS) * repetitions
    counts = {
        "expected_runs": expected,
        "received_runs": len(runs),
        "completed_runs": sum(1 for run in runs if run.get("status") == "completed"),
        "failed_runs": sum(1 for run in runs if run.get("status") == "failed"),
        "other_runs": sum(1 for run in runs if run.get("status") not in {"completed", "failed"}),
    }
    return {
        "label": fault_label,
        "experiment_id": experiment_id,
        "status": detail.get("status"),
        "mode": detail.get("mode"),
        "suite_id": detail.get("suite_id"),
        "models": detail.get("models"),
        "task_ids": detail.get("task_ids"),
        "repetitions": detail.get("repetitions"),
        "faults": detail.get("faults"),
        "counts": counts,
        "results": report.get("results", []),
        "runs": [{
            "agent_id": run.get("agent_id"),
            "agent_name": run.get("agent_name"),
            "task_id": run.get("task_id"),
            "repetition": run.get("repetition"),
            "status": run.get("status"),
            "result": run.get("result") or {},
        } for run in runs],
    }


def pct(value: Any) -> str:
    return "—" if value is None else f"{float(value):.1f}%"


def usd(value: Any) -> str:
    return "—" if value is None else f"${float(value):.6f}"


def make_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# RIFT live Coding-10 benchmark",
        "",
        f"Published from live RIFT run on {report['generated_at']}.",
        "",
        "## Protocol",
        "",
        f"- Model route: `{report['model']}`",
        f"- Repetitions: {report['repetitions']} per task and agent configuration",
        f"- Tasks: {len(TASK_IDS)} Coding-10 tasks",
        "- Agent configurations: vanilla Python loop and LangGraph plan/implement/validate/review",
        "- Clean condition: no injected failure",
        "- Fault condition: the agent-side `python_syntax_check` tool returns an injected unavailable result; final code is still independently executed by Judge0",
        "- Both adapters use the same Bifrost model route and RIFT task suite. Their prompts/orchestration differ intentionally because the benchmark compares complete agent configurations.",
        "- This is one observed run batch. It is not a population-level confidence interval and does not prove general superiority.",
        "",
    ]
    for condition in report["conditions"]:
        lines.extend([
            f"## {condition['label'].replace('-', ' ').title()} condition",
            "",
            f"Experiment: `{condition['experiment_id']}` · status: **{condition['status']}**",
            f"Run coverage: {condition['counts']['completed_runs']}/{condition['counts']['expected_runs']} completed; {condition['counts']['failed_runs']} failed; {condition['counts']['other_runs']} incomplete.",
            "",
            "| Agent configuration | Task success | pass@5 | pass^5 | Avg steps | Avg tool calls | Avg tokens | Avg latency | Cost / verified success |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ])
        for item in condition["results"]:
            latency = item.get("latency_avg_ms")
            latency_text = f"{round(latency)} ms" if latency is not None else "—"
            lines.append(
                f"| {item.get('agent', item.get('agent_id'))} | {pct(item.get('success_rate'))} | {pct(item.get('pass_at_k_pct'))} | {pct(item.get('pass_power_k_pct'))} | {item.get('steps_avg') if item.get('steps_avg') is not None else '—'} | {item.get('tool_calls_avg') if item.get('tool_calls_avg') is not None else '—'} | {item.get('tokens_avg') if item.get('tokens_avg') is not None else '—'} | {latency_text} | {usd(item.get('cost_per_success_usd'))} |"
            )
        if not condition["results"]:
            lines.append("| No report data | — | — | — | — | — | — | — | — |")
        lines.append("")
    lines.extend([
        "## Metric definitions",
        "",
        "- `pass@k`: percentage of task/configuration groups with at least one successful run among k repetitions.",
        "- `pass^k`: percentage of task/configuration groups where all k repetitions succeeded. Earlier RIFT UI versions labelled this `reliability@k`; the mathematical interpretation here is pass^k.",
        "- Task success and pass metrics are task-level. They do not describe an isolated model request.",
        "- Cost is shown only when every run in the group has actual provider-reported or explicitly configured per-token pricing. Unknown costs stay blank.",
        "",
        "## Reproducibility and limitations",
        "",
        f"Seed: `{report['seed']}`. RIFT preserves each task's run seed and the fault configuration in its run record. Model outputs can still vary between repeated executions; a seed does not make hosted model sampling deterministic.",
        "Judge0 runs candidate Python code with network disabled and per-submission resource limits. This report uses actual live-mode records, not RIFT's demo fixtures. Confirm each row has completed runs and `validation_status=executed` in the attached JSON before presenting it as an executed benchmark.",
        "The outage is a controlled failure of the example agents' syntax-check tool, not a Bifrost provider outage. The adapters recover by asking the same model to review manually. Provider failover must be tested separately with the dedicated Bifrost fault proxy.",
        "",
    ])
    return "\n".join(lines)


def assert_real_coding10_records(condition: dict[str, Any], tool_fault_expected: bool = False) -> None:
    """Reject fixture, failed-provider or unexecuted sandbox records before publishing."""
    expected = condition["counts"]["expected_runs"]
    if len(condition.get("runs", [])) != expected:
        raise ApiError(f"{condition['label']} returned {len(condition.get('runs', []))}/{expected} run records; refusing to publish or continue.")
    problems = []
    for run in condition["runs"]:
        result = run.get("result") or {}
        run_name = f"{run.get('agent_name')} / {run.get('task_id')} / rep {run.get('repetition')}"
        if run.get("status") != "completed":
            problems.append(f"{run_name}: status={run.get('status')}")
        if result.get("mode") != "live" or result.get("simulated") is True:
            problems.append(f"{run_name}: result is not verified live execution")
        if result.get("validation_status") != "executed":
            problems.append(f"{run_name}: sandbox validation={result.get('validation_status')}")
        if int(result.get("model_calls") or 0) < 1:
            problems.append(f"{run_name}: no observed model calls")
        if tool_fault_expected and result.get("tool_unavailable_injected") is not True:
            problems.append(f"{run_name}: requested tool outage was not observed")
    if problems:
        raise ApiError("Live Coding-10 verification failed; inspect the experiment in RIFT. First issues: " + "; ".join(problems[:6]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repetitions", type=int, default=5, choices=range(1, 6))
    parser.add_argument("--poll-seconds", type=int, default=5)
    parser.add_argument("--timeout-hours", type=float, default=4.0)
    parser.add_argument("--output-dir", default=str(ROOT / "artifacts"))
    args = parser.parse_args()

    try:
        api_base = normalize_api_url(os.getenv("RIFT_API_URL", ""))
        agent_base = os.getenv("RIFT_AGENT_BASE_URL", "").rstrip("/")
        model = os.getenv("RIFT_LIVE_MODEL", os.getenv("BIFROST_MODEL", "")).strip()
        token = os.getenv("RIFT_ACCESS_TOKEN", "").strip()
        if not agent_base.startswith("https://"):
            raise ApiError("Set RIFT_AGENT_BASE_URL to the public HTTPS URL of the deployed example live-agent service.")
        if not model:
            raise ApiError("Set RIFT_LIVE_MODEL to an actual model alias configured in Bifrost.")
        timeout_seconds = int(args.timeout_hours * 3600)
        print(f"RIFT API: {api_base}")
        print(f"Agent adapter: {agent_base}")
        print(f"Model: {model}")
        print(f"Protocol: 2 agent configurations × 10 tasks × {args.repetitions} repetitions × 2 conditions")
        print("Total planned task runs:", 2 * 10 * args.repetitions * 2)

        health = request_json(api_base, "/health", token=token)
        if health.get("status") != "ok":
            raise ApiError(f"RIFT health check did not return ok: {health}")
        integration = request_json(api_base, "/integrations", token=token)
        if health.get("security", {}).get("authentication_required") and not token:
            raise ApiError("RIFT authentication is enabled. Set RIFT_ACCESS_TOKEN, or set RIFT_AUTH_REQUIRED=false in Render for the temporary shared demo workspace.")
        if not integration.get("bifrost", {}).get("configured"):
            raise ApiError("RIFT backend needs BIFROST_BASE_URL and BIFROST_API_KEY configured before live Coding-10.")
        if not integration.get("evaluation", {}).get("judge0_configured"):
            raise ApiError("RIFT backend needs JUDGE0_API_URL configured for isolated live Coding-10 grading.")

        adapter_health = request_json(agent_base, "/health")
        if adapter_health.get("status") != "ok" or not adapter_health.get("bifrost_configured"):
            raise ApiError("The live-agent service is reachable but does not report working Bifrost configuration. Set BIFROST_BASE_URL and BIFROST_API_KEY on the adapter service.")

        vanilla_id = ensure_agent(api_base, token, "RIFT Vanilla Coding Loop", "Plain Python", f"{agent_base}/vanilla/run", "Single-pass generation with a syntax-check tool and optional manual repair.", "cyan")
        graph_id = ensure_agent(api_base, token, "RIFT LangGraph Coding Agent", "LangGraph", f"{agent_base}/langgraph/run", "Plan, implement, tool validation and review using a LangGraph state graph.", "violet")
        agent_ids = [vanilla_id, graph_id]

        conditions = []
        clean = launch_and_collect(api_base, token, "Coding-10 · live clean baseline", agent_ids, model, args.repetitions, False, args.poll_seconds, timeout_seconds)
        assert_real_coding10_records(clean, tool_fault_expected=False)
        conditions.append(clean)
        tool_outage = launch_and_collect(api_base, token, "Coding-10 · live syntax-tool outage", agent_ids, model, args.repetitions, True, args.poll_seconds, timeout_seconds)
        assert_real_coding10_records(tool_outage, tool_fault_expected=True)
        conditions.append(tool_outage)

        report = {
            "title": "RIFT live Coding-10 comparison",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "repetitions": args.repetitions,
            "seed": 42017,
            "task_ids": TASK_IDS,
            "agent_ids": agent_ids,
            "adapter_base_url": agent_base,
            "conditions": conditions,
            "health": health,
            "pricing_configured_on_adapter": bool(os.getenv("MODEL_INPUT_COST_PER_1M") and os.getenv("MODEL_OUTPUT_COST_PER_1M")),
        }
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        json_path = output_dir / f"coding10-live-{stamp}.json"
        md_path = output_dir / f"coding10-live-{stamp}.md"
        json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        md_path.write_text(make_markdown(report), encoding="utf-8")
        print(f"\nSaved actual run data: {json_path}")
        print(f"Saved publication draft: {md_path}")
        all_complete = all(
            item["status"] == "completed" and item["counts"]["completed_runs"] == item["counts"]["expected_runs"]
            for item in conditions
        )
        if not all_complete:
            print("WARNING: One or more benchmark conditions are incomplete. Do not publish aggregate numbers as a complete run.", file=sys.stderr)
            return 2
        return 0
    except ApiError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
