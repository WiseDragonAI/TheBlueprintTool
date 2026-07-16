## A. Outcome

1. **New-run conversation surface:** For thread-launched Codex runs created after this change, the `Thread` tab contains operator notes and the single final `# AGENT` answer produced by each scoped run.
2. **Execution surface:** The `Codex Log` tab contains the headless run stream: run status, thinking, interim agent messages, tool calls, file changes, warnings, and errors.
3. **Reading objective:** Collapsed tool activity keeps thinking and interim agent messages visible in chronological order without forcing the operator to scroll through repeated lifecycle events and command output.

---

## B. Content And Persistence Contract

1. **Canonical conversation:** Keep human interaction in `.decision-os/threads/<ledger>/<thread-id>.md`. A scoped Codex run appends its final answer as one normal `# AGENT` note after completing the requested work.
2. **No event projection:** Do not persist headless run events as conversation notes for a thread-launched run. `thread.started`, `turn.started`, `thinking`, interim `agent_message`, `command_execution`, `file_change`, warning, error, and `turn.completed` events remain run-log data.
3. **Canonical log:** Read the log from `.decision-os/runs/codex-skills/<ledger>/<run-id>.jsonl` through `GET /api/codex/skills/runs/:runId`, using the source card's `codexThreadRunId` as the active run identifier. Keep `.log` as the stderr and transport-diagnostic source.
4. **No new persisted model:** Reuse the current run files, `codexThreadRunId`, normalized run-event response, and `since` cursor. Tab selection and expanded groups are runtime UI state, not ledger fields.
5. **New-run scope:** Do not build a legacy artifact filter and do not rewrite existing contaminated thread Markdown. Existing old threads can remain contaminated; the required behavior is that future thread-launched runs stop adding headless events to conversation Markdown.
6. **Failure isolation:** A failed, cancelled, unavailable, transport-degraded run exposes its state in `Codex Log` and on the log-tab status indicator. It does not append a synthetic conversation message.

---

## C. Thread Panel Tabs And Header

1. **Tab set and sticky header:** Add an accessible two-item tablist with `Thread` first and `Codex Log` second inside a sticky thread panel header that stays visible above both tab panels while content scrolls.
2. **Two-row maximum:** The thread panel header must occupy at most two visual rows at every supported panel width. Long text truncates with ellipsis instead of wrapping into a third row.
3. **Header row one:** Show one visible identifier: the selected card title. Do not simultaneously show `Thread`, `Notes`, thread name, and card title. Keep the full card title available through the native `title` attribute.
4. **Header row two:** Render the `Thread` and `Codex Log` tabs on the left, then `model`, `effort`, and the `Codex` run button on the right in one stable row. Use compact control labels, fixed control heights, and ellipsized selected values so this row does not wrap.
5. **Default selection:** Open every newly selected thread on `Thread`. Remember the active tab per thread for the lifetime of the frontend session in `threadActiveTabByThreadId`.
6. **Thread tab:** Render operator notes, final agent answers, voice notes, attachments, delete controls, jump-to-bottom behavior, and the existing note composer. Preserve current conversation scroll state per thread.
7. **Codex Log tab:** Render the active run identified by `codexThreadRunId`, a compact status strip with `status`, `model`, `effort`, elapsed time, and total unique tool calls, followed by the chronological normalized event stream.
8. **Live updates:** Reuse the existing `1,000 ms` run poll and `since` cursor while the run is active. Merge returned events into the current log without rebuilding completed groups and stop polling on `complete`, `failed`, and `cancelled`.
9. **Empty state:** When the selected thread has no `codexThreadRunId`, show `No Codex run for this thread.` and keep the `Thread` tab fully usable.
10. **Composer ownership:** Show the note and voice composer only on `Thread`; switching to `Codex Log` gives the full panel height to run inspection.

---

## D. Tool Lifecycle Coalescing

1. **Stable identity:** Coalesce tool lifecycle events by the tuple `codexRunId` plus `codexItemId`. An event without `codexItemId` remains an independent log item keyed by `codexLine`.
2. **Single lifecycle row:** `item.started` creates one tool item with `in_progress`; `item.completed` for the same identity updates that item in place with terminal status, exit code, command output, and completion line.
3. **No duplicate count:** Count unique coalesced tool identities. A started/completed pair contributes `1` to the displayed tool-call total.
4. **Terminal precedence:** The latest lifecycle event supplies the visible status. Completed output replaces the empty in-progress body while retaining the original chronological position.
5. **Incremental safety:** Re-reading an already consumed JSONL line through refresh and reconnection keeps the existing tool item, unique count, and chronological position unchanged.

---

## E. Sequential Tool Grouping

1. **Group boundary:** After lifecycle coalescing, combine each maximal contiguous sequence of `tool_call` items from the same run into one tool group. A `thinking`, `agent_message`, `file_change`, warning, error, and run-status item each ends the sequence.
2. **Collapsed summary:** Render each tool group closed by default as one compact card labelled `<count> tool call` for `1` and `<count> tool calls` for larger counts. Include concise counts for `in_progress`, `completed`, and `failed` when those statuses are present.
3. **Expanded list:** Expanding the group reveals one compact row per unique tool item in execution order. Each row shows action, shortened command, terminal status, and exit code.
4. **Raw detail:** Expanding an individual tool row reveals the full command and captured output. Raw output never expands automatically when a tool completes.
5. **Live group update:** A newly started tool that directly follows the current group increments that group's count in place. A non-tool event closes the group, so later tool activity creates a new collapsed card after that event.
6. **Thinking readability:** Render `thinking` and interim `agent_message` items as normal readable log blocks between collapsed tool groups; do not place them inside a tool group.

---

## F. Interaction And Accessibility

1. **Tab semantics:** Use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, and stable element IDs. Support `ArrowLeft`, `ArrowRight`, `Home`, and `End` while focus is inside the tablist.
2. **Disclosure semantics:** Implement tool groups and tool rows with native `details` and `summary` controls so keyboard activation, focus indication, and announced expanded state work without custom key handling.
3. **Live-region scope:** Keep conversation announcements on the `Thread` panel. Announce new log events only while `Codex Log` is selected, and announce one lifecycle update instead of both started and completed entries.
4. **Scroll stability:** Appending log events must preserve the operator's reading position unless the log viewport was already pinned to the bottom.
5. **Sticky header focus:** Keep the sticky header in normal DOM order. Keyboard focus must move through the title actions, tabs, model selector, effort selector, and `Codex` button before entering the active tab panel.
6. **Status independence:** Tab changes, group expansion, and log polling leave card status, card geometry, thread Markdown, and ledger structured data unchanged.

---

## G. Implementation Surfaces

1. **Backend projection:** Update `backend/src/business/codex/controller/read-card-skill-run-controller.ts` and the thread-launched run persistence path so normalized events and counts remain run data instead of conversation notes.
2. **Panel composition:** Add the sticky two-row header, tablist, and tab panels through `frontend/src/runtime/thread/effect/render-thread-panel.ts`.
3. **Conversation rendering:** Keep conversation rendering in `frontend/src/runtime/thread/effect/render-thread-notes.ts` focused on the Markdown notes it receives, with no legacy artifact cleanup requirement.
4. **Runtime state:** Add per-thread tab state, incremental event state, coalesced tool state, group disclosure state, and independent scroll positions under the frontend runtime state.
5. **Existing run client:** Reuse `frontend/src/runtime/codex/effect/request-card-skill-run-status.ts` and the polling contract in `frontend/src/runtime/codex/effect/poll-card-skill-run.ts` for the log tab.
6. **Presentation:** Extend `frontend/assets/canvas/thread.css` for the sticky header, two-row grid, tablist, compact run status strip, thinking blocks, tool-group summary, nested tool rows, and focus-visible states.

---

## H. Acceptance Criteria

1. **New clean conversation:** Given one new operator note, multiple run events, and one final agent note after deployment, `Thread` renders the operator note and final agent note in source order.
2. **Separated log:** The same run events render only in `Codex Log`; switching tabs does not mutate the thread file.
3. **Header density:** The thread panel header never exceeds two visual rows while showing one card title, the two tabs, `model`, `effort`, and the `Codex` run button.
4. **Sticky reachability:** When the operator scrolls to the bottom of `Thread` and `Codex Log`, the header remains visible and the operator can switch tabs without scrolling back to the top.
5. **Lifecycle merge:** Given `item.started` and `item.completed` with the same `codexItemId`, the log shows one tool row, one count contribution, and the completed status and output.
6. **Sequential condensation:** Given four tool calls, one thinking item, and two more tool calls, the log shows a collapsed `4 tool calls` card, the readable thinking item, and a collapsed `2 tool calls` card in that order.
7. **Incremental refresh:** Repeated responses containing an already seen line leave event order, tool counts, expanded state, and scroll position unchanged.
8. **Terminal behavior:** `complete`, `failed`, and `cancelled` stop the active poll, remain inspectable in `Codex Log`, and add no synthetic agent note to `Thread`.
9. **Legacy non-goal:** Existing contaminated thread files are not rewritten, not migrated, and not cleaned through a dedicated frontend artifact filter.
10. **Keyboard behavior:** Both tabs and every nested disclosure can be reached, identified, activated, expanded, and collapsed with the keyboard.
11. **Regression coverage:** Frontend integration tests cover tab selection, sticky two-row header behavior, lifecycle coalescing, sequential grouping, incremental updates, scroll stability, and accessibility attributes. Backend tests prove thread-launched run reads do not persist event notes while the final scoped agent reply remains intact.
