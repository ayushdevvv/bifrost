# RIFT Arena full read-only MCP connector

RIFT exposes a remote Model Context Protocol (MCP) server over Streamable HTTP. It is designed to work with ChatGPT, Claude and other MCP-compatible clients.

## Endpoint

```text
https://riftz.vercel.app/mcp/
```

The Vercel frontend proxies `/mcp` and `/mcp/` to the RIFT FastAPI backend at `https://bifrost-1-qmoa.onrender.com/mcp/`. The Bifrost model gateway at `https://bifrost-deploy.onrender.com` is a separate service and is not the MCP endpoint.

## Full read-only scope

The connector provides read-only access to the persisted RIFT workspace data:

- Workspace overview and data catalog
- Benchmark task suite, full task prompts and scoring expectations
- Registered agents and their public configuration (adapter endpoint URLs are not exposed)
- Experiment configurations, selected agents/models/tasks, repetitions, fault settings, budgets and status
- Run records, outputs, metrics, source references, errors and seeds
- Ordered execution event traces and event payloads
- Experiment evidence snapshots and their source passages/hashes
- Saved research queries, answers and source passages
- Evaluation summaries, comparisons, reports and leaderboard
- Safe integration status and database record counts (no API keys or passwords)

The MCP server includes 21 read-only tools:

- `rift_search_workspace`
- `rift_get_data_catalog`
- `rift_get_overview`
- `rift_list_tasks`
- `rift_get_task`
- `rift_list_agents`
- `rift_get_agent`
- `rift_list_experiments`
- `rift_get_experiment`
- `rift_list_runs`
- `rift_get_run`
- `rift_get_run_events`
- `rift_list_events`
- `rift_get_experiment_evidence`
- `rift_get_leaderboard`
- `rift_get_evaluation_summary`
- `rift_get_experiment_report`
- `rift_list_research_snapshots`
- `rift_get_research_snapshot`
- `rift_get_integration_status`
- `rift_get_database_summary`

The server also exposes read-only resources `rift://workspace/catalog` and `rift://benchmark/tasks`, plus the `rift_analyze_experiment` analysis prompt. All tools carry MCP `readOnlyHint` annotations. No write tools are registered: clients cannot create/cancel experiments, register/delete agents, edit settings, change credentials, or trigger Bifrost/Tavily usage.

## Render deployment

The backend's `requirements.txt` pins the official MCP Python SDK (`mcp==2.3.0`). The FastAPI application mounts the Streamable HTTP app at `/mcp/` and starts its session manager in the application lifespan.

Deploy from the `backend` directory using the existing native Python Render commands:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

No Dockerfile or extra Render service is required for MCP. The existing RIFT backend hosts both the REST API and MCP endpoint.

## Vercel routing

`frontend/vercel.json` rewrites `/mcp` and `/mcp/` to the RIFT FastAPI backend before the SPA fallback. Keep the frontend's existing `VITE_API_BASE_URL` unchanged; MCP uses its own Vercel rewrite.

## Connect Claude

Remote MCP custom connectors are available on Claude Free, Pro, Max, Ultra, Team and Enterprise plans. Free accounts are limited to one custom connector.

1. Open Claude → Customize → Connectors.
2. Choose Add custom connector.
3. Name it `RIFT Arena`.
4. Enter `https://riftz.vercel.app/mcp/`.
5. Configure HTTP Bearer authentication and send `Authorization: Bearer <workspace-access-token>`. The connector client must support custom authorization headers.
6. Add the connector and enable it in a conversation. Access tokens expire; sign in again when the token expires.

Claude's official setup guide: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

## Connect ChatGPT

Custom MCP availability in ChatGPT depends on plan and workspace permissions. OpenAI's current help article lists custom MCP connections for Business and Enterprise/Edu workspaces; its FAQ also mentions read/fetch custom MCP access for Pro. Free access is not currently documented as supported.

For an eligible account:

1. Open ChatGPT on the web and go to Plugins.
2. Select `+` → `Add custom MCP server`.
3. Name it `RIFT Arena`.
4. Enter `https://riftz.vercel.app/mcp/`.
5. Configure HTTP Bearer authentication and send `Authorization: Bearer <workspace-access-token>`. The client must support a custom authorization header.
6. Review the discovered tools and create the plugin.
7. Start a new chat and select `RIFT Arena` from Plugins / `@` app selection.

OpenAI's connection guide: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

## Workspace authentication and security

The MCP endpoint is not public. Every request must include a valid workspace access token in `Authorization: Bearer <token>`. Obtain a token through the RIFT sign-in flow (`POST /api/auth/login` or the registration flow while signup is enabled). All MCP reads use the authenticated tenant context; tools are read-only and cannot launch or mutate experiments.

Only connect from an MCP client that can attach a custom Bearer authorization header. Some client integrations support only OAuth 2.1 discovery or do not expose custom headers; those clients cannot authenticate against this endpoint yet. RIFT does not currently implement the MCP OAuth 2.1 authorization-server flow. Do not disable authentication or distribute a shared admin token to work around that limitation. Tokens are short-lived and logout revokes them.
