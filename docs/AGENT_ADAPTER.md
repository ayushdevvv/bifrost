# RIFT framework-neutral agent adapter

RIFT benchmarks the complete agent configuration: its orchestration strategy, prompt, memory, tool use, retry behaviour and chosen model route. An existing agent does not need to be rewritten in LangGraph, CrewAI, AutoGen, PydanticAI or another framework. Add a thin HTTP adapter around the agent's current invocation and return its observable execution data.

## Adapter lifecycle

1. RIFT sends one task envelope per run, with the exact task, category, seed, repetition, shared evidence snapshot (for research), budgets and controlled-fault context.
2. Your adapter invokes the existing agent as-is. Enforce the received step, tool-call, time and cost budgets inside the agent; the RIFT HTTP timeout is an outer limit, not a substitute for internal budget enforcement.
3. Emit observable step, tool and model events to the authenticated event sink while the agent is running. This makes execution visible in RIFT's run timeline and live arena.
4. Return the final answer plus usage counters and a bounded event list. Batch events are also accepted when live event delivery is not configured.

## Request envelope

```json
{
  "run_id": "run-123",
  "task_id": "coding-001",
  "task": {
    "title": "Normalize an email address",
    "objective": "Implement normalize_email(value)...",
    "category": "coding",
    "difficulty": "Easy"
  },
  "evidence": [],
  "context": "Controlled fault context, if any",
  "budgets": {
    "max_steps": 20,
    "max_tool_calls": 15,
    "timeout_seconds": 120,
    "max_cost_usd": 0.10
  },
  "environment": {
    "mode": "live",
    "seed": 12345,
    "repetition": 2,
    "fault_injections": {"provider": false, "tool_unavailable": false}
  },
  "event_sink": {
    "url": "https://rift-api.example/api/adapter/runs/run-123/events",
    "token": "per-run-token",
    "delivery": "POST {type, payload} while the agent runs"
  }
}
```

`event_sink.url` and `event_sink.token` are populated when the backend has `RIFT_PUBLIC_API_BASE_URL` configured. The token is scoped to one run. Send `POST` requests with header `x-rift-adapter-token: <token>` and JSON body:

```json
{
  "type": "tool.call.completed",
  "payload": {"tool": "search_docs", "status": "success", "duration_ms": 84}
}
```

Event types may contain letters, digits, `_`, `.`, `:` and `-`. Each payload is limited to 16 KB, and each run accepts at most 500 events. Use meaningful, ordered events such as:

- `agent.step.started` / `agent.step.completed`
- `tool.call.started` / `tool.call.completed` / `tool.call.failed`
- `model.request.started` / `model.request.completed` / `model.request.failed`
- `memory.read` / `memory.write`
- `agent.retry` / `agent.fallback`
- `agent.run.completed`

Do not send hidden chain-of-thought. Emit observable action summaries, tool names, redacted inputs/outputs, statuses, timing and retry metadata only.

The full `environment.fault_injections` object is included in the envelope. RIFT can directly add untrusted task context and tool-unavailable conditions to the task it sends. A framework-neutral adapter should make its own agent respect those conditions and report the observable fallback/retry events. A true upstream provider outage must be introduced at the provider boundary (for example, through a dedicated Bifrost test deployment or the RIFT fault proxy); RIFT cannot forcibly interrupt an arbitrary external agent's private provider client without that routing cooperation. Do not report provider recovery unless the trace contains an observed fallback or successful recovery event.

## Response contract

```json
{
  "output": "Final answer or implementation...",
  "steps": 6,
  "tool_calls": 3,
  "model_calls": 4,
  "input_tokens": 1200,
  "output_tokens": 450,
  "cost_usd": 0.012,
  "tool_cost_usd": 0.001,
  "provider": "anthropic",
  "trace_id": "optional-otel-trace-id",
  "events": [
    {"type": "agent.step.started", "payload": {"step": "plan"}},
    {"type": "tool.call.completed", "payload": {"tool": "search_docs", "status": "success"}}
  ]
}
```

`output` is required. Counters and cost fields are optional. RIFT derives step, tool-call and model-call counts from returned event types when the corresponding top-level counters are absent. It accepts usage under `usage.input_tokens`, `usage.output_tokens`, `usage.cost_usd` and `usage.total_cost_usd` as well. Unknown usage remains unknown; RIFT does not invent token or cost estimates.

## Minimal FastAPI adapter

```python
from fastapi import FastAPI
from pydantic import BaseModel
import httpx

app = FastAPI(title="Existing agent adapter")

class Envelope(BaseModel):
    run_id: str
    task_id: str
    task: dict
    evidence: list[dict] = []
    budgets: dict = {}
    environment: dict = {}
    event_sink: dict = {}
    context: str = ""

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/run")
async def run_agent(payload: Envelope):
    # Invoke your existing agent here. It may be LangGraph, CrewAI,
    # AutoGen, PydanticAI, a home-grown loop, or plain Python.
    events = []
    sink = payload.event_sink

    async def report(kind: str, details: dict):
        event = {"type": kind, "payload": details}
        events.append(event)
        if sink.get("url") and sink.get("token"):
            try:
                async with httpx.AsyncClient(timeout=2) as client:
                    await client.post(
                        sink["url"], json=event,
                        headers={"x-rift-adapter-token": sink["token"]},
                    )
            except httpx.HTTPError:
                # Preserve the final batch trace even if live event delivery fails.
                pass

    await report("agent.step.started", {"step": "invoke-existing-agent"})
    answer = await existing_agent_invoke(
        objective=payload.task["objective"],
        evidence=payload.evidence,
        budgets=payload.budgets,
        context=payload.context,
        seed=payload.environment.get("seed"),
    )
    await report("agent.step.completed", {"step": "invoke-existing-agent"})
    await report("agent.run.completed", {"status": "success"})

    return {
        "output": answer,
        "steps": 2,
        "tool_calls": 0,
        "events": events,
    }
```

Replace `existing_agent_invoke` with the call to your current agent. It is intentionally not a RIFT-specific framework implementation.

## Framework-specific wrappers

A wrapper should be thin: call the framework's current entry point, subscribe to its public callbacks/tracing hooks, normalise observable events to the RIFT event schema, and return the final response and usage. Keep framework-specific code inside your adapter service; RIFT receives the same HTTP contract regardless of framework.

## Local and production setup

Register the HTTPS `/run` endpoint in **Agent registry**. Remote endpoints must use HTTPS; exact loopback hosts are allowed for local development.

Set this backend environment variable if you want adapters to push live events during execution:

```env
RIFT_PUBLIC_API_BASE_URL=https://your-rift-api.example
```

The server creates a per-run token using `RIFT_ADAPTER_EVENT_SECRET`. Set a stable secret explicitly for multi-instance deployments and restarts:

```env
RIFT_ADAPTER_EVENT_SECRET=use-a-long-random-secret
```

Keep adapter endpoints private where possible, redact customer data and credentials from event payloads, and enforce each budget inside the agent itself.

## Real model usage and Bifrost fault correlation

RIFT does not infer actual token or cost usage from text length. Have the adapter report the usage returned by the model provider/framework. The shared helper collects token counts and cost when Bifrost includes them in its response and emits matching start/completion events:

```python
from examples.rift_instrumentation import RiftReporter

reporter = RiftReporter(payload.model_dump())
result = await reporter.call_bifrost(
    base_url=os.environ["BIFROST_BASE_URL"],
    api_key=os.environ["BIFROST_API_KEY"],
    model=os.getenv("BIFROST_MODEL", "general"),
    messages=[{"role": "user", "content": objective}],
    call_index=1,
)
answer = result["content"]
return reporter.response(answer, provider=result["provider"], trace_id=result["trace_id"])
```

`call_bifrost` adds these fields for each request:

- Body `user`: `rift:<run_id>:<call_index>:<workspace_id>`.
- `x-request-id`: `rift-<run_id>-<call_index>`.
- `x-bf-lh-rift-run-id`, `x-bf-lh-rift-task-id` and `x-bf-lh-rift-workspace-id` headers.

For an existing framework-managed OpenAI-compatible client, replicate those body/header fields on every model call. Do not reuse a single `call_index` for multiple distinct requests; increment it for each request in the same run.

A true provider-fault experiment only works when Bifrost's selected primary route points to the RIFT fault proxy and the request carries the run-scoped `user` value. Bifrost must have a separately configured healthy fallback. The proxy injects an upstream 503 at the provider boundary; the agent should not fake an exception. RIFT counts observed recovery only after the proxy records that 503 and a later successful model completion is present in the adapter trace. See [`BIFROST_SETUP.md`](BIFROST_SETUP.md).

## Included framework adapters

- `examples/langgraph_adapter.py` subscribes to LangGraph's public `graph.astream_events(..., version="v2")` stream and normalises chain, tool and model events. Its step count reflects reported runnable/chain events, which may be more granular than conceptual agent reasoning steps.
- `examples/crewai_adapter.py` listens to CrewAI typed kickoff, agent, task, tool and LLM events. Listener tasks are drained before the adapter returns its batch trace.
- `examples/rift_instrumentation.py` provides safe event redaction, live delivery, explicit usage aggregation, and Bifrost request correlation.

Set `RIFT_AGENT_MODULE` to the Python module that exports a compiled `graph` (LangGraph example) or `crew` (CrewAI example). These are reference wrappers: you must point them at an agent implementation and check that the framework version in your environment exports the documented public events. RIFT's adapter schema remains framework-neutral.
