# RIFT HTTP agent adapter contract

RIFT does not require agents to use LangGraph, CrewAI or any specific orchestration framework. An agent can expose one HTTP endpoint that accepts a task envelope and returns its final output plus optional observable events.

## Request

```json
{
  "run_id": "run-123",
  "task_id": "research-001",
  "task": {
    "title": "AI gateway landscape",
    "objective": "Compare modern AI gateways..."
  },
  "evidence": [
    {"title": "Official docs", "url": "https://example.com/docs", "content": "..."}
  ],
  "budgets": {
    "max_steps": 20,
    "max_tool_calls": 15,
    "timeout_seconds": 120,
    "max_cost_usd": 0.10
  },
  "environment": {
    "mode": "live",
    "seed": 12345
  }
}
```

## Response

```json
{
  "output": "Final evidence-backed answer with source links...",
  "steps": 6,
  "tool_calls": 3,
  "input_tokens": 1200,
  "output_tokens": 450,
  "events": [
    {"type": "plan.created", "label": "Collect official evidence"},
    {"type": "tool.call", "tool": "web_search", "status": "success"}
  ]
}
```

`output` is required. The counters are optional, but supplying them improves comparability. Do not return hidden chain-of-thought. Send observable summaries, action names, tool inputs/outputs and status changes only.

## Example with FastAPI

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class TaskEnvelope(BaseModel):
    run_id: str
    task_id: str
    task: dict
    evidence: list[dict] = []
    budgets: dict = {}
    environment: dict = {}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/run")
async def run_agent(payload: TaskEnvelope):
    # Call your existing agent or framework here.
    # Do not replace your internal architecture with RIFT code.
    answer = "Your agent's final answer goes here."
    return {
        "output": answer,
        "steps": 4,
        "tool_calls": 2,
        "events": [
            {"type": "agent.plan", "status": "completed"},
            {"type": "tool.search", "status": "completed"}
        ]
    }
```

Run it on a private endpoint and register its `/run` URL in the Agents page. External endpoints must use HTTPS.
