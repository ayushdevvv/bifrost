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
