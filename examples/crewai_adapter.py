"""CrewAI adapter template backed by CrewAI's typed event listener bus.

Set RIFT_AGENT_MODULE to a module exporting `crew`. The example uses the
CrewAI public BaseEventListener and event bus; install CrewAI in this adapter
service only, not in the RIFT backend.
"""
from __future__ import annotations

import asyncio
import importlib
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field
from crewai.events import (
    AgentExecutionCompletedEvent,
    AgentExecutionErrorEvent,
    AgentExecutionStartedEvent,
    BaseEventListener,
    CrewKickoffCompletedEvent,
    CrewKickoffFailedEvent,
    CrewKickoffStartedEvent,
    LLMCallCompletedEvent,
    LLMCallFailedEvent,
    LLMCallStartedEvent,
    TaskCompletedEvent,
    TaskFailedEvent,
    TaskStartedEvent,
    ToolUsageErrorEvent,
    ToolUsageFinishedEvent,
    ToolUsageStartedEvent,
)
from crewai.events import crewai_event_bus

from examples.rift_instrumentation import RiftReporter

_AGENT_MODULE = os.getenv("RIFT_AGENT_MODULE", "my_crew")
_crew_module = importlib.import_module(_AGENT_MODULE)
crew = getattr(_crew_module, "crew")
app = FastAPI(title="RIFT CrewAI adapter")


class Envelope(BaseModel):
    run_id: str
    task_id: str
    task: dict[str, Any]
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    context: str = ""
    budgets: dict[str, Any] = Field(default_factory=dict)
    environment: dict[str, Any] = Field(default_factory=dict)
    event_sink: dict[str, Any] = Field(default_factory=dict)


class RIFTEventListener(BaseEventListener):
    def __init__(self, loop: asyncio.AbstractEventLoop, reporter: RiftReporter):
        self.loop = loop
        self.reporter = reporter
        self.pending = []
        super().__init__()

    def send(self, kind: str, event: Any, **extra: Any) -> None:
        payload = {key: value for key, value in extra.items() if value is not None}
        payload["framework"] = "crewai"
        if self.loop.is_running():
            self.pending.append(asyncio.run_coroutine_threadsafe(self.reporter.emit(kind, payload), self.loop))

    async def flush(self) -> None:
        if self.pending:
            await asyncio.gather(*(asyncio.wrap_future(future) for future in self.pending), return_exceptions=True)
            self.pending.clear()

    def setup_listeners(self, bus):
        @bus.on(CrewKickoffStartedEvent)
        def on_crew_started(source, event): self.send("agent.step.started", event, step="crew kickoff")

        @bus.on(CrewKickoffCompletedEvent)
        def on_crew_completed(source, event): self.send("agent.step.completed", event, step="crew kickoff")

        @bus.on(CrewKickoffFailedEvent)
        def on_crew_failed(source, event): self.send("agent.step.failed", event, step="crew kickoff")

        @bus.on(AgentExecutionStartedEvent)
        def on_agent_started(source, event): self.send("agent.step.started", event, step="agent execution", agent=getattr(getattr(event, "agent", None), "role", None))

        @bus.on(AgentExecutionCompletedEvent)
        def on_agent_completed(source, event): self.send("agent.step.completed", event, step="agent execution")

        @bus.on(AgentExecutionErrorEvent)
        def on_agent_error(source, event): self.send("agent.step.failed", event, step="agent execution", error_type=type(getattr(event, "error", None)).__name__)

        @bus.on(TaskStartedEvent)
        def on_task_started(source, event): self.send("agent.step.started", event, step="task")

        @bus.on(TaskCompletedEvent)
        def on_task_completed(source, event): self.send("agent.step.completed", event, step="task")

        @bus.on(TaskFailedEvent)
        def on_task_failed(source, event): self.send("agent.step.failed", event, step="task")

        @bus.on(ToolUsageStartedEvent)
        def on_tool_started(source, event): self.send("tool.call.started", event, tool=getattr(event, "tool_name", None))

        @bus.on(ToolUsageFinishedEvent)
        def on_tool_finished(source, event): self.send("tool.call.completed", event, tool=getattr(event, "tool_name", None))

        @bus.on(ToolUsageErrorEvent)
        def on_tool_error(source, event): self.send("tool.call.failed", event, tool=getattr(event, "tool_name", None))

        @bus.on(LLMCallStartedEvent)
        def on_llm_started(source, event): self.send("model.request.started", event, model=getattr(event, "model", None))

        @bus.on(LLMCallCompletedEvent)
        def on_llm_completed(source, event):
            usage = getattr(event, "token_usage", None) or getattr(event, "usage", None) or {}
            self.send("model.request.completed", event, model=getattr(event, "model", None), usage=usage if isinstance(usage, dict) else {})

        @bus.on(LLMCallFailedEvent)
        def on_llm_failed(source, event): self.send("model.request.failed", event, model=getattr(event, "model", None))


@app.get("/health")
async def health():
    return {"status": "ok", "adapter": "crewai"}


@app.post("/run")
async def run_agent(payload: Envelope):
    loop = asyncio.get_running_loop()
    reporter = RiftReporter(payload.model_dump())
    # Instantiate per run and use CrewAI's scoped event bus so parallel runs do not share handlers.
    inputs = {"task": payload.task.get("objective", payload.task.get("title", "")), "evidence": payload.evidence, "context": payload.context}
    with crewai_event_bus.scoped_handlers():
        # Construct the listener inside the scope so this run's callbacks are
        # attached only while this invocation is active.
        listener = RIFTEventListener(loop, reporter)
        result = await crew.akickoff(inputs=inputs)
        # CrewAI listeners may schedule async reporter calls from event threads.
        # Drain them before returning the final batch trace.
        await listener.flush()
    output = getattr(result, "raw", None) or str(result)
    token_usage = getattr(result, "token_usage", None)
    if token_usage is not None:
        usage = getattr(token_usage, "model_dump", lambda: {})() or getattr(token_usage, "__dict__", {})
        await reporter.record_model_usage(
            provider="CrewAI",
            input_tokens=usage.get("prompt_tokens", usage.get("input_tokens")),
            output_tokens=usage.get("completion_tokens", usage.get("output_tokens")),
            cost_usd=usage.get("total_cost", usage.get("cost_usd")),
        )
    return reporter.response(output, provider="CrewAI", trace_id=reporter.trace_id)
