# Deploy the direct-workspace UI and fix the blank screen

## What changed

- The frontend no longer contains a sign-in or login gate. It opens directly in **Benchmark Lab** on every fresh load, even when an old URL hash points at an appendix page.
- The old authenticated render branch was removed. React hooks now execute in a stable order across renders; the previous gate could return before later hooks and trigger React error #310 (rendered more hooks than during the previous render).
- The backend defaults to `RIFT_AUTH_REQUIRED=false` for this presentation build. Its API remains a single shared workspace, not tenant-isolated.
- MCP monitor, Bifrost route replay, request datasets and the 3D replay view remain secondary Appendix pages.

## Deploy steps

1. Push this project version to the Git repository connected to Vercel and Render.
2. In Vercel, set the Root Directory to `frontend`, Build Command to `npm run build`, Output Directory to `dist`, and `VITE_API_BASE_URL=https://bifrost-1-qmoa.onrender.com/api`.
3. Redeploy the frontend with **Clear Build Cache** enabled so Vercel cannot serve the previous bundle containing the login gate.
4. In Render, explicitly set `RIFT_AUTH_REQUIRED=false`. Existing Render environment variables override the new source default.
5. Keep `RIFT_RATE_LIMIT_REDIS_URL` configured because the backend requires shared Redis in production. Keep `DATABASE_URL` and provider keys on the backend only.
6. Redeploy the Render API and verify `https://bifrost-1-qmoa.onrender.com/api/health` returns `security.authentication_required: false` and `security.access_mode: single_shared_workspace`.
7. Open the Vercel app and hard-refresh (`Ctrl+Shift+R`). Confirm the first page is Benchmark Lab and `/api/overview` plus `/api/agents` return successfully without an Authorization header.

## Security warning

No-login mode is intended for a closed hackathon demo. Anyone who can reach the deployment can read and modify the same workspace and may launch runs that consume provider and Judge0 quota. Put the site behind a hosting-level access gate or restrict access at ingress. Do not use this mode for an unrestricted multi-user service. The backend's authentication endpoints remain in the code, but this frontend intentionally does not implement that sign-in flow.

## Verification status

The app source passed JSX transformation and a static hook-order audit. Backend tests cover no-token access in no-login mode. A Vite production bundle was not built in the editing environment because npm registry DNS resolution failed; Vercel will need to complete the dependency install and build on deployment.
