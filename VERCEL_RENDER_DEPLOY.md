# RIFT Arena deployment: Vercel frontend + Render API + separate Bifrost gateway

This repository is configured for the following deployment:

- **React + Vite frontend:** Vercel at `https://riftz.vercel.app`
- **RIFT FastAPI backend:** Render at `https://bifrost-1-qmoa.onrender.com`
- **Bifrost AI gateway:** separate Render service at `https://bifrost-deploy.onrender.com`
- **Database:** Neon PostgreSQL recommended (Render Free local files are ephemeral)

## 1. Frontend API target

The production Vite setting is stored in `frontend/.env.production` and `.env.example`:

```env
VITE_API_BASE_URL=https://bifrost-1-qmoa.onrender.com/api
```

The frontend derives its WebSocket endpoint from this API URL, so it connects to:

```text
wss://bifrost-1-qmoa.onrender.com/ws/{experiment_id}
```

`frontend/vercel.json` provides the SPA fallback and proxies `/mcp/` to the backend for remote AI-assistant connections.

When deploying on Vercel:

- Framework Preset: **Vite**
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

If a Vercel dashboard environment variable named `VITE_API_BASE_URL` already exists, it overrides `.env.production`. Set it to the exact URL above and redeploy so the built JavaScript stops calling the wrong service.

## 2. RIFT FastAPI backend on Render

Use the existing Render Web Service `bifrost-1-qmoa.onrender.com`:

- Runtime: **Python 3** (not Docker)
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`

Backend configuration:

```env
ENVIRONMENT=production
SERVE_FRONTEND=false
DATABASE_URL=YOUR_NEON_POSTGRES_CONNECTION_STRING
RIFT_AUTH_REQUIRED=false
# No RIFT_AUTH_SECRET is needed for the no-login presentation frontend
RIFT_ALLOW_LOCAL_ADAPTERS=false
RIFT_ADAPTER_ALLOWED_HOSTS=your-agent-adapter.example.com
RIFT_RATE_LIMIT_REDIS_URL=rediss://<user>:<password>@<private-redis-host>:<port>
BIFROST_BASE_URL=https://bifrost-deploy.onrender.com/v1
BIFROST_API_KEY=sk-bf-YOUR_VIRTUAL_KEY
BIFROST_MODEL=YOUR_CONFIGURED_MODEL
TAVILY_API_KEY=YOUR_TAVILY_KEY
TAVILY_BASE_URL=https://api.tavily.com
```


Before the first production deploy, provision a persistent Redis-compatible instance and set `RIFT_RATE_LIMIT_REDIS_URL` to its private TLS connection URL. The backend now refuses to start in production without reachable shared Redis because its in-memory development limiter is not safe across multiple workers or replicas. This presentation build runs in one shared workspace with auth disabled; anyone who can reach it can access and modify the same runs and consume provider resources. Restrict access at the hosting layer; do not expose it as a public multi-user service. Set `RIFT_ADAPTER_ALLOWED_HOSTS` to the exact hostnames of your adapter services (or leave it empty until any are registered); do not use wildcards. The repository retains backend authentication endpoints, but the current presentation frontend does not show a login screen. Re-enable `RIFT_AUTH_REQUIRED=true` only when deploying a frontend with the matching authenticated session flow and a stable `RIFT_AUTH_SECRET`.

`BIFROST_BASE_URL` is the separate AI gateway, **not** the RIFT API base URL. The code has this gateway URL as its default; set the same value explicitly in Render if an older `BIFROST_BASE_URL` environment variable is already present. Keep the Bifrost virtual key, Tavily key, and database credentials only on the backend.

## 3. CORS is built into the backend

The FastAPI backend includes `https://riftz.vercel.app` and local development origins in its exact-origin allowlist. It supports normal API preflight requests and the `/ws/{experiment_id}` WebSocket origin check. No `CORS_ORIGINS` environment variable is required for this deployment.

CORS middleware wraps the entire ASGI app so that error responses also receive CORS headers. This avoids browser errors that hide a backend 500 response as a CORS failure.

## 4. Verify the three-service path

1. Open `https://bifrost-1-qmoa.onrender.com/api/health`. It should return JSON with `"status":"ok"`.
2. Open `https://riftz.vercel.app`.
3. In DevTools → Network, confirm `/api/...` requests go to `https://bifrost-1-qmoa.onrender.com/api/...`.
4. Confirm experiment events connect to `wss://bifrost-1-qmoa.onrender.com/ws/...`.
5. In the RIFT backend's settings/integration status, confirm the Bifrost gateway URL is `https://bifrost-deploy.onrender.com/v1` and that the virtual key is configured.
6. Verify the remote assistant connector at `https://riftz.vercel.app/mcp/` after the backend redeploy completes. The connector requires `Authorization: Bearer <workspace-access-token>`; use an MCP client that supports custom authorization headers (RIFT does not yet expose MCP OAuth 2.1 discovery).

## Notes

- `VITE_API_BASE_URL` is public frontend configuration, not a secret.
- Never put Bifrost, Tavily, or database credentials in Vercel frontend environment variables.
- Render Free services can spin down when idle; the first request after inactivity may be delayed.
- Use Neon PostgreSQL for persistent benchmark data; SQLite on Render Free is not durable across restarts/redeploys.
- No Dockerfile or Docker deployment is required for the RIFT backend.

## Remote MCP connector

RIFT now exposes a full read-only MCP endpoint at `https://riftz.vercel.app/mcp/` with 21 read-only tools, 2 resources and an analysis prompt. It covers persisted benchmark tasks, agents, experiment configuration, runs, event traces, research/evidence snapshots, evaluations, reports and leaderboard data. The endpoint is hosted by the existing RIFT FastAPI service; the separate Bifrost gateway is only used for model requests. See [`docs/MCP_CONNECTORS.md`](docs/MCP_CONNECTORS.md) for setup, plan availability and the public-endpoint security note.
