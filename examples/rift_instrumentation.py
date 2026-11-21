"""Small async instrumentation helper for framework-independent RIFT adapters.

This does not replace a framework's tracing API. Attach its public event hooks to
`RiftReporter`; return `reporter.response(...)` from the adapter's /run handler.
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import httpx


_SENSITIVE_KEYS = {
    "authorization", "api_key", "apikey", "access_token", "refresh_token",
    "token", "password", "secret", "credential", "credentials", "cookie",
}


def _safe(value: Any, depth: int = 0) -> Any:
    """Bound and redact event metadata. Never send prompts or raw tool contents by default."""
    if depth > 4:
        return "[depth-limited]"
    if isinstance(value, dict):
        return {
            str(key)[:80]: ("[redacted]" if str(key).lower() in _SENSITIVE_KEYS else _safe(item, depth + 1))
            for key, item in list(value.items())[:50]
        }
    if isinstance(value, (list, tuple)):
        return [_safe(item, depth + 1) for item in list(value)[:50]]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value if not isinstance(value, str) or len(value) <= 1000 else value[:1000] + "…"
    return str(value)[:500]


class RiftReporter:
    def __init__(self, envelope: dict[str, Any]):
        self.envelope = envelope
        self.sink = envelope.get("event_sink") or {}
        self.events: list[dict[str, Any]] = []
        self.steps = 0
        self.tool_calls = 0
        self.model_calls = 0
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_cost_usd = 0.0
        self._has_input_tokens = False
        self._has_output_tokens = False
        self._has_cost = False
        self.trace_id = None

    async def emit(self, event_type: str, payload: dict[str, Any] | None = None) -> None:
        normalized_type = str(event_type)[:100]
        if normalized_type in {"agent.step.started", "step.started"}:
            self.steps += 1
        elif normalized_type == "tool.call.started":
            self.tool_calls += 1
        elif normalized_type == "model.request.started":
            self.model_calls += 1
        event = {"type": normalized_type, "payload": _safe(payload or {})}
        self.events.append(event)
        self.events = self.events[-250:]
        url, token = self.sink.get("url"), self.sink.get("token")
        if url and token:
            try:
                async with httpx.AsyncClient(timeout=2.0, follow_redirects=False) as client:
                    await client.post(url, json=event, headers={"x-rift-adapter-token": token})
            except httpx.HTTPError:
                # The final batch trace is returned even if live delivery is offline.
                pass

    @asynccontextmanager
    async def step(self, name: str, **metadata: Any):
        step_id = f"step-{uuid.uuid4().hex[:10]}"
        await self.emit("agent.step.started", {"step_id": step_id, "step": name, **metadata})
        started = time.perf_counter()
        try:
            yield step_id
        except Exception as exc:
            await self.emit("agent.step.failed", {"step_id": step_id, "step": name, "error_type": type(exc).__name__})
            raise
        else:
            await self.emit("agent.step.completed", {"step_id": step_id, "step": name, "duration_ms": int((time.perf_counter() - started) * 1000)})

    @asynccontextmanager
    async def tool(self, name: str, **metadata: Any):
        call_id = f"tool-{uuid.uuid4().hex[:10]}"
        await self.emit("tool.call.started", {"tool_call_id": call_id, "tool": name, **metadata})
        started = time.perf_counter()
        try:
            yield call_id
        except Exception as exc:
            await self.emit("tool.call.failed", {"tool_call_id": call_id, "tool": name, "error_type": type(exc).__name__, "duration_ms": int((time.perf_counter() - started) * 1000)})
            raise
        else:
            await self.emit("tool.call.completed", {"tool_call_id": call_id, "tool": name, "duration_ms": int((time.perf_counter() - started) * 1000)})

    def bifrost_request_metadata(self, call_index: int) -> dict[str, Any]:
        """Return Bifrost correlation fields for one model request.

        Include the `user` value in the OpenAI-compatible JSON body and all
        headers in the request. The user value is how RIFT's seeded upstream
        fault proxy correlates a real Bifrost request to this benchmark run.
        """
        run_id = str(self.envelope.get("run_id", ""))
        workspace_id = str(self.envelope.get("workspace_id", "local"))
        return {
            "user": f"rift:{run_id}:{int(call_index)}:{workspace_id}",
            "headers": {
                "x-request-id": f"rift-{run_id}-{int(call_index)}",
                "x-bf-lh-rift-run-id": run_id,
                "x-bf-lh-rift-task-id": str(self.envelope.get("task_id", "")),
                "x-bf-lh-rift-workspace-id": workspace_id,
            },
        }

    async def call_bifrost(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        messages: list[dict[str, Any]],
        call_index: int,
        temperature: float = 0.2,
        max_tokens: int = 1200,
        timeout_seconds: int = 60,
    ) -> dict[str, Any]:
        """Call an OpenAI-compatible Bifrost route with RIFT run correlation.

        Use this inside existing framework nodes when you need deterministic
        RIFT fault-proxy correlation. The call is an ordinary Bifrost request;
        the RIFT backend never receives the prompt or message contents through
        telemetry events.
        """
        metadata = self.bifrost_request_metadata(call_index)
        call_id = metadata["headers"]["x-request-id"]
        await self.emit("model.request.started", {"call_id": call_id, "provider": "Bifrost", "model": model})
        request_body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
            "user": metadata["user"],
        }
        try:
            async with httpx.AsyncClient(timeout=max(5, min(int(timeout_seconds), 180)), follow_redirects=False) as client:
                response = await client.post(
                    f"{base_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        **metadata["headers"],
                    },
                    json=request_body,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            await self.emit("model.request.failed", {
                "call_id": call_id,
                "provider": "Bifrost",
                "status_code": exc.response.status_code,
            })
            raise
        except Exception as exc:
            await self.emit("model.request.failed", {
                "call_id": call_id,
                "provider": "Bifrost",
                "error_type": type(exc).__name__,
            })
            raise

        choices = data.get("choices") or [{}]
        message = (choices[0].get("message") or {}) if choices else {}
        content = message.get("content", "")
        if isinstance(content, list):
            content = "\n".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
        usage = data.get("usage") or {}
        input_tokens = usage.get("prompt_tokens", usage.get("input_tokens"))
        output_tokens = usage.get("completion_tokens", usage.get("output_tokens"))
        cost = usage.get("cost_usd", usage.get("total_cost_usd", data.get("cost_usd")))
        trace_id = (
            response.headers.get("x-request-id")
            or response.headers.get("x-bifrost-request-id")
            or data.get("trace_id")
            or call_id
        )
        await self.record_model_usage(
            provider=str(data.get("provider") or "Bifrost"),
            model=str(data.get("model") or model),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            call_id=call_id,
            trace_id=trace_id,
            started=False,
        )
        return {
            "content": str(content),
            "model": data.get("model", model),
            "provider": data.get("provider", "Bifrost"),
            "trace_id": trace_id,
            "request_id": call_id,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost_usd": cost,
            },
        }

    async def record_model_usage(
        self,
        *,
        provider: str | None = None,
        model: str | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        cost_usd: float | None = None,
        call_id: str | None = None,
        trace_id: str | None = None,
        started: bool = True,
    ) -> None:
        model_call_id = call_id or f"model-{uuid.uuid4().hex[:10]}"
        if started:
            await self.emit("model.request.started", {"call_id": model_call_id, "provider": provider, "model": model})
        if input_tokens is not None:
            self.input_tokens += int(input_tokens)
            self._has_input_tokens = True
        if output_tokens is not None:
            self.output_tokens += int(output_tokens)
            self._has_output_tokens = True
        if cost_usd is not None:
            self.total_cost_usd += float(cost_usd)
            self._has_cost = True
        if trace_id:
            self.trace_id = trace_id
        await self.emit("model.request.completed", {
            "call_id": model_call_id,
            "provider": provider, "model": model,
            "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens, "cost_usd": cost_usd},
            "trace_id": trace_id,
        })

    def response(self, output: str, *, provider: str | None = None, trace_id: str | None = None) -> dict[str, Any]:
        usage: dict[str, Any] = {}
        if self._has_input_tokens:
            usage["input_tokens"] = self.input_tokens
        if self._has_output_tokens:
            usage["output_tokens"] = self.output_tokens
        if self._has_cost:
            usage["total_cost_usd"] = round(self.total_cost_usd, 8)
        return {
            "output": output,
            "steps": self.steps,
            "tool_calls": self.tool_calls,
            "model_calls": self.model_calls,
            "usage": usage,
            "provider": provider,
            "trace_id": trace_id or self.trace_id,
            "events": self.events,
        }
