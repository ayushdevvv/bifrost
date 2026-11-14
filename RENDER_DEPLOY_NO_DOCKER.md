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

`frontend/vercel.json` provides the SPA fallback for client-side routes.

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
SERVE_FRONTEND=false
DATABASE_URL=YOUR_NEON_POSTGRES_CONNECTION_STRING
BIFROST_BASE_URL=https://bifrost-deploy.onrender.com/v1
BIFROST_API_KEY=sk-bf-YOUR_VIRTUAL_KEY
BIFROST_MODEL=YOUR_CONFIGURED_MODEL
TAVILY_API_KEY=YOUR_TAVILY_KEY
TAVILY_BASE_URL=https://api.tavily.com
```

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

## Notes

- `VITE_API_BASE_URL` is public frontend configuration, not a secret.
- Never put Bifrost, Tavily, or database credentials in Vercel frontend environment variables.
- Render Free services can spin down when idle; the first request after inactivity may be delayed.
- Use Neon PostgreSQL for persistent benchmark data; SQLite on Render Free is not durable across restarts/redeploys.
- No Dockerfile or Docker deployment is required for the RIFT backend.

## 5. PostgreSQL integer overflow fix

Run seeds are now masked to the non-negative signed 32-bit range (`0` to `2,147,483,647`) before insertion. This prevents PostgreSQL `INTEGER` overflow in `runs.seed`; no database schema migration or manual SQL change is required. The seed remains deterministic for the same master seed, task, and repetition.
