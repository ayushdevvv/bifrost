# RIFT Arena feature map

RIFT Arena evaluates complete AI agent configurations, not only model responses. The initial benchmark category is research agents.

## Platform pages

The product exposes 11 separate workspaces, grouped into eight core feature areas plus setup and onboarding.

| Page | Working flow |
|---|---|
| Overview | Experiment totals, completed runs, quality, success and recent sessions |
| Benchmark Lab | Pick agents, model routes, tasks, repetitions, evidence mode, seed, fault profile and execution budgets |
| Agents | Use the built-in ReAct and Planner baselines or register an existing HTTP agent |
| Research Intelligence | Search with Tavily, inspect source passages and preserve hashed evidence snapshots; Demo uses labelled synthetic fixtures |
| Chaos Lab | Enable provider outage, synthetic evidence poisoning and controlled Tavily latency |
| 3D Arena | View live WebSocket events as the event-driven 3D environment changes; replay recorded runs |
| Run Inspector | Review output, evidence, source provenance, steps, calls, tokens, costs, budgets and ordered events |
| Deep Evaluation | Aggregate measured answer quality, evidence coverage, citation integrity, reliability, cost completeness and fault recovery |
| Compare | Compare matched configurations, quality consistency, cost per success, poison resistance and provider recovery |
| Leaderboard | Rank completed agent and model combinations by measured success, quality and latency |
| Settings | Check integrations, inspect configuration status and open setup documentation |

## Benchmark suite

The Research-10 suite includes ten task definitions covering gateway research, MCP security, observability, contradictory evidence, recent releases, citation integrity, multi-hop architecture, stale information, hostile page instructions and structured decision briefs.

Each task has a versioned identifier, objective, expected concepts and minimum source count. The current evaluator is a transparent MVP rubric based on expected concepts, source coverage and citation integrity. It is not a validated academic benchmark or a substitute for human adjudication.

## Fairness and repeatability

- Snapshot mode collects one Tavily result set per task and shares it across matched agents, models and repetitions.
- Live evidence mode searches independently for each run and is intended for freshness testing, not strict reproducibility.
- Fault decisions derive from a master seed, task, repetition, fault type and eligible call index. Experiment and agent identifiers are excluded so matched experiments can reuse the same planned schedule.
- Model generation and live web results can still vary. The seed reproduces RIFT's fault schedule and synthetic fixtures, not the internet or a stochastic model.
- The experiment runner caps a benchmark at 80 runs. Each run also has configurable step, tool-call, cost and timeout budgets.

## Bifrost and Tavily

- Bifrost provides the OpenAI-compatible model endpoint. RIFT records usage and request timing from gateway responses where available.
- Tavily Search supplies research evidence from the backend. Tavily credentials remain server-side. The MVP calls the Tavily Search API directly, while Bifrost handles model traffic; it does not currently route Tavily tools through Bifrost MCP.
- Accurate total cost requires model input/output pricing and a Tavily per-search price. Unknown cost is displayed as unavailable.

## Chaos Lab

| Fault | Implementation |
|---|---|
| Provider failure | In Demo mode, the runner records a simulated 503 and demo fallback. Live mode requires the optional RIFT upstream proxy configured as a Bifrost custom provider and a separate healthy fallback route. |
| Evidence poisoning | Adds a local synthetic `.invalid` source containing misleading content and hostile instructions. It never alters a real web page. |
| Network latency | Adds a fault-specific delay to eligible research calls. At 50% severity the runner adds 2 seconds before delivering the result in both Demo and Live modes. Demo mode uses synthetic evidence, so no external provider is slowed. |

## Framework independence

An existing agent can be connected through an HTTPS HTTP adapter without changing its internal framework. The adapter receives the task, evidence, seed and budgets, and can return the answer, counters and observable events. Built-in ReAct and Planner examples are provided. RIFT does not inspect hidden chain-of-thought.

## Current MVP boundaries

- The frontend is React 19 + Vite with Three.js and React Three Fiber. Build it with `npm install` followed by `npm run build`.
- The 3D Arena is a React Three Fiber / Three.js digital twin driven by live backend events and recorded replay. It is not a physics sandbox.
- Live provider fallback is only measured when the Bifrost custom provider is actually pointed at the RIFT upstream fault proxy.
- Built-in agent step limits are checked before each orchestration step. External adapter limits are sent in the task envelope and validated against returned counters; external agents should enforce their own budgets during execution.
- Cost is only calculated when configured rates are available.
- This is a local hackathon prototype. Add authentication, tenant isolation, rate limiting, stricter network egress controls and persistent audit policies before public deployment.
