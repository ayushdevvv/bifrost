# Publish a real Coding-10 benchmark

This runbook creates an auditable comparison of two actual agent configurations, not two model names:

- **Vanilla Python loop:** one-pass Bifrost generation, local syntax-check tool, optional model-assisted repair.
- **LangGraph agent:** plan → implement → validate → review graph using the same Bifrost model route and syntax-check tool.

The protocol runs both configurations on all 10 Coding-10 tasks with five repetitions, first with no injected fault and then with the agent-side syntax-check tool unavailable. That is 200 task executions in total. RIFT grades candidate code independently through Judge0 in live mode.

The tool outage is intentionally narrow: it tests an agent's response to an unavailable tool. It is **not** a Bifrost provider outage or a provider failover benchmark.

## 1. Deploy the two real agent adapters

Create a separate Python web service from the repository root (Render can deploy it as another Web Service):

- Runtime: Python 3.11+
- Build command:

```bash
pip install -r backend/requirements.txt && pip install -r examples/requirements-live-agents.txt
```

- Start command:

```bash
uvicorn examples.live_agents:app --host 0.0.0.0 --port $PORT
```

Configure these environment variables on the adapter service:

```env
BIFROST_BASE_URL=https://your-bifrost-host/v1
BIFROST_API_KEY=YOUR_BIFROST_VIRTUAL_KEY
BIFROST_MODEL=YOUR_REAL_MODEL_ALIAS

# Set both to the provider's published USD price per 1M tokens.
# Leave blank when unknown; RIFT will leave cost unavailable.
MODEL_INPUT_COST_PER_1M=
MODEL_OUTPUT_COST_PER_1M=
```

The adapter exposes `/health`, `/vanilla/run` and `/langgraph/run`. Both agent configurations use the model alias supplied in the RIFT experiment request. The LangGraph service requires the `langgraph` package from `examples/requirements-live-agents.txt`.

After deployment, open `https://<adapter-host>/health`. It should return `status: ok`, `bifrost_configured: true` and list both adapter names. This confirms configuration is present, not that the upstream model key is valid; run the first single-task smoke test before launching the full 200-run batch if you want to limit spend.

## 2. Configure the RIFT backend

In Render's RIFT API service, configure:

```env
ENVIRONMENT=production
RIFT_AUTH_REQUIRED=false
RIFT_ALLOW_LOCAL_ADAPTERS=false
RIFT_ADAPTER_ALLOWED_HOSTS=<exact-adapter-hostname>.onrender.com
RIFT_RATE_LIMIT_REDIS_URL=rediss://<user>:<password>@<redis-host>:<port>

BIFROST_BASE_URL=https://your-bifrost-host/v1
BIFROST_API_KEY=YOUR_BIFROST_VIRTUAL_KEY
BIFROST_MODEL=YOUR_REAL_MODEL_ALIAS

JUDGE0_API_URL=https://ce.judge0.com
JUDGE0_LANGUAGE_ID=113
JUDGE0_TIMEOUT_SECONDS=25
```

For RapidAPI Judge0, also set `JUDGE0_RAPIDAPI_HOST` and `JUDGE0_RAPIDAPI_KEY`. For a private Judge0 deployment, use its own API URL and token setting. Confirm your selected service plan allows the submission volume; public free endpoints may rate-limit or be unavailable.

The no-login frontend and backend must agree: explicitly set `RIFT_AUTH_REQUIRED=false` on Render. This makes one shared workspace accessible to anyone who can reach the deployment. Keep the demo behind a hosting-level access gate or otherwise restrict who can use it. Do not publish sensitive prompts or data. The backend still requires a shared Redis URL in production.

Only the adapter's exact hostname goes in `RIFT_ADAPTER_ALLOWED_HOSTS`; do not use a wildcard. The backend rejects loopback adapters and private/reserved IP destinations in production.

## 3. Run the publication script

From the repository root, in PowerShell:

```powershell
$env:RIFT_API_URL = "https://<rift-api-host>.onrender.com/api"
$env:RIFT_AGENT_BASE_URL = "https://<adapter-host>.onrender.com"
$env:RIFT_LIVE_MODEL = "<real-bifrost-model-alias>"
python tools/publish_live_coding10.py --repetitions 5
```

If workspace authentication is enabled on a different deployment, also set `RIFT_ACCESS_TOKEN` to a valid token. The included presentation frontend intentionally has no login flow, so the recommended hackathon demo setting is `RIFT_AUTH_REQUIRED=false` with network/hosting access restricted.

The script:

1. Checks RIFT health.
2. Registers or reuses the two external agent configurations.
3. Runs 100 live baseline tasks (2 configurations × 10 tasks × 5 repetitions).
4. Runs another 100 live tasks with the syntax-check tool unavailable.
5. Waits for actual experiment status and retrieves run-level results.
6. Saves JSON plus a Markdown report under `artifacts/`.

Default timeout is four hours. If the script times out, the RIFT experiment may still be running; check the Run Inspector before launching another copy. Do not run multiple copies concurrently without checking provider and Judge0 quotas.

## 4. Verify before publishing

In each JSON condition:

- `mode` must be `live`.
- Expected and received run counts must match.
- Every task run used for aggregate results must have a terminal result; inspect incomplete/failed runs separately.
- Each Coding-10 result should contain `validation_status: executed` and `grader_type: code_sandbox`.
- `simulated` must be false.
- Token values must originate from Bifrost usage or reported adapter events.
- Cost must originate from Bifrost-reported cost or configured token pricing. Unknown stays null.
- The tool-outage run record must show `tool_unavailable_injected: true` for the trials selected by the seeded schedule. With severity 100, all should be selected.

The Markdown report uses **pass@5** for at least one success across five repetitions and **pass^5** for all five successes. Earlier RIFT UI versions called pass^5 `reliability@5`; use pass^5 in judging materials. The report also includes average steps, tool calls, tokens, latency and cost per verified task success.

## 5. What not to claim

- Do not use results from `mode=demo` as model or agent performance.
- Do not claim LangGraph is generally better from one model alias and one 10-task suite. This is one measured comparison of two concrete agent configurations.
- Do not compare cost if provider pricing is missing or costs are only partially observed.
- Do not call the tool-outage experiment a provider outage.
- Do not claim framework telemetry is identical in granularity. RIFT aggregates the event families the adapter reports; inspect the run trace if a framework emits extra internal spans.
