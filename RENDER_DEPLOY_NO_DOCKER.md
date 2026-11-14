# RIFT Arena: Vercel frontend + Render backend (no Docker)

This is the deployment layout for the current setup:

- **React + Vite frontend:** Vercel
- **FastAPI backend:** Render at `https://riftz.onrender.com`
- **Database:** Neon PostgreSQL (recommended; Render Free local files are ephemeral)

The frontend is already configured to call the Render API through `VITE_API_BASE_URL`. The production default is stored in `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://riftz.onrender.com/api
```

`frontend/vercel.json` provides the SPA fallback so client-side routes resolve to `index.html`. The app derives the WebSocket URL from the API URL, so HTTPS automatically becomes WSS and connects to `wss://riftz.onrender.com/ws/{experiment_id}`.

## 1. Render backend (existing service)

Open the existing Render Web Service for `riftz.onrender.com`.

- Runtime: **Python 3** (not Docker)
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`

Set these environment variables in the Render backend service:

```env
SERVE_FRONTEND=false
DATABASE_URL=YOUR_NEON_POSTGRES_CONNECTION_STRING
BIFROST_BASE_URL=https://YOUR-BIFROST-HOST/v1
BIFROST_API_KEY=sk-bf-YOUR_VIRTUAL_KEY
BIFROST_MODEL=YOUR_CONFIGURED_MODEL
TAVILY_API_KEY=YOUR_TAVILY_KEY
TAVILY_BASE_URL=https://api.tavily.com
```

CORS is already configured in the backend to allow `https://riftz.vercel.app` plus local development origins. You do not need to add a CORS environment variable for this deployment. If you later use a custom frontend domain, you may optionally add it through `CORS_ORIGINS` as a comma-separated list of exact origins (no trailing slash). Wildcard origins are ignored.

If the Render service's Root Directory is the repository root instead of `backend`, use:

- Build: `pip install -r backend/requirements.txt`
- Start: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## 2. Vercel frontend

Import the same GitHub repository into Vercel.

- Framework Preset: **Vite**
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install` (or leave the Vercel default)

Set this environment variable in Vercel under **Project → Settings → Environment Variables** for Production (and Preview if you use preview deployments):

```env
VITE_API_BASE_URL=https://riftz.onrender.com/api
```

The repository also includes `frontend/.env.production` with this same public API base URL, so a normal production Vite build has the correct default even when the dashboard variable has not yet been added. Vercel dashboard values override `.env.production` values.

Deploy the project at `https://riftz.vercel.app`. The backend CORS allowlist already includes this exact production origin.

## 3. Verify

1. Open `https://riftz.onrender.com/api/health`. It should return a JSON response with `"status":"ok"`.
2. Open the Vercel frontend URL.
3. In browser DevTools → Network, confirm API requests go to `https://riftz.onrender.com/api/...` and not to the Vercel domain.
4. Start an experiment and confirm the WebSocket connects to `wss://riftz.onrender.com/ws/...`.
5. The production origin `https://riftz.vercel.app` is built into the backend allowlist. For a different custom domain, optionally add that exact origin through `CORS_ORIGINS` and redeploy.

## Notes

- `VITE_API_BASE_URL` is a public frontend setting, not a secret. Do not put Bifrost, Tavily, or database keys in Vercel frontend environment variables.
- Keep provider and database credentials only in the Render backend environment.
- Render Free services can spin down when idle. The first API request after inactivity may be delayed.
- Use Neon PostgreSQL for persistent benchmark data; SQLite on Render Free is not durable across service restarts/redeploys.
- No Dockerfile or Docker deployment is required for this layout.
