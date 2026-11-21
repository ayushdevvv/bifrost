# RIFT reliability workflows

RIFT adds three persistent workflows to the benchmark and run-inspection system.

## 1. MCP manifest monitoring

Create a monitor with a Streamable HTTP MCP endpoint. RIFT performs an MCP `initialize` request followed by `tools/list`, then stores a canonical JSON manifest and SHA-256 digest.

- `POST /api/mcp-monitors` creates a monitor and captures version 1.
- `GET /api/mcp-monitors` lists monitored endpoints and their latest snapshot metadata.
- `GET /api/mcp-monitors/{monitor_id}` returns the monitor and its latest 30 snapshots.
- `POST /api/mcp-monitors/{monitor_id}/scan` captures a new version only when the manifest hash changes.
- `DELETE /api/mcp-monitors/{monitor_id}` removes the monitor and its snapshot history.

The background scanner runs every 900 seconds by default. Set `RIFT_MCP_MONITOR_INTERVAL_SECONDS=0` to disable it. Each snapshot records server information, capabilities, tool descriptions, input/output schemas, annotations and execution hints. Diffs classify added/removed tools, description changes, schema changes, permission-annotation changes, metadata changes and capability changes. A changed `readOnlyHint` or destructive annotation is marked critical.

The monitor currently supports public, unauthenticated Streamable HTTP endpoints. HTTPS is required except for exact loopback hosts during local development. DNS answers resolving to private or reserved IP ranges are rejected. Redirects are not followed. OAuth and bearer-token configuration are not currently supported.

## 2. Counterfactual failure analysis

- `POST /api/runs/{run_id}/counterfactual-analysis` reads a completed run and its ordered events.
- Trace signals are returned as explainable hypotheses, not causal probabilities.
- For each active injected fault, RIFT launches a child experiment with that one fault disabled, plus a clean control with all supported injected faults disabled. Duplicate configurations are removed.
- The original task, agent, model, seed, budgets and evidence snapshot are preserved where available.
- `GET /api/counterfactual-analyses` and `GET /api/counterfactual-analyses/{analysis_id}` return findings and updated child-run outcomes.

The comparisons are controlled reruns, not formal causal inference. For live experiments, the same seed and captured evidence are retained, but external providers can still change between requests.

## 3. Regression memory

- `POST /api/regression-cases/from-run/{run_id}` saves a finished execution as a case.
- The case stores the original task ID, agent ID, model, mode, evidence mode, fault schedule, severity, master seed, run seed, budgets, evidence snapshot and baseline result.
- `POST /api/regression-cases/{case_id}/replay` launches a new one-run experiment under the saved conditions. An alternate registered agent ID can be supplied to compare a new agent version.
- `GET /api/regression-cases` returns cases and their replay outcomes.
- `POST /api/regression-cases/replay-suite` runs all saved cases against a selected registered `agent_id`. This is intended as a release-gate action after registering an updated agent adapter; it returns the individual run IDs for CI/reporting.
- `DELETE /api/regression-cases/{case_id}` removes a case and its replay index; benchmark runs themselves are retained.

A regression replay preserves RIFT's captured evidence snapshot when the source run had one; the execution engine reuses that snapshot instead of refreshing it. It does not freeze external model-provider behaviour or external service state. The workspace polls replay outcomes and labels each case Stable, Resolved, Still failing or Regression against its saved baseline.

## Validation

The backend tests cover manifest versioning and permission drift, counterfactual child-run creation, regression case persistence and replay-seed preservation. Run the suite from the repository root:

```bash
python -m unittest discover -s backend/tests -v
```
