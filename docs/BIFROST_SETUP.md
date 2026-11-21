# Bifrost and Tavily setup

## Standard live mode

1. Start Bifrost and configure at least one provider and a public model or virtual key.
2. Put the Bifrost OpenAI-compatible URL in `BIFROST_BASE_URL`, typically `http://localhost:8080/v1` for a local gateway.
3. Put the virtual key in `BIFROST_API_KEY` and the configured model name in `BIFROST_MODEL`.
4. Create a Tavily API key and set `TAVILY_API_KEY`.
5. Restart RIFT and check Settings. Both integrations should display Ready.
6. Launch a Live benchmark.

RIFT calls `POST {BIFROST_BASE_URL}/chat/completions` and uses the response usage object for token counts when available. Tavily search calls use the Search API. Keys are never sent to the browser.

## Testing real Bifrost upstream fallback

A provider failure should occur between Bifrost and its upstream provider if the purpose is to measure Bifrost fallback. An adapter-side exception only tests the agent's own recovery.

RIFT includes an optional OpenAI-compatible upstream fault proxy at:

`http://127.0.0.1:8000/fault-proxy/v1/chat/completions`

Configure a Bifrost custom OpenAI-compatible provider with:

- Base URL: `https://YOUR-RIFT-BACKEND.onrender.com/fault-proxy/v1` when Bifrost can reach the public RIFT backend.
- Authorization: `Bearer <RIFT_PROXY_TOKEN>`.
- Upstream target: set `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY` in RIFT's `.env`.

Then set `RIFT_PROVIDER_FAULT_PROXY_ENABLED=true`, configure that custom provider as the primary model route in Bifrost, and configure a separate healthy fallback deployment in Bifrost. RIFT tags model requests with a `user` correlation value of `rift:<run_id>:<call_index>`. The proxy uses the run's stored seed and fault profile to deterministically return HTTP 503 for selected primary-provider requests. Bifrost then handles retry or fallback according to its own configuration.

For a local demo where Bifrost's fallback is not configured, leave provider fault testing in Demo mode. Do not claim that an adapter-level demo fault measures Bifrost fallback.

## Limits

The included proxy handles non-streaming chat completion requests. It is designed for the RIFT benchmark path, not as a general-purpose public API gateway. Keep it private, use a long random token, configure upstream allowlists/firewall rules, and never expose it as an unrestricted proxy.

## Correlating full agent benchmarks with Bifrost request logs

Bifrost is an optional model-gateway integration inside RIFT, not the benchmark runner. RIFT's unit of evaluation is the complete agent task: it includes the agent's orchestration, prompt, tools, memory, retries and model calls. Bifrost contributes provider-side request telemetry such as model, token usage, cost, latency, retries and route/fallback information when its logging configuration and provider response expose them.

For each RIFT-managed model call, the benchmark runner sends a stable `x-request-id` in the form `rift-{run_id}-{call_index}` and attaches these Bifrost log metadata headers:

- `x-bf-lh-rift-run-id`
- `x-bf-lh-rift-experiment-id`
- `x-bf-lh-rift-task-id`
- `x-bf-lh-rift-agent-id`

Bifrost's `x-bf-lh-*` convention captures custom request metadata in its logs. Use the RIFT run ID to connect the model request with the complete agent trace. When Bifrost returns its own request ID, RIFT stores it on the run as well. RIFT does not claim to import every Bifrost log or provider metric automatically; request IDs and metadata let an operator retrieve the corresponding gateway log through Bifrost's API when needed.

Example lookup (replace the host and ID with your deployment values):

```bash
curl -H "Authorization: Bearer $BIFROST_API_KEY" \
  "http://localhost:8080/api/logs?request_id=rift-RUN_ID-0"
```

If your Bifrost deployment returns a different canonical request ID, use the `bifrost_request_id` stored in the RIFT run inspector. Confirm Bifrost logging is enabled for the deployment; do not interpret missing provider usage/cost as zero. RIFT keeps unknown usage unknown rather than inventing values.

This integration makes a model request traceable from a repeated benchmark trial, but the platform still grades the entire agent task rather than treating the model request as the benchmark result.

## External framework agents and seeded provider failures

The external adapter path can participate in the same true upstream-fault test. The adapter must send its model requests through the Bifrost test deployment and attach run correlation. The included `RiftReporter.call_bifrost(...)` helper does this automatically. It sends:

- `user=rift:<run_id>:<call_index>:<workspace_id>` in the OpenAI-compatible request body;
- `x-request-id=rift-<run_id>-<call_index>`;
- `x-bf-lh-rift-run-id`, `x-bf-lh-rift-task-id` and `x-bf-lh-rift-workspace-id` log metadata.

In a live external-agent provider-fault trial, RIFT fails closed unless `RIFT_PROVIDER_FAULT_PROXY_ENABLED=true`. If the agent does not send the correlated request through the proxy, RIFT records `provider.fault.not_observed`; it does not award recovery. If the proxy injects a 503 but no later successful model completion appears in the adapter trace, RIFT records `provider.recovery.not_observed`. A later completion is only evidence of recovery; use Bifrost's request logs to confirm which fallback route served it.

Keep this test gateway separate from the production model route. The proxy only supports non-streaming chat completions.
