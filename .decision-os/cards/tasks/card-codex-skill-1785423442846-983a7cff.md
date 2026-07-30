## A. Feasibility Verdict

1. **Verdict:** the unified model `is technically feasible` through the pinned CodeMirror state, transaction, range, decoration, widget, syntax-tree, and lifecycle contracts plus Pierre complete-file diff data.
2. **Authority:** one long-lived CodeMirror `EditorView` owns editable Markdown, transactions, history, selection, search, scrolling, focus, and disposal. `EditorState.doc` remains the exact save payload.
3. **Pierre boundary:** `@pierre/diffs@1.2.12` contributes `parseDiffFromFile()`, `FileDiffMetadata`, and `Hunk` only. `FileDiff` remains on standalone History surfaces because its shadow DOM and interaction managers would create a second owner.
4. **Semantic boundary:** editable source Markdown receives source-positioned canonical semantics plus Git decorations. Complete `renderLedgerCardMarkdown()` DOM parity inside CodeMirror remains excluded and unproven.
5. **License boundary:** the pinned CodeMirror packages remain `MIT`; Pierre remains `Apache-2.0`; existing local license artifacts remain sufficient.
6. **Performance boundary:** one module Worker runs complete diff derivation after a `150 ms` debounce with a `2,000 ms` deadline. The `1,000,000`-byte proof must show no attributable input-thread task of `50 ms`.
7. **Claim boundary:** source and architecture establish feasibility. Mapping, accessibility, performance, persistence, refresh, and teardown remain served-proof gated.

---

## B. Master Ledger Result

1. **Domains:** Frontend `authored-file-diff`, Frontend `ledger-markdown`, and Backend `content-authoring`.
2. **Coverage:** `7/7` runtime Specs from source-card `A.3` plus `B.1-B.6` have one suite, external inputs, prior state, controller, helpers, effects, and telemetry.
3. **Control flow:** `9/9` controllers are reachable: revision snapshot read, initial admission, document transaction, Worker settlement, save settlement, refresh, explicit reload, semantic synchronization, and disposal.
4. **Consistency:** `0` dangling domains, inputs, components, state props, helpers, effects, telemetry names, controllers, and runtime Specs.
5. **Operator questions:** `0`. GateController already accepted source-positioned semantics and excluded complete rendered-DOM parity.
6. **Detailed artifact:** `.decision-os/executor-analysis/tmp/architecture/master-ledger-unified-markdown-diff-26-07-30-1.md` contains the complete `1,446`-line Master Ledger, every controller pseudocode body, the reference audit, and all per-path pseudocode patches.

---

## C. Smallest Bounded Proof

1. **Fixture:** one task-card revision pair with complete old plus new Markdown containing a heading, strong text, a `::questions` directive, one addition, one deletion between surviving lines, a second independent addition hunk, and an end-of-file deletion.
2. **Identity:** `{ contentRevision, commit, olderCommit, baseMarkdown, markdown, sessionGeneration, requestedMarkdown }`; every member must match before Worker admission.
3. **Served target:** `/p/<project-id>/ledgers/tasks/cards/<card-id>?editor=markdown` through the existing isolated canary fixture in `tests/browser/codex/direct-markdown-editor-routing.spec.ts`.
4. **Sequence:** load and admit the snapshot; edit before a hunk; edit inside a hunk; insert at a deletion anchor; undo; redo; search; select plus copy added text; keyboard-traverse the deletion anchor; hold then settle save; reload; reject a stale save; receive commit refresh while dirty; reject an obsolete Worker result; trigger deadline; explicitly reload authority; close the modal.
5. **Pass — bytes:** every save body equals `EditorState.doc`; removed text is absent from document bytes, search, selection, clipboard, and persistence.
6. **Pass — mapping:** untouched ranges map exactly; a touched addition plus touched deletion anchor withdraws its whole hunk in the same transaction; matching recomputation replaces the complete snapshot.
7. **Pass — interaction:** one scroller, selection, focus owner, and editable surface remain. Save, Worker settlement, timeout, conflict, refresh, and reload preserve focus.
8. **Pass — accessibility:** visible `+` plus `−` text supplements color; deletion groups occur in source order, stay non-editable, have stable accessible names, and add no tab stop.
9. **Pass — persistence:** success survives fresh reload; rejection preserves the local draft plus server-confirmed bytes and identity.
10. **Pass — teardown:** debounce, Worker, timer, listeners, requests, StateField, plugins, widgets, and `EditorView` settle exactly once.
11. **Failure:** removed bytes enter the document; Pierre shadow DOM enters CodeMirror; touched presentation survives; stale work dispatches; Worker lifetime is unbounded; conflict overwrites either byte sequence; obsolete history returns after reload; color is the only change identity; a resource survives teardown; complete rendered-DOM parity is claimed.

---

## D. Production Sequence

1. **Snapshot contract:** return exact selected plus base Markdown and identity on current revision reads, save success, and stale-save conflict.
2. **Worker delivery:** export the required CodeMirror symbols and build one pinned Pierre module Worker without `FileDiff`.
3. **Normalized state:** validate complete metadata, convert lines to offsets, place deletion anchors, map untouched hunks, withdraw touched hunks, and reject stale identities.
4. **CodeMirror presentation:** install one `StateField`, mapped `StateEffect`, `RangeSet`, addition decorations, accessible deletion widgets, and non-history snapshot replacement.
5. **Session integration:** make the existing session own snapshot admission, debounce, single-flight Worker, deadline, persistence, refresh conflict, authoritative reload, and disposal.
6. **Semantic spans:** preserve exact original offsets through newline normalization and trimming; publish canonical block plus inline semantics for matching bytes only.
7. **Task-card integration:** load current snapshot, carry success plus conflict snapshots, route exact active-card refresh, and retain explicit recovery reload.
8. **Proof:** run backend snapshot tests, parser span tests, diff normalization plus mapping tests, session tests, full typechecks, one full suite, then served canary interaction.

---

## E. Implementation-Ready Change Contract

1. **Backend immutable snapshot:** change `backend/src/business/content-authoring/helper/authored-file-git-revisions.ts` at `AuthoredFileRevisionContent`, new `AuthoredFileRevisionSnapshot`, `readAuthoredFileRevisionContent()`, and new `readCurrentAuthoredFileRevisionContent()`. Return `{ contentRevision, commit, olderCommit, baseMarkdown, markdown }`; root history uses empty base bytes. Collision: shared skill history receives a backward-compatible path-free superset. Check: extend `backend/test/content-authoring/authored-file-git-revisions.test.ts`.
2. **Current revision route:** change `backend/src/business/ledger/controller/read-ledger-card-revisions-controller.ts` at `readLedgerCardRevisionContentController()`. Admit literal `current` at the existing revision route; retain full-commit validation for every other value. Collision: deterministic route precedence. Check: latest affecting commit plus path-free JSON.
3. **Save settlement:** change `backend/src/business/ledger/controller/save-ledger-card-content-controller.ts` at `saveLedgerCardContentController()`. Validate the current snapshot before mutation; return the new snapshot on success and current snapshot on pre-mutation `409`. Collision: the bounded Git read must settle before any write and honor cancellation. Check: extend `backend/test/content-authoring/ledger-card-content.test.ts`.
4. **Frontend snapshot contract:** add `frontend/src/runtime/content-authoring/helper/authored-file-revision-snapshot.ts`; change `frontend/src/runtime/content-authoring/component/render-authored-file-revision.ts`, `frontend/src/runtime/content-authoring/effect/load-ledger-card-revision.ts`, and `frontend/src/runtime/content-authoring/effect/request-ledger-card-content-save.ts`. Validate every identity member and decode `/revisions/current`, success snapshot, and conflict snapshot. Collision: malformed transport data stays unadmitted.
5. **CodeMirror vendor boundary:** change `frontend/scripts/codemirror-vendor-entry.ts`; regenerate `frontend/assets/vendor/codemirror-6.0.2.js`. Export `StateField`, `StateEffect`, `RangeSet`, `MapMode`, `Decoration`, `ViewPlugin`, `WidgetType`, and `syntaxTree`. Collision: update the dynamic module type in the same iteration and bound generated size.
6. **Pierre Worker:** add `frontend/src/runtime/content-authoring/worker/authored-file-diff-worker.ts`; change `frontend/scripts/build-editor-vendors.mjs`; generate `frontend/assets/vendor/pierre-diff-worker-1.2.12.js`. Invoke complete `parseDiffFromFile()` with `FileContents` objects and post JSON-compatible metadata. Collision: the Worker bundle must omit `FileDiff`, Shiki, DOM managers, and runtime network dependencies.
7. **Finite Worker settlement:** add `frontend/src/runtime/content-authoring/helper/derive-authored-file-diff.ts` at `deriveAuthoredFileDiff()`. Own message, error, deadline, cancellation, termination, timer, and listener settlement through one idempotent finish boundary. Check: every settlement ordering and no callback after cancellation.
8. **Diff normalization:** add `frontend/src/runtime/content-authoring/helper/normalize-authored-file-diff.ts` and `frontend/src/runtime/content-authoring/helper/map-authored-file-diff.ts`. Validate complete old/new coordinates, convert one-based lines to offsets, anchor end-of-file removals at `doc.length`, map untouched hunks, and withdraw touched hunks. Collision: replacement hunks, CRLF, final blank lines, adjacent hunks, and zero-length anchors.
9. **CodeMirror extension:** add `frontend/src/runtime/content-authoring/helper/create-authored-file-diff-extension.ts` at `createAuthoredFileDiffExtension()`, `installAuthoredFileDiffEffect`, `clearAuthoredFileDiffEffect`, and `AuthoredFileDeletionWidget`. One StateField owns mapping plus decorations; matching effects replace state with `addToHistory: false`. Collision: block widgets remain direct sorted decorations and never create false document offsets.
10. **Editor adapter:** change `frontend/src/runtime/codex/component/codemirror-file-editor.ts` at `CodeMirrorModule`, `CodeMirrorFileEditor`, `mountCodeMirrorFileEditor()`, and `replaceDocument()`. Host the extensions, expose install plus clear commands, and use `EditorView.setState()` for authoritative reload while preserving valid selection, scroll, focus, compartments, theme, toolbar, and DOM structure.
11. **Session owner:** change `frontend/src/runtime/content-authoring/controller/text-file-editor-session.ts` at `TextFileEditorSessionState`, `createTextFileEditorSession()`, `markSaved()`, `reloadAuthoritative()`, and `dispose()`. Own the `150 ms` debounce, single Worker, `2,000 ms` deadline, identity, conflict, refresh, and exact-once teardown. Collision: existing skill-editor inputs stay compatible and preview lifetime remains independent.
12. **Task-card screen:** change `frontend/src/runtime/content-authoring/controller/ledger-card-editor.ts` and `frontend/src/runtime/refresh/effect/subscribe-ledger-content-events.ts`. Load current card plus snapshot, admit exact matches, pass save snapshots, preserve draft on `409`, route exact active-card refresh, and never remount the modal. Collision: SSE save echo remains idempotent and normal ledger refresh still runs.
13. **Canonical spans:** change `frontend/src/runtime/ledger/helper/normalize-ledger-markdown.ts`, `frontend/src/runtime/ledger/helper/parse-ledger-markdown-inline.ts`, and `frontend/src/runtime/ledger/helper/parse-ledger-card-markdown.ts`; add `frontend/src/runtime/content-authoring/helper/create-ledger-markdown-semantic-extension.ts`. Add absolute `from` plus `to` to every canonical record through an original-byte source map. Collision: values for tables, images, embeds, fences, directives, links, and escaped newlines remain unchanged.
14. **Presentation:** change `frontend/assets/canvas/dialogs.css`. Add `.authored-file-diff-status`, `.cm-authored-addition`, `.cm-authored-deletion`, `.cm-authored-deletion-label`, and semantic classes using existing blue, red, mono, panel, and line tokens. Collision: no style leaks into Pierre shadow content and mobile geometry remains unchanged.
15. **Focused frontend proof:** add `frontend/test/unit/content-authoring/helper/authored-file-revision-snapshot.test.ts`, `frontend/test/unit/content-authoring/helper/normalize-authored-file-diff.test.ts`, and `frontend/test/unit/content-authoring/helper/map-authored-file-diff.test.ts`; extend `frontend/test/runtime/content-authoring-editor.integration.test.ts` and `frontend/test/unit/ledger/helper/parse-ledger-card-markdown.test.ts`.
16. **Served proof:** extend `tests/browser/codex/direct-markdown-editor-routing.spec.ts` inside its existing isolated `g12-served-proof` fixture. Collision: no primary checkout mutation, no production-port interaction, and no new live node.
17. **Architecture contract:** update `documentation/documentation/architecture/codex-content-authoring.md` with CodeMirror byte authority, the identity tuple, data-only Pierre use, Worker bounds, touched-hunk withdrawal, canonical spans, conflict preservation, teardown, and excluded rendered-DOM parity.

---

## F. Core Pseudocode Patches

1. **Immutable snapshot:**

   ```diff
   + const markdown = await immutableContent(context, selected, signal)
   + const baseMarkdown = older ? await immutableContent(context, older, signal) : ''
   + return {
   +   ...revision,
   +   contentRevision: sha256AuthoredBytes(markdown),
   +   markdown,
   +   baseMarkdown,
   +   olderCommit: older?.commit ?? null,
   + }
   ```

2. **Worker derivation:**

   ```diff
   + const metadata = parseDiffFromFile(
   +   { name: 'base.md', contents: baseMarkdown, cacheKey: olderCommit ?? 'root' },
   +   { name: 'draft.md', contents: draftMarkdown, cacheKey: contentRevision },
   + )
   + self.postMessage({ ok: true, identity, metadata })
   ```

3. **Touched-hunk policy:**

   ```diff
   + const touched = changes.touchesRange(hunk.from, hunk.to)
   +   || touchesDeletionAnchor(changes, hunk.deletionAnchor)
   + return touched
   +   ? withdrawEveryDecorationForHunk(hunk)
   +   : mapHunkThroughChanges(hunk, changes)
   ```

4. **Identity admission:**

   ```diff
   + if (!sameIdentity(returned.identity, active.identity)) {
   +   telemetry('reject-stale-authored-file-diff', returned.identity)
   +   return
   + }
   + view.dispatch({
   +   effects: installAuthoredFileDiffEffect.of(normalized),
   +   annotations: Transaction.addToHistory.of(false),
   + })
   ```

5. **Conflict preservation:**

   ```diff
   + if (acceptedMarkdown !== submittedMarkdown) {
   +   publishAuthoredFileConflict({
   +     serverSnapshot,
   +     localDraft: submittedMarkdown,
   +     reason: 'accepted-bytes-mismatch',
   +   })
   +   clearGitPresentation()
   +   return
   + }
   ```

6. **Finite disposal:**

   ```diff
   + if (disposed) return
   + disposed = true
   + clearTimeout(debounceHandle)
   + activeWorker?.cancel()
   + activeWorker = null
   + editable.destroy()
   ```

---

## G. Readiness and Stop Boundary

1. **Implementation contract:** `19` detailed Master Ledger entries and `17` condensed change groups name exact paths, symbols, concrete behavior, collision risks, focused checks, and pseudocode patches.
2. **Executor readiness:** the Master Ledger is structurally ready for `executor-implement`.
3. **Authorization:** source-card `A.2` prohibits production implementation in this run. Readiness does not grant execution authority.
4. **Research subtask `4`:** the feasibility verdict, bounded proof, measurable pass conditions, measurable failure conditions, and production sequence now exist.
5. **Final report:** feasibility is source-proven; runtime acceptance remains proof-gated; complete rendered-DOM parity remains excluded; the implementation-ready change contract is complete.
6. **Unchanged boundaries:** production source, tests, generated assets, servers, Git history, and master-task lifecycle were not changed.
7. **Next controller action:** GateController can audit this result and stop at the operator-authorized pre-implementation endpoint.
---

Codex run completed: exit code 0
