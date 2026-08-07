# Canary Skill Authoring And Delivery Integration Postmortem

## A. Summary

1. The iteration delivered a substantial authoring system: skill and pipeline-prompt creation, CodeMirror editing, Git-backed revisions, Pierre Diffs, Task-card Markdown editing, direct Markdown routing, canary isolation, and a delivery control plane.
2. Commit `5d309bb525eb0ddf20af9292d7ca080bb06cdf95` was the first incorrect closeout transition. Its merge message stated that canary QA confirmed the complete dev iteration and that the iteration was ready for integration.
3. At that transition, the recorded served-proof group still left pipeline-only prompt execution and the complete suite open. The delivery topology was explicitly protocol `0`.
4. Later commits added runtime recovery, canary status, server decomposition, and pipeline-content recovery. Commit `9a4034c8` merged the resulting `dev` branch into `main`.
5. The reviewed `main` tip, `dcacb5e4`, adds only an unrelated migration task graph. Product source is unchanged from `9a4034c8`.
6. The current source still contains six release-blocking defects: two critical and four high severity. Current Workstation and canary health remain protocol `0`.
7. No production deployment is established by the repository history, runtime health, and delivery journals reviewed here.

---

## B. Intended Invariants

1. One exact clean, pushed, reviewed `origin/dev` SHA must own all canary proof.
2. Canary proof must be produced by the named test authority and must not be operator-authored assertion data.
3. No production mutation may occur before durable admission of that exact SHA.
4. One authenticated coordinator must own the delivery run.
5. Relay transport must preserve the authenticated requester identity at the owner.
6. Remote delivery and remote execution must consume request-bound, one-use authority.
7. Task-card persistence and focused Git revision creation must share one uninterrupted mutation owner.
8. Every external mutation and external authority observation must have durable started and terminal evidence.
9. Resume must distinguish unstarted work, uncertain work, accepted work, and verified work.
10. The frozen production topology must contain every project-owning node, and every target must support delivery protocol `1`.
11. Final completion must require Git, relay, node pointer, process, catalog, federation, and convergence authority to agree.
12. Git integration, runtime deployment, and production proof are separate states.

---

## C. Timeline

1. On `2026-07-25`, the operator defined skill creation, direct editing, a reusable Markdown editor, canary isolation, a dev relay, and complete API and environment documentation.
2. On `2026-07-27`, revision browsing, Pierre Diffs, blue addition semantics, pipeline-only prompts, Git saves, and an isolated canary-first execution order were added to the specification.
3. The first canary gate established production `50150`, canary `50151`, and dev relay `50152` as distinct processes.
4. On `2026-07-28`, implementation was divided into content identity, Git ownership, authoring, prompt execution, editor, Task-card ownership, release protocol, relay topology, delivery orchestration, documentation, and served-proof groups.
5. Integration audits reopened invalid-store handling, Git ownership, diff races, delivery authorization, receipt ownership, release leases, candidate evidence, relay authority, launcher checkout ownership, and default-runtime delivery composition.
6. Focused repairs and focused test results were recorded for those groups.
7. The served-proof group recorded four passing browser scenarios for workspace-skill and Task-card authoring, then explicitly retained open work for pipeline-only prompt execution and the complete suite.
8. On `2026-07-29 14:54 +07:00`, commit `5d309bb5` merged `dev` into `main` and declared the complete iteration ready.
9. Subsequent `main` and `dev` work added canary status, runtime recovery, safe federation verification documentation, server decomposition, and pipeline-content recovery.
10. On `2026-07-30 02:19 +07:00`, commit `9a4034c8` merged that later `dev` state into `main`.
11. On `2026-07-30 02:37 +07:00`, commit `dcacb5e4` added an unrelated migration task graph without changing product source.
12. The `2026-07-30` review compared current source, recorded group evidence, merge messages, and live health. It found that integration had occurred, release admission had not occurred, and critical authority gaps remained.

---

## D. Delivered Architecture

1. **Skill and prompt identity:** workspace skills remain `SKILL.md` content; pipeline-only prompts live under `.decision-os/pipeline-prompts` and are excluded from natural agent skill discovery.
2. **Authoring API:** skill and prompt create/save/retry/history controllers preserve owner paths, content revisions, source kind, and publication boundaries.
3. **Task-card authoring:** Task-card Markdown saves flow through the authoritative `patch-card` mutation and validate the returned task receipt before Git revision creation.
4. **Git history:** authored-file helpers provide focused commits, cursor history, exact historical Markdown, diffs, and recovery tokens.
5. **Editor adapter:** a pinned CodeMirror 6 bundle owns editor state; a pinned Pierre Diffs bundle owns revision rendering.
6. **Direct Markdown routing:** absolute owned Markdown paths resolve to card, thread, skill, and prompt destinations.
7. **Prompt execution:** pipeline-prompt snapshots bind admitted prompt bytes, revision, and content kind to execution manifests.
8. **Canary topology:** application `50151` and dev relay `50152` remain distinct from production `50150`.
9. **Delivery schema:** fixed run phases, terminal statuses, receipts, node state, topology evidence, relay evidence, and exit codes are defined in `shared/schemas/decision-os-delivery-types.ts`.
10. **Delivery CLI:** `bin/decision-os-delivery.mjs` exposes `bootstrap-node`, `candidate`, `promote`, `status`, `resume`, and `rollback`.
11. **Release storage:** immutable detached worktrees, stable `current` pointer, node receipts, process-identity leases, and bounded child processes provide the intended node mutation boundary.
12. **Relay release tooling:** pinned Wrangler commands list, upload, activate, inspect, and roll back relay versions.

---

## E. Failed Closeout Invariant

1. The closeout invariant was: declare the iteration ready only after every required behavior has complete evidence and every release prerequisite is admitted.
2. The recorded G12 evidence did not satisfy that invariant. Pipeline-only prompt served proof remained open, the complete suite remained pending, and nodes remained protocol `0`.
3. The merge description at `5d309bb5` converted partial evidence into a complete-iteration claim.
4. That claim allowed Git integration to become the practical closeout event even though the delivery protocol, all-node bootstrap, full verification, card reconciliation, final report, and production admission gates were incomplete.

---

## F. First Incorrect Transition

1. **Transition:** merge commit `5d309bb5`, `Merge dev into main`.
2. **Claim:** “Canary QA confirmed the selected Codex Log performance fix and the complete dev iteration is ready for integration.”
3. **Contradicting evidence:** the iteration orchestration record states that T49 remained open because no served pipeline-only prompt proof existed and the complete suite remained pending.
4. **Runtime evidence at the same boundary:** canary was documented as `deliveryProtocol: 0`, empty release SHA, and `unbootstrapped`.
5. **Why this is first:** earlier worker reports described focused implementation progress and retained their verification limits. `5d309bb5` was the first durable repository transition that collapsed those limits into a complete integration assertion.
6. **Correct transition:** the merge should have been blocked pending the complete closeout ledger. If an integration merge was still desired, its message and cards needed to state “integrated for continued verification; not release-admitted.”

---

## G. Card And Git Divergence

1. The task graph correctly accumulated detailed specs, task inventory, dependency groups, repairs, and partial served proof.
2. The Git merge message became more authoritative than the still-open Task evidence.
3. The master summary and linked implementation cards were not reconciled atomically with the merge admission decision.
4. Git therefore recorded “complete dev iteration” while the Task system still recorded incomplete T49 proof and protocol-0 runtime.
5. Later product merges advanced `main` without a closeout card that bound the exact final source SHA to the exact final test set and exact live admission state.
6. The divergence made it possible to answer “integrated in main” accurately while incorrectly inferring “verified,” “deployable,” and “production-ready.”
7. Future closeout must update the verification card, implementation report, postmortem, runbook, master executive summary, and Git merge evidence from one immutable candidate SHA.

---

## H. Delivery Protocol Bypass

1. The intended production path is `candidate` followed by `promote`, with durable admission before the first production mutation.
2. The actual integration path was a direct Git merge from `dev` into `main`.
3. No reviewed evidence shows a successful candidate record for the final SHA, a delivery run journal, an admitted topology fingerprint, a relay production activation, node protocol-1 bootstrap, final-authority receipt, or terminal `complete` delivery status.
4. Direct Git integration did not itself deploy production, but it bypassed the release protocol as the authority for moving reviewed code into the production branch.
5. Live Workstation and canary health still report protocol `0`; the dev relay alone reports protocol `1`.
6. The all-node protocol is also structurally blocked because bootstrap implements only Workstation and explicitly rejects the phone.
7. The result is a split system: `main` contains delivery code and documentation, while live nodes are not adopted by that delivery protocol.

---

## I. Verification Evidence

1. Focused worker records cover content identity, Git revisions, authoring APIs, prompt snapshots, CodeMirror and Pierre integration, Task-card ownership, delivery schemas, relay topology, release stores, CLI parsing, and documentation.
2. The G12 record covers four served Chromium scenarios on `50151` for workspace-skill and Task-card authoring behavior.
3. The G12 record explicitly excludes a completed pipeline-prompt served scenario and the complete suite.
4. Source inspection in this review identified defects outside the focused assertions:
   1. requester identity loss at the relay
   2. manually supplied canary proof assertions
   3. spoofable federated execution identity
   4. non-atomic Task-card and Git ownership
   5. an unrecorded final-authority crash window
   6. editor lifecycle and route ownership defects
5. Current live health establishes runtime state only. It does not prove editor interactions, prompt execution, cross-node delivery, production relay activation, node restart, rollback, and convergence.

---

## J. Critical Defects

1. **Relay requester identity loss**
   1. `federation-relay/src/index.ts:400-406` sends the owner a `request-open` frame without `from`.
   2. `federation-node-connector.ts:543-555` requires `frame.from` to issue delivery capability.
   3. `delivery-routes.ts:126-137` rejects the resulting capability-less internal delivery request.
   4. Required correction: preserve relay-authenticated sender identity and bind it into one-use transport authority.
2. **Forgeable candidate proofs**
   1. `delivery-cli-runtime.ts:126-142` trusts locally supplied proof records.
   2. `delivery-admission-controller.ts:323-348` validates assertion shape and freshness without validating provenance.
   3. Required correction: execute and sign proof production inside the candidate command; persist immutable output receipts tied to command, route, artifact hash, and release SHA.
3. **Missing coordinator authorization**
   1. The receiving node cannot establish the requester after the relay drops `from`.
   2. The delivery capability does not carry a durable admitted-coordinator role because it is never minted on that path.
   3. Required correction: record one coordinator in settings and candidate evidence; require the same identity in every delivery capability and journal transition.
4. **Spoofable federated execution admission**
   1. `federated-execution-admission-routes.ts:42-51` reads a caller-controlled node header.
   2. `create-global-request-handler.ts:142-145` accepts that header when the named node is online.
   3. Required correction: remove header authentication and consume request-bound federation transport authority.
5. **Task-card Git recovery ownership gap**
   1. Card persistence occurs before Git commit.
   2. The admission lock is released before card mutation.
   3. Required correction: one repository mutation owner spans admission, card mutation, byte confirmation, Git commit, and recovery persistence.
6. **Final-authority crash gap**
   1. `delivery-forward-state-machine.ts:453-498` completes the `final-authority` receipt before the separate terminal run-status write.
   2. A crash between those writes leaves a running journal with a terminal phase receipt; resume then rejects that receipt instead of completing the run.
   3. Required correction: write final-authority receipt completion and terminal run status atomically, then test a crash after that exact durable boundary.

---

## K. Frontend Defects

1. `ledger-card-editor.ts:261-305` allows async save and retry continuations to dereference a cleared module-level session after Close.
2. `ledger-card-editor.ts:274-289` preserves stale recovery state after successful save and classifies every `409` before recovery.
3. `request-codex-skill-library-save.ts:49-60` maps every `409` to a content conflict instead of using the stable response code.
4. `resolve-markdown-editor-target.ts:104-154` can discover one shared skill through several projects and return ambiguous ownership.
5. `markdownEditorTargetLocation()` routes shared skill targets through global `/skills` instead of one canonical project-owned route.
6. `dialogs.css:543-548` implements a `900px` width cap instead of the accepted `80vw` desktop width.
7. `render-skill-library-editor-modal.ts:456-504` provides diff history without the paired historical Markdown preview.
8. `text-file-editor-session.ts:103-123` and `responsive/application.js:3305-3311` both own `popstate`.
9. `ledger-card-editor.ts:358-362` silently abandons initial-load failure.
10. The mobile CSS changes modal dimensions but leaves the toolbar in an unwrapped single-row flex layout.

---

## L. Live Protocol State

1. Workstation `50150` returned:
   1. `ok: true`
   2. `status: "degraded"`
   3. `deliveryProtocol: 0`
   4. `releaseSha: ""`
   5. `activeReleasePointer: "unbootstrapped"`
   6. active paused task, federated-task, background, and watcher scopes
2. Canary `50151` returned:
   1. `ok: true`
   2. `status: "ready"`
   3. `deliveryProtocol: 0`
   4. `releaseSha: ""`
   5. `activeReleasePointer: "unbootstrapped"`
3. Dev relay `50152` returned:
   1. `ok: true`
   2. `status: "ready"`
   3. `deliveryProtocol: 1`
   4. `environment: "dev"`
   5. `workerName: "decision-os-federation-relay-dev"`
   6. `durableObjectNamespace: "decision-os-federations-dev"`
4. The protocol-0 application state is evidence that delivery bootstrap and promotion did not complete. It is not a production outage by itself.

---

## M. Impact And Data Safety

1. **Delivered value:** users received integrated skill, prompt, Task-card, revision, diff, and direct-Markdown authoring code on `main`.
2. **Release risk:** the delivery control plane cannot safely authorize remote node mutations, candidate proof can be fabricated from local JSON, and final authority has an unrecorded crash window.
3. **Execution risk:** a reachable caller can claim the identity of an online federation node on the remote execution admission route.
4. **Content risk:** a Task-card can be durably changed while the focused Git revision remains uncommitted; the current recovery design does not hold one lock across both systems.
5. **UI risk:** close, retry, history, conflict, direct-route, and mobile-toolbar behavior has unverified failure states.
6. **Observed data safety:** this review performed read-only Git, source, process, and health inspection. It did not mutate card content, task state, runtime state, node pointers, relay traffic, and production processes.
7. **Deployment boundary:** no reviewed evidence proves that the integrated source was deployed to production through the delivery CLI.

---

## N. Detection Gaps

1. Focused tests validated injected authorities without exercising the relay's exact requester-frame transformation.
2. Admission tests treated proof records as inputs rather than testing their trustworthy production.
3. Federated execution tests did not distinguish a relay-authenticated identity from a caller-supplied matching node ID.
4. Task-card tests proved retry behavior without injecting a concurrent repository mutation between writable admission and focused commit.
5. Delivery crash tests did not inject termination after external final-authority observation and before durable reconciliation.
6. Browser tests did not close the card editor while save and retry requests were in flight.
7. Browser tests did not reopen a saved card after prior recovery to prove stale recovery was cleared.
8. Route tests did not register two projects that map the same shared skill file.
9. Responsive tests did not prove every toolbar action remained reachable at narrow width.
10. Closeout did not require one machine-readable matrix that mapped every accepted requirement to focused, full-suite, served, runtime, and deployment evidence.
11. Merge admission did not compare Git claims with open Task gates.

---

## O. Corrective Actions

1. **P0 — federation transport authority**
   1. Preserve requester identity through relay `request-open`.
   2. Mint and consume request-bound authority for internal delivery and remote execution.
   3. Add relay integration tests that prove forged headers fail and authenticated frames pass.
2. **P0 — candidate and coordinator authority**
   1. Remove operator-authored proof records.
   2. Generate proof receipts from the candidate command.
   3. Bind the configured coordinator identity to candidate, journal, transport, node receipts, and final authority.
3. **P0 — durable ownership**
   1. Hold one lock across Task-card mutation and Git commit.
   2. Persist recovery evidence inside that same owner boundary.
   3. Persist final-authority observation before dependent verification.
4. **P1 — all-node release**
   1. Implement the phone supervisor adapter.
   2. Fixture-test immutable release preparation, pointer activation, restart adoption, status, and rollback.
   3. Bootstrap every production target to protocol `1` before candidate admission.
5. **P1 — frontend correctness**
   1. Give each async editor operation an immutable session generation.
   2. Add abort and close settlement.
   3. Classify error codes explicitly.
   4. Correct geometry, history preview, route ownership, load failure, and mobile toolbar behavior.
6. **P1 — closeout governance**
   1. Adopt `documentation/procedure/implementation/iteration-closeout.md`.
   2. Require an exact candidate SHA, evidence matrix, card reconciliation, report, postmortem, and explicit deployment boundary before merge.
7. Keep the master task active until the operator directly authorizes closure after the repaired iteration passes.

---

## P. Prevention Rules

1. Never treat a merge commit as proof of deployment.
2. Never declare an iteration complete while its evidence ledger contains an open required behavior.
3. Never accept proof records that the candidate preparer can author without executing the proof.
4. Never authenticate a federation mutation from a caller-controlled identity header.
5. Never strip authenticated requester identity at a relay hop when downstream authorization depends on it.
6. Never split one logical content-and-Git save across two independent lock lifetimes.
7. Never retain only a started receipt around an external read whose result controls terminal completion.
8. Never admit a multi-node release while one production node lacks the required supervisor adapter.
9. Never claim an interaction works from source inspection and unit tests alone.
10. Never close the Task graph before its statuses, Git SHA, verification report, and runtime evidence agree.

---

## Q. Evidence Index

1. **Current reviewed tip:** `dcacb5e4a93faff705d672095f03c265b7d0f7f4`.
2. **Current product-source boundary:** `9a4034c8`.
3. **First incorrect closeout:** `5d309bb525eb0ddf20af9292d7ca080bb06cdf95`.
4. **Iteration record:** `documentation/working-documents/expanded-skill-authoring-implementation-orchestration-2026-07-28.md`.
5. **Authoritative specification:** `documentation/working-documents/expanded-skill-authoring-authoritative-spec-2026-07-28.md`.
6. **Authoring architecture:** `documentation/documentation/architecture/codex-content-authoring.md`.
7. **Delivery runbook:** `documentation/procedure/deployment/production-delivery-protocol.md`.
8. **Relay identity loss:** `federation-relay/src/index.ts:400-406`.
9. **Capability minting:** `backend/src/business/federation/helper/federation-node-connector.ts:543-555`.
10. **Capability rejection:** `backend/src/business/delivery/http/delivery-routes.ts:126-137`.
11. **Candidate proof input:** `backend/src/business/delivery/helper/delivery-cli-runtime.ts:126-142`.
12. **Candidate evidence creation:** `backend/src/business/delivery/helper/delivery-cli-runtime.ts:663-749`.
13. **Proof assertion validation:** `backend/src/business/delivery/controller/delivery-admission-controller.ts:323-348`.
14. **Federated execution identity:** `backend/src/business/codex/http/federated-execution-admission-routes.ts:42-51`.
15. **Online-node check:** `backend/src/business/server/http/create-global-request-handler.ts:142-145`.
16. **Task-card save:** `backend/src/business/ledger/controller/save-ledger-card-content-controller.ts:137-190`.
17. **Writable admission lock:** `backend/src/business/codex/helper/skill-git-revisions.ts:83-106`.
18. **Final authority:** `backend/src/business/delivery/helper/delivery-forward-state-machine.ts:453-498`.
19. **Workstation-only bootstrap:** `backend/src/business/delivery/controller/bootstrap-decision-os-node.ts:60-64,106-110`.
20. **Card editor lifecycle:** `frontend/src/runtime/content-authoring/controller/ledger-card-editor.ts`.
21. **History ownership:** `frontend/src/runtime/content-authoring/controller/text-file-editor-session.ts` and `frontend/src/app/responsive/application.js`.
22. **Direct Markdown ownership:** `backend/src/business/content-authoring/helper/resolve-markdown-editor-target.ts`.
23. **Editor geometry and mobile layout:** `frontend/assets/canvas/dialogs.css`.
24. **Skill revision view:** `frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts`.
25. **Live health:** `http://127.0.0.1:50150/api/health`, `http://127.0.0.1:50151/api/health`, and `http://127.0.0.1:50152/health`, read during the `2026-07-30` review.
