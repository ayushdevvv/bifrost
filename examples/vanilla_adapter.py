"""Minimal framework-independent example adapter for RIFT."""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Example research agent")

class Envelope(BaseModel):
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
async def run(payload: Envelope):
    # Replace this body with your existing agent invocation.
    sources = payload.evidence[:3]
    output = "Evidence review for: " + payload.task.get("objective", "")
    for source in sources:
        output += f"\n\n{source.get('title')} — {source.get('url')}\n{source.get('content', '')[:220]}"
    return {
        "output": output,
        "steps": 3,
        "tool_calls": len(sources),
        "events": [
            {"type": "plan", "status": "completed"},
            {"type": "evidence.review", "status": "completed", "source_count": len(sources)},
        ],
    }
