# Canary Skill Authoring Main Review

## A. Review Decision

1. The skill, pipeline-prompt, Markdown-card, revision-history, and editor implementation is present on `main`.
2. The reviewed `main` tip is `dcacb5e4a93faff705d672095f03c265b7d0f7f4`.
3. Commit `dcacb5e4` adds an unrelated migration task graph. Product source at the reviewed tip is byte-identical to product source at `9a4034c8`.
4. The implementation is not release-admitted. Current Workstation and canary health report `deliveryProtocol: 0`, an empty `releaseSha`, and `activeReleasePointer: "unbootstrapped"`.
5. The review found six release-blocking authority and durability defects: two critical and four high severity. It also found eight frontend defects. The delivery CLI must not mutate production until those defects are repaired and the closeout procedure passes.
6. No production deployment is claimed by this review. Git integration into `main` is not deployment evidence.

---

## B. Repository Intent

1. Decision OS is a multi-project, file-backed decision and task system with browser authoring, local Codex execution, federated content, durable task state, and an operator-controlled release boundary.
2. Project-owned Markdown remains durable source content. Derived browser projections and federated caches must not replace owner bytes.
3. Recoverable failures must remain inside their owning project, request, task, delivery, watcher, stream, and child-process scope.
4. Production release authority must bind one reviewed Git SHA to canary proof, production topology, relay identity, node identity, durable receipts, rollback authority, and final convergence.

---

## C. Iteration Intent

1. Create and edit workspace skills from the Skill Library.
2. Represent pipeline-only prompts as authored Markdown that pipelines can inject without natural agent discovery and without skill federation publication.
3. Reuse one CodeMirror 6 editor boundary for skills, prompts, and Task-card Markdown.
4. Create a focused Git revision for each accepted save and provide explicit retry after a post-mutation Git failure.
5. Browse historical revisions with Pierre Diffs, red removal semantics, blue addition semantics, keyboard-readable labels, and full historical Markdown.
6. Route direct owned Markdown paths to the canonical editing surface instead of returning raw JSON.
7. Prove the complete feature on an isolated canary and distinct dev relay.
8. Provide one delivery CLI for candidate preparation, production admission, Git promotion, relay activation, node activation, final verification, resume, and rollback.

---

## D. Severity-Ordered Findings

1. **Critical — remote delivery authority is lost in relay transit.** `federation-relay/src/index.ts:400-406` forwards `request-open` without restoring the authenticated sender as `from`. `backend/src/business/federation/helper/federation-node-connector.ts:543-555` issues the one-use delivery capability only when `frame.from` is present. `backend/src/business/delivery/http/delivery-routes.ts:126-137` rejects a missing capability with `delivery_transport_capability_invalid`. The documented coordinator-to-remote-node delivery path therefore cannot authorize its target mutation.
2. **Critical — candidate proof records are locally forgeable assertions.** `candidate-input.json` supplies `relayConfiguration` and five `proofs` through `backend/src/business/delivery/helper/delivery-cli-runtime.ts:126-142`. The candidate command copies those records into evidence at `delivery-cli-runtime.ts:663-749`. `backend/src/business/delivery/controller/delivery-admission-controller.ts:323-348` checks names, `passed`, timestamps, receipt IDs, and SHA equality, but does not bind each proof to the test runner, served route, immutable artifact, or trusted signer.
3. **High — coordinator authorization is not established across federation.** The same relay identity loss prevents the connector from proving which authenticated peer requested `/api/internal/delivery`. The receiving route consumes a capability but receives no durable coordinator role assertion. Release mutation authority is therefore not demonstrably limited to the admitted coordinator.
4. **High — federated execution admission trusts a spoofable node header.** `backend/src/business/codex/http/federated-execution-admission-routes.ts:42-51` accepts `x-decision-os-federation-node`. `backend/src/business/server/http/create-global-request-handler.ts:142-145` authenticates it by finding an online node with the same text ID. The route does not consume request-bound transport authority, so a caller that can reach the route can impersonate an online federation node.
5. **High — Task-card mutation and Git ownership are not one transaction.** `backend/src/business/ledger/controller/save-ledger-card-content-controller.ts:137-190` performs the authoritative card mutation before the Git commit. `assertSkillFileRevisionWritable()` acquires and releases its repository lock at `backend/src/business/codex/helper/skill-git-revisions.ts:83-106` before the card mutation begins. Another repository mutation can enter between admission, card persistence, re-read, and commit. Recovery cannot prove one uninterrupted ownership interval across both durable systems.
6. **High — final-authority completion has a crash window.** `backend/src/business/delivery/helper/delivery-forward-state-machine.ts:453-498` completes the `final-authority` phase receipt before the separate terminal run-status write. A crash between those writes leaves a running journal with a terminal phase receipt. Resume then calls `begin(final-authority)` and fails on the existing terminal receipt.
7. **High — card editor async completion outlives modal ownership.** `frontend/src/runtime/content-authoring/controller/ledger-card-editor.ts:261-305` dereferences the module-level `session` after awaited save and retry calls. `finishClose()` clears that session at lines `125-143`, while the Close action remains available at line `343`. Closing during an in-flight request can make the continuation operate on `null` or on a later editor session.
8. **High — stale card recovery survives a later successful save.** The successful save branch at `ledger-card-editor.ts:274-279` does not clear `session.state().recovery`. A prior Git-recovery state can keep the retry action visible after a subsequent save succeeds.
9. **High — HTTP `409` is treated as one conflict class.** `frontend/src/runtime/codex/effect/request-codex-skill-library-save.ts:49-60` marks every `409` as a content conflict. `ledger-card-editor.ts:279-289` handles `409` before inspecting `recovery`. Repository ownership conflicts and retryable Git outcomes can therefore be presented as stale-content conflicts.
10. **High — direct shared-skill Markdown paths can be ambiguous.** `backend/src/business/content-authoring/helper/resolve-markdown-editor-target.ts:104-154` scans the same shared skill source through each available project and returns `409` when more than one logical project maps to the same canonical file. The generated skill location at lines `79-81` uses global `/skills` plus `projectId`, so the redirect does not carry one path-owned canonical project route.
11. **High — the requested desktop geometry is not implemented.** `frontend/assets/canvas/dialogs.css:543-548` caps the skill and card editor at `900px`; the accepted design required `80vw` width and `95vh` height.
12. **Medium — skill revision history exposes diff without the paired historical preview.** `frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts:456-504` renders only the Pierre diff viewport, while the Task-card revision component owns both preview and diff surfaces.
13. **Medium — browser history has two close owners.** `frontend/src/runtime/content-authoring/controller/text-file-editor-session.ts:103-123` installs a `popstate` listener. `frontend/src/app/responsive/application.js:3305-3311` installs another listener that closes the same card and skill editors. One Back event can trigger duplicate close transitions and a compensating `history.forward()`.
14. **Medium — initial Task-card load failure is silent.** `ledger-card-editor.ts:358-362` returns before building the dialog when the content request fails. The operator receives no error surface and no retry action.
15. **Medium — the mobile editor toolbar has no wrapping contract.** `frontend/assets/canvas/dialogs.css:1337-1379` defines a single-row flex toolbar and actions. The mobile block at lines `1482-1510` changes modal geometry but does not wrap, scroll, or collapse the editor toolbar.
16. **High — production topology remains unbootstrapped.** `backend/src/business/delivery/controller/bootstrap-decision-os-node.ts:60-64` implements only `multiterm-workstation-v1`; lines `106-110` reject every non-Workstation node. The documented all-node release cannot admit the phone until its supervisor adapter exists and has fixture evidence.

---

## E. Implemented Boundaries

1. `frontend/assets/vendor/codemirror-6.0.2.js` and its license pin CodeMirror `6.0.2` as a local browser asset.
2. `frontend/assets/vendor/pierre-diffs-1.2.12.js` and its license pin Pierre Diffs `1.2.12`.
3. `frontend/src/runtime/codex/component/codemirror-file-editor.ts` owns the editor adapter, Markdown mode, read-only mode, focus, value, dirty state, and disposal.
4. `frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts` owns skill and prompt create/edit state, revision navigation, save, retry, and diff presentation.
5. `frontend/src/runtime/content-authoring/controller/ledger-card-editor.ts` adapts the shared editor session to Task-card content APIs.
6. `backend/src/business/codex/helper/pipeline-prompt-library.ts` keeps pipeline-only prompts under `.decision-os/pipeline-prompts`.
7. `backend/src/business/codex/helper/pipeline-prompt-snapshot.ts` binds admitted prompt content to immutable pipeline execution input.
8. `backend/src/business/content-authoring/helper/authored-file-git-revisions.ts` owns focused Git revision history, exact-byte confirmation, and recovery tokens.
9. `backend/src/business/content-authoring/helper/resolve-markdown-editor-target.ts` maps owned Markdown files to card, thread, skill, and prompt destinations.
10. `shared/schemas/decision-os-delivery-types.ts`, `backend/src/business/delivery/**`, and `bin/decision-os-delivery.mjs` implement the delivery journal, receipts, leases, release worktrees, relay helpers, node commands, admission controller, coordinator, and fixed CLI.
11. `federation-relay/wrangler.toml` defines distinct production and dev relay environments.
12. `backend/src/business/server/helper/read-decision-os-settings.ts` reports release identity, delivery protocol, and active release pointer in health.

---

## F. Verification And Runtime Evidence

1. The iteration orchestration record reports focused backend, frontend, relay, launcher, and delivery checks for the implementation groups. Those focused results establish component-level evidence, not complete release admission.
2. The same record reports four served Chromium scenarios on canary `50151` for workspace-skill editing and Task-card editing, including optimistic save, reload persistence, stale rejection, Git recovery, history, accessible diff semantics, geometry checks, dirty close, and focus restoration.
3. The served-proof record explicitly left pipeline-only prompt execution and the complete suite open. Commit `5d309bb5` nevertheless described the complete dev iteration as ready for integration.
4. Current `main` health at `http://127.0.0.1:50150/api/health` reports `deliveryProtocol: 0`, `releaseSha: ""`, `activeReleasePointer: "unbootstrapped"`, `status: "degraded"`, and active paused scopes.
5. Current canary health at `http://127.0.0.1:50151/api/health` reports `deliveryProtocol: 0`, `releaseSha: ""`, `activeReleasePointer: "unbootstrapped"`, and `status: "ready"`.
6. Current dev relay health at `http://127.0.0.1:50152/health` reports protocol `1`, environment `dev`, Worker `decision-os-federation-relay-dev`, and Durable Object namespace `decision-os-federations-dev`.
7. These live responses prove the canary environment remains available and also prove that no protocol-1 node candidate is admitted.
8. This static review did not restart a server, deploy a relay, mutate a release pointer, run the delivery CLI, or alter production.

---

## G. Remediation Sequence

1. Repair relay forwarding so every owner request retains the relay-authenticated requester identity. Bind the one-use delivery capability to requester, owner, request ID, method, path, and body digest.
2. Replace the federated execution node header with the same request-bound transport authority. Reject direct client-supplied federation identity.
3. Make candidate proof generation a repository-owned command that executes the named checks and writes signed, immutable receipts. Remove manual proof values from `candidate-input.json`.
4. Admit delivery only on the configured coordinator and include coordinator identity in candidate evidence, journal identity, remote capabilities, and final authority.
5. Hold one repository mutation lock from pre-mutation card admission through card persistence, byte revalidation, Git commit, and recovery-record persistence.
6. Persist final-authority receipt completion and terminal run status in one atomic run-store write. Add a crash-after-write regression for that exact boundary.
7. Implement and fixture-test the phone supervisor adapter before admitting an all-node release.
8. Repair the editor lifecycle with operation-generation ownership, captured session identity, disabled close while settlement is owned, explicit abort on close, and one terminal continuation.
9. Clear stale recovery on a confirmed save, classify `409` by stable error code, render initial-load failures, resolve shared Markdown ownership once, implement `80vw × 95vh`, add historical preview, assign one `popstate` owner, and make mobile toolbar actions reachable.
10. Execute the focused regressions, package typechecks, complete suite, served canary proof, card reconciliation, documentation review, and release closeout gates in `documentation/procedure/implementation/iteration-closeout.md`.

---

## H. Decision Summary

1. Keep the integrated authoring code on `main`; the review found no evidence of owner Markdown loss from the Git integration itself.
2. Treat the delivery CLI, remote delivery transport, remote execution admission, Task-card Git transaction, and final-authority closeout as not production-ready.
3. Keep the master task active. Publish the review, postmortem, and remediation tasks before any production release decision.
4. Use `documentation/postmortem/canary-skill-authoring-and-delivery-integration-2026-07-30.md` as the causal record.
5. Use `documentation/procedure/implementation/iteration-closeout.md` as the mandatory closeout gate for this repair and future multi-gate iterations.
