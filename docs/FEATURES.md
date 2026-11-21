# RIFT Agent Benchmark Platform

RIFT evaluates complete AI agent configurations, not isolated model outputs. It runs framework-independent agents against matched tasks, repeats trials, injects controlled failures and preserves detailed execution records so developers can compare task success, steps, tool calls, tokens, cost and time.

## Working areas

The app opens directly in **Benchmark Lab**. Product and architecture information is kept under **About RIFT**, the final sidebar destination.

| Area | Purpose |
|---|---|
| Benchmark Lab | Select Coding-10, Research-10 or Support-10; match task sets, agents, models, budgets, seeds and repetitions |
| Agent registry | Register an existing agent behind a thin HTTP adapter; framework code stays outside RIFT |
| Run inspector | Inspect the final response, task assertions, token/cost usage, Bifrost request ID and ordered step/tool/model events |
| Compare experiments | Compare configurations on shared tasks and seeded conditions |
| Fault testing | Inject provider unavailability, broken tools, misleading instructions, poisoned research evidence and latency |
| Failure analysis | Run controlled one-variable counterfactuals against the original task and evidence snapshot |
| Regression suite | Save important failures and replay them against later agent versions |
| Execution replay | Inspect the recorded sequence as a replayable timeline and 3D event view |
| Evaluation reports | Review task quality, category metrics, pass@k, reliability@k, quality variance and cost completeness |
| Leaderboard | Rank configurations by measured task outcomes, not marketing claims |
| Bifrost gateway | Optional model gateway integration and route workload testing |
| MCP manifest monitor | Optional tool-server manifest history and drift alerts; not the primary product workflow |
| About RIFT | Architecture, implementation notes and product information |

## Benchmark categories

| Suite | Tasks | Evaluation approach |
|---|---:|---|
| Coding-10 | 10 | Live mode executes candidate functions in a child interpreter inside Judge0, with hidden task-specific acceptance assertions retained by the grader parent. Network and resource limits are requested from Judge0. Demo mode is AST/structural-only. |
| Research-10 | 10 | Deterministic task checks plus model-assisted factual-claim extraction and claim-to-excerpt support/contradiction review. Accepted claims require a verbatim quote from the cited non-synthetic source, checked by RIFT. |
| Support-10 | 10 | Deterministic checks plus a model-assisted policy rubric covering empathy, policy accuracy, false promises, privacy/safety, next steps and clarity. Passing criteria and active risk flags require exact answer-local quotes. |

The category graders are transparent MVP rubrics, not validated academic benchmarks. Judge0 supplies the outer execution isolation for live coding; RIFT itself is not an OS sandbox. The Python suite is limited to ten tasks and should be expanded with property-based tests, additional hidden cases and adversarial submissions. Research quote presence does not prove semantic entailment or independent truth, and support model judgments can misclassify nuanced policy language. Human review remains important for high-stakes comparisons.

## Matched experiments and repeatability

- Every selected agent receives the same task objective and suite configuration. Research snapshot mode shares one evidence pack for the task across agents and repetitions.
- Configurable repetitions run each selected agent/model/task combination multiple times. RIFT records the repetition index and deterministic seed.
- `pass@k` is the observed fraction of repeated agent/task groups with at least one successful trial.
- `reliability@k` is the observed fraction of groups where every repetition succeeds.
- Quality standard deviation reports outcome spread across repeated trials. These are descriptive values for the configured repetitions, not universal estimates of production reliability.
- Seeds reproduce RIFT's fault assignment and fixture decisions, not stochastic model output, external systems or live web results.
- Experiments are capped at 80 runs, with configurable step, tool-call, wall-clock and per-run cost budgets.

## Framework-independent adapter and traces

Any agent can be registered through the same HTTP adapter contract. The wrapper invokes the existing framework or hand-written orchestration loop; RIFT does not require agents to be rewritten. Adapters return the final output, explicit usage counters and a batch trace. When `RIFT_PUBLIC_API_BASE_URL` is set, RIFT sends a per-run authenticated event-sink URL/token so an adapter can stream step, tool, model, retry and memory events while it runs. Included examples show LangGraph `astream_events(version="v2")`, CrewAI's typed event listener and a framework-neutral reporter. `RiftReporter.call_bifrost` adds Bifrost request IDs and task/workspace metadata so provider outages can be tied to one agent run. Events never need to include hidden chain-of-thought.

See [`AGENT_ADAPTER.md`](AGENT_ADAPTER.md) for the request/response schema and live event callback.

## Bifrost integration

Bifrost is an optional model gateway and telemetry source, not the centre of the product. RIFT adds a stable `x-request-id` to model calls and `x-bf-lh-rift-*` logging headers for run, experiment, task and agent IDs. Bifrost's logging plugin captures `x-bf-lh-*` values as request metadata; request IDs can be queried in Bifrost's Logs API. This creates a join between a RIFT agent run and the underlying gateway request record without claiming that gateway telemetry explains the entire agent trajectory.

Bifrost exposes request-level model, token, cost, latency and routing/fallback information. RIFT adds task outcomes, agent steps, tool events, repeated trials and controlled fault context. Unknown cost/token metrics remain unavailable; RIFT does not infer them from response length.

See [`BIFROST_SETUP.md`](BIFROST_SETUP.md) for gateway configuration.

## Reliability workflows

- **MCP manifest monitoring:** captures Streamable HTTP tool manifests, canonical SHA-256 snapshots and tool/schema/permission/capability drift. It is an optional dependency-monitoring tool.
- **Counterfactual failure analysis:** compares actual child runs after removing one injected condition at a time and includes a clean control. These are controlled comparisons, not formal causal inference.
- **Regression memory:** stores the original task, agent/model, seed, budget, fault schedule and evidence snapshot. Replays reuse the captured evidence so the task context does not silently change.
- **Bifrost routing replay:** compares candidate gateway routes on a fixed request workload. This complements agent-level benchmarking; it does not replace it.

See [`RELIABILITY_WORKFLOWS.md`](RELIABILITY_WORKFLOWS.md) for API and implementation details.

## Fault model

| Fault | Demo mode | Live mode |
|---|---|---|
| Provider outage | Records simulated 503 and baseline fallback events | Requires RIFT's upstream fault proxy as a dedicated Bifrost custom provider, run-scoped `user` correlation, and a separate healthy fallback route. For external adapters, the proxy must actually observe the request and a later model completion before RIFT counts recovery. |
| Tool unavailable | Injects a task-context tool outage for coding/support or a research-tool outage | Same policy; no fabricated successful tool response |
| Misleading instruction | Adds explicitly untrusted adversarial context | Same injection, supplied to the real agent |
| Evidence poisoning | Adds a synthetic `.invalid` source to research snapshots | Same synthetic source; never modifies a real page |
| Latency | Adds a controlled delay | Delays the eligible task/tool path |

Fault schedules derive from a master seed, task, repetition, fault type and eligible call index. Not every small sample necessarily exercises every fault at the configured probability.

## Demo and live modes

Demo mode uses clearly labelled generated fixtures and does not contact Bifrost or Tavily, even when credentials are configured. It is for checking the workflow, UI and test harness, not for claiming real model performance. Live mode requires Bifrost credentials. Research-10 additionally requires Tavily; Coding-10 and Support-10 do not.

## Known boundaries

- Coding live execution depends on an operator-configured, trusted Judge0-compatible service. Demo mode does not execute code. Validate the sandbox provider's actual isolation configuration.
- Built-in RIFT agents are lightweight reference baselines. The primary framework-independence path is the external adapter for existing agents.
- Agent traces are only as complete as the events reported by the adapter. Bifrost observes model traffic through the gateway but cannot infer private agent planning or memory transitions.
- The research and support judges are model-assisted. Exact quote checks are deterministic, but semantic entailment and policy correctness still need human/domain review.
- Authentication, per-workspace SQLite/PostgreSQL isolation, revocable tokens, rate limiting, adapter host allowlists and tenant-checked WebSockets are included. The rate limiter is per-process; configure a shared ingress limiter for replicas.
- Adapter DNS preflight checks do not replace network-layer egress firewalls. Configure private-network blocking and cloud metadata protection at the deployment boundary.
- Email verification, password reset, MFA/SSO, tenant retention/deletion workflows, encrypted backups and full operational monitoring remain deployment/product work.
