# Use Trace Evidence

## A. Choose the Correct Workflow

1. **Need only a pass/fail verification:** do not use `trace-evidence`. Run the test directly through `node bin/decision-os-verify.mjs -- <direct-command>`.
2. **Need a new observation of one or more existing tests:** use `start-tests`. The tool runs the selected tests once under the repository lease and captures their evidence.
3. **Need evidence already produced by a Decision OS task:** use `cards` and `sessions` to resolve exact identity, then use `start-tasks`. This workflow reads existing artifacts and does not run a test or acquire the verification lease.
4. **Already have a trace job ID:** use `status`, `wait`, `events`, and `report`. Do not start a replacement job because a wait timed out or Graphify is still running.
5. **Need a diagnosis:** first produce evidence with the matching workflow, then diagnose it as the agent. The tool does not select causes, judge correctness, or prescribe remediation.

---

## B. Establish One Execution Boundary

1. Prepare the active implementation or diagnostic worktree. Do not operate from `main`.

   ```bash
   npm --prefix trace-evidence ci --ignore-scripts
   npm --prefix trace-evidence run build
   node bin/trace-evidence.mjs help
   ```

2. Install the selected package's dependencies before starting the trace. The trace tool does not install dependencies for the test target.
3. **Use exactly one working-directory owner.** `--cwd <package>` sets the child process working directory. Every `--test-file`, executable path, configuration path, and test argument must then be valid from that directory.
4. Never combine `--cwd backend` with `env --chdir=backend`, `env -C backend`, `npm --prefix backend`, or another second move into `backend`.
5. Pass direct child argv after `--`. Do not pass a shell string or `sh -c`.
6. Choose one Graphify mode deliberately:
   - `--graphify off` for the fastest test, stack, flow, and log evidence.
   - `--graphify touched` when relationships between implicated files are useful.
   - `--graphify all` only when the full selected source corpus is required.
7. Configure pinned Graphify argv before starting a Graphify-enabled job:

   ```bash
   export TRACE_EVIDENCE_GRAPHIFY_COMMAND='["uvx","--from","graphifyy==0.9.22","graphify"]'
   ```

---

## C. Produce a New Test Trace

1. Use one job for tests that share the same package working directory, runner, environment, and timeout. Use separate jobs for different packages.
2. Repeat `--test-file` for every exact selected test. Paths are relative to `--cwd`.
3. Pass test environment through repeatable `--env <name=value>` options instead of introducing an `env --chdir` child wrapper.
4. Decision OS acquires `bin/decision-os-verify.mjs` once around the batch and holds the lease until every selected process and evidence writer settles.

Backend example:

```bash
node bin/trace-evidence.mjs start-tests \
  --cwd backend \
  --test-file test/unit/<first>.test.ts \
  --test-file test/unit/<second>.test.ts \
  --env TSX_TSCONFIG_PATH=tsconfig.json \
  --timeout 10m \
  --stacks both \
  --logs both \
  --graphify touched \
  -- node --test --test-concurrency=1 --import tsx \
     test/unit/<first>.test.ts test/unit/<second>.test.ts
```

Package-local executable example:

```bash
node bin/trace-evidence.mjs start-tests \
  --cwd federation-relay \
  --test-file test/relay.test.ts \
  --timeout 10m \
  --stacks both \
  --logs both \
  --graphify off \
  -- ./node_modules/.bin/vitest run test/relay.test.ts
```

The accepted response returns a `jobId` immediately. Preserve it. Multiple selected tests retain separate scope, process, result, log, and telemetry identities while sharing one lease.

---

## D. Collect Existing Task Evidence

1. Do not start or restart the Decision OS server. Use the already registered server and exact project route.
2. Resolve identity without reading Codex content:

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

3. Start one read-only evidence job for one or more exact cards:

   ```bash
   node bin/trace-evidence.mjs start-tasks \
     --project <project-id> \
     --card-id <first-card-id> \
     --card-id <second-card-id> \
     --execution default \
     --include-presentation
   ```

4. Use `--execution-id`, `--session-id`, or `--provider-session-id` when one exact execution is required. Never select by timestamp proximity, filename fragment, title similarity, or the run currently visible in the UI.
5. Add `--session-id <exact-session-id> --include-raw-codex` only when raw Codex content is explicitly required.
6. Add `--include-subtasks` only when every canonical subtask belongs to the requested scope.
7. Task evidence collection does not acquire the test verification lease.

---

## E. Use the Evidence Window

1. **Accepted:** `start-tests` or `start-tasks` returns the durable `jobId`; collection continues in the background.
2. **Waiting for lease:** `waiting_for_lease` is expected for test jobs while another verifier owns the repository lease. Do not start another job.
3. **Evidence ready:** wait for this milestone when raw results are sufficient and the agent can begin inspection while source mapping, Graphify, and report rendering continue.

   ```bash
   node bin/trace-evidence.mjs wait \
     --job <job-id> --until evidence --timeout 10m --json
   ```

4. **Complete:** wait for this milestone before requiring mapped stacks, source details, Graphify output, or the formatted reports.

   ```bash
   node bin/trace-evidence.mjs wait \
     --job <job-id> --until complete --timeout 15m --json
   ```

5. A wait timeout means only that the requested milestone was not reached inside that client wait. Inspect the same job and continue waiting:

   ```bash
   node bin/trace-evidence.mjs status --job <job-id> --json
   ```

6. `failed`, `cancelled`, and `interrupted` are terminal. Inspect their retained manifest and raw artifacts; do not describe them as complete evidence.

---

## F. Read Evidence in Authority Order

1. Read `job.json` or `status` for phase, selected scopes, per-scope status, processes, and collection failures.
2. Read `manifest.json` for hashes, parse failures, dropped-byte offsets, Graphify status, and the authoritative completeness claim.
3. Read `test-events.jsonl` for recorded test results. Graphify, mapping, and report failures cannot rewrite those results.
4. Read `telemetry.jsonl`, `supervisor-telemetry.jsonl`, `stacks.jsonl`, `flow.json`, stdout, and stderr for execution evidence.
5. Read `source-files.json` and Graphify outputs only after `complete`.
6. Use display filtering without changing raw evidence:

   ```bash
   node bin/trace-evidence.mjs events \
     --job <job-id> --event-name <name> --limit 100 --json
   ```

7. Render the human or stable machine report:

   ```bash
   node bin/trace-evidence.mjs report --job <job-id> --format markdown
   node bin/trace-evidence.mjs report --job <job-id> --format json
   ```

8. Diagnose the first incorrect transition from the evidence. Do not ask the collector to interpret causality.

---

## G. Cancel and Recover

1. Cancel only the exact recorded job:

   ```bash
   node bin/trace-evidence.mjs cancel --job <job-id>
   ```

2. Cancellation terminates the owned process groups, flushes evidence writers, and installs a readable manifest.
3. Recovery after `evidence_ready` may regenerate derived artifacts but must never rerun selected tests.
4. A pre-evidence interrupted job remains `interrupted`. Start a new explicit job only when a new observation is intended.
5. Preserve malformed, partial, oversized, and failed artifacts. Use manifest failures and completeness fields instead of rewriting evidence.

The complete tool contract is in [`../../working-documents/generalized-trace-evidence-tool-plan-and-specification.md`](../../working-documents/generalized-trace-evidence-tool-plan-and-specification.md). Installation and adapter adoption for another repository is in [`install-trace-evidence-in-another-repository.md`](install-trace-evidence-in-another-repository.md).
