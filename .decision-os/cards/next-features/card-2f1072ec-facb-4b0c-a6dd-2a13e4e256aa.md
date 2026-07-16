## A. Product Direction

1. **Primary objective:** Make mobile decision-making a first-class Decision OS workflow, with enough context to review evidence and respond without returning to the desktop canvas.
2. **Mobile priority:** Present one active card with two tabs: `Document` for the edited card content and `Conversation` for its thread.
3. **Context requirement:** The mobile decision surface must display images, web links, workspace files, and Git diffs.

---

## B. Verified Existing Capabilities

1. **Headless Codex execution — `verified`:** The server launches `codex exec` from the workspace, passes the complete card and thread context, records run events, and supports session continuation. Evidence: `backend/src/business/codex/helper/resolve-codex-command.ts` and `backend/src/business/codex/helper/build-thread-codex-prompt.ts`.
2. **Sequential prompt pipelines — `implemented in current worktree`:** Operators can define reusable ordered steps, assign skills, and run the steps sequentially. Evidence: `frontend/src/runtime/codex/effect/render-pipeline-editor-modal.ts` and `backend/src/business/codex/helper/codex-pipeline-runner.ts`.
3. **Card workflow state — `verified foundation`:** Cards persist `todo` and `done`; an operator note derives the visible `processing` state. The operator queue, pending-card list, and defer-to-bottom behavior remain unimplemented.
4. **Threads and voice — `verified foundation`:** Card threads, zone threads, the global `conversation-ledger`, microphone capture, transcription, retry, and Codex queueing exist. Automatic targeting from the global thread into the best matching card remains unimplemented.
5. **Thread attachments — `verified foundation`:** Threads accept uploaded files and pasted images through `/api/thread-file-upload` and `/api/thread-image-upload`. Direct card-body attachment controls remain unimplemented.
6. **Card rendering — `verified foundation`:** Cards render Markdown headings, links, images, image carousels, tables, code blocks, and sandboxed local HTML embeds. The HTML directive is `::html[Title](.decision-os/cards/<ledger>/assets/view.html)`.
7. **Custom HTML views — `verified`:** Ledger-scoped HTML files render in sandboxed iframes without application integration. Evidence: `frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts`.
8. **Groups — `verified foundation`:** Groups are first-class visual containers for cards and zones. They do not create child canvases and do not support recursive canvas nesting.
9. **Ledger creation and navigation — `verified foundation`:** Ledgers can be created inside the app, header ledger tabs have already been removed, and a dedicated Ledgers canvas exists. The requested right-panel vertical ledger list remains unimplemented.
10. **Card tabs — `verified foundation`:** Field-bearing cards already expose `Description` and `Fields` tabs. The requested mobile `Document` and `Conversation` pair remains unimplemented.

---

## C. Mobile Decision Experience

1. **Single-card mobile shell:** Show one selected card at a time with `Document` and `Conversation` tabs, mobile-safe editing, and explicit next-card navigation.
2. **Decision context:** Render card images, thread images, external web links, workspace file previews, and unified Git diffs inside the mobile flow.
3. **Voice workflow:** Reuse the existing voice capture and transcription pipeline in the mobile thread composer, including retry and Codex queueing.
4. **Mobile delivery:** Provide an installable, deployed mobile application with workspace connection settings and authenticated access.

---

## D. Operator Queue and Agent Execution

1. **Operator stack:** Add a vertical queue of `todo` and `processing` cards, expose every pending card, preserve operator ordering, and move deferred cards to the bottom.
2. **General task list:** Add ledger-level tasks for research and multi-card work without requiring a source card relationship.
3. **Global thread treatment:** Let Codex treat `conversation-ledger`, identify the best matching existing card, update that card, and create a new card only when no matching card exists.
4. **Session freshness:** Before a new Codex turn, evaluate the cached session age. When stale, synthesize the conversation with a configured low-cost model, start a fresh headless session, and load the workspace `AGENTS.md` context.
5. **Decision-question tool:** Let the agent raise concrete questions, propose a recommended answer for each question, and record the operator's selected answer.
6. **Automatic Git versioning:** After a successful agent turn, create a scoped Git snapshot containing only the files changed by that turn.

---

## E. Files, Context, and Git Review

1. **File-linked diffs:** Link a card to a workspace file and render its unified Git diff with line numbers, syntax highlighting, collapsed unchanged hunks, and inline changes. Use [`@pierre/diffs`](https://diffs.com/) as the rendering reference.
2. **Quoted source context:** Let the operator select lines in a file view and append the file path, exact line range, and exact quote to the active thread.
3. **Partial staging:** Let the operator stage selected changed lines directly from the card diff while preserving the remaining unstaged changes.
4. **File modal:** Open a linked workspace file in an in-app modal with line numbers, selection, copy, and thread-context actions.
5. **Card attachments:** Add upload controls that insert durable file references into the card body and store assets under the active ledger card asset directory.

---

## F. Canvas and Ledger Organization

1. **Nested canvases:** Convert a grouped set of zones into a child canvas, allow recursive child canvases, and use zoom navigation to enter and leave each canvas level.
2. **Card splitting:** Add an explicit split-point selector and a section-based split action that creates ordered cards while preserving source provenance.
3. **Canvas export:** Export the active canvas as one archive containing ledger JSON, card Markdown, thread Markdown, and referenced assets.
4. **Ledger panel:** Replace ledger navigation chrome with a right-panel vertical ledger list that supports selection and in-app ledger creation.
5. **Undo history:** Add `Ctrl+Z` to rewind durable card, zone, group, relationship, and geometry mutations in reverse commit order.

---

## G. Media, Custom Data, and Performance

1. **Audio player:** Render durable audio attachments with playback controls inside cards and threads.
2. **Audio grid:** Lay out consecutive audio files in an automatically sized grid with no carousel and persist an independent volume level for each sound-effect file.
3. **Video embeds:** Render supported local and remote video references inside cards with responsive controls.
4. **Sortable tables:** Make rendered Markdown table headers sortable while preserving the source row order in Markdown.
5. **Virtualized threads:** Use `@tanstack/virtual` for long thread feeds while preserving scroll position, image sizing, and jump-to-latest behavior.
6. **Custom-view data binding:** Feed selected card, zone, ledger, and SQLite query data into the existing sandboxed HTML view contract.
7. **SQLite links:** Let a card and a zone persist a reference to a configured SQLite database and named query.

---

## H. Collaboration and Security

1. **Authentication:** Require authenticated workspace access and preserve user identity on every card, zone, thread note, task, and agent action.
2. **Team collaboration:** Let multiple authorized users share a workspace with attributed edits, thread participation, presence, and conflict-safe concurrent updates.

---

## I. Clarification Required

1. **Operator question:** Which exact object does `Create header from within app` refer to: a Markdown section heading, the application top bar, the ledger title, or another object?
