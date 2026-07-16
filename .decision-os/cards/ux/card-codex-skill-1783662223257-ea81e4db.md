## A. DEPENDENCY GRAPH

| from_task | to_task | edge_type | reason | evidence |
|---|---|---|---|---|
| `TL-01` | `TL-02` | `test-order-risk` | The backend proof must assert the thread-launched persistence behavior and counting contract implemented by `TL-01`. | Explicit `TL-02.depends_on`; `backend/test/codex/read-card-skill-run-controller.test.ts` exercises `readCardSkillRunController`, `persistedEventCount`, terminal states, and JSONL lifecycle fixtures. |
| `TL-01` | `TL-04` | `hard-blocker` | The client poller must consume the stable normalized response and non-persistence behavior from the backend read route. | Explicit `TL-04.depends_on`; `requestCardSkillRunStatus` calls `GET /api/codex/skills/runs/:runId` and consumes the event, cursor, count, metadata, and terminal-status fields produced by `readCardSkillRunController`. |
| `TL-03` | `TL-04` | `shared-state-risk` | The poll consumer needs the session-only per-thread summary and event destinations before it can feed newly started runs into log state. | Explicit `TL-04.depends_on`; `processThreadCodexController` already imports the singleton `state`, and `TL-03` owns the new per-thread run cache in `frontend/src/runtime/state.ts`. |
| `TL-03` | `TL-05` | `shared-file-risk` | The reducer result and disclosure keys are stored in the state shape introduced by `TL-03`. | Explicit `TL-05.depends_on`; both tasks target `frontend/src/runtime/state.ts`, including per-thread events, coalesced tools, and disclosure state. |
| `TL-04` | `TL-05` | `soft-ordering` | Finalize the expanded normalized diagnostic event contract before typing the reducer that consumes those fields. | `TL-04` owns `CardSkillRunEvent` and `CardSkillRunSummary`; `TL-05` consumes run IDs, item IDs, JSONL lines, bodies, terminal fields, and event kinds when merging lifecycle events. |
| `TL-03` | `TL-06` | `shared-state-risk` | Accessible tab rendering requires the remembered active tab for the selected thread. | Explicit `TL-06.depends_on`; `renderThreadPanel` reads the singleton `state`, while `TL-03` introduces `threadActiveTabByThreadId`. |
| `TL-04` | `TL-07` | `hard-blocker` | The log surface requires incremental summaries, normalized diagnostic fields, terminal retention, and transport failure data from the poll consumer. | Explicit `TL-07.depends_on`; `renderThreadCodexLog` consumes the run summary and event stream defined and delivered by `TL-04`. |
| `TL-05` | `TL-07` | `hard-blocker` | Tool rows and sequential tool groups cannot be rendered until lifecycle coalescing and group boundaries are defined. | Explicit `TL-07.depends_on`; `TL-07` renders native disclosures from `mergeThreadRunEvents` and `groupSequentialToolCalls`. |
| `TL-06` | `TL-07` | `shared-file-risk` | The log renderer mounts into the tab panel and run target structure created by the panel composition task. | Explicit `TL-07.depends_on`; both tasks edit `render-thread-panel.ts` and `card-codex-run-id.ts`. |
| `TL-03` | `TL-08` | `shared-file-risk` | Independent conversation and log scroll ownership extends the state and scroll helpers created by `TL-03`. | Explicit `TL-08.depends_on`; both tasks edit `persist-thread-scroll.ts`, and both use the per-thread tab and scroll maps in `state.ts`. |
| `TL-05` | `TL-08` | `shared-state-risk` | Announcement deduplication and disclosure preservation depend on coalesced lifecycle updates and stable disclosure keys. | Explicit `TL-08.depends_on`; `TL-08` announces one coalesced update and preserves log position while `TL-05` defines reducer update identity. |
| `TL-06` | `TL-08` | `shared-file-risk` | Conversation ownership and composer visibility must be applied inside the active tab-panel structure. | Explicit `TL-08.depends_on`; both tasks edit `render-thread-panel.ts`, and `TL-08` moves existing thread-only surfaces under the `Thread` panel created by `TL-06`. |
| `TL-07` | `TL-08` | `shared-file-risk` | Live-region ownership and log scroll pinning operate on the log DOM produced by `TL-07`. | Explicit `TL-08.depends_on`; both tasks edit `render-thread-panel.ts`, while `TL-08` coordinates `renderThreadCodexLog` with conversation rendering and scroll effects. |
| `TL-06` | `TL-09` | `hard-blocker` | CSS selectors and dimensions require the final two-row header, tabs, controls, IDs, and panel DOM. | Explicit `TL-09.depends_on`; `TL-09` styles `.thread-heading`, `.thread-actions`, `.thread-target-title`, and `.thread-codex-select` created or restructured by `TL-06`. |
| `TL-07` | `TL-09` | `hard-blocker` | Condensed log styling requires the final status strip, event blocks, tool groups, and nested disclosures. | Explicit `TL-09.depends_on`; `TL-09` replaces conversation Codex-event selectors with the log-surface selectors emitted by `renderThreadCodexLog`. |
| `TL-08` | `TL-09` | `hard-blocker` | Full-height panels, composer visibility, jump controls, and independent scrolling must be finalized before their layout is styled. | Explicit `TL-09.depends_on`; `TL-08` owns the panel visibility and scroll behavior that `frontend/assets/canvas/thread.css` must represent. |
| `TL-03` | `TL-10` | `test-order-risk` | Runtime tests require the session tab, cache, disclosure, and independent scroll state contract. | Explicit `TL-10.depends_on`; `thread-selection-runtime.integration.test.ts` covers tab memory and scroll restoration against `state.ts`, `select-thread.ts`, and `persist-thread-scroll.ts`. |
| `TL-04` | `TL-10` | `test-order-risk` | Poller tests require the callback consumer, advancing cursor, retained terminal summaries, unavailable response, and timer shutdown behavior. | Explicit `TL-10.depends_on`; `codex-skill-request.integration.test.ts` already covers `requestCardSkillRunStatus` and is the named harness for deterministic poll responses. |
| `TL-05` | `TL-10` | `test-order-risk` | Reducer and grouping proofs require the final identity, replay, chronology, disclosure, and grouping rules. | Explicit `TL-10.depends_on`; the new reducer cases use repeated lines, paired lifecycle items, missing item IDs, and interleaved non-tool events. |
| `TL-07` | `TL-10` | `test-order-risk` | Live-region and log-scroll assertions require the rendered event surface and terminal-state DOM. | Explicit `TL-10.depends_on`; `TL-10` checks announcements, chronological groups, unavailable responses, and pinned-bottom behavior exposed through `renderThreadCodexLog`. |
| `TL-08` | `TL-10` | `test-order-risk` | Conversation/log ownership and viewport invariants must exist before integration tests can assert them. | Explicit `TL-10.depends_on`; `TL-10` covers independent scroll restoration, active-panel announcements, pinned readers, and tab memory. |
| `TL-06` | `TL-11` | `test-order-risk` | Header density, tab semantics, native title, focus order, and roving keyboard behavior require the composed header DOM. | Explicit `TL-11.depends_on`; the named integration and Chromium tests import or exercise `renderThreadPanel`. |
| `TL-07` | `TL-11` | `test-order-risk` | Nested disclosure keyboard coverage requires the completed log status and tool-group markup. | Explicit `TL-11.depends_on`; `TL-11` exercises the native disclosures produced by `renderThreadCodexLog`. |
| `TL-08` | `TL-11` | `test-order-risk` | Composer visibility, tab restoration, bottom-position switching, and unchanged Markdown depend on the isolated panel behaviors. | Explicit `TL-11.depends_on`; the browser and rendered-DOM cases switch panels and verify conversation ownership. |
| `TL-09` | `TL-11` | `test-order-risk` | Measured two-row height, sticky reachability, truncation, fixed controls, and visible focus require final CSS. | Explicit `TL-11.depends_on`; Chromium coverage measures the selectors in `frontend/assets/canvas/thread.css` at supported inspector widths. |

---

## B. INDEPENDENT TASK GROUPS

| group_id | task_ids | target_files | target_symbols | independence_reason | dispatch_notes |
|---|---|---|---|---|---|
| `TG-01` | `TL-01`, `TL-02` | `backend/src/business/codex/controller/read-card-skill-run-controller.ts`; `backend/test/codex/read-card-skill-run-controller.test.ts`; `backend/test/codex/start-card-skill-process-controller.test.ts` | `NormalizedRunEvent`; `normalizeRunEvent`; `persistRunEvents`; `readCardSkillRunController`; `toolCallCount`; named backend route cases | This group owns the backend read contract, persistence boundary, JSONL and log interpretation, tool identity, and the fixtures proving those behaviors. It does not edit frontend runtime state or thread-panel files. | Dispatch to one backend worker. Complete `TL-01` before updating the assertions in `TL-02`; preserve the existing non-thread card-skill behavior in the same controller and harness. |
| `TG-02` | `TL-03`, `TL-04`, `TL-05`, `TL-06`, `TL-07`, `TL-08`, `TL-09`, `TL-10`, `TL-11` | `frontend/index.html`; `frontend/src/runtime/state.ts`; `frontend/src/runtime/thread/**`; `frontend/src/runtime/codex/**`; `frontend/src/runtime/voice/effect/render-voice-dock.ts`; `frontend/assets/canvas/thread.css`; named frontend integration tests; named Chromium thread tests | Thread session state; scroll helpers; `CardSkillRunEvent`; `CardSkillRunSummary`; poll consumer; `mergeThreadRunEvents`; `groupSequentialToolCalls`; `renderThreadPanel`; `renderThreadCodexLog`; conversation effects; tab semantics; log disclosures | The frontend tasks form one collision-connected unit: `state.ts` joins `TL-03` and `TL-05`; `persist-thread-scroll.ts` joins `TL-03` and `TL-08`; `render-thread-panel.ts` joins `TL-06`, `TL-07`, and `TL-08`; `card-codex-run-id.ts` joins `TL-06` and `TL-07`. The DOM contract then directly controls `TL-09`, `TL-10`, and `TL-11`. Splitting this unit would assign the same runtime state and panel file family to multiple workers. | Dispatch to one frontend worker after `TG-01`. Within the group, establish `TL-03`, extend the polling contract in `TL-04`, add the reducer in `TL-05`, compose and render the panels through `TL-06` to `TL-08`, style with `TL-09`, then complete `TL-10` and `TL-11`. |

---

## C. SEQUENTIAL GATES

1. **`TG-01` → `TG-02`.** Start `TG-02` after the backend response contract is stable: thread-launched reads return normalized chronological diagnostics, retain advancing `since` semantics, count unique tools by run and item identity with line fallback, return `persistedEventCount: 0`, preserve thread Markdown and ledger bytes, and expose `complete`, `failed`, and `cancelled` without synthetic notes.
2. **`TG-02` internal state gate.** Complete `TL-03` before connecting `TL-04`, `TL-05`, and `TL-06` to per-thread tab, event, disclosure, and scroll state.
3. **`TG-02` internal log gate.** Complete the event types and callback poll consumer in `TL-04` plus lifecycle reduction and grouping in `TL-05` before implementing `TL-07`.
4. **`TG-02` internal panel gate.** Complete the tab and panel DOM in `TL-06` plus the log DOM in `TL-07` before isolating conversation ownership and scroll behavior in `TL-08`.
5. **`TG-02` internal presentation gate.** Complete `TL-06`, `TL-07`, and `TL-08` before finalizing the selector and layout contract in `TL-09`.
6. **`TG-02` internal proof gate.** Complete the relevant runtime behavior through `TL-09` before finalizing `TL-10` and `TL-11` assertions.

---

## D. COLLISION RISKS

1. **Backend persistence boundary.** `read-card-skill-run-controller.ts` currently calls `persistRunEvents` unconditionally after identifying both `codexThreadRunId` and `codexRunId` references. `TL-01` and `TL-02` must share one interpretation of thread-launched fixtures so a test update cannot accidentally bless writes to thread Markdown or ledger JSON.
2. **Singleton frontend state.** `TL-03` and `TL-05` both change `frontend/src/runtime/state.ts`. The cache shape, reducer result, disclosure keys, tab memory, and scroll maps must be introduced as one session-only contract.
3. **Scroll helper ownership.** `TL-03` and `TL-08` both change `persist-thread-scroll.ts`; `TL-08` also coordinates `render-thread-jump-button.ts` and `pin-thread-feed-to-last-message.ts`. Parallel edits risk applying conversation selectors to the log panel and overwriting per-panel restoration behavior.
4. **Thread-panel composition.** `TL-06`, `TL-07`, and `TL-08` all change `render-thread-panel.ts`. That file currently owns title rendering, controls, note rendering, voice rendering, jump rendering, and scroll restoration, so its final DOM and effect order require one owner.
5. **Run-ID resolution.** `TL-06` and `TL-07` both change `card-codex-run-id.ts`. The header controls and log renderer must resolve the same selected card and `codexThreadRunId`.
6. **DOM and CSS contract.** `frontend/index.html`, `render-thread-panel.ts`, the new `render-thread-codex-log.ts`, and `thread.css` jointly define tab IDs, ARIA links, sticky rows, active panels, native disclosures, and live regions. Independent edits could leave selectors, focus behavior, and measured browser expectations out of sync.
7. **Poller lifecycle.** `poll-card-skill-run.ts` currently keys pollers by ledger, card, and run and stops when its widget element remains detached. `TL-04` must preserve widget behavior while adding a DOM-independent log consumer; `TL-10` must use the same timer, cursor, terminal-cache, and rerender semantics.
8. **Frontend test fixtures.** `codex-skill-request.integration.test.ts` owns request and poll timing fixtures; `thread-selection-runtime.integration.test.ts` owns singleton state and scroll fixtures; `thread-accent-runtime.integration.test.ts` and the Chromium thread specs consume the final panel DOM. Fixture resets must include the new session-only maps and pollers so one case cannot leak tab, disclosure, cursor, timer, or scroll state into another.

---

## E. AMBIGUITIES

1. **None.** Every task has a reliable placement, and no dependency question requires an operator answer.

---

## F. READINESS

1. `READY_FOR_TASK_GROUP_COMPLETENESS`
---

Codex run completed: exit code 0
