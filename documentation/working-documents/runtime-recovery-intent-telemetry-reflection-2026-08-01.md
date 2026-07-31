## A. Consolidated Intent

1. The three retained changes protect one invariant: once an owning subsystem reaches an authoritative transition, a later observer must not reverse, duplicate, or misrepresent it.
2. `Stabilize transient pipeline store reads` protects a valid store from being promoted into a latched project-runtime pause after one transient partial read.
3. `Keep successful library recovery resumed` protects a component-owned successful recovery from being reversed when generic recovery resolves the same incidents again and receives an empty result.
4. `FIX - clarify pipeline handoff and stabilize fixtures` makes the optimistic Process Card handoff explicit and guarantees its admission deadline is retired after request settlement.

---

## B. First Incorrect Transitions

1. Pipeline store: a first invalid read immediately creates an upstream store incident; the scheduler observes that incident and creates a second runtime pause before a bounded stability re-read can prove the file valid.
2. Federated library recovery: component recovery resolves its incidents successfully; generic recovery performs a second resolution, treats the empty result as failure, and re-pauses the recovered subsystem.
3. Optimistic pipeline handoff: the frontend completed admission through an unnamed boolean contract and retained an admission timer until implicit cleanup, obscuring which settlement owned navigation and rejection reconciliation.

---

## C. Telemetry Confrontation

1. Pipeline-store telemetry confirms the original failure class. The durable incident ledger records `codex_pipeline_store_invalid` followed by `runtime_scope_paused` for the scheduler. One invalid authored-content incident was observed twice between `2026-07-29T02:38:20.587Z` and `2026-07-29T02:38:31.410Z`; store recovery completed at `02:38:55.355Z`, while the derived scheduler pause was resolved only at `03:33:39.221Z`.
2. Later pipeline-store incidents also demonstrate repeated read/resolution churn. The same `pipeline-content-kind-mismatch` fingerprint produced separate incidents and immediate resolutions at approximately 16-20 millisecond intervals. The ledger proves repeated classification, but it does not yet emit a stability-window decision event that distinguishes transient recovery from persistent corruption.
3. Federated-library telemetry proves an affected scope can remain paused: `federated-skill-publication:psychoqwak` has two occurrences and no `resolvedAt`. It does not record the ordered component-recovery result, generic-recovery result, retained incident identities, and final pause state. The selected idempotence fix is source- and regression-backed but not production-proven by the current telemetry.
4. Frontend telemetry records Codex Log binding, summary installation, HTTP settlement, presentation settlement, and render decisions. It does not record the Process Card pipeline sequence `optimistic projection -> handoff -> admission settlement -> deadline cleared -> rejection reconciliation`. The quality branch improves the contract and fixtures, but current telemetry cannot verify the complete behavior.

---

## D. Required Telemetry Contract

1. Emit one bounded `pipeline-store-stability-decision` record containing project scope, incident identity, first-read issue codes, first observation time, re-read result, elapsed stability time, and final action `recovered` or `paused`.
2. Emit one `background-runtime-recovery-settled` record containing component, scope, recovery operation, candidate incident identities, resolved incident identities, final paused state, and outcome.
3. Emit Process Card events keyed by `clientRequestId`: `optimistic-projection-installed`, `handoff-published`, `admission-settled`, `admission-deadline-cleared`, and `rejection-reconciled`. Record identifiers and status only; exclude prompts, Markdown, tokens, and relay payloads.
4. Keep every event locally bounded by the existing frontend telemetry queue and backend telemetry harness. These events must not trigger relay publication or Cloudflare synchronization.

---

## E. Implementation Decision

1. Keep the three retained changes in one runtime-transition integrity iteration because they share the same ownership invariant.
2. Add the three telemetry sequences at their existing transition boundaries, without introducing a second state store.
3. Use telemetry to prove ordering and final authority, then retain focused regression tests for each first incorrect transition.

---

## F. Engineering Audit

1. No test file or test case was deleted from `dev`. The consolidated diff adds one unit-test file and extends four existing test surfaces. Removed test lines replace duplicated fixtures and mutable route setup; they do not remove assertions.
2. The obsolete stale-waiting regression and RCA were removed because current `dev` already owns that behavior; their net diff against `dev` is empty.
3. Pipeline-store stability is placed at the downstream pause-promotion boundary in `createCodexProcessCoordinator()`. The integration test injects transient and persistent invalid reads, proves unrelated routes remain available, and asserts the emitted `recovered` and `paused` decisions with their exact incident and project scopes.
4. Federated recovery remains factored through `resumeBackgroundRuntime()`. Its unit test uses the real durable incident ledger, supervisor, and federated runtime to prove synchronized-state installation, original-incident resolution, pause deletion, and suppression of duplicate generic resolution through an isolated in-process peer connector.
5. Optimistic handoff remains at the existing admission and reconciliation boundaries. Focused tests prove the telemetry contract and source ordering; the served Chromium sequence is encoded for success, rejection, and timeout but is not executed because this run has no authoritative injected `platform` value required by `BROWSER_RUNBOOK.md`.
6. Verification passed: backend focused tests `8/8`, frontend focused tests `26/26`, backend and frontend typechecks, frontend full suite `623/623`, and the complete backend suite at concurrency `3`. The only observed failure was a test-only use of `Array.findLast()` outside the backend TypeScript target; replacing it with reverse-and-find corrected the compatibility error before the green typecheck and suites.
7. Historical `dev` telemetry proves the pipeline-store failure class. The branch now proves all three corrected transition paths with local telemetry and isolated fixtures; deployment proof remains distinct from branch verification.
