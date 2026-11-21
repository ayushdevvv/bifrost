# RIFT Agent Benchmark Platform

**Benchmark complete agents, not just models.**

RIFT is a framework-independent AI agent benchmarking platform. It runs agents against matched tasks in Coding, Research and Customer Support; repeats trials; injects controlled failures; and records outcomes plus observable execution traces. Developers can compare task success, steps, tool calls, tokens, cost and latency, then preserve failures as regression cases.

RIFT opens directly in the Benchmark Lab. Integration pages are secondary; product and architecture information lives at the bottom of the sidebar under **About RIFT**.

## What is included

- **Three task suites:** Coding-10, Research-10 and Support-10, each with ten benchmark tasks and category-specific deterministic MVP graders.
- **Framework-independent adapters:** connect existing LangGraph, CrewAI, AutoGen, PydanticAI or hand-written agents through one HTTP contract without rewriting the agent itself.
- **Matched experiments:** same task set, budgets, repetition count and seeded fault schedule across selected agents.
- **Execution traces:** batch or live step/tool/model/retry events from external adapters; RIFT stores ordered events per run.
- **Evaluation:** Judge0-isolated Coding-10 execution, model-assisted claim-to-evidence review for Research-10, quote-verified policy rubrics for Support-10, plus step/tool/model counts, latency, real usage, pass@k, pass^k and quality variation.
- **Failure testing:** provider outage, tool unavailability, misleading instructions, evidence poisoning and latency.
- **Reliability loop:** counterfactual reruns, immutable evidence snapshots and replayable regression memory.
- **Bifrost integration:** optional gateway request correlation, real upstream-fault proxy tests and route workload comparisons. External adapters can use the included `RiftReporter.call_bifrost` helper to preserve run correlation.
- **Demo deployment:** one direct shared workspace with authentication disabled for the hackathon presentation. Do not expose the no-login instance to untrusted users; re-enable authentication and tenant isolation before public multi-user use. Production rate limiting still requires Redis.
- **Optional MCP tools:** read-only access to benchmark records and a manifest drift monitor, not the main product workflow.

## Stack

- React 19 + Vite 8
- Three.js + React Three Fiber 9 + Drei (event replay view)
- FastAPI + Pydantic
- Neon PostgreSQL via psycopg 3; SQLite fallback for local development
- Bifrost OpenAI-compatible gateway (optional)
- Tavily Search for live research tasks (optional)
- WebSockets for live experiment events

## Quick start (Windows)

1. Install Node.js 22.12+ and Python 3.11+.
2. Extract the project.
3. Run `run.ps1` from the project root.
4. Open `http://127.0.0.1:8000`.

## Quick start (macOS/Linux)

```bash
chmod +x run.sh
./run.sh
```

The launcher installs dependencies, builds the frontend, then starts FastAPI. For frontend hot reload, run `uvicorn main:app --reload --env-file .env --port 8000` from `backend` and `npm run dev` from `frontend`.

## Configure Bifrost

Start Bifrost and configure a provider/model route. Add its OpenAI-compatible URL and virtual key to `backend/.env`:

```env
BIFROST_BASE_URL=https://your-bifrost-host/v1
BIFROST_API_KEY=YOUR_BIFROST_VIRTUAL_KEY
BIFROST_MODEL=general
```

RIFT correlates model calls using `x-request-id` and `x-bf-lh-rift-run-id`, `x-bf-lh-rift-experiment-id`, `x-bf-lh-rift-task-id` and `x-bf-lh-rift-agent-id` logging headers. The request ID can be searched in Bifrost's Logs API. Bifrost provides request-level model telemetry; RIFT supplies agent/task context and trace comparison.

## Configure Tavily for Research-10

```env
TAVILY_API_KEY=tvly-YOUR_KEY
TAVILY_BASE_URL=https://api.tavily.com
```

Coding-10 and Support-10 do not require Tavily. Demo mode always uses labelled synthetic fixtures and does not contact paid services.

## Connect an existing agent

Expose a small HTTPS endpoint that accepts RIFT's task envelope and invokes your existing agent. It may use any framework or no framework. Configure the adapter endpoint in **Agent registry**. For live step/tool/model events, configure:

```env
RIFT_PUBLIC_API_BASE_URL=https://your-rift-api.example
RIFT_ADAPTER_EVENT_SECRET=use-a-long-random-secret
```

The run envelope then includes a one-run event sink URL and token. See [`docs/AGENT_ADAPTER.md`](docs/AGENT_ADAPTER.md), [`examples/langgraph_adapter.py`](examples/langgraph_adapter.py), [`examples/crewai_adapter.py`](examples/crewai_adapter.py) and [`examples/vanilla_adapter.py`](examples/vanilla_adapter.py).

## Evaluation and scientific limits

Live Coding-10 requires a configured Judge0-compatible service. Candidate code runs inside Judge0 with network disabled, CPU/memory/time/process limits and task-specific hidden assertions. The hidden pass/fail rubric remains in the grader process; candidate code runs in a separate child interpreter. Without Judge0, live Coding-10 fails closed. Demo mode uses AST/structural fixtures and is labelled `structural_demo_only`.

Live Research-10 combines deterministic task checks with a Bifrost model-assisted claim evaluator. Each supported/contradicted claim must include a verbatim quote from the exact non-synthetic source excerpt, and RIFT checks that quote against the excerpt. This is stronger than URL matching, but does not prove semantic entailment or independent real-world truth. Use a separate evaluator model and human review for high-stakes results.

Live Support-10 evaluates empathy, policy accuracy, false promises, privacy/safety, actionable next steps and clarity. Passing criteria require exact response quotes, which RIFT verifies; quote-backed risk flags fail the run. Human review is available for research and support runs.

These are category-specific MVP rubrics, not validated academic benchmarks. `pass@k` is the observed percentage of agent/task groups with at least one success; `pass^k` is the percentage where all repetitions succeed. Earlier RIFT UI versions labelled `pass^k` as `reliability@k`; use `pass^k` in reports and presentations. Seeds reproduce RIFT's fault schedules, not stochastic model output or live internet results. Demo mode demonstrates the workflow only and must not be represented as real model performance.

## Deploy

Vercel + Render deployment instructions are in [`VERCEL_RENDER_DEPLOY.md`](VERCEL_RENDER_DEPLOY.md). The current presentation build defaults to `RIFT_AUTH_REQUIRED=false` and opens directly into one shared workspace. On Render, explicitly set `RIFT_AUTH_REQUIRED=false` to match this frontend. This is only for a closed/demo deployment: anyone who can reach it can access and modify shared benchmark records and potentially consume configured provider and Judge0 resources. Production startup still requires local adapter access disabled and a reachable `RIFT_RATE_LIMIT_REDIS_URL`. To restore multi-user use, set `RIFT_AUTH_REQUIRED=true`, provide `RIFT_AUTH_SECRET`, and use the authenticated frontend build.

Keep a shared ingress/WAF limit as a second layer and enforce network-layer egress restrictions to protect against DNS rebinding and internal network access. Production setup, Judge0 configuration, evaluator limits, Bifrost fault proxy setup and residual security controls are documented in [`docs/SECURITY_AND_EVALUATION.md`](docs/SECURITY_AND_EVALUATION.md). Do not run untrusted agent code outside a trusted isolated sandbox.

## Tests

```bash
python -m unittest discover -s backend/tests -v
```

For the two-agent live Coding-10 publication workflow, see [`docs/LIVE_CODING10_PUBLICATION.md`](docs/LIVE_CODING10_PUBLICATION.md). See [`docs/FEATURES.md`](docs/FEATURES.md) for the feature map, [`docs/COMPETITIVE_POSITIONING.md`](docs/COMPETITIVE_POSITIONING.md) for the product boundary and judging demo, [`docs/RELIABILITY_WORKFLOWS.md`](docs/RELIABILITY_WORKFLOWS.md) for counterfactual analysis and regression memory, and [`docs/SECURITY_AND_EVALUATION.md`](docs/SECURITY_AND_EVALUATION.md) for production hardening and evaluation configuration.
