## A. Consolidated Intent

1. The four selected branches protect one invariant: once an owning subsystem reaches an authoritative transition, a later observer must not reverse, duplicate, or misrepresent it.
2. `Stabilize transient pipeline store reads` protects a valid store from being promoted into a latched project-runtime pause after one transient partial read.
3. `Keep successful library recovery resumed` protects a component-owned successful recovery from being reversed when generic recovery resolves the same incidents again and receives an empty result.
4. `FIX - clarify pipeline handoff and stabilize fixtures` makes the optimistic Process Card handoff explicit and guarantees its admission deadline is retired after request settlement.
5. `Document stale waiting timestamp RCA` identifies the missing authoritative transition: terminal execution settlement must reset the owning task's Queue-entry clock from the execution's canonical `finishedAt`.

---

## B. First Incorrect Transitions

1. Pipeline store: a first invalid read immediately creates an upstream store incident; the scheduler observes that incident and creates a second runtime pause before a bounded stability re-read can prove the file valid.
2. Federated library recovery: component recovery resolves its incidents successfully; generic recovery performs a second resolution, treats the empty result as failure, and re-pauses the recovered subsystem.
3. Optimistic pipeline handoff: the frontend completed admission through an unnamed boolean contract and retained an admission timer until implicit cleanup, obscuring which settlement owned navigation and rejection reconciliation.
4. Task requeue: a terminal temporary pipeline removes the execution from the active projection without updating the master task's `waitingAt`; the Control Room then correctly renders Queue age from stale durable task state.

---

## C. Telemetry Confrontation

1. Pipeline-store telemetry confirms the original failure class. The durable incident ledger records `codex_pipeline_store_invalid` followed by `runtime_scope_paused` for the scheduler. One invalid authored-content incident was observed twice between `2026-07-29T02:38:20.587Z` and `2026-07-29T02:38:31.410Z`; store recovery completed at `02:38:55.355Z`, while the derived scheduler pause was resolved only at `03:33:39.221Z`.
2. Later pipeline-store incidents also demonstrate repeated read/resolution churn. The same `pipeline-content-kind-mismatch` fingerprint produced separate incidents and immediate resolutions at approximately 16-20 millisecond intervals. The ledger proves repeated classification, but it does not yet emit a stability-window decision event that distinguishes transient recovery from persistent corruption.
3. Federated-library telemetry proves an affected scope can remain paused: `federated-skill-publication:psychoqwak` has two occurrences and no `resolvedAt`. It does not record the ordered component-recovery result, generic-recovery result, retained incident identities, and final pause state. The selected idempotence fix is source- and regression-backed but not production-proven by the current telemetry.
4. Frontend telemetry records Codex Log binding, summary installation, HTTP settlement, presentation settlement, and render decisions. It does not record the Process Card pipeline sequence `optimistic projection -> handoff -> admission settlement -> deadline cleared -> rejection reconciliation`. The quality branch improves the contract and fixtures, but current telemetry cannot verify the complete behavior.
5. The stale-waiting RCA is backed by durable task and execution timestamps plus an exact route regression. Current frontend telemetry does not record the terminal execution `finishedAt`, resolved master `taskId`, previous task `waitingAt`, applied task `waitingAt`, and resulting Control Room `waitingSince` in one causal sequence. The branch intentionally contains diagnosis and a red regression, not the correction.

---

## D. Required Telemetry Contract

1. Emit one bounded `pipeline-store-stability-decision` record containing project scope, incident identity, first-read issue codes, first observation time, re-read result, elapsed stability time, and final action `recovered` or `paused`.
2. Emit one `background-runtime-recovery-settled` record containing component, scope, recovery operation, candidate incident identities, resolved incident identities, final paused state, and outcome.
3. Emit Process Card events keyed by `clientRequestId`: `optimistic-projection-installed`, `handoff-published`, `admission-settled`, `admission-deadline-cleared`, and `rejection-reconciled`. Record identifiers and status only; exclude prompts, Markdown, tokens, and relay payloads.
4. Emit one `task-terminal-requeue-settled` record containing project, execution identity, canonical task identity, terminal phase, execution `finishedAt`, previous task `waitingAt`, applied task `waitingAt`, and mutation outcome.
5. Keep every event locally bounded by the existing frontend telemetry queue and durable incident ledger. These events must not trigger relay publication or Cloudflare synchronization.

---

## E. Implementation Decision

1. Keep all four changes in one runtime-transition integrity iteration because they share the same ownership invariant.
2. Complete the missing stale-waiting correction before integration; its admitted regression is intentionally red.
3. Add the four telemetry sequences at their existing transition boundaries, without introducing a second state store.
4. Use telemetry to prove ordering and final authority, then retain focused regression tests for each first incorrect transition.
