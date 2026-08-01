# Use Trace Evidence

Use `node bin/trace-evidence.mjs` when an investigation needs complete execution evidence rather than a normal pass/fail test result. The tool produces evidence; the agent remains responsible for diagnosis and interpretation.

## Prepare Once Per Worktree

```bash
npm --prefix trace-evidence ci --ignore-scripts
npm --prefix trace-evidence run build
node bin/trace-evidence.mjs help
```

- Do not run the tool from `main`. Use the active implementation or diagnostic worktree.
- Do not start or restart the Decision OS server to collect task evidence. Use the already registered server and exact project route.
- Configure Graphify with pinned direct argv when graph output is required:

```bash
export TRACE_EVIDENCE_GRAPHIFY_COMMAND='["uvx","--from","graphifyy==0.9.22","graphify"]'
```

## Trace Existing Tests

Start one background job for one or more selected tests. Pass the test runner as direct argv after `--`; do not wrap it in a shell. The Decision OS adapter acquires `bin/decision-os-verify.mjs` once around the complete batch and holds the lease until test processes and evidence writers settle.

```bash
node bin/trace-evidence.mjs start-tests \
  --cwd backend \
  --test-file test/<first>.test.ts \
  --test-file test/<second>.test.ts \
  --graphify touched \
  --timeout 10m \
  -- env --chdir=backend TSX_TSCONFIG_PATH="$PWD/backend/tsconfig.json" \
     node --test --test-concurrency=1 --import tsx \
     test/<first>.test.ts test/<second>.test.ts
```

Record the returned `jobId`. Multiple selected tests retain separate scope, process, log, telemetry, and result identities while sharing the repository verification lease.

## Inspect Existing Tasks

Discover identity without Codex content:

```bash
node bin/trace-evidence.mjs cards \
  --project <project-id> \
  --card-id <card-id> \
  --json

node bin/trace-evidence.mjs sessions \
  --project <project-id> \
  --card-id <card-id> \
  --json
```

Collect exact selected task evidence:

```bash
node bin/trace-evidence.mjs start-tasks \
  --project <project-id> \
  --card-id <first-card-id> \
  --card-id <second-card-id> \
  --execution default \
  --include-presentation
```

- Add `--session-id <exact-session-id> --include-raw-codex` only when raw Codex content is explicitly required.
- Use `--include-subtasks` only when every canonical subtask belongs to the requested scope.
- Never select task evidence by timestamp proximity, filename fragment, title similarity, or the currently visible UI run.
- Task evidence collection does not acquire the test verification lease.

## Wait, Read, and Interpret

```bash
node bin/trace-evidence.mjs status --job <job-id> --json
node bin/trace-evidence.mjs wait --job <job-id> --until evidence --timeout 10m --json
node bin/trace-evidence.mjs wait --job <job-id> --until complete --timeout 15m --json
node bin/trace-evidence.mjs report --job <job-id> --format markdown
node bin/trace-evidence.mjs report --job <job-id> --format json
```

- `wait --until evidence` is the earliest authority for finalized raw artifacts. Graphify and report rendering may still be running.
- Read retained JSONL and log artifacts directly from the job directory. Event filters and `--limit` affect display only and never rewrite raw evidence.
- Treat `report.json`, `report.md`, `manifest.json`, `stacks.jsonl`, `flow.json`, `source-files.json`, raw logs, and Graphify outputs as evidence products. The report intentionally contains no diagnosis.
- Source mapping occurs during the trace invocation. Never move source-map work into the application runtime.
- Diagnose the first incorrect transition from the produced evidence. Do not ask the programmatic collector to choose a cause or remediation.

## Cancel and Recover

```bash
node bin/trace-evidence.mjs cancel --job <job-id>
```

- Cancellation targets only the recorded supervisor and its owned process groups, escalates from `SIGTERM` to `SIGKILL`, flushes writers, and installs a readable manifest.
- A supervisor restart after `evidence_ready` may regenerate derived outputs but must never rerun the selected tests.
- A pre-evidence interrupted job terminates as `interrupted`; start a new explicit job when a new observation is required.
- Preserve malformed, partial, oversized, and failed artifacts. Use manifest parse failures, dropped-byte offsets, and completeness flags instead of rewriting evidence.

The complete tool contract is in [`../../working-documents/generalized-trace-evidence-tool-plan-and-specification.md`](../../working-documents/generalized-trace-evidence-tool-plan-and-specification.md). Installation and adapter adoption for another repository is in [`install-trace-evidence-in-another-repository.md`](install-trace-evidence-in-another-repository.md).
