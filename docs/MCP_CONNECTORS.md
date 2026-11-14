# RIFT Arena remote MCP connector

RIFT exposes a read-only Model Context Protocol (MCP) server for ChatGPT, Claude and other clients that support remote Streamable HTTP MCP servers.

## Endpoint

Use the branded Vercel endpoint:

```text
https://riftz.vercel.app/mcp/
```

Vercel proxies `/mcp` and `/mcp/` to the RIFT FastAPI service at `https://bifrost-1-qmoa.onrender.com/mcp/`. The Bifrost model gateway at `https://bifrost-deploy.onrender.com` is separate and is not the MCP endpoint.

## Tools

The server exposes read-only tools:

- `rift_get_overview`
- `rift_list_tasks`
- `rift_list_agents`
- `rift_list_experiments`
- `rift_get_experiment`
- `rift_list_runs`
- `rift_get_run`
- `rift_get_leaderboard`
- `rift_get_evaluation_summary`
- `rift_get_experiment_report`
- `rift_list_research_snapshots`
- `rift_get_research_snapshot`

No tool creates experiments, cancels runs, registers agents, changes settings, or calls model providers. This connector does not trigger Bifrost or Tavily spend.

## Render deployment

The backend's `requirements.txt` pins the official MCP Python SDK (`mcp==2.3.0`). The API mounts the Streamable HTTP app at `/mcp/`, starts the MCP session manager with the FastAPI lifespan, and permits the service host plus the Vercel proxy host in MCP transport security.

Deploy the backend from the `backend` directory using the existing native Python Render commands:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

No Dockerfile or extra Render service is needed for MCP. The existing RIFT backend hosts both the REST API and MCP endpoint.

## Vercel routing

`frontend/vercel.json` rewrites `/mcp` and `/mcp/` to the RIFT backend before the single-page-app fallback. Keep the Vercel frontend's existing `VITE_API_BASE_URL` unchanged.

## Connect Claude

1. Open **Customize → Connectors** in Claude.
2. Choose **Add custom connector**.
3. Name it `RIFT Arena` and enter `https://riftz.vercel.app/mcp/`.
4. Choose **No sign in** because the current endpoint has no authentication.
5. Add the connector and enable it in a conversation.

Official guide: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

## Connect ChatGPT

ChatGPT custom MCP app availability depends on account and workspace plan. For supported accounts, open the web app's **Plugins / Apps** area, add a custom MCP server, and enter `https://riftz.vercel.app/mcp/`. On Pro, current OpenAI documentation describes read/fetch access; full MCP is available for Business and Enterprise/Edu workspaces.

Official guide: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt

## Security and privacy

The endpoint is public and currently unauthenticated. Read-only means clients cannot change RIFT data, but anyone who discovers the URL can read benchmark tasks, agent names, experiments, run traces, outputs and saved research snapshots exposed by these tools. Do not put secrets, private customer data or sensitive prompts into RIFT records while this public connector is enabled. Add authentication and per-user authorization before using it for private workspaces.
