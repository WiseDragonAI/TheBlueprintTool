## A. Authority And Delivery Outcome

1. **This document is the authoritative expanded specification** for skill authoring, pipeline-only prompts, reusable Markdown editing, Git-backed revisions, direct Markdown routing, canary admission, and one-command production delivery.
2. **The selected product outcome** is one owner-aware Markdown authoring system. It creates and edits `federated-skill`, `workspace-skill`, `pipeline-prompt`, and Task card description content without granting browser-selected filesystem access.
3. **The selected release outcome** is one non-interactive CLI that admits one exact `origin/dev` commit, publishes one reviewed `main` merge commit, deploys the production relay, activates every admitted project-owning node, restarts each node through its declared supervisor, and proves release identity plus federation convergence.
4. **The current `dev` source is not admitted.** The implementation is uncommitted, local `dev` differs from `origin/dev`, current `origin/main` is not contained by the development tip, the checked-in Wrangler configuration does not yet prove the documented isolated `dev` Worker, and active nodes do not yet expose delivery protocol `1`.
5. **No production mutation is permitted before canary admission.** A delivery run may create its local journal and perform read-only preflight before admission. It may not push `main`, deploy relay traffic, change a node release pointer, stop a process, and restart a process until the journal contains a successful admission receipt for the exact release SHA.
6. **Implementation remains on the isolated `dev` worktree.** The dirty primary checkout, staged operator hunks, production process `50150`, and production relay state remain untouched until the admitted delivery command reaches its mutation phases.

---

## B. Selected Scope

1. **Editable authored kinds:** `federated-skill`, `workspace-skill`, and `pipeline-prompt`.
2. **Editable non-skill owner:** the Markdown description of a locally owned Decision OS card whose `comment.contentFile` is resolved through the authoritative ledger projection.
3. **Read-only authored sources:** user, system, plugin, imported federated, unavailable-project, and remote-replica skill records.
4. **Direct Markdown compatibility targets:** current card descriptions, current card-owned thread files, scanned skill identities, and registered pipeline-prompt identities.
5. **Thread behavior:** a direct thread Markdown path opens the canonical card thread surface. Whole-thread CodeMirror replacement is not admitted because thread notes remain individually identified task-state mutations.
6. **General repository Markdown:** an unregistered `.md` file does not become editable merely because it is inside a project. The server returns `markdown_editor_target_not_found`.
7. **Thread attachment behavior:** attachment click-to-edit remains a documented future owner adapter. The CodeMirror adapter must retain a code comment naming that reuse. Attachment mutation is not implemented in this delivery.
8. **Content ownership transitions:** rename, delete, archive, restore, and kind conversion are outside this delivery. `contentKind` is immutable after creation.
9. **Historical restore:** revision selection is read-only. A historical revision is not restored automatically; a later restore feature must submit the selected bytes as a new optimistic-concurrency save and create a new commit.

---

## C. Content Identity, Storage, And Discovery

1. **Agent-visible identity** is the validated `name` field in `SKILL.md` frontmatter.
2. **`federated-skill` storage** is the canonical server `.skills/<name>/SKILL.md` root returned by `resolveServerSkillContext()` in `backend/src/business/codex/helper/server-skill-context.ts`.
3. **`workspace-skill` storage** is the selected registered project's `.skills/<name>/SKILL.md` root.
4. **`pipeline-prompt` identity and storage** belong to `CodexPipelineStore.authoredContent` in `.decision-os/codex-pipelines.json`; Markdown is stored at `.decision-os/pipeline-prompts/<id>.md`. No `.skills` directory and no `SKILL.md` file is created for a prompt.
5. **Natural agent discovery** in `scanCodexSkills()` returns agent-visible skills only. It never returns `pipeline-prompt`.
6. **Authoring and pipeline selection discovery** use `readCodexContentCatalog()` and may return all three content kinds with `contentKind` plus `executionVisibility`.
7. **Execution visibility values** are `agent` for both skill kinds and `pipeline-only` for prompts.
8. **One global name namespace** spans canonical server skills, every available registered workspace root, registered pipeline prompts, user skills, system skills, and plugin skills. `createCodexSkillLibrary()` must build that index before writing bytes.
9. **Collision behavior** is deterministic. A duplicate returns HTTP `409` with code `content_identity_conflict`, the existing content kind, the owning project identity when applicable, and the protected source class. It returns no physical path.
10. **Creation is path-free.** Browser payloads containing `path`, `filePath`, and `skillFile` remain rejected before validation and before writes.
11. **Frontmatter validation** remains mandatory for both agent-visible kinds. Pipeline prompt validation uses its store identity, UTF-8 Markdown body, payload ceiling, and contained registered content file; it does not manufacture agent-visible frontmatter.

---

## D. Editor Library And Session Ownership

1. **Selected editor:** `codemirror` `6.0.2` and `@codemirror/lang-markdown` `6.5.1`, both MIT licensed, pinned in `frontend/package.json`, locked in `frontend/package-lock.json`, bundled locally as `/assets/vendor/codemirror-6.0.2.js`, and served without a runtime CDN.
2. **Selected diff renderer:** `@pierre/diffs` `1.2.12`, Apache-2.0 licensed, pinned and bundled locally as `/assets/vendor/pierre-diffs-1.2.12.js`.
3. **Modal geometry:** the desktop dialog is `80vw` wide and `95vh` high. The existing mobile inset rule remains, with toolbar overflow and the editor body scrolling inside the dialog.
4. **Stable editor owner:** add `frontend/src/runtime/content-authoring/controller/text-file-editor-session.ts` with `createTextFileEditorSession()`. One session owns draft Markdown, loaded content revision, dirty state, saving state, Git-recovery state, revision selection, `beforeunload`, modal-close confirmation, focus return, and final disposal.
5. **Editable view lifetime:** one editable `EditorView` is mounted when the session opens. Metadata changes, status changes, save progress, history navigation, tag changes, default-model changes, and footer rendering must not destroy or remount that view.
6. **Revision preview lifetime:** the session may mount one separate read-only CodeMirror preview while history is open. Closing history destroys only the preview; the editable view retains its exact undo stack, selection, search state, wrapping state, scroll position, and draft.
7. **Adapter boundary:** `mountCodeMirrorFileEditor()` in `frontend/src/runtime/codex/component/codemirror-file-editor.ts` owns CodeMirror configuration, editor commands, dirty observation, and `EditorView.destroy()`. It owns no API request, physical path, Git operation, federation action, task mutation, skill metadata, and pipeline execution.
8. **Read-only controls:** read-only mode disables document mutation, Undo, Redo, and Save. Find, wrapping, revision navigation, content selection, copying, and focus navigation remain enabled.
9. **Session close behavior:** explicit close, Escape, browser Back, route change, and page unload consult the same dirty state. A dirty session requires discard confirmation. A clean session closes immediately and returns focus to the initiating control.
10. **Route persistence:** a canonical editor deep link reloads canonical owner bytes and opens a new session. In-memory drafts are not persisted across a full page reload.
11. **Owner adapters:** skill metadata remains in `render-skill-library-editor-modal.ts`; Task card identity and mutation remain in a new card adapter; both consume the same session controller and CodeMirror adapter.

---

## E. Direct Markdown Resolution And Canonical Routes

1. **Server resolver:** add `resolveMarkdownEditorTarget()` in `backend/src/business/content-authoring/helper/resolve-markdown-editor-target.ts`.
2. **Compatibility inputs:** `GET` and `HEAD` requests whose decoded pathname is an absolute `.md` path, plus project-scoped requests for `/.decision-os/*.md`, enter the resolver before `tryServeDecisionOsAsset()` and before the unmatched JSON fallback in `createHttpServer()`.
3. **Containment:** the resolver enumerates available registered projects, computes each current owner file through its existing owner helper, compares canonical real paths, rejects lexical escapes, rejects realpath escapes, rejects symlinks, and requires exactly one owner.
4. **Card target:** an exact current `comment.contentFile` match redirects to `/p/:projectId/ledgers/:ledgerId/cards/:cardId?editor=markdown`.
5. **Skill target:** a scanned server, workspace, user, system, plugin, and imported skill match redirects to `/skills?editor=skill&name=:skillName`. A workspace skill also includes `projectId=:projectId`.
6. **Pipeline prompt target:** a registered prompt match redirects to `/skills?editor=skill&name=:promptName`.
7. **Thread target:** a current card-owned `threadFiles[threadId]` match redirects to `/p/:projectId/ledgers/:ledgerId/cards/:cardId?thread=open`.
8. **Unowned thread target:** a thread file with no live owning card does not gain a raw edit surface and returns `markdown_editor_target_not_found`.
9. **Successful response:** compatibility resolution returns HTTP `302`, `Cache-Control: no-store`, and the canonical identity route. It returns no Markdown bytes and stores no absolute path in browser state.
10. **Missing and unsafe response:** an unregistered, missing, non-Markdown, traversing, escaped, unavailable, stale, symlinked, and out-of-root target returns HTTP `404` with code `markdown_editor_target_not_found`.
11. **Ambiguous response:** multiple current owners for one canonical file return HTTP `409` with code `markdown_editor_target_ambiguous`.
12. **Protected content:** a protected skill still redirects to its canonical skill editor route; its identity response marks the session read-only and supplies the exact read-only reason.
13. **Zone independence:** the canonical card editor route does not contain `zoneId`. Card movement does not invalidate a direct editor link.
14. **Fallback correction:** an unmatched `.md` URL never returns the current generic HTTP `200` `{ok, method, url}` response.

---

## F. Owner-Specific Read And Save Contracts

1. **Skill reads and saves** remain identity-scoped on `GET` and `PUT /p/:projectId/api/codex/skill-library/:name`.
2. **Skill creation** remains `POST /p/:projectId/api/codex/skill-library` with explicit `contentKind`, stable identity, description, initial Markdown, and a required project identity for `workspace-skill`.
3. **Card reads** remain `GET /p/:projectId/api/ledgers/:ledgerId/cards/:cardId`; the response adds SHA-256 `contentRevision` for the hydrated description bytes.
4. **Card editor saves** use `PUT /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/content` with `{markdown, expectedContentRevision}`. The browser never sends `contentFile`.
5. **Card persistence order:** the controller checks editability, content size, expected revision, staged-path protection, and the repository mutation lock; submits one scoped `patch-card` command; verifies its exact mutation receipt plus task clock; reloads the authoritative card projection; confirms the returned Markdown; then creates the focused Git revision.
6. **Task-state authority:** `patch-card` remains the only component allowed to replace Task card Markdown. The content endpoint does not write the card file directly and does not bypass content heads, task clocks, federation publication, or mutation receipts.
7. **Card Git transaction:** a successful card editor save commits only the card Markdown file. Runtime task-state objects and thread files are excluded from the commit.
8. **Task mutation succeeds and Git fails:** the Task card bytes, task content head, task clock, and publication remain authoritative. The endpoint returns HTTP `503` with code `git_revision_pending_recovery`, `authoredBytesPreserved: true`, `gitRevisionCreated: false`, the confirmed `contentRevision`, and a recovery token bound to that exact revision.
9. **Card Git retry:** `POST /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/revisions/retry` accepts the confirmed content revision and recovery token, revalidates current owner bytes and staged-path protection, and commits those exact bytes without issuing a second task mutation.
10. **Recovery collision:** changed owner bytes make the retry return HTTP `409` with `content_revision_conflict`; it does not commit stale bytes.
11. **Skill Git recovery:** the existing skill save contract adopts the same explicit recovery result and retry semantics. Uncommitted federated skill bytes remain ineligible for export. Uncommitted prompt bytes remain ineligible for pipeline admission.
12. **Metadata-only changes:** tags, favorite state, default model, and default effort use their existing metadata mutation. They do not report a content save and do not claim a new file revision.
13. **No-op save:** unchanged Markdown returns HTTP `422` with code `content_not_changed`; it does not reuse an older commit and does not report success.
14. **Create success:** creation returns success only after its owned files and focused Git revision exist. A prompt creation transaction allows its prompt Markdown and `.decision-os/codex-pipelines.json`; a skill creation transaction allows only its `SKILL.md`.

---

## G. Git Revision And History Contract

1. **Generic Git owner:** replace the skill-specific process boundary with `backend/src/business/content-authoring/helper/authored-file-git-revisions.ts`. It exposes owner-neutral commit, retry, history, and revision functions consumed by skills, prompts, and Task cards.
2. **Asynchronous process boundary:** replace `spawnSync` in authored revisions and federated export admission with one bounded asynchronous process helper at `backend/src/business/process/helper/run-bounded-process.ts`.
3. **Process containment:** every Git child has bounded stdout and stderr, a finite deadline, cancellation, recorded process identity, `SIGTERM`, timed `SIGKILL` escalation, guaranteed promise settlement, and delivery-scoped incident context. Slow Git cannot block unrelated HTTP, health, diagnostic, task-state, and federation requests.
4. **Repository serialization:** authored commits and delivery promotion share an exclusive mutation lock located under the repository Git common directory. A held live lock returns HTTP `423` with code `repository_mutation_locked`. A stale lock is reconciled only after its owning operation and current Git state are verified.
5. **Focused commits:** an isolated temporary index stages only the owner allowlist, preserves unrelated index entries byte-for-byte, refuses a pre-staged owned path, creates one commit, and updates `HEAD` through compare-and-swap.
6. **Successful content save:** a success response always advances `HEAD` exactly once and returns the newly created commit. Existing commits are never returned as a new revision.
7. **History completeness:** history uses cursor-based `git log --follow` traversal with no fixed total cap. Each page returns a stable next cursor until the complete affecting history has been traversed.
8. **History entry:** each revision exposes full commit SHA, authored file identity, commit timestamp, author name, author email, subject, file content revision, and rename-followed logical filename. Physical absolute paths are omitted.
9. **Revision content:** the API reads immutable file bytes from the selected affecting commit after proving that commit belongs to the owner's complete history.
10. **Diff direction:** the selected revision is compared with the immediately older affecting revision. The oldest revision is compared with an empty file. This shows the exact change introduced by the selected revision.
11. **Current selection:** opening History selects the current committed revision. Older and Newer controls traverse every loaded page and fetch the next cursor before reaching a boundary.
12. **Revision presentation:** the modal shows the selected full historical Markdown in a read-only preview and its Pierre patch. Removals are red, additions are blue, and both sides retain signs, line numbers, text labels, focus order, and accessible group names.
13. **No red/green-only semantics:** green is not the addition color. Color is never the sole distinction.
14. **Imported federated skill history:** federation transfers the current committed package and provenance revision, not origin Git objects. Imported skills remain current-only and read-only; complete history remains available on the repository that owns the authored skill.

---

## H. Pipeline-Prompt Admission And Execution

1. **Prompt admission occurs once** in `availablePipelineContent()` inside `backend/src/business/codex/controller/start-codex-pipeline-run-controller.ts`.
2. **Clean committed requirement:** the prompt Markdown and its `CodexAuthoredContentRecord` in `.decision-os/codex-pipelines.json` must be tracked, unmodified relative to `HEAD`, present, contained, kind-matched, and reachable from the current owning repository commit.
3. **Immutable run fields:** extend `CodexPipelineRunSkill` in `shared/schemas/codex-pipeline-types.ts` with required `contentRevision`, `contentCommit`, and `promptSnapshot` for `pipeline-prompt`.
4. **Manifest ownership:** `createCodexPipelineRunManifest()` stores the exact admitted prompt bytes, SHA-256 revision, Git commit, and content kind in the immutable run manifest.
5. **Runner ownership:** `codex-pipeline-runner.ts` consumes only the admitted snapshot. It never re-reads mutable pipeline-prompt working-tree bytes during execution.
6. **Fail-closed prompt building:** `buildPipelineSkillPrompt()` requires explicit `contentKind`. A prompt without admitted bytes, with a revision mismatch, and with a kind mismatch throws a stable admission error. It never falls back to `$<skillName>`.
7. **Local execution:** the exact snapshot is injected once into the selected step's process prompt and is never exposed through natural skill resolution.
8. **Remote execution:** the same immutable snapshot may travel inside the authenticated run installation payload. The remote executor injects it only into the selected run step, stores it only with that run's immutable execution evidence, and never writes it into `.skills`, a workspace catalog, a workstation catalog, the cloud-agent skill catalog, and the federation library cache.
9. **Remote admission:** remove the blanket `task_execution_pipeline_prompt_not_federated` rejection from `assertExecutorCanRun()` and replace it with snapshot, commit, revision, kind, payload-size, and authenticated-manifest validation.
10. **Pipeline isolation:** prompt metadata may appear in the authoring catalog and pipeline picker. Prompt bytes never appear in direct skill launch, agent discovery, workspace skill discovery, server skill context, federated skill manifests, and federated skill snapshots.
11. **Missing content:** prompt deletion, dirty bytes, uncommitted bytes, stale store metadata, and disappeared content block the pipeline before execution starts and before a remote run is installed.

---

## I. Federated Skill Publication

1. **Export scope:** `exportableSkills()` in `backend/src/business/federation/helper/federated-library-cache.ts` exports only clean committed `federated-skill` packages under the canonical server root.
2. **Excluded scope:** workspace, user, system, plugin, imported, and pipeline-prompt content never enters the federated skill manifest and snapshot.
3. **Cache invalidation:** a successful federated skill creation and content commit invalidates the export index before the next manifest read.
4. **Synchronization:** after invalidation, the server publishes the refreshed manifest and requests the existing bounded skills-first synchronization.
5. **Post-commit relay failure:** local content and its Git revision remain successful. The response exposes `publication.status: failed`, records a scoped federation incident, and offers an explicit synchronization retry. It does not report that the local save failed.
6. **Uncommitted recovery state:** a federated skill with authored bytes and no Git revision is excluded until Git recovery succeeds.
7. **Prompt run transport:** run-scoped prompt snapshot transport is execution data, not federated library publication.

---

## J. Authorization, Collision, And Error States

1. **Actor boundary:** authoring remains inside the current trusted Decision OS operator deployment boundary. This delivery adds resource authorization and does not add an end-user role database.
2. **Resource authorization:** every editable request is bound to a server-resolved project, owner kind, identity, canonical root, current revision, and editability reason. Browser-supplied paths never authorize reads and writes.
3. **Replica boundary:** a direct path resolves only against locally owned available projects. Remote replicas remain read-only through their existing projected identities.
4. **Delivery authorization:** the CLI is local and non-interactive. Git uses the Wise SSH identity, Wrangler uses `CLOUDFLARE_API_TOKEN` from ignored local configuration, and neither secret appears in arguments, journal bodies, logs, HTTP responses, and JSON summaries.
5. **Internal node authorization:** `/api/internal/delivery` accepts only a bounded request carried by the authenticated federation connector from a currently online peer. It accepts no shell command, repository path, process command, port, relay URL, environment mutation, and arbitrary supervisor instruction.
6. **Read-only response:** protected and imported content returns HTTP `403` with `content_read_only`, its source class, and one stable reason.
7. **Stale response:** changed bytes return HTTP `409` with `content_revision_conflict`, the current revision, and no overwrite.
8. **Staged-path response:** a pre-staged owned path returns HTTP `409` with `authored_path_staged` before owner mutation.
9. **Invalid content response:** invalid kind, invalid identity, frontmatter mismatch, invalid Markdown encoding, invalid prompt registration, and unsafe reference return HTTP `422` with a stable code and field.
10. **Payload response:** content above the one-million-byte ceiling returns HTTP `413` with `content_too_large`.
11. **Owner unavailable response:** a paused project, invalid durable owner, unavailable repository, and failed task-state recovery return HTTP `503` with the owning scope and incident identity. Invalid durable bytes remain byte-identical.
12. **Git pending response:** owner bytes persisted without a commit return `git_revision_pending_recovery`; the UI keeps the confirmed bytes, recovery token, and revision visible.
13. **UI conflict behavior:** a rejected save keeps the editor open and keeps the draft. Only `content_revision_conflict` offers an explicit authoritative reload; reload is never automatic.
14. **Global collision check:** the all-project identity index is re-read immediately before atomic creation. A conflict writes no temporary file, store entry, Git object, and federation record.

---

## K. Canary And Admission Gate

1. **Canary branch:** the exact release candidate is a clean pushed `origin/dev` SHA that contains the current `origin/main` as an ancestor.
2. **Canary worktree:** `.worktrees/dev` is the only feature implementation checkout and contains no staged entry, untracked implementation file, active Git operation, and local-only commit at admission.
3. **Server isolation:** production remains on `50150`; `decision-os-workstation-dev` serves the exact candidate on `50151` through its own MultiTerm registration.
4. **Relay isolation:** `federation-relay/wrangler.toml` must contain a real `[env.dev]` Worker name and a distinct `FEDERATIONS` Durable Object binding. Canary credentials, node identity, namespace, URL, logs, and ignored settings are separate from production.
5. **Source proof:** an earlier local `--env dev` invocation does not satisfy admission until the distinct environment exists in source and Wrangler validation proves the resolved Worker plus binding.
6. **Canary content proof:** create all three content kinds; save each; reload; create and recover a forced Git failure; exercise stale conflict; prove prompt discovery exclusion; execute an admitted local prompt; execute an admitted remote prompt snapshot; prove workspace isolation; prove federated skill convergence through the development relay.
7. **Canary editor proof:** use the Linux browser runbook and `/snap/bin/chromium`; prove CodeMirror typing, Undo, Redo, Find, wrapping, dirty Back protection, exact `80vw` by `95vh` geometry, focus return, read-only navigation tools, complete history paging, full historical content, and Pierre red/blue diffs.
8. **Direct-path proof:** visit an absolute Task card Markdown URL on `50151`; observe the canonical redirect; save through task state; prove optimistic UI, successful persistence after reload, rejected-save reconciliation, Git history, and production isolation.
9. **Verification proof:** all change-specific tests, scoped typechecks, the complete admitted suite, and browser scenarios run through `node bin/decision-os-verify.mjs -- <direct-command>`.
10. **Admission receipt:** `decision-os-delivery promote` writes the successful canary evidence, exact SHA, command receipts, endpoint health, configuration hashes, and timestamp into the delivery run journal before its first production mutation. The explicit `promote --release-sha` invocation is the operator's admission decision.
11. **Admission rejection:** any evidence mismatch, dirty source, changed `origin/dev`, failed check, reused production relay identity, non-distinct Durable Object binding, missing canary process, and production-state mutation exits with code `2`.

---

## L. Delivery Authority And Minimal Recovery State

1. **Single executable owner:** add `bin/decision-os-delivery.mjs`, published as `decision-os-delivery` from root `package.json`.
2. **Routine command:** `decision-os-delivery promote --release-sha <40-character-origin-dev-sha> --server http://127.0.0.1:50150 --json`.
3. **Companion commands in the same CLI:** `status --delivery-id`, `resume --delivery-id`, `rollback --delivery-id`, and `bootstrap-node`. No second delivery tool is introduced.
4. **Selected recovery design:** use one minimal durable run journal. A stateless coordinator is rejected because the admitted intent, pre-mutation relay deployment, admitted node set, node predecessor release pointers, activation order, lost-response receipts, and compensation progress cannot be reconstructed safely after those authorities change.
5. **No duplicate authority:** the journal never replaces Git refs, Cloudflare deployment status, MultiTerm registration, node active release pointers, health, incidents, and federation diagnostics. Every resumed phase re-reads those authorities and reconciles them with the journal before acting.
6. **Run path:** `<catalog-root>/.decision-os/delivery/runs/<deliveryId>.json`.
7. **Run fields:** delivery ID, admitted SHA, prior `origin/main`, generated `main` SHA, admitted node IDs, zero-project identities, prior relay deployment ID, uploaded relay version ID, each node's prior and staged release SHA, activation order, phase receipts, bounded artifact paths, deadlines, retry counts, failure code, compensation receipts, and terminal status.
8. **Node receipt path:** each node writes `.decision-os/delivery/nodes/<deliveryId>.json` below its stable ignored settings root before scheduling an exit.
9. **Atomic durability:** journals and receipts use sibling temporary files, fsync, and atomic rename. Invalid existing bytes remain byte-identical in place; the delivery pauses and records a separate runtime incident naming the invalid file.
10. **Exclusive lease:** `<catalog-root>/.decision-os/delivery/lock` records delivery ID, PID, admitted SHA, acquisition time, renewal time, and finite expiry. A new promotion cannot steal an expired lock. Only `resume` for the journal's delivery ID may replace it after verifying the owning process is absent and reconciling external state.
11. **Exit codes:** `0` means `complete`; `2` means admission rejected before production mutation; `3` means durable paused, rolled-back-runtime, and partial state; `4` means compensation failed.
12. **Bounded evidence:** command arguments are stored as redacted arrays. stdout and stderr use bounded durable artifact files. Secret values and request authorization headers are never serialized.

---

## M. Node Bootstrap And Target Topology

1. **Active target definition:** every persisted relay-manifest node with at least one project is a production delivery target. Zero-project verification identities are recorded and excluded.
2. **Offline policy:** an offline active target blocks admission before `main` changes.
3. **Topology stability:** the admitted target set is immutable for the run. A new project-owning node, a removed manifest owner, and an identity change before completion produce `delivery_topology_changed`, stop forward progress, and prevent a success claim.
4. **One-time bootstrap:** `decision-os-delivery bootstrap-node` installs delivery protocol `1`, an immutable release root, a stable `current` pointer, stable ignored node settings, health release identity, node receipt storage, and a supervised-exit declaration.
5. **Workstation supervisor:** bootstrap updates the exact MultiTerm production registration to launch the stable `current/bin/decision-os-server.mjs` path while preserving port `50150`, URL, description, log ownership, and automatic restart policy.
6. **Non-workstation supervisor:** bootstrap must bind the node's existing process supervisor to the same stable launcher and prove clean-exit restart, bounded backoff, circuit opening, bounded logs, and emergency-health availability before that node becomes admissible.
7. **Immutable node release:** each `main` SHA is prepared as a detached Git worktree below the configured absolute `deliveryReleaseRoot`; dependencies are installed from lockfiles; the primary checkout is never reset, cleaned, switched, and used as a release directory.
8. **Fixed node contract:** `POST /api/federation/nodes/:nodeId/delivery` accepts `{deliveryId, action, targetCommit, expectedCommit}` with `action` in `preflight`, `prepare`, `activate`, `status`, and `rollback`. The local node uses the same controller directly; remote requests use `FederationNodeConnector.request()`.
9. **Internal contract:** `/api/internal/delivery` accepts the same fixed schema through the authenticated federation transport and returns a durable node receipt identity.
10. **Health identity:** normal and emergency `/api/health` responses expose `releaseSha`, `processStartedAt`, `deliveryProtocol`, and active release pointer identity.

---

## N. Promotion And Activation Protocol

1. Acquire the delivery lease and durably create the run before network and Git work.
2. Fetch `origin/main` and `origin/dev` in `BatchMode` with the Wise SSH key.
3. Require `origin/dev === releaseSha`, `origin/main` as an ancestor of `releaseSha`, clean release-related worktrees, no protected staged owner path, no active Git operation, and no concurrent authored Git transaction.
4. Execute the full canary and verification gate from section K and durably record admission.
5. Read the active target set from `/api/federation/nodes`; require every target online, delivery protocol `1`, stable supervisor adoption, matching repository origin fingerprint, enough space, clean application release state, zero active task execution, zero paused delivery dependency, and no server-fatal incident.
6. Trigger reconciliation on every target and require zero runtime-dirty entities, zero pending delivery IDs, zero content queue depth, zero unavailable content resource, and converged relay entries for every locally owned project.
7. Create an isolated integration worktree from exact `origin/main`, merge the admitted SHA with `--no-ff`, and create a merge commit whose body contains `WHAT:` and `WHY:`.
8. Run the complete admitted verification against the merge candidate. Re-fetch `origin/main` and reject when it differs from the recorded predecessor.
9. Push the exact merge commit to `refs/heads/main` without force and record `mainSha`. The dirty primary checkout remains unchanged.
10. Ask every target to prepare `mainSha` as an immutable detached release and return its current active predecessor. No active pointer changes during preparation.
11. Read the current production Cloudflare deployment through Wrangler `4.111.0`, upload the relay from the exact release worktree with `mainSha` as build identity, and record the immutable uploaded version.
12. Require the target relay protocol and schema to be backward-compatible with both predecessor nodes and target nodes during the rolling window.
13. Deploy the uploaded relay version at `100%`; require public `/health` HTTP `200`, expected protocol, state schema, baseline epoch, and `releaseSha === mainSha`.
14. Activate remote nodes sequentially in stable `nodeId` order. Each node atomically changes its `current` pointer, durably records the receipt, schedules a clean exit, and relies on its declared supervisor to restart.
15. After each activation, poll until the node reports a new `processStartedAt`, `releaseSha === mainSha`, ready HTTP health, restored project catalog, connected federation phase, and convergence with the new relay.
16. Activate the coordinator node last. The external CLI continues running and polls the original server URL until the coordinator reports the new process identity and release SHA.
17. Re-run topology, health, project-catalog, content-lane, task-state, skill-manifest, pipeline availability, incident, and convergence checks from every active target.
18. Mark `complete` only when `origin/main`, relay health, every node active pointer, every node health response, every restart identity, and required federation state agree on the admitted release.

---

## O. Rollback, Resume, And Failure Containment

1. **Preflight failure:** exits before `main` push, relay deployment, node preparation, pointer activation, process exit, and restart.
2. **Failure before relay traffic changes:** leaves every running production runtime unchanged and marks the run `paused`.
3. **Relay health failure before node activation:** redeploys the captured previous Cloudflare version, verifies previous relay health, and leaves all node active pointers unchanged.
4. **Node activation failure:** stops forward activation; switches every activated node back to its recorded predecessor in reverse activation order; verifies each supervisor restart and predecessor health; then redeploys and verifies the previous relay version.
5. **Coordinator activation failure:** the external CLI reads launcher emergency health, node receipt, active pointer, and process identity; it restores the predecessor through the bootstrapped supervisor contract.
6. **Published Git history:** runtime rollback never force-pushes and never rewinds `main`. The failed release merge remains auditable. A corrective reviewed commit is required before a later successful delivery.
7. **Compensation failure:** an unreachable node keeps its exact release pointer and evidence intact, sets `compensation-failed`, records the last confirmed phase, and leaves diagnostics readable.
8. **Resume identity:** `resume --delivery-id` uses the same journal and lease. Each phase re-reads `origin/main`, Cloudflare deployment, node pointer, node receipt, process start identity, health, and convergence before deciding that a receipt is complete.
9. **Lost response:** a missing activation response is resolved by polling the node's durable receipt, active release SHA, and process identity before any repeated request.
10. **Timeout and cancellation:** every Git, Wrangler, HTTP, federation, restart, health, and convergence wait has a finite deadline, an abort signal, cleaned listeners, and a terminal incident boundary.
11. **Runtime incidents:** a delivery failure records scope, component, phase, operation, stable code, message, stack, delivery ID, target node, release SHA, timestamps, and occurrence count through `createRuntimeIncidentLedger()`.
12. **Success calibration:** `rolled-back-runtime`, `paused`, and `compensation-failed` are never reported as delivery success.

---

## P. Required Source Targets

1. **Shared content schema:** update `shared/schemas/codex-pipeline-types.ts` for required prompt snapshot admission fields and strict discriminated content kinds.
2. **Shared delivery schema:** add `shared/schemas/decision-os-delivery-types.ts` for journal validation, node actions, receipts, phases, compensation, and exit status.
3. **Content ownership:** update `backend/src/business/codex/helper/codex-skill-library.ts`, `scan-codex-skills.ts`, `pipeline-prompt-library.ts`, `codex-pipeline-store.ts`, and `server-skill-context.ts`.
4. **Git ownership:** add `backend/src/business/content-authoring/helper/authored-file-git-revisions.ts`, the repository mutation lock, and `backend/src/business/process/helper/run-bounded-process.ts`; retire synchronous Git use in `skill-git-revisions.ts` and `federated-library-cache.ts`.
5. **Direct routing:** add `resolve-markdown-editor-target.ts`, card content controllers, card history controllers, and the compatibility redirect in `backend/src/business/server/helper/create-http-server.ts`.
6. **Pipeline admission:** update `start-codex-pipeline-run-controller.ts`, `create-codex-pipeline-run-manifest.ts`, `build-pipeline-skill-prompt.ts`, `codex-pipeline-runner.ts`, and `install-remote-pipeline-run.ts`.
7. **Frontend session:** add `frontend/src/runtime/content-authoring/controller/text-file-editor-session.ts`, a Task card editor adapter, a generic revision browser, and route-driven editor parsing in `frontend/src/app/responsive/project-route.js` plus `application.js`.
8. **Frontend existing surfaces:** update `codemirror-file-editor.ts`, `render-skill-library-editor-modal.ts`, skill request effects, `render-skill-revision-diff.ts`, `begin-ledger-card-edit.ts`, and `frontend/assets/canvas/dialogs.css`.
9. **Delivery owner:** add `bin/decision-os-delivery.mjs`, `backend/src/business/delivery/helper/delivery-run-store.ts`, `delivery-git.ts`, `node-release-store.ts`, `backend/src/business/delivery/controller/delivery-topology-controller.ts`, and `delivery-node-command-controller.ts`.
10. **Runtime identity:** update `create-http-server.ts`, `bin/decision-os-server.mjs`, both emergency launcher health paths, and node settings loading.
11. **Relay identity:** update `federation-relay/src/index.ts`, `federation-relay/wrangler.toml`, relay tests, and pinned Wrangler commands.
12. **Documentation:** update `documentation/documentation/architecture/codex-content-authoring.md`, `documentation/procedure/deployment/canary-skill-authoring-dev-environment.md`, `documentation/procedure/deployment/README.md`, and `federation-relay/README.md`.

---

## Q. Verification And Acceptance Criteria

1. **Creation:** each authored kind creates once, returns its correct kind plus execution visibility, survives reload, creates one allowed-path commit, and appears only in its admitted catalogs.
2. **Global collision:** a name owned by any registered project, server root, user root, system root, plugin root, and prompt store blocks creation before bytes change.
3. **Editor lifetime:** metadata rerenders and status updates preserve draft, undo history, selection, search, wrapping, scroll, and focus. Closing destroys each owned `EditorView` exactly once.
4. **Read-only access:** Find, wrapping, copying, history, and focus remain usable while mutation controls remain disabled.
5. **Task card routing:** the supplied absolute Task Markdown URL returns the canonical zone-independent card editor redirect and never returns JSON success or raw bytes.
6. **Task card persistence:** typing updates the UI before the request resolves; a successful owner mutation plus Git commit survives reload; a rejected mutation reconciles only after the operator selects authoritative reload.
7. **Task card authority:** every editor save produces an exact `patch-card` receipt, task content head, task clock, card-file commit, and no unrelated task-state file commit.
8. **Git recovery:** forced failure at `read-tree`, `add`, `write-tree`, `commit-tree`, `update-ref`, and real-index reconciliation preserves the defined owner bytes, unrelated index state, journal evidence, incident availability, and explicit retry behavior.
9. **Event-loop containment:** a stalled Git child does not prevent unrelated health, diagnostics, project, task-state, and federation routes from responding.
10. **Complete history:** a fixture above 500 affecting commits reaches its oldest revision through cursors; rename-followed content, immutable blobs, author data, and older-to-selected diffs match Git.
11. **Pierre accessibility:** computed additions are blue, removals are red, and signs, line numbers, labels, focus order, plus screen-reader names distinguish the change without color.
12. **Prompt isolation:** ordinary skill catalogs and direct skill launch never expose a prompt; local and remote pipeline execution inject the exact admitted bytes once; dirty, missing, stale, and uncommitted prompts fail before execution.
13. **Federation:** only clean committed server skills export; prompt and workspace content never export; a post-commit relay failure preserves local success and exposes publication failure.
14. **Canary:** `50150`, `50151`, and the isolated dev relay remain simultaneously healthy; production catalogs exclude `.worktrees/dev`; canary proof is tied to the exact pushed SHA.
15. **Delivery admission:** dirty source, changed remote refs, non-distinct canary relay state, offline active nodes, missing bootstrap, non-convergence, paused dependencies, active task execution, and incompatible relay protocol exit before production mutation.
16. **Delivery completion:** the JSON result names previous and resulting `main` SHAs, previous and deployed relay versions, every admitted node, predecessor and active node SHAs, process restart identities, health results, catalog results, and convergence results.
17. **Delivery interruption:** forced termination after each phase resumes from the same delivery ID without repeating a completed external mutation and without trusting a stale journal receipt.
18. **Delivery compensation:** forced relay failure and forced node activation failure restore prior relay traffic plus prior node runtime pointers, preserve published Git history, and never claim complete.
19. **Served interaction:** browser evidence records canonical routes, HTTP results, complete gestures, reload persistence, conflict recovery, modal geometry, focus behavior, revision navigation, and production isolation.
20. **Release hygiene:** all tests and typechecks use the repository verification lease; implementation is committed with required `WHAT:` and `WHY:` bodies; final `dev` is pushed; no unrelated operator file, runtime task-state file, secret, cache, run artifact, and voice upload is staged.

---

## R. Execution Order And Current Blockers

1. **First:** update the master and Task list to include immutable prompt admission, owner-routed Task editing, Git recovery, asynchronous Git, complete history, delivery bootstrap, durable delivery recovery, activation, compensation, and proof.
2. **Second:** repair the current authoring implementation's fail-closed prompt, Git, collision, recovery, read-only toolbar, and stable CodeMirror session defects.
3. **Third:** implement direct owner routing and Task card editor persistence with Git history.
4. **Fourth:** implement the minimal delivery journal, fixed node protocol, immutable release layout, health identity, relay identity, and single CLI.
5. **Fifth:** complete focused tests, scoped typechecks, full-suite verification, and the served canary scenarios.
6. **Sixth:** clean and push the exact `dev` candidate, bootstrap every active node, then invoke the one-command promotion.
7. **Current implementation blocker:** the dirty, unpushed, main-diverged `dev` state cannot be admitted.
8. **Current configuration blocker:** the checked-in relay configuration does not yet prove the documented isolated `[env.dev]` Worker and Durable Object binding.
9. **Current operational blocker:** `workstation` and `phone` do not yet expose delivery protocol `1` and stable supervisor adoption. The first production promotion requires local bootstrap evidence from both nodes.
10. **Current credential gate:** promotion must verify the Wise SSH key and ignored `CLOUDFLARE_API_TOKEN` non-interactively before mutation.
11. **Operator decision state:** no additional product choice remains. The only operator-controlled production action is the explicit `decision-os-delivery promote --release-sha ...` invocation after bootstrap and canary evidence are complete.

---

## Review Reconciliation — 2026-07-30

1. The specification is reconciled against current source and the `2026-07-30` review.
2. Verified drift is preserved: unversioned prompt authoring, shared Markdown ambiguity, separate Task-card/Git lock lifetimes, incomplete history fields, and delivery authority defects.
3. The specification artifact is complete; unmet acceptance criteria remain open in implementation and verification cards.
