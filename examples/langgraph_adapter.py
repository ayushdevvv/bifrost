"""LangGraph adapter template using public astream_events(version='v2') events.

Set RIFT_AGENT_MODULE to a Python module that exports a compiled `graph` object.
Optional dependencies for this example: fastapi, uvicorn, langgraph, httpx.
"""
from __future__ import annotations

import importlib
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from examples.rift_instrumentation import RiftReporter

_AGENT_MODULE = os.getenv("RIFT_AGENT_MODULE", "my_agent")
_agent_module = importlib.import_module(_AGENT_MODULE)
graph = getattr(_agent_module, "graph")
app = FastAPI(title="RIFT LangGraph adapter")


class Envelope(BaseModel):
    run_id: str
    task_id: str
    task: dict[str, Any]
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    context: str = ""
    budgets: dict[str, Any] = Field(default_factory=dict)
    environment: dict[str, Any] = Field(default_factory=dict)
    event_sink: dict[str, Any] = Field(default_factory=dict)


def _extract_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("messages", "output", "answer", "final"):
            if key in value:
                text = _extract_text(value[key])
                if text:
                    return text
    if isinstance(value, (list, tuple)):
        for item in reversed(value):
            text = _extract_text(item)
            if text:
                return text
    content = getattr(value, "content", None)
    if isinstance(content, str):
        return content
    return ""


def _usage_from_model_output(value: Any) -> dict[str, Any]:
    candidates = value if isinstance(value, list) else [value]
    for candidate in reversed(candidates):
        usage = getattr(candidate, "usage_metadata", None)
        if not isinstance(usage, dict) and isinstance(candidate, dict):
            usage = candidate.get("usage_metadata")
            if not isinstance(usage, dict):
                usage = (candidate.get("response_metadata") or {}).get("token_usage")
        if isinstance(usage, dict):
            return {
                "input_tokens": usage.get("input_tokens", usage.get("prompt_tokens")),
                "output_tokens": usage.get("output_tokens", usage.get("completion_tokens")),
            }
    return {}


@app.get("/health")
async def health():
    return {"status": "ok", "adapter": "langgraph"}


@app.post("/run")
async def run_agent(payload: Envelope):
    reporter = RiftReporter(payload.model_dump())
    task_input = {
        "messages": [{"role": "user", "content": payload.task.get("objective", payload.task.get("title", ""))}],
        "evidence": payload.evidence,
        "context": payload.context,
    }
    final_state: Any = None
    async with reporter.step("langgraph execution", framework="langgraph"):
        async for event in graph.astream_events(task_input, version="v2"):
            event_name = str(event.get("event", ""))
            event_id = str(event.get("run_id", ""))
            name = str(event.get("name", "runnable"))[:100]
            data = event.get("data") or {}
            if event_name == "on_chain_start":
                await reporter.emit("agent.step.started", {"step_id": event_id, "step": name, "framework_event": event_name})
            elif event_name == "on_chain_end":
                await reporter.emit("agent.step.completed", {"step_id": event_id, "step": name, "framework_event": event_name})
                if isinstance(data, dict) and data.get("output") is not None:
                    final_state = data.get("output")
            elif event_name == "on_tool_start":
                await reporter.emit("tool.call.started", {"tool_call_id": event_id, "tool": name, "framework_event": event_name})
            elif event_name == "on_tool_end":
                await reporter.emit("tool.call.completed", {"tool_call_id": event_id, "tool": name, "framework_event": event_name})
            elif event_name in {"on_tool_error", "on_chain_error"}:
                await reporter.emit("tool.call.failed" if "tool" in event_name else "agent.step.failed", {"call_id": event_id, "step_id": event_id, "name": name, "framework_event": event_name})
            elif event_name in {"on_chat_model_start", "on_llm_start"}:
                await reporter.emit("model.request.started", {"call_id": event_id, "model": name, "framework_event": event_name})
            elif event_name in {"on_chat_model_end", "on_llm_end"}:
                usage = _usage_from_model_output(data.get("output") if isinstance(data, dict) else data)
                await reporter.record_model_usage(
                    model=name,
                    input_tokens=usage.get("input_tokens"),
                    output_tokens=usage.get("output_tokens"),
                    call_id=event_id,
                    trace_id=event.get("parent_ids", [None])[0] if event.get("parent_ids") else event_id,
                    started=False,
                )
            elif event_name in {"on_chat_model_error", "on_llm_error"}:
                await reporter.emit("model.request.failed", {"call_id": event_id, "model": name, "framework_event": event_name})
    answer = _extract_text(final_state)
    if not answer:
        answer = str(final_state or "")
    return reporter.response(answer, provider="LangGraph", trace_id=reporter.trace_id)
