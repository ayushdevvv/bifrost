# RIFT competitive positioning

Research checked: 21 November 2026. Public product capabilities change; this note is a positioning guide, not an exhaustive competitor audit.

## The product, in one sentence

**RIFT is a task-level benchmarking platform for complete agent configurations** — prompts, tools, memory, orchestration and retry behaviour — measured against identical workloads over repeated trials and controlled failures.

The benchmark unit is not an isolated model request. It is an agent configuration completing a task under a defined budget and environment.

## Existing solutions and the gap RIFT targets

| Product | Existing strength | RIFT's boundary |
|---|---|---|
| [Bifrost](https://github.com/maximhq/bifrost) | AI gateway: provider routing, retries/fallbacks, request logs, token/cost/latency telemetry and custom metadata. | RIFT does not replace gateway routing. It evaluates the complete agent outcome at task level and links gateway requests to agent runs. |
| [LangSmith](https://www.langchain.com/langsmith/evaluation) | Framework-agnostic tracing, dataset evaluation, experiment comparison, offline/online evaluators and trace-to-dataset regression workflows. | RIFT should not claim tracing, evaluation datasets or regression tests are individually novel. |
| [Braintrust](https://www.braintrust.dev/) | Agent traces, cost/latency/quality monitoring, versioned datasets, side-by-side evaluations and human/automated scoring. | A trace viewer plus evaluator dashboard is not a differentiator by itself. |
| [Inspect AI](https://inspect.aisi.org.uk/) | Open evaluation framework with broad task libraries, composable solvers/scorers, tool support and external agent execution. | RIFT should not compete on number of prebuilt academic benchmarks. |
| [Promptfoo](https://www.promptfoo.dev/docs/red-team/mcp-security-testing/) | LLM/agent red-teaming and MCP security testing. | General prompt-injection or tool-security testing is not unique to RIFT. |

RIFT's intended contribution is the integrated workflow: matched complete agent configurations, repeated task-level trials, observable efficiency, controlled fault conditions, trace-based investigation and regression replay. Individual techniques overlap with the ecosystem; do not pitch them as unprecedented.

## The single story to demonstrate

1. **Register two existing agent configurations.** Use thin HTTP adapters; keep each agent's framework, prompts, tools and memory outside RIFT.
2. **Choose one category and matched task suite.** Both agents receive the same task versions, budgets and repetition protocol.
3. **Run repeated trials.** Show task success, steps, tool calls, model calls, tokens, measured cost and end-to-end latency.
4. **Compare the configurations.** Use pass@k, pass^k, variance and the cost-versus-pass^k Pareto frontier.
5. **Inject a controlled failure.** Start with a broken tool, then inspect how each complete agent configuration responds.
6. **Inspect and explain a failed task.** Open its ordered trace and run a one-variable counterfactual to test a failure hypothesis.
7. **Save and replay the regression.** Preserve the task, seed, fault schedule and evidence snapshot; rerun it after changing the agent.

Keep the main navigation focused on Benchmark Lab, Agent registry, Compare, Run inspector, Fault testing, Failure analysis, Regression suite and Evaluation reports. MCP manifest monitoring, Bifrost route replay, request datasets and the 3D execution arena are appendix integrations, not the opening product story.

## Metrics and terminology

- `pass@k`: fraction of task/configuration groups with **at least one** successful run among k repetitions.
- `pass^k`: fraction of task/configuration groups where **all k** repetitions succeed.
- Older RIFT UI versions called `pass^k` `reliability@k`. Use `pass^k` in the presentation and footnote the older label as a synonym in this implementation. Do not confuse pass@k with pass^k.
- Cost per verified success is only available when every run in the group has measured or explicitly configured cost. Unknown cost must remain unavailable.
- A seed makes the fault schedule repeatable; it does not make hosted model output, remote tools or live web evidence deterministic.

## Bifrost's role

Bifrost is an optional model gateway and telemetry source. It observes model requests and can provide provider/model, tokens, cost, latency, retries and routing information. RIFT adds the agent and task context, aggregates the complete task trajectory and grades the result. An agent-level pass/fail score cannot be inferred from gateway request metrics alone.

## Honest implementation limits

- **Coding-10:** in live mode, candidate Python is executed by a configured Judge0-compatible service with network disabled and bounded CPU, memory, stack, process, file and time limits; hidden assertions stay in RIFT's grader process. Demo mode uses AST/structural fixtures only and is not executed validation. This is a Python MVP, not a general multi-language coding benchmark.
- **Research-10:** live mode retrieves real sources and uses a Bifrost model-assisted claim-to-evidence evaluator. RIFT verifies that a claimed quote occurs in the exact source excerpt. This does not prove semantic entailment or independent real-world truth; human review remains necessary for important claims.
- **Support-10:** the live rubric scores empathy, policy accuracy, false promises, privacy/safety, next step and clarity. Quote checks make some flags auditable, but the rubric is an MVP, not a validated policy certification.
- **Agent telemetry:** RIFT counts actual events and provider-reported usage returned by the adapter. Missing tokens or costs remain unknown. Framework adapters must map their actual callbacks/events; framework-specific event granularity can differ.
- **Live benchmark publication:** do not show numbers until two real adapters have completed the same task suite and repetitions in `mode=live`. Do not combine demo fixtures with live provider results.
- **Shared no-login mode:** the current presentation build disables auth and uses one shared workspace. Anyone with access to the public deployment can potentially read or alter its benchmark records and consume configured provider/sandbox resources. Restrict deployment access at the hosting layer or re-enable workspace authentication before inviting untrusted users.
- **Production egress:** application DNS checks do not replace an outbound firewall/proxy. Arbitrary external agent adapters should not be accepted on a shared public deployment.

## Live Coding-10 publication

Use [`../tools/publish_live_coding10.py`](../tools/publish_live_coding10.py) with the adapter service in [`../examples/live_agents.py`](../examples/live_agents.py). The script launches two real agent configurations across Coding-10 with five repetitions, first clean and then with the example agents' syntax-check tool unavailable. It saves raw run data and a Markdown report only after reading actual live RIFT records. The tool-outage condition is not a Bifrost provider outage; provider failover requires the separate Bifrost fault-proxy setup.
