# RIFT competitive positioning

Research checked: 21 November 2026. Capabilities below are summaries of the linked public product/documentation pages and can change.

## What already exists

| Product | Existing strength | What RIFT should not claim |
|---|---|---|
| [Bifrost](https://github.com/maximhq/bifrost) | AI gateway with request-level logs, input/output, model/provider, tokens, cost, latency, retries, routing/fallback details, custom log metadata and telemetry export. | RIFT is not a replacement for an AI gateway, provider router, or production observability stack. |
| [LangSmith](https://www.langchain.com/langsmith/evaluation) | Framework-agnostic agent traces, offline/online evaluation, curated datasets, experiment comparison, reference-based and reference-free evaluators, code checks, LLM judges and human review. Trace-to-dataset regression workflows. | Agent tracing, dataset evaluation, regression tests, and framework independence are not novel in isolation. |
| [Braintrust](https://www.braintrust.dev/) | Full agent traces/tool calls, live quality/cost/latency monitoring, versioned datasets, side-by-side evaluations and automated/human scoring. | A trace viewer plus evaluator dashboard is not a differentiated product by itself. |
| [Inspect AI](https://inspect.aisi.org.uk/) | Open evaluation framework with 200+ evaluations, composable tasks/solvers/scorers, tool support and external agent execution. | RIFT should not compete on the number of prebuilt academic benchmarks or claim to be the broadest evaluator. |
| [Promptfoo](https://www.promptfoo.dev/docs/red-team/mcp-security-testing/) | Agent red-teaming and MCP security testing for tool poisoning, malicious tool outputs, data exfiltration and privilege-boundary attacks. | General prompt-injection or MCP security testing is not unique to RIFT. |

## RIFT's intended product boundary

RIFT is the **task-level benchmarking and failure-learning layer for complete agents**. Its unit of comparison is an agent configuration completing a task, not an isolated model request.

The product workflow joins:

1. Matched task suites across Coding-10, Research-10 and Customer Support-10.
2. Repeated trials with observed pass@k, reliability@k and outcome variance.
3. End-to-end task outcomes plus steps, tool/model calls, tokens, cost and latency when measured.
4. Controlled provider, tool, instruction, evidence and latency faults under a shared seeded schedule.
5. Ordered run traces and one-variable counterfactual reruns to investigate failure signals.
6. Regression cases that preserve the original task, seed, fault schedule and evidence snapshot for future replay.
7. Optional Bifrost request correlation so model-gateway telemetry can be connected to the containing agent run.

This workflow is the differentiator to demonstrate. Individual pieces overlap with other tools; the product claim is the integrated, matched, repeated and failure-aware task benchmark. RIFT's graders are currently transparent MVP rubrics, not a validated standard benchmark.

## Bifrost's role

Bifrost is the supporting gateway/telemetry integration. It already observes model requests, token usage, cost, latency, retry/fallback attempts and routing decisions. RIFT adds task IDs and agent context to the gateway log metadata and links the request ID to the run inspector. RIFT then evaluates the full task trajectory and its outcome. Unknown gateway values remain unknown; RIFT does not infer real usage from generated text.

## Recommended judging demonstration

1. Register two existing agents behind thin HTTP adapters. Keep their frameworks and internals unchanged.
2. Select one category and run the exact same task set against both with three to five repetitions.
3. Compare success, score, steps, tool calls, tokens, cost, latency, pass@k and reliability@k.
4. Repeat under a shared tool outage and hostile-instruction schedule. Open the trace and inspect the exact failed step.
5. Start counterfactual analysis to remove one fault at a time. Save the problematic run as a regression case.
6. Update one agent and replay the saved case. Show whether the failure is fixed without regressing the remaining task suite.
7. Open a run's Bifrost request ID to connect the model-provider attempt with the agent-level result.

## Honest limitations to state

- Coding-10 currently performs Python AST and structural checks; it does not execute untrusted code in a sandbox.
- Research-10 uses concept, citation-linkage and evidence-coverage checks; source presence does not prove factual support.
- Support-10 uses explicit policy/privacy/communication assertions; nuanced language still needs human review.
- A framework-neutral HTTP adapter avoids rewriting an agent, but each integration must map its public callbacks/events and usage data to the adapter contract.
- The current prototype needs authentication, workspace authorization, tenant isolation, rate limits, egress controls, retention controls and an isolated execution environment before use with untrusted public agents.
