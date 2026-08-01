# Trace Evidence

Generalized background evidence production for tests and repository task adapters. The tool captures facts and artifacts; an agent interprets them.

See `documentation/working-documents/generalized-trace-evidence-tool-plan-and-specification.md` in the Decision OS repository for the complete contract.

Decision OS agent operation is documented in `documentation/procedure/testing/use-trace-evidence.md`, referenced by the repository `AGENTS.md`. Cross-repository installation and adapter adoption are documented in `documentation/procedure/testing/install-trace-evidence-in-another-repository.md`.

## Build

```text
npm --prefix trace-evidence ci --ignore-scripts
npm --prefix trace-evidence run build
node bin/trace-evidence.mjs help
```

## Repository configuration

The core reads `trace.config.yaml` before accepting a job. `adapter` may name the built-in `decision-os` or `reference-node` adapter, or a repository-relative JavaScript module exporting an adapter constructor. Copy `trace-evidence/trace.config.example.yaml` into a new repository and change only the adapter path and defaults.

## Graphify

Graphify is pinned to the official `graphifyy==0.9.22` package under the MIT license. Supply direct argv as JSON; the tool adds its sanitized input and fixed extraction arguments:

```text
TRACE_EVIDENCE_GRAPHIFY_COMMAND='["uvx","--from","graphifyy==0.9.22","graphify"]'
```

Graphify receives no telemetry arguments, raw stacks, logs, prompts, transcripts, tokens, or unrestricted environment. Successful extraction writes `graph.json`, `graph.html`, and `GRAPH_REPORT.md` beneath the job directory.

## Examples

```text
node bin/trace-evidence.mjs start-tests \
  --cwd backend \
  --test-file test/unit/example.test.ts \
  --graphify touched \
  -- node --test --import tsx test/unit/example.test.ts

node bin/trace-evidence.mjs start-tasks \
  --project <project-id> \
  --card-id <card-id> \
  --execution default \
  --include-presentation

node bin/trace-evidence.mjs wait --job <job-id> --until evidence
node bin/trace-evidence.mjs wait --job <job-id> --until complete
node bin/trace-evidence.mjs report --job <job-id> --format json
```

`--limit` and event filters affect displayed records only. Raw artifacts remain unchanged and are inventoried by SHA-256 in `manifest.json`.
