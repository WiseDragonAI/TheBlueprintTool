## A. Repository Intent

1. **Decision OS keeps project task state locally readable while causal state converges across authenticated replicas.**
2. **Scoped task reads:** navigation, card, and thread routes expose projections without rewriting durable task state.
3. **Causal gate:** browser projection installation rejects a snapshot that does not cover the last installed runtime-replica clock.

---

## B. Current Incident

1. **Target:** `card-c2294c71-cb87-49d6-8886-002cd0f6b036` in project `ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z`.
2. **Project state:** `/api/ledgers/tasks/navigation` and both target card and thread handlers begin with HTTP `200`; no active `project-task-state:ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z` incident exists.
3. **Transport failure:** curl aborts before receiving the JSON body because `x-decision-os-task-clock` is `571,660` bytes.
4. **Payload boundary:** the target card response body is `12,384` bytes; its Markdown and thread sidecars are `11,121` and `21,626` bytes.
5. **Clock inventory:** the durable clock contains `3,307` coordinates. `3,303` are immutable `migration:*` identities; the runtime writers are `workstation` and `phone`.

---

## C. First Incorrect Transition

1. **Introduction:** commit `eca0aadcf` added the complete `store.clock()` to every scoped task read header and to task mutation acknowledgements.
2. **Mismatch:** the store clock is a durable federation and writer-counter structure. It includes one deterministic coordinate for each recovered migration presence candidate.
3. **Failure:** `create-http-server.ts` base64url-encodes all `428,745` JSON bytes into one HTTP header. Standard clients reject the `571,660`-byte header before the successful body becomes readable.
4. **Result:** the UI presents an inaccessible project even though the task runtime is not paused and the target projection exists.

---

## D. Remediation

1. **Preserve the full durable clock:** federation join, root calculation, mutation counter advancement, and persisted entity clocks remain unchanged.
2. **Project the client clock:** exclude only `migration:*` coordinates at the HTTP response boundary; configured node IDs cannot contain the `:` delimiter.
3. **Preserve causal ordering:** authenticated runtime replica coordinates, including any literal `baseline` node identity, remain in the browser clock. Immutable `migration:*` coordinates never advance after cutover and are common historical context, so they do not distinguish later browser snapshots.
4. **Apply one boundary:** use the projected clock for scoped read headers, mutation `taskClock`, and receipt `clock`.
5. **Regression:** construct the observed `3,303` migration-coordinate shape and prove the response clock retains `workstation` plus `phone` under the Node default `16 KiB` header budget.

---

## E. Recovery and Operator Decision

1. **Code recovery:** merge and publish the response-boundary fix.
2. **Runtime activation:** the registered Decision OS server must load the merged code before the existing `50150` route can emit the bounded header.
3. **Restart ownership:** no server restart is performed without an explicit operator request.
4. **Durable-state action:** no task-state rewrite, clock deletion, runtime resume, project pause, or server-wide degraded mode is required.

---

## F. Subsequent Execution-Conflict Pause

1. **Incident:** `incident-d2f00c56-93ca-4350-a000-75c591193df6` paused the same project after a federated frame installed explicit phone and workstation candidates for execution `codex-execution-1784538682976-fe26fa2d`.
2. **Durable validity:** the execution retains both terminal lifecycle and artifact candidates as `task_execution_conflict`; no bytes are corrupt.
3. **Incorrect containment:** federation projection invalidation called `executions.find()`, which deliberately throws for a conflicted execution. The exception escaped the frame handler and paused the entire project.
4. **Fix:** projection invalidation reads the conflict-free `executions.all()` view and publishes `null` for the conflicted record. Repository diagnostics and Control Room invalidation remain authoritative for the affected execution.
5. **Recovery evidence:** a byte-identical backup at `/tmp/decision-os-execution-conflict-resume-wrjTez` retained `5,526` files and `434,155,632` bytes. Scoped resume returned `200` and resolved the incident.
