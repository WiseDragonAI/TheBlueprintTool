## A. Owner And Discovery Model

1. **`federated-skill`:** the canonical server root returned by `resolveServerSkillContext()` owns `.skills/<name>/SKILL.md`. The skill is agent-visible and is the only authored kind eligible for the federation skill manifest.
2. **`workspace-skill`:** the registered project selected by `:projectId` owns `.skills/<name>/SKILL.md`. The skill is agent-visible only in that workspace and is excluded from federation publication.
3. **`pipeline-prompt`:** the canonical pipeline store owns an `authoredContent` record in `.decision-os/codex-pipelines.json`; `.decision-os/pipeline-prompts/<name>.md` owns its Markdown. It is `pipeline-only`, never materializes as `SKILL.md`, and is excluded from natural agent discovery.
4. Agent-visible skill identity is the validated `name` in `SKILL.md` frontmatter. A prompt uses the validated store identity and UTF-8 Markdown without agent-visible frontmatter.
5. `readCodexContentCatalog()` exposes all three kinds with `contentKind` and `executionVisibility`. `scanCodexSkills()` exposes only agent-visible skills.
6. One global identity namespace includes `canonical-server`, `registered-workspace`, `pipeline-prompt`, `user`, `system`, `plugin`, and `imported` owners across every available registered project.
7. HTTP `409 content_identity_conflict` returns `conflict: {contentKind, sourceClass, projectId}`. It never returns a physical path.
8. Browser create, save, retry, and history requests carry owner identity. `path`, `filePath`, and `skillFile` are rejected with HTTP `422 browser_path_forbidden`.
9. `contentKind` is immutable after creation. Rename, delete, archive, restore, and kind conversion are outside this owner contract.

---

## B. Skill And Prompt HTTP Contracts

1. Every route below is project-scoped. `:projectId` selects the registered request context; shared `federated-skill` and `pipeline-prompt` storage remains server-owned.
2. Create content with `POST /p/:projectId/api/codex/skill-library`:

   ```json
   {
     "name": "release-audit",
     "description": "Audit an admitted release.",
     "instructions": "Inspect the admitted release evidence.",
     "contentKind": "workspace-skill"
   }
   ```

3. `contentKind` is exactly `federated-skill`, `workspace-skill`, or `pipeline-prompt`. `markdown` may replace generated initial Markdown. A workspace skill requires an available project-scoped request.
4. HTTP `201` returns `{ok, statusCode, skill, publication}`. `skill` includes the path-free identity, `contentKind`, `executionVisibility`, `projectId`, `editable`, `readOnlyReason`, Markdown SHA-256 `revision`, `markdown`, defaults, tags, references, `gitRevision`, and initial `history`.
5. Read the selected catalog identity with `GET /p/:projectId/api/codex/skill-library/:name`. Read the canonical server-skill owner explicitly with `GET /p/:projectId/api/codex/server-skills/:name`.
6. Save Markdown with `PUT /p/:projectId/api/codex/skill-library/:name`; canonical server-skill saves may use `PUT /p/:projectId/api/codex/server-skills/:name`:

   ```json
   {
     "markdown": "---\nname: release-audit\ndescription: Audit an admitted release.\n---\n\nInspect the current evidence.\n",
     "revision": "<loaded-markdown-sha256>",
     "defaultCodexModel": null,
     "defaultCodexEffort": null
   }
   ```

7. A content save requires all four fields. The server revalidates owner containment, editability, immutable skill frontmatter identity, prompt registration, content size, and the loaded revision before mutation.
8. Favorite and tag requests use the same `PUT` route with only `favorite` and `tags`. They mutate pipeline-store metadata and do not claim a Markdown save or Git content revision.
9. A successful create returns only after its focused Git revision exists. A skill transaction contains only its `SKILL.md`; a prompt transaction contains its Markdown and `.decision-os/codex-pipelines.json`.
10. A successful content save returns the reloaded path-free `skill` detail and advances repository `HEAD` exactly once. HTTP `422 content_not_changed` creates no commit.

---

## C. Git Recovery And Retry

1. Authored skill and prompt Git operations use `authored-file-git-revisions.ts` through the compatibility adapter in `skill-git-revisions.ts`.
2. The transaction acquires the repository common-directory mutation lock shared with production delivery, rejects a pre-staged owned path, revalidates every transaction-bound file by SHA-256, uses an isolated temporary index, creates one commit, and compare-and-swap updates `HEAD`.
3. Existing staged operator entries and unrelated working-tree bytes remain outside the focused commit and remain byte-identical.
4. A live repository mutation owner returns HTTP `423 repository_mutation_locked`. A pre-staged owned path returns HTTP `409 authored_path_staged`. A byte race returns HTTP `409 content_revision_conflict`.
5. A recoverable Git failure after accepted owner bytes returns HTTP `503 git_revision_pending_recovery`:

   ```json
   {
     "ok": false,
     "code": "git_revision_pending_recovery",
     "currentRevision": "<confirmed-markdown-sha256>",
     "recovery": {
       "authoredBytesPreserved": true,
       "gitRevisionCreated": false,
       "contentRevision": "<confirmed-markdown-sha256>",
       "recoveryToken": "<owner-bound-token>",
       "incidentId": "<incident-id>"
     }
   }
   ```

6. Retry that exact owner state with `POST /p/:projectId/api/codex/skill-library/:name/revisions/retry`:

   ```json
   {
     "recoveryToken": "<owner-bound-token>",
     "contentRevision": "<confirmed-markdown-sha256>"
   }
   ```

7. Retry re-reads current owner bytes, the coupled prompt-store bytes when applicable, staged-path state, the recovery record, and repository `HEAD`. It does not repeat the content mutation.
8. A changed owner returns HTTP `409 content_revision_conflict`; a missing or malformed retry identity returns HTTP `422 invalid_revision_retry`; a held mutation lock returns HTTP `423 repository_mutation_locked`.
9. Uncommitted federated-skill bytes are excluded from export. Uncommitted pipeline-prompt bytes are excluded from pipeline admission.

---

## D. Task Card Owner Contract

1. Read one hydrated card with `GET /p/:projectId/api/ledgers/:ledgerId/cards/:cardId`. The card response includes SHA-256 `contentRevision` for `comment.what`.
2. Save the description with `PUT /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/content`:

   ```json
   {
     "markdown": "## Updated description\n",
     "expectedContentRevision": "<loaded-markdown-sha256>"
   }
   ```

3. The endpoint validates local ownership, the `1,000,000`-byte ceiling, optimistic revision, staged-path protection, and repository mutation ownership.
4. `patch-card` is the sole Task-card Markdown authority. The endpoint verifies the exact mutation receipt, Task clock, changed-card entity, content head, and reloaded card projection before creating the Git revision.
5. Success returns `{ok, statusCode, card, contentRevision, gitRevision, taskClock, receipt}` for Task cards. The focused commit contains only the card Markdown; runtime task-state objects and thread files are excluded.
6. If Task mutation succeeds and Git creation fails, the card bytes, task content head, Task clock, receipt, and federation publication remain authoritative. HTTP `503 git_revision_pending_recovery` returns top-level `authoredBytesPreserved: true`, `gitRevisionCreated: false`, `contentRevision`, `recoveryToken`, and `incidentId`.
7. Retry with `POST /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/revisions/retry` and `{recoveryToken, contentRevision}`. It commits the confirmed current bytes without issuing a second `patch-card`.
8. Card save and retry use the same `409 content_revision_conflict`, `409 authored_path_staged`, and `423 repository_mutation_locked` semantics as skill and prompt owners.
9. Card-specific validation failures are `422 invalid_card_content_save`, `413 content_too_large`, `404 card_content_owner_not_found`, `422 content_not_changed`, `422 invalid_revision_retry`, `422 invalid_card_revision`, `422 card_revision_history_invalid`, `404 card_revision_not_found`, `500 card_content_save_failed`, and `500 card_revision_retry_failed`.

---

## E. Cursor History And Immutable Revisions

1. Skill and prompt history is `GET /p/:projectId/api/codex/skill-library/:name/revisions?cursor=<cursor>&limit=<1-100>`.
2. Task-card history is `GET /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/revisions?cursor=<cursor>&limit=<1-200>`.
3. Skill and prompt history returns newest-first top-level `history` plus `nextCursor`. Task-card history returns `{history: {revisions, nextCursor}}`. The Git owner traverses complete `git log --follow` history without a fixed total cap; clients continue until the applicable `nextCursor` is `null`.
4. Each entry contains full commit SHA, author and committer names, emails and timestamps, subject, and parents. Physical paths are omitted.
5. Skill or prompt revision content is `GET /p/:projectId/api/codex/skill-library/:name/revisions/:commit`. Task-card revision content is `GET /p/:projectId/api/ledgers/:ledgerId/cards/:cardId/revisions/:commit`.
6. Revision reads accept only a full commit that belongs to the current owner's complete rename-following history. Membership is immutable and cannot be expanded with a browser-supplied path.
7. A revision detail contains full historical `markdown`, the patch from the immediately older affecting revision to the selected revision, `olderCommit`, and `newerCommit`. The oldest revision is compared with an empty file.
8. Selecting history is read-only. No automatic restore occurs. A future restore must submit selected bytes through a new optimistic-concurrency save and create a new revision.
9. Imported federated skills expose current content only on the importing node. Their complete Git history remains on the owning repository.

---

## F. Direct Markdown Owner Routing

1. `GET` and `HEAD` accept an absolute decoded `.md` pathname. A project-scoped `/.decision-os/*.md` pathname is resolved below that project's registered Decision OS root.
2. `resolveMarkdownEditorTarget()` enumerates available registered projects and compares the requested canonical real path with current card, thread, scanned skill, and registered prompt owners.
3. Lexical escape, realpath escape, symlink, missing file, stale reference, unavailable project, unowned thread, and unregistered Markdown return HTTP `404` with `{"ok":false,"error":"markdown_editor_target_not_found"}`. A `HEAD` response has no body.
4. Multiple current owners return HTTP `409 markdown_editor_target_ambiguous`.
5. Success returns HTTP `302`, `Cache-Control: no-store`, no Markdown bytes, and one canonical destination:
   1. Card: `/p/:projectId/ledgers/:ledgerId/cards/:cardId?editor=markdown`
   2. Thread: `/p/:projectId/ledgers/:ledgerId/cards/:cardId?thread=open`
   3. Server, user, system, plugin, and imported skill: `/skills?editor=skill&name=:name`
   4. Workspace skill: `/skills?editor=skill&name=:name&projectId=:projectId`
   5. Pipeline prompt: `/skills?editor=skill&name=:name`
6. Protected skill owners redirect to the same canonical editor route; their identity response sets `editable: false` and supplies `readOnlyReason`.
7. Card routes contain no `zoneId`; moving a card does not invalidate its canonical editor URL. Thread files open the canonical note surface and are not replaced by whole-file editing.

---

## G. Persistent Editor Session

1. `mountCodeMirrorFileEditor()` uses locally bundled `codemirror@6.0.2` with `@codemirror/lang-markdown@6.5.1`. It owns the `EditorView`, Markdown language support, line numbers, search, undo, redo, wrapping, dirty observation, focus, and disposal.
2. `createTextFileEditorSession()` mounts one editable view for the session lifetime. Metadata, status, recovery, save, and history rendering do not remount it, preserving draft bytes, undo stack, selection, search, wrapping, scroll, and focus.
3. History uses a separate read-only preview. Closing or changing history destroys only that preview.
4. Read-only mode disables document mutation, Undo, Redo, and Save. Find, wrapping, selection, copy, focus navigation, history navigation, and preview remain available.
5. Explicit close, Escape, browser Back, route change, and `beforeunload` consult the same dirty state. A dirty session requires discard confirmation; a clean close disposes the views and returns focus to the initiating control.
6. Desktop geometry is exactly `80vw` by `95vh`. The responsive inset rule keeps the dialog within the mobile viewport and makes the editor body scroll internally.
7. `@pierre/diffs@1.2.12` renders the adjacent patch with red removals and blue additions. Minus and plus signs, line numbers, `Removed` and `Added` labels, revision text, focus order, region labels, and group labels preserve meaning without color.
8. `frontend/src/runtime/codex/component/codemirror-file-editor.ts` contains the required future-use comment for a thread-attached file owner.
9. The deferred attachment adapter must resolve attachment identity and file authorization on the backend, then pass confirmed Markdown bytes into the same CodeMirror boundary. Attachment mutation is not implemented, and the browser never submits an attachment path.

---

## H. Prompt Snapshot Admission

1. `availablePipelineContent()` admits a selected `pipeline-prompt` once before execution side effects.
2. Admission requires the registered prompt record and Markdown to be present, contained, tracked, clean relative to `HEAD`, kind-matched, payload-bounded, and reachable from the owning repository commit.
3. The immutable run manifest records `contentKind`, SHA-256 `contentRevision`, `contentCommit`, and `promptSnapshot`.
4. The local runner injects that exact snapshot once into the selected step and never re-reads working-tree prompt bytes.
5. Authenticated remote run installation carries the same snapshot and validates kind, revision, commit, size, and manifest identity. The executor stores it only with that run's immutable evidence.
6. Prompt bytes never enter `.skills`, natural skill resolution, direct skill launch, server or workspace skill discovery, cloud-agent catalogs, federation manifests, federation snapshots, and the federation library cache.
7. Missing, dirty, uncommitted, disappeared, stale-store, revision-mismatched, and kind-mismatched prompt content rejects the run before local scheduling and before remote installation.

---

## I. Federation Publication

1. `exportableSkills()` admits only clean committed `federated-skill` packages below the canonical server root.
2. Workspace, prompt, user, system, plugin, imported, unavailable-store, and recovery-pending content is excluded.
3. A successful federated-skill commit invalidates the export cache, republishes the manifest, and requests the bounded skills-first synchronization.
4. Relay failure after local Git success does not roll back the content commit. The response reports publication `failed`, `retryable: true`, the synchronization retry path, and incident evidence with stable code `federated_skill_publication_failed`.
5. Publication retry uses `POST /api/federation/libraries/synchronize`; it does not repeat the authored content save.

---

## J. Containment, Incidents, And Stable Errors

1. Authored Git uses `runBoundedProcess()` with finite deadlines, bounded stdout and stderr, cancellation, process identity, `SIGTERM` then timed `SIGKILL`, terminal settlement, and runtime-incident context.
2. Slow Git and contained authoring failures do not stop unrelated HTTP routes, projects, task state, health, diagnostics, and federation traffic.
3. Recovery records are owner-bound, bounded, and path-internal. API responses omit repository roots, temporary indexes, recovery-file paths, and physical content paths.
4. Invalid JSON, unsupported versions, structural errors, ambiguous references, and mixed validation failures remain byte-identical, pause only their owning pipeline-store scope, record a runtime incident, and remain excluded from catalog mutation, execution admission, import, and export until explicit validated recovery.
5. A `pipeline-content-kind-mismatch` is automatically recoverable only when every write-blocking issue is that discriminator mismatch and the live catalog resolves every referenced identity. Recovery archives the exact original bytes under `.decision-os/codex-pipeline-recovery/<sha256>.json`, changes only each stale `contentKind`, atomically installs the revalidated store, and resolves the incident with the archive revision plus repaired identities.
6. Catalog discovery is the discriminator authority: server-owned skills resolve to `federated-skill`, other agent-visible skills resolve to `workspace-skill`, and registered pipeline prompts take precedence over same-name skills. Catalog-free readers cannot resolve a discriminator incident.
7. Stable shared content errors are:
   1. `browser_path_forbidden` — `422`
   2. `invalid_content_identity` — `422`
   3. `invalid_content_kind` — `422`
   4. `invalid_content_markdown` — `422`
   5. `content_too_large` — `413`
   6. `workspace_project_required` — `422`
   7. `content_identity_conflict` — `409`
   8. `content_owner_unavailable` — `503`
   9. `content_not_found` — `404`
   10. `content_read_only` — `403`
   11. `content_revision_conflict` — `409`
   12. `content_not_changed` — `422`
   13. `authored_path_staged` — `409`
   14. `repository_mutation_locked` — `423`
   15. `git_revision_pending_recovery` — `503`
   16. `content_history_unavailable` — `503`
   17. `content_revision_not_found` — `404`
   18. `invalid_revision_retry` — `422`
   19. `content_reload_failed` — `500`
   20. `git_revision_failed` — `503` unless the contained Git owner supplied a more specific status
8. Direct owner routing uses `markdown_editor_target_not_found` with `404` and `markdown_editor_target_ambiguous` with `409`.
9. Task-card owner errors are listed in section D. Malformed legacy route parameters and metadata-only payload fields that have no stable code remain HTTP `400` text validation responses.
10. Production admission, delivery recovery, and rollback are owned by [Production Delivery Protocol](../../procedure/deployment/production-delivery-protocol.md). Canary evidence is owned by [Canary Skill Authoring Dev Environment](../../procedure/deployment/canary-skill-authoring-dev-environment.md).

---

## K. 2026-07-30 Review Reconciliation

1. The implementation currently permits a `pipeline-prompt` create and save to succeed without a Git repository. That response carries `gitRevision: null`; history is empty; immutable execution admission still rejects the prompt because no clean tracked commit owns its bytes.
2. This unversioned behavior does not satisfy the original invariant that every successful authored save creates a focused Git revision. It remains an open contract defect, not an accepted replacement for Git-backed prompt ownership.
3. Shared skill Markdown is discovered once per project context. When several projects resolve the same canonical shared file, direct Markdown routing returns `409 markdown_editor_target_ambiguous`. Shared owner identity must be deduplicated before the direct-path contract is complete.
4. Task-card mutation and focused Git commit currently use separate repository-lock lifetimes. A failure after authoritative `patch-card` persistence can leave confirmed card bytes without the affecting Git revision. One mutation owner must span writable admission, card persistence, byte confirmation, Git commit, and recovery persistence.
5. The complete source-backed reconciliation, severity-ranked findings, and verification boundary are recorded in [Canary Skill Authoring Main Review](../../working-documents/canary-skill-authoring-main-review-2026-07-30.md).
