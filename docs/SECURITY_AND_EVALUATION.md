# Security and evaluation operations

This document describes current demo-mode behaviour, the optional authenticated deployment path, and the remaining security/evaluation limits. A green health check is not a security certification or proof that a model judge is correct.

## 1. Current presentation deployment (no login)

The hackathon frontend opens directly into one shared workspace. Configure the backend to match:

```env
ENVIRONMENT=production
RIFT_AUTH_REQUIRED=false
RIFT_ALLOW_LOCAL_ADAPTERS=false
RIFT_ADAPTER_ALLOWED_HOSTS=your-agent-adapter.example.com
RIFT_RATE_LIMIT_REDIS_URL=rediss://<user>:<password>@<redis-host>:<port>
```

`RIFT_AUTH_SECRET` is not used when `RIFT_AUTH_REQUIRED=false`. Production startup still requires reachable shared Redis, local adapter access disabled, and a valid adapter allowlist for remote adapter registrations. If `RIFT_PUBLIC_API_BASE_URL` is configured for live event streaming, production also requires a stable `RIFT_ADAPTER_EVENT_SECRET`. If the provider fault proxy is enabled, `RIFT_PROXY_TOKEN` must be at least 32 characters.

**This no-login mode is only for a closed hackathon/demo deployment.** Anyone who can reach the app can read and modify the shared benchmark workspace, register adapters, start runs and consume configured Bifrost/Judge0 resources. Do not place customer or confidential data in it, and do not expose it to arbitrary users. Restrict access using a hosting-level access gate or network policy. Rate limits reduce abuse but do not create user identity, tenant isolation or per-user budgets.

## 2. Optional authenticated workspace mode

The backend retains the account and tenant-isolation implementation, but the current presentation frontend intentionally has no login screen. To use authenticated tenants, set:

```env
RIFT_AUTH_REQUIRED=true
RIFT_AUTH_SECRET=<stable-random-secret-at-least-32-characters>
RIFT_ALLOW_SIGNUP=false
RIFT_RATE_LIMIT_REDIS_URL=rediss://<user>:<password>@<redis-host>:<port>
```

Use a frontend build that includes the matching sign-in/token flow before enabling this setting; this repository's presentation frontend does not currently provide that flow and will receive HTTP 401 responses. Passwords in the retained backend auth path are stored as salted PBKDF2-HMAC-SHA256 hashes (310,000 iterations); access tokens are HMAC-signed, expire and can be revoked. Workspace data is stored in separate SQLite files or PostgreSQL schemas per tenant. This mode is not the active no-login demo configuration.

## 3. Rate limits

The application uses an atomic Redis sorted-set sliding window when `RIFT_RATE_LIMIT_REDIS_URL` is configured. Every worker/replica shares the same counters:

| Surface | Limit |
|---|---:|
| Login and registration | 8 requests / 5 minutes / peer IP |
| API and fault-proxy routes | 120 requests / minute / peer IP |
| MCP | 60 requests / minute / peer IP |

Responses include HTTP 429 and `Retry-After`. Production startup refuses to run without a reachable Redis service. Development/test can fall back to process-local in-memory buckets.

These are IP-level limits, not a complete abuse/quota system. Reverse proxies may make requests appear to originate from the same peer. Configure trusted proxy handling at ingress, add account/workspace spend quotas before public multi-user use, and do not trust arbitrary client-supplied `X-Forwarded-For` values. Keep a WAF/API-gateway limit as a second layer.

## 4. Adapter egress restrictions

Remote adapter registrations are restricted to HTTPS on port 443. In production, the hostname must match an exact operator-owned entry in `RIFT_ADAPTER_ALLOWED_HOSTS`. Wildcards are not supported. RIFT resolves the hostname before each request and rejects private, loopback, link-local, reserved or otherwise non-public IP addresses. Adapter calls do not follow redirects. Credentials in endpoint URLs and URL fragments are rejected. Loopback HTTP is available only when `RIFT_ALLOW_LOCAL_ADAPTERS=true`, which must be false in production.

Allowlist only domains controlled by your organization. DNS preflight validation is not a substitute for network-layer egress enforcement: DNS can change between validation and connection. For a public deployment, put adapter calls behind an outbound firewall/proxy that blocks RFC1918, loopback, link-local, cloud metadata and internal service ranges. Avoid registering arbitrary user-supplied endpoints on a shared no-login instance.

Event-sink credentials are HMAC-signed per-run tokens scoped to one run and tenant when auth is enabled, expire after one hour, and accept bounded event payloads and counts. In no-login mode, the shared workspace remains unscoped. Event telemetry should contain observable action summaries, not secrets, full customer records or hidden chain-of-thought.

## 5. Coding evaluation: Judge0 execution

Live Coding-10 fails closed unless `JUDGE0_API_URL` is configured. RIFT submits the candidate to a Judge0-compatible execution service with network disabled and explicit resource limits:

- CPU time: 2 seconds; wall time: 6 seconds.
- Memory: 128 MiB; stack: 64 MiB.
- Maximum processes/threads: 8.
- File-size limit: 1,024 KB; one execution.
- RIFT polling timeout: 5–60 seconds (`JUDGE0_TIMEOUT_SECONDS`).

The hidden acceptance assertions remain in the grader parent process. Candidate code runs in a separate child Python interpreter within the Judge0 submission; the child receives test inputs, while expected outputs and pass/fail decisions remain in the parent harness. This prevents candidate code from rewriting the parent assertion list. Judge0 provides the outer isolation boundary; RIFT does not implement an OS sandbox itself.

Configuration examples:

```env
JUDGE0_API_URL=https://your-judge0.example/api
JUDGE0_API_KEY=<Judge0 X-Auth-Token, if required>
JUDGE0_LANGUAGE_ID=113
JUDGE0_TIMEOUT_SECONDS=25
```

For RapidAPI deployments, set `JUDGE0_RAPIDAPI_HOST` and `JUDGE0_RAPIDAPI_KEY`; the client sends the corresponding RapidAPI headers. Configure only a trusted Judge0 service and confirm that its network-isabling and resource limits are enforced by the service, not merely accepted as request parameters. Demo mode uses AST/structural fixtures and is explicitly marked `structural_demo_only`; never present those as executed test results.

Coding-10 is currently a Python suite with task-specific executable examples, not a universal code correctness benchmark. Expand hidden cases, property tests, language coverage and adversarial sandbox tests before treating its score as a hiring or production gate.

## 6. Research and customer-support evaluation

### Research-10

Live Research-10 retrieves real evidence (Tavily) and sends the answer plus bounded source excerpts to the configured Bifrost evaluator model. The evaluator extracts factual claims, attempts to classify them as supported, contradicted or insufficient, and must provide the exact source URL and a verbatim quote. RIFT then deterministically checks that the quoted text occurs in that exact non-synthetic source excerpt. Quotes not present in the cited excerpt are downgraded to `insufficient`.

Set `RIFT_EVALUATOR_MODEL` to a model different from the agent's generator when possible. The evaluator is model-assisted, not an independent truth oracle. Quote presence proves textual provenance, not semantic entailment or real-world truth; an evaluator may overlook claims or misread context. Human reviewers can accept, reject or request review of a run and add claim-level review notes. Keep high-stakes/current claims under human review.

### Support-10

The live evaluator scores six dimensions: empathy, policy accuracy, no false promises, privacy/safety, actionable next step and clarity. A passing criterion must include an exact response substring; RIFT verifies the quote. Risk flags affect run success only when the quoted unsafe text is actually present in the answer. Unverified model-reported risk flags remain visible separately. This is not legal, medical or policy certification.

The six criteria are a starter rubric. Adapt them to each domain's policy and approved knowledge source. The deterministic checks and model judge should be treated as complementary signals, not one absolute grade.

## 7. Framework adapters and real usage telemetry

The common adapter contract accepts any existing agent behind an HTTP `/run` endpoint. Framework-specific adapters in `examples/` demonstrate LangGraph `astream_events(version="v2")` and CrewAI's typed event bus. The vanilla template works for any framework or plain Python. Adapters can push live events using the per-run sink and return the same events in a final response batch.

Supported event families include agent step start/completion/failure, tool call start/completion/failure, model request start/completion/failure, retries and fallbacks. RIFT counts starts (with completion fallback) to avoid counting both sides of one call. Model usage is taken only from explicit provider/framework `usage` data; missing tokens/cost remain unknown, never inferred from output length. LangGraph chain/runnable spans are observable framework events and can be more granular than conceptual agent steps; document the adapter's mapping when comparing frameworks.

The helper `RiftReporter.call_bifrost(...)` sends a request through an OpenAI-compatible Bifrost endpoint with a run-scoped `user` value, stable request ID and `x-bf-lh-rift-*` metadata. This is the simplest way for an external agent to participate in RIFT's real provider-fault proxy and correlate request-level usage. Existing framework clients can instead send the same metadata on each Bifrost call; see `docs/AGENT_ADAPTER.md`.

## 8. Real upstream provider faults through Bifrost

A live provider-failure trial must test the upstream boundary, not throw an exception inside the agent. Configure a dedicated Bifrost test deployment:

1. Expose RIFT's `/fault-proxy/v1` route over HTTPS to Bifrost.
2. Set `RIFT_PROVIDER_FAULT_PROXY_ENABLED=true`, a strong `RIFT_PROXY_TOKEN`, and the upstream base URL/key on RIFT.
3. In Bifrost, add a custom OpenAI-compatible primary provider whose base URL is `https://<rift-host>/fault-proxy/v1` and whose bearer token is `RIFT_PROXY_TOKEN`.
4. Configure a separate healthy fallback provider/route in Bifrost.
5. Ensure agent calls send `user=rift:<run_id>:<call_index>:<workspace_id>`; use `RiftReporter.call_bifrost` or replicate its correlation fields.
6. Run a live experiment with the provider fault enabled. RIFT records the injected 503 only when the request actually reaches the proxy. Recovery is counted only when a later successful Bifrost completion/fallback event is observed.

The proxy is deliberately narrow: it handles non-streaming OpenAI-compatible chat completions, is rate limited, requires a bearer token and is not a general-purpose unrestricted proxy. Keep it on a dedicated test route; never use it as your production primary provider. `RIFT_PROVIDER_FAULT_PROXY_ENABLED` defaults to false.

## 9. Remaining production controls

Before opening the current no-login presentation build to arbitrary users, add or configure:

- A shared ingress/WAF rate limiter and account-level quotas for multi-worker deployments.
- Network egress firewall rules for adapter and provider destinations.
- Secret management/rotation and encrypted database/backups.
- Tenant-aware retention, export and deletion policies.
- Monitoring/alerting for auth failures, adapter errors, unexpected outbound calls, judge failures and provider spend.
- A matching authenticated frontend, email verification, password reset, MFA/SSO or invite-only provisioning as appropriate.
- A reviewed privacy policy and retention notice for uploaded prompts, task outputs, evidence and traces.

RIFT contains application-layer controls, but this repository alone cannot configure your cloud account, WAF, firewall, DNS, database encryption, backup retention or provider credentials.
