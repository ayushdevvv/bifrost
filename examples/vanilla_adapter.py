"""Runnable HTTP adapter skeleton for an existing framework-free agent.

Run with: uvicorn examples.vanilla_adapter:app --host 0.0.0.0 --port 9000
Register http://127.0.0.1:9000/run in RIFT's Agent registry for local testing.
Replace invoke_existing_agent() with your current agent call. The agent itself
is not required to adopt a RIFT-specific framework or SDK.
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="RIFT vanilla agent adapter")


class AdapterEnvelope(BaseModel):
    run_id: str
    task_id: str
    task: dict[str, Any]
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    context: str = ""
    budgets: dict[str, Any] = Field(default_factory=dict)
    environment: dict[str, Any] = Field(default_factory=dict)
    event_sink: dict[str, Any] = Field(default_factory=dict)


async def invoke_existing_agent(payload: AdapterEnvelope) -> tuple[str, list[dict[str, Any]]]:
    """Replace this function body with your existing agent invocation.

    Examples:
      - LangGraph: await graph.ainvoke(input_state, config=...)
      - CrewAI: await crew.akickoff(inputs=...)
      - AutoGen: await agent.run(task=...)
      - Plain Python: call your existing async function directly

    Subscribe to public callbacks/tracing hooks in the integration above this
    layer and normalise those observations to the RIFT event shape. Do not send
    private chain-of-thought; send action summaries and redacted I/O only.
    """
    objective = str(payload.task.get("objective") or payload.task.get("title") or "")
    # This deliberately simple response proves the adapter transport only. It
    # is not intended to score well on RIFT's benchmark suites.
    return f"Adapter received task {payload.task_id}: {objective}", [
        {"type": "agent.step.completed", "payload": {"step": "adapter-invocation"}},
    ]


async def emit_event(sink: dict[str, Any], event: dict[str, Any]) -> None:
    url = sink.get("url")
    token = sink.get("token")
    if not url or not token:
        return
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                url,
                json=event,
                headers={"x-rift-adapter-token": token},
            )
    except httpx.HTTPError:
        # Live delivery is best-effort; return the event in the final batch too.
        return


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/run")
async def run_agent(payload: AdapterEnvelope) -> dict[str, Any]:
    events: list[dict[str, Any]] = []

    async def record(kind: str, details: dict[str, Any]) -> None:
        event = {"type": kind, "payload": details}
        events.append(event)
        await emit_event(payload.event_sink, event)

    await record("agent.step.started", {"step": "invoke-existing-agent"})
    answer, agent_events = await invoke_existing_agent(payload)
    await record("agent.step.completed", {"step": "invoke-existing-agent"})
    for event in agent_events[:200]:
        if isinstance(event, dict) and isinstance(event.get("type"), str):
            await record(event["type"], event.get("payload", {}))
    await record("agent.run.completed", {"status": "success"})

    return {
        "output": answer,
        "steps": sum(1 for item in events if item["type"].startswith("agent.step.")),
        "tool_calls": sum(1 for item in events if item["type"].startswith("tool.call.")),
        "events": events,
    }
