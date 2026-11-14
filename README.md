# RIFT Arena

**Benchmark. Stress test. Understand.**

RIFT Arena is a React + FastAPI platform for framework-independent AI agent benchmarking. It compares complete agent configurations across repeatable research tasks, injects controlled provider/evidence/latency faults, records traces, and visualizes actual execution events in a Three.js arena.

## Stack

- React 19 + Vite 8
- Three.js + React Three Fiber 9 + Drei
- FastAPI + Pydantic
- Neon PostgreSQL (via psycopg 3); SQLite fallback for development
- Bifrost OpenAI-compatible model gateway
- Tavily Search API
- WebSockets for live event streaming

## Platform workspaces

RIFT ships with 11 separate workspaces:

| Workspace | What it does |
|---|---|
| Overview | Live experiment health, key metrics and recent activity |
| Benchmark Lab | Build matched experiments across agents, models and Research-10 tasks |
| Agents | Use built-in baselines or register framework-independent HTTP adapters |
| Research Intelligence | Search with Tavily, inspect evidence and preserve hashed snapshots |
| Chaos Lab | Configure provider outages, evidence poisoning and network latency |
| 3D Arena | Explore the Three.js digital twin with live events and replay |
| Run Inspector | Inspect outputs, evidence, tool calls, costs and ordered execution events |
| Deep Evaluation | Review answer quality, evidence, citation integrity and resilience metrics |
| Compare | Compare agent and model configurations in matched experiments |
| Leaderboard | Rank completed configurations by measured outcomes |
| Settings | Verify connected services and configure assistant integrations |

The eight core feature areas are agent benchmarking, chaos testing, the 3D execution arena, deep evaluation, model-versus-agent analysis, live web intelligence, detailed run inspection, and leaderboard/comparison. Settings and agent onboarding support those workflows.

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

The launcher installs frontend and backend dependencies, builds React, then starts FastAPI. For a frontend hot-reload workflow, use two terminals: run `uvicorn main:app --reload --env-file .env --port 8000` from `backend`, then run `npm run dev` from `frontend` and open `http://127.0.0.1:5173`.

## Neon PostgreSQL setup

1. Create a Neon project and open **Connect** in the Neon Console.
2. Select the database and role. Choose the pooled connection string for the running application.
3. Copy the complete string, including `sslmode=require` and `channel_binding=require` when provided.
4. Put it in `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-POOLER-HOST/DBNAME?sslmode=require&channel_binding=require
```

RIFT creates the required tables and indexes on startup. If `DATABASE_URL` is blank, it uses local SQLite in `data/rift.db`. To verify the database, open Settings and check the database status or call `GET /api/health`.

Neon guide: https://neon.com/docs/get-started/connect-neon

## Vercel + Render deployment (no Docker)

Deploy the React + Vite frontend on Vercel and the FastAPI backend on Render. The frontend production API URL is configured as `https://bifrost-1-qmoa.onrender.com/api` in `frontend/.env.production`; `frontend/vercel.json` contains the SPA fallback. Follow [`VERCEL_RENDER_DEPLOY.md`](VERCEL_RENDER_DEPLOY.md) for exact settings and environment variables.

## Research Intelligence

The Research Intelligence workspace provides Tavily searches and an explicitly labelled preview dataset when live search is not selected. Each search is stored as an evidence snapshot with its query, source list, provider, creation time and content hash. Preview records use `.invalid` fixture domains and are not real web evidence. Live searches require `TAVILY_API_KEY`.

## Bifrost setup

Start Bifrost and configure at least one provider/model route. Copy its OpenAI-compatible API URL and a virtual key into `backend/.env`:

```env
BIFROST_BASE_URL=https://bifrost-deploy.onrender.com/v1
BIFROST_API_KEY=YOUR_BIFROST_VIRTUAL_KEY
BIFROST_MODEL=general
```

The exact public model name must match a model route configured in your Bifrost instance. For hosted deployments, use the public HTTPS URL of your Bifrost service ending in `/v1`.

## Tavily setup

Create an API key in Tavily and set:

```env
TAVILY_API_KEY=tvly-YOUR_KEY
TAVILY_BASE_URL=https://api.tavily.com
```

RIFT sends research requests from the backend. API keys are never embedded in the React bundle. Verify both integrations from Settings.

## Optional cost accounting

Set model rates and Tavily search rates to calculate cost per verified success:

```env
MODEL_INPUT_COST_PER_1M=
MODEL_OUTPUT_COST_PER_1M=
TAVILY_COST_PER_SEARCH=
```

Prices depend on your provider and plan; enter the applicable rates yourself. RIFT does not invent missing prices.

## Provider failure testing

For a real Bifrost upstream fallback test, enable the RIFT fault proxy and configure a dedicated Bifrost custom provider to point at it. Never point production model traffic at a chaos proxy. Keep the proxy private and set a strong `RIFT_PROXY_TOKEN`. See `docs/BIFROST_SETUP.md`.

## Framework-independent agent contract

External agents integrate through a small HTTP endpoint. RIFT sends the objective, evidence snapshot, budget and run metadata. The adapter returns a final output plus optional step/tool/model counters and normalized events. It does not require LangGraph, CrewAI or any other framework. See `docs/AGENT_ADAPTER.md` and `examples/vanilla_adapter.py`.

## Evaluation workspace

The Deep Evaluation page aggregates completed run records into answer quality, evidence coverage, citation integrity, success rate, cost completeness, provider recovery and poison resistance. It reports null when pricing or fault-specific telemetry is not available. It does not treat Tavily relevance as proof of source credibility.

## Fairness and limitations

- Snapshot mode gives matched agents the same Tavily evidence pack. Live mode is useful for freshness tests but public search results can change.
- Seeds reproduce RIFT fault decisions and fixtures across matched agents and experiments, not stochastic model output or the external internet.
- The provider fault probability and evidence poisoning probability are configured per eligible call. Small experiments may not show exactly the configured percentage.
- Demo mode always uses synthetic model and evidence fixtures, even when live credentials are configured. It does not spend provider credits and does not report simulated token counts as actual usage.
- The built-in evaluator is an MVP rubric. It combines task checks, evidence coverage and citation integrity; it is not a scientifically validated benchmark or a replacement for human review.
- Bifrost captures traffic that passes through the gateway. Agent planning and memory steps require adapter or OpenTelemetry instrumentation.
- The Three.js Arena is an event-driven digital twin. It visualizes recorded events, not hidden model reasoning.

## Run tests

```bash
python -m unittest discover -s backend/tests -v
```

## Production checklist

Before exposing a public instance, add authentication, per-workspace authorization, rate limits, tenant isolation, adapter egress allowlists, secret rotation, retention controls, stronger isolation for untrusted agent containers, and a production connection pool. Keep the prototype on localhost or a trusted private network.

## AI assistant connector

RIFT exposes a full read-only remote MCP endpoint at `https://riftz.vercel.app/mcp/` for supported ChatGPT, Claude and other MCP clients. Its 21 read-only tools plus resources cover task prompts, agents, experiment configurations, every run, ordered event traces, research/evidence sources, evaluation summaries, comparison reports and leaderboards. It cannot launch/cancel runs, modify agents/settings or trigger provider spend. See [`docs/MCP_CONNECTORS.md`](docs/MCP_CONNECTORS.md) for setup and security limitations.
