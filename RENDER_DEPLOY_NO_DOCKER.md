# RIFT Arena on Render (no Docker)

This project is configured for a native Render deployment with two services:

1. **RIFT API**: Python Web Service (FastAPI + Uvicorn)
2. **RIFT frontend**: Static Site (React + Vite)

The frontend is separate so the Python service does not need Node.js installed. The API supports cross-origin HTTP and WebSocket connections from the Static Site.

## A. Existing backend service (`riftz.onrender.com`)

In Render, open the existing RIFT backend Web Service and set:

- Runtime: **Python 3** (not Docker)
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`

Set these environment variables in the backend service:

```env
SERVE_FRONTEND=false
CORS_ORIGINS=*
DATABASE_URL=YOUR_NEON_POSTGRES_CONNECTION_STRING
BIFROST_BASE_URL=https://YOUR-BIFROST-SERVICE.onrender.com/v1
BIFROST_API_KEY=sk-bf-YOUR_VIRTUAL_KEY
BIFROST_MODEL=YOUR_CONFIGURED_MODEL
TAVILY_API_KEY=YOUR_TAVILY_KEY
TAVILY_BASE_URL=https://api.tavily.com
```

Keep secrets in Render Environment, never in Git. Set `DATABASE_URL` to Neon PostgreSQL for persistence; Render Free's local filesystem is ephemeral.

If your existing Render service uses the repository root as its Root Directory instead of `backend`, use these commands instead:

- Build: `pip install -r backend/requirements.txt`
- Start: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## B. Create the React Static Site

In Render, choose **New → Static Site** and connect the same GitHub repository.

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Add this environment variable to the Static Site before its build:

```env
VITE_API_BASE_URL=https://riftz.onrender.com/api
```

Then deploy the Static Site. Its generated `onrender.com` URL is the frontend URL. The app uses `VITE_API_BASE_URL` for API requests and derives the matching `wss://` WebSocket address automatically.

## C. Verify

1. Open `https://riftz.onrender.com/api/health`. Expect `{"status":"ok", ...}`.
2. Open the frontend Static Site URL.
3. Open Settings and test Bifrost and Tavily.
4. Run a Demo benchmark first, then a Live benchmark after provider credentials are configured.

## Local development

The existing `run.ps1` and `run.sh` launchers still build the frontend and serve it from FastAPI locally. Docker is not required or included in this deployment setup.
