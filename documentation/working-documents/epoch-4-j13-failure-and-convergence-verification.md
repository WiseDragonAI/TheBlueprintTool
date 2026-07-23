## A. Verification Result

1. **Automated matrix state:** rows `1` through `36` have focused evidence on `feature/epoch4-task-execution`.
2. **Served matrix state:** row `37` is not verified. The registered server at `http://127.0.0.1:50150/` is healthy but serves `main` at `369d4158`; the refactor branch is not installed on that runtime.
3. **Production state:** epoch `3` remains active. No server was stopped, restarted, replaced, or launched during this verification.
4. **Artifact collection boundary:** execution and session tombstones replicate before an explicit offline collector admits deletion by retention cutoff plus recorded converged root. Execution artifacts now have one replicated reachability owner; shared hashes remain retained.

---

## B. Defects Found and Corrected

1. **Voice owner failure:** a post-transcription admission rejection left the note at `transcribed`. The orchestration boundary now persists `execution launch failed`, retains the transcript, audio reference, retry identity, and launch inputs, then exposes the existing Retry control.
2. **Projection determinism:** equal CRDT state could serialize different projection clock key order after different delivery orders. Incremental materialization now canonicalizes projection clock keys by replica ID.
3. **Mixed capacity:** node-message and project-sync children were outside the shared task-execution capacity count. The server now reserves those direct children through the global capacity boundary.
4. **Server close:** a direct-child capacity wait could survive server shutdown. A server-owned abort signal now cancels pending shared-capacity waits.
5. **Persistence containment:** a journal durable-write failure did not notify the project persistence-failure boundary. The store now reports that failure without replacing the original write error.
6. **Artifact ownership:** execution settlement published duplicate path-based resource heads that made eligible objects permanently reachable. Execution artifacts now publish only their artifact lane, and the explicit collector preserves shared hashes plus byte-identical causal state.

---

## C. Matrix Evidence

1. **Rows 1–12:** assigned held-task publication and reload, logical identity, optimistic admission ordering and reconciliation contracts, offline local idempotency with one child, remote retry idempotency, unreachable-owner rejection, assignment conflict, and active-phase reassignment fences pass.
2. **Rows 13–24:** direct lifecycle, continuation, direct skill, saved pipelines, pipeline failure and restart, project synchronization, local and remote voice ownership, unavailable voice ownership, cancellation, and post-spawn persistence failure containment pass.
3. **Rows 25–36:** invalid-byte preservation with project-only pause, relay outage repair, real HTTP client disconnect, server-close cancellation and restart retention, recovery adoption and interruption, remote live status, offline terminal artifact reads, tombstone ordering, mixed capacity, timeout containment, and three-party deterministic convergence pass.
4. **Row 37:** pending against the operator-facing route on the refactor commit.

---

## D. Verification Commands and Results

1. **Backend typecheck:** passed.
2. **Frontend typecheck:** passed.
3. **Backend suite:** `377/378`; the only failure was the new mixed-capacity test using a fixed `40 ms` child-start assumption.
4. **Corrected failing scope:** `2/2` passed after replacing the fixed delay with a bounded marker wait.
5. **Frontend suite:** `534/534` passed.
6. **Focused J.13 scenarios:** all passed through the repository verification lease.
7. **Artifact collection scope:** `17/17` passed for project-state artifact ownership, pre-cutoff retention, root mismatch rejection, shared-hash retention, eligible raw/object deletion, retry idempotency, and conflicted session fail-closed behavior.
8. **Backend suite after artifact collection:** `381/381` passed.

---

## E. Remaining Gate

1. Install the reviewed refactor commit on the registered Workstation and Mobile runtimes through the authorized cutover procedure.
2. Verify row `37` on the served Workstation and Mobile surfaces: modal assignment, optimistic placement before response settlement, canonical success after reload, rejection reconciliation in the active detail view, authenticated remote execution ownership, timers, cancellation, and assignment display.
3. Record Workstation, Mobile, and relay convergence evidence before marking `J.13` verified.
