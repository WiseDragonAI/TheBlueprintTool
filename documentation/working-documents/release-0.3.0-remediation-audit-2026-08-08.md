# Release 0.3.0 Remediation Audit

## A. Repository Intent

1. **Decision OS must preserve epoch-4 task-state compatibility** while containing failures to their owning project, delivery, watcher, federation, process, and persistence scopes.
2. **Production promotion consumes one canonical published release.** Source integration, release identity, deployment, runtime recovery, and federation convergence remain separately observable boundaries.
3. **Recovery evidence must survive restart.** Invalid durable state remains byte-identical, terminal conflicts remain explicit, and operator recovery installs one causally valid successor without weakening join admission.

---

## B. Current Iteration Intent

1. The requested audit covers the `rel-0.3.0` promotion, the production failure chain through `rel-0.3.12`, and the attempted remediation at `dcc7f74f` on `fix/federation-zero-error-zero-flood-20260807`.
2. The decision required now is whether the remediation branch is safe to integrate and which smallest correction restores production without another speculative release chain.
3. **Corrected release decision: `rel-0.3.0` was the origin of the broken production state and should never have been promoted.** Its Git transaction completed, but the release was behaviorally invalid and lacked the evidence required for production admission.
4. **Remediation decision: reject `dcc7f74f` as an integration candidate.** Preserve it as history. Do not merge, push, deploy, or run its production recovery tooling.

---

## C. Verified State And Chronology

1. `rel-0.3.0` points to parent merge `736b0347`; `devrel-0.3.0` points to `fd937375`. The merge receipt `.decision-os-merge-dev-logs/2026-08-06T14-00-59.140Z-769948.jsonl` ends in `promotion-completed` and records matching parent and child release tags.
2. **`promotion-completed` was not release-validity evidence.** The receipt proves only the executed Git merge, tags, parent order, protected gitlink, and repository status. It contains no behavioral result for watcher startup, complete production-state federation, terminal collision handling, restart recovery, or real deployment convergence.
3. **Release 0.3.0 introduced the broken behavior.** Relative to `rel-0.2.1`, it changed `96` paths with `4,614` additions and `586` deletions. The release included `40cfdf2b` and `2e40175f`, which respectively introduced incomplete repair ownership and invalid startup Markdown reconciliation.
4. `rel-0.3.1` activated the coordinator, but its Cloudflare Worker was not deployed. Releases `rel-0.3.2` through `rel-0.3.12` were then created while reacting to successive delivery and federation symptoms originating from the invalid 0.3.0 release.
5. The current production release pointer resolves to `rel-0.3.12` at `0a14fa39`. `origin/main` is the same commit. Local `main` contains main-owned audit and recovery documentation beyond that release.
6. `dev` and `origin/dev` both point to `550b64fa`. The attempted remediation is one isolated commit, `dcc7f74f`, and has not entered `dev`.
7. The remediation worktree has only untracked dependency directories. The primary parent has no protected staged paths. The main `.decision-os` child contains an unstaged operator/agent incident-review card change and was not modified by this audit.
8. The active production incident ledger groups unresolved evidence into `49` `task_content_capture_failed` incidents with `632` observations, one Ardaria `EACCES` incident with `79` observations, two mobile `federated_library_remote_unavailable` incidents with `12` observations, and two `EADDRINUSE` incidents.

---

## D. First Incorrect Transitions

1. **Watcher transition introduced by 0.3.0:** commit `2e40175f` allowed startup reconciliation to interpret `one retained causal head + missing mutable Markdown sidecar` as an external edit. Startup then launched capture through an unbounded `Promise.all`. Missing MOH and lys files became repeated `task_content_capture_failed` incidents; the inaccessible Ardaria path received concurrent `EACCES` attempts.
2. **Federation transition introduced by 0.3.0:** commit `40cfdf2b` added valid epoch-4 flood guards but retained response-send completion instead of receiver convergence as repair ownership. Eighteen MOH entities with the same causal dot and different values were correctly rejected by the relay. The node retained them as dirty because no terminal rejection settled the delivery.
3. **Release-admission transition:** the 0.3.0 promotion treated Git merge admission as sufficient release admission. No gate executed the candidate against the complete real production catalog and durable state before creating `rel-0.3.0`.
4. **Operational transition:** the incomplete `rel-0.3.1` deployment was answered with eleven further patch releases instead of first classifying 0.3.0 as an invalid promoted baseline.
5. Commit `630baa87` then scoped durable repair admission to a socket session. A reconnect therefore purchased another repair attempt for unchanged durable state and reopened the flood condition.

---

## E. Why 0.3.0 Should Have Failed Admission

1. **The watcher test fixture excluded the production failure.** `project-content-runtime.test.ts` created the mutable Markdown file unconditionally before every startup test. Its startup cases therefore proved existing-file reconciliation only. No release test combined one retained head with an absent sidecar, an inaccessible project root, or many affected resources.
2. **The federation proof excluded the production collision.** The 0.3.0 relay tests generated valid mergeable entities and simulated a dropped sentinel. They proved duplicate-request suppression and large healthy synchronization, but never supplied the same causal dot with different values already present across local and relay state.
3. **The acknowledgement contract was incomplete.** `persistStateEntities()` attempted the join before emitting `state-relay-ack`. A same-dot collision threw before any accepted or terminal rejected outcome. The node retained the batch as dirty and had no finite terminal settlement path.
4. **The promotion tool had no behavioral admission gate.** `decision-os-merge-dev` checked branches, dirt, conflicts, tags, merge parents, and the protected `.decision-os` gitlink. It neither ran the repository verifier nor consumed a release-bound canary receipt.
5. **The canary evidence was not bound to the final release candidate.** The flood working document recorded isolated proof for the federation patch, but 0.3.0 later bundled that patch with atomic Markdown synchronization, delivery changes, merge tooling, frontend work, and unrelated features. No final-candidate test replayed the complete 96-path release against copied production state.
6. **The required blocker was therefore visible before promotion:** the candidate lacked tests for missing and inaccessible sidecars, lacked same-dot collision settlement, lacked restart-stable recovery, and lacked an immutable full-state canary receipt tied to `fd937375`.

---

## F. Remediation Branch Findings

1. **Critical - restart destroys collision recovery evidence.** `backend/src/business/federation/runtime/federation-state-runtime.ts` rehydrates persisted rejection entries with `key`, `stateHash`, and `code`, but drops `relayStateHash` and `collisions`. `validCollisionEvidence()` in `federation-task-state-replicator.ts` requires those fields. After restart, `restorePausedProjectRepair()` rejects the evidence, falls back to an empty held repair, and explicit local-authority reconciliation cannot proceed.
2. **High - Ardaria permission failure is hidden.** `project-content-runtime.ts` uses `existsSync(change.file)` as startup admission. Node maps an inaccessible path to `false`, so the branch silently skips the resource instead of recording one contained `EACCES` result. This is failure suppression, not containment.
3. **High - the canary does not exercise the claimed delivery boundary.** `release-canary-delivery-proof.ts` defines `fakeRepositoryLock()` and `fakeLease()` and injects isolated effects into `promoteDecisionOsDelivery`. It proves state-machine behavior under doubles, not the canonical repository lock, lease, tag resolution, deployment, and recovery path.
4. **High - implementation scope is disproportionate.** `dcc7f74f` changes `51` paths with `8,441` additions and `207` deletions. It adds a release platform, Git sandbox, snapshot/archive system, backup CLI, deployment proof framework, canary administration endpoint, and orchestration layer alongside the watcher and federation fixes.
5. **High - no integration proof exists.** The branch has not merged to `dev`, so the mandatory exact-feature `decision-os-dev-integration-check.mjs` admission cannot have passed. The commit also contains no required Decision OS card/thread Markdown.
6. **Medium - current main documentation is stale.** Commit `081b1829` changed the recovery plan to non-destructive causal reconciliation. Commit `3f6e7c91` temporarily restored the older dev blob to avoid a planned merge conflict. Because the feature was never merged, current `main` still documents the older reset/reseed path while `dcc7f74f` implements causal successor recovery.
7. **Verification - backend typecheck passed.** The backend full suite produced `782` passes and `2` file-level failures. Focused rerun of both failed files passed all `16` tests, establishing suite-order or concurrency flakiness rather than a deterministic pass. This does not cure the static critical defects.

---

## G. Release Patch Classification

1. **Retain** deploy-only promotion from `5a2cdc89`, tag resolution from `293d23b6`, sibling-parent and port correction from `d0f7d826`, bounded batches from `f8040f47`, exact acknowledgement retention from `a03504ab`, and single-flight delivery from `b324d6bf`.
2. **Revert** local-only project exclusion from `914b170b`, repository-origin error erasure from `a72dacbf`, and session-scoped repair eligibility from `630baa87`.
3. **Replace** narrowed health projection from `f64e9c27` with complete diagnostics plus a separate deploy-blocking projection.
4. **Replace** socket-send repair completion from `c5f617d8` with receiver-application convergence.
5. **Treat** `8983d605` as diagnostic telemetry only.

---

## H. Remediation Path

1. **Do not incrementally repair `dcc7f74f`.** Its proof platform and backup architecture obscure the four required corrections and already contain a restart-critical defect.
2. Restore one canonical non-destructive recovery document on `main`: retain epoch 4 and existing frames, remove relay reset/reseed, and require a causally valid local successor for the terminal collision.
3. Create a new isolated feature from current `dev` containing only four corrections: explicit `stat` and `open` admission distinguishing `ENOENT` from `EACCES`; sequential per-project startup capture; durable repair identity across reconnect; additive terminal rejection carrying complete restart-stable evidence.
4. Keep collision recovery inside the existing replicator and task-state store. Add a regression that serializes, restarts, rehydrates every rejection field, executes explicit reconciliation, and proves convergence without deleting relay state.
5. Test the existing delivery and merge tools through their real lock, lease, tag, and isolated-root boundaries. Do not describe injected fake leases as end-to-end release proof.
6. Admission requires focused watcher, collision, restart, reconnect, deadline, Worker, and Termux tests; backend and relay typechecks; one backend and relay full suite; a bounded isolated two-node canary; complete diff review; required Decision OS card/thread documentation; exact-feature dev integration acceptance; then push the accepted merge only.

---

## I. Operator Decision Summary

1. **Classify `rel-0.3.0` as an invalid promotion and the origin of the broken production state.** The successful Git receipt does not make it a clean release.
2. **Reject the 8.4k-line remediation branch.** It cannot recover terminal collisions after restart and hides the Ardaria permission boundary.
3. **Preserve production and repository state.** No rollback, relay deletion, recovery command, merge, push, deployment, server restart, tag movement, branch deletion, or worktree cleanup is authorized by this audit.
4. **Authorize one narrow replacement iteration** only after the canonical non-destructive recovery document is restored.
