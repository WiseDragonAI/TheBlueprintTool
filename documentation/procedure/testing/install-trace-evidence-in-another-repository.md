# Install Trace Evidence in Another Repository

## Purpose

Install the reusable trace supervisor, evidence pipeline, source mapper, Graphify integration, and report controllers in another repository while limiting repository-specific code to an adapter, configuration, telemetry emission, and launcher wiring.

## Resulting Boundary

The adopted repository reuses `trace-evidence/src/business/**` unchanged for:

1. Durable background-job supervision and recovery.
2. Multi-test execution and process-tree cancellation.
3. Raw artifact finalization and SHA-256 inventories.
4. Telemetry parsing and mechanical correlation.
5. Invocation-time source mapping.
6. Sanitized Graphify execution.
7. Markdown and deterministic JSON reports.

The adopted repository owns only:

1. Test discovery and verification-lease admission.
2. Task, execution, and session identity discovery when the repository has task concepts.
3. Exact raw-evidence access.
4. Source-map and implicated-source resolution.
5. Emission-time telemetry integration.
6. Repository configuration and a thin launcher.

## Prerequisites

1. Node.js 22 or newer.
2. npm with lockfile installation support.
3. A repository-owned direct test command.
4. A finite verification lease or capacity controller for test runs.
5. Production builds that emit exact source maps for generated JavaScript.
6. `uvx` when Graphify output is enabled.

## 1. Copy the Reusable Package

Copy these paths from Decision OS without editing core controllers:

```text
trace-evidence/
bin/trace-evidence.mjs
```

The target layout must remain:

```text
<target-repository>/
  bin/trace-evidence.mjs
  trace-evidence/
    bin/
    src/business/
    src/lib/
    package.json
    package-lock.json
    tsconfig.json
```

Add repository ignores:

```gitignore
trace-evidence/node_modules/
trace-evidence/dist/
trace-evidence/.graphify-runtime/
trace-evidence/.graphify-venv/
.trace/
```

Install and build:

```bash
npm --prefix trace-evidence ci --ignore-scripts
npm --prefix trace-evidence run typecheck
npm --prefix trace-evidence run build
node bin/trace-evidence.mjs help
```

## 2. Create Repository Configuration

Copy `trace-evidence/trace.config.example.yaml` to repository-root `trace.config.yaml`.

For an ordinary Node repository without task entities, begin with:

```yaml
trace:
  adapter: reference-node
  artifacts: .trace/jobs
  lease:
    strategy: repository-adapter
  telemetry:
    format: jsonl
    runIdField: traceRunId
  sourceMaps:
    strategy: build-manifest
  graphify:
    package: graphifyy
    version: 0.9.22
    defaultScope: touched
```

Use a repository-relative adapter module path instead of `reference-node` when the repository has its own lease, test selection, task model, artifact layout, or build manifest.

## 3. Implement the Repository Adapter

Create one adapter implementing `TraceRepositoryAdapter` from `trace-evidence/src/lib/types.ts`.

Required behavior:

1. `discoverTests` returns one stable `testId` and direct argv per selected test.
2. `wrapTestCommandWithLease` returns direct argv admitted by the repository verification lease.
3. `wrapTestBatchWithLease` holds one outer lease across every selected test and all evidence writers when the repository supports batches.
4. `resolveCards` returns caller-ordered identity and status metadata without task content.
5. `resolveScopes` rejects selectors not owned by the exact task.
6. `collectEvidence` reads only exact selected identities and preserves original bytes.
7. `locateSourceMaps` returns maps for generated files present in captured stacks, not every map in the repository.
8. `resolveSourceFiles` returns repository-relative paths, tracked state, and Git blob hashes.
9. Every network request, recursive read, and child wait accepts cancellation and has a finite deadline.
10. One failed scope remains contained and does not discard successful scopes.

The built-in `ReferenceNodeAdapter` is the minimal implementation example. `DecisionOsAdapter` demonstrates task identity, execution selection, raw session evidence, presentations, frontend telemetry, and one outer verification lease.

Compile a custom adapter to JavaScript and set `trace.adapter` to its repository-relative module path. The module must default-export the adapter class or export it as `Adapter`.

## 4. Add Emission-Time Telemetry

Every telemetry event admitted to trace collection must capture its stack where the event is emitted:

```ts
export function telemetry(name: string, args: unknown = {}): void {
  const error = new Error();
  Error.captureStackTrace(error, telemetry);
  const event = {
    name,
    args,
    at: new Date().toISOString(),
    rawStack: error.stack ?? '',
  };
  writeTelemetry(event);
}
```

Runtime responsibilities stop at retaining the raw generated stack and stable identities. Source-map resolution belongs to the trace invocation.

Propagate these identities where they exist:

```text
traceJobId
traceRunId
scopeId
testId
cardId
executionId
sessionId
eventId
sequence
processId
```

Keep the telemetry writer failsafe and bounded. A writer failure must not change the test result or terminate unrelated application work.

## 5. Enable Production Source Maps

Configure production JavaScript builds to emit external `.map` files. Retain the exact generated JavaScript and matching map from the observed build.

The adapter must return the adjacent or manifest-owned map for each generated file captured in a raw stack. The mapper records explicit `source_map_missing`, `source_map_incompatible`, `source_map_ambiguous`, and `source_position_missing` failures while preserving raw frames.

Do not import source-map libraries into the application runtime and do not rewrite stored raw stacks.

## 6. Configure Graphify

Use the pinned package and direct argv:

```bash
export TRACE_EVIDENCE_GRAPHIFY_COMMAND='["uvx","--from","graphifyy==0.9.22","graphify"]'
```

The reusable controller supplies sanitized inputs and fixed extraction arguments. Do not add prompts, transcripts, credentials, unrestricted environment variables, raw stacks, or logs to Graphify input.

## 7. Add the Agent Runbook

Create a repository procedure for operating the tool. Keep `AGENTS.md` concise: add only a mandatory link to that procedure and the boundary that the tool produces evidence while agents interpret it. The procedure must state:

1. The exact installation/build commands.
2. The direct test command and repository lease behavior.
3. Supported task selectors and exact-identity rules.
4. `status`, both `wait` milestones, `report`, `events`, and `cancel` commands.
5. Raw evidence locations and completeness rules.
6. Invocation-time source mapping.
7. Graphify configuration.
8. The boundary that agents diagnose while the tool only produces evidence.

Adapt [`use-trace-evidence.md`](use-trace-evidence.md); do not copy Decision OS server routes or task selectors into a repository that does not own those concepts.

## 8. Run Adapter Conformance

Run every check through the target repository lease:

```bash
<target-lease-command> npm --prefix trace-evidence test
<target-lease-command> npm --prefix trace-evidence run typecheck
```

Add adapter-specific tests proving:

1. Multiple selected tests retain independent identities under one lease.
2. Passing, failing, timed-out, cancelled, and interrupted tests settle.
3. Interleaved telemetry remains separated by scope and test identity.
4. Malformed JSONL remains byte-identical and appears in parse failures.
5. Telemetry-writer failure cannot change the test result.
6. Exact production JavaScript frames map to TypeScript through pinned maps.
7. Missing and incompatible maps retain raw stacks.
8. Artifact ceilings expose the first dropped byte and mark evidence incomplete.
9. Graphify failure and timeout preserve test outcomes and raw artifacts.
10. Recovery after `evidence_ready` regenerates derived output without rerunning tests.
11. Replaying finalized evidence produces byte-identical `report.json`.
12. Task-capable adapters isolate multiple task scopes and deduplicate overlapping session bytes.

## 9. Prove One Real Installation

Run one real selected test through the installed launcher:

```bash
node bin/trace-evidence.mjs start-tests \
  --test-file <test-file> \
  --graphify touched \
  --timeout 10m \
  -- <direct-test-command>
```

Then verify:

```bash
node bin/trace-evidence.mjs wait --job <job-id> --until evidence --timeout 10m --json
node bin/trace-evidence.mjs wait --job <job-id> --until complete --timeout 15m --json
node bin/trace-evidence.mjs report --job <job-id> --format json
```

The installation is proven only when:

1. The selected test result is correct.
2. Raw logs, lifecycle events, and telemetry are durable and hashed.
3. Every captured telemetry event retains a raw stack.
4. Production frames map to original sources during the invocation.
5. `flow.json`, `source-files.json`, `report.json`, `report.md`, and `manifest.json` are present.
6. Graphify enabled runs contain `graph.json`, `graph.html`, and `GRAPH_REPORT.md`.
7. No parse failure, dropped record, or missing artifact is hidden from completeness state.

## 10. Upgrade Without Forking the Core

When updating from Decision OS:

1. Replace the reusable `trace-evidence/` core as one versioned unit.
2. Preserve the target repository adapter and `trace.config.yaml` separately.
3. Recompile the adapter against the current `TraceRepositoryAdapter` interface.
4. Rerun the complete core suite, adapter conformance, typecheck, and one real trace.
5. Review schema and manifest version changes before reading older job directories.

Do not copy repository-specific fixes into reusable controllers. Correct reusable behavior in the core and keep raw-data ownership in adapters.
