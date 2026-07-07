# Decision OS Human Context

Allowed source set: source card `card-0b144d6a-16a1-4cc2-9b9f-32aabafd5b4a`, titled `Decision OS Context`.

Reader: the operator deciding how to use and continue the current `decision-os` workspace.

---

## 1. What is it for?

1. **`decision-os` is a local decision workspace for canvas-based product work.** It combines a browser canvas, a TypeScript ledger server, and workspace-local `.decision-os` data. [A1]
2. **The current workspace is dogfooding the product.** It exposes `specs`, `data`, `performances`, and `tasks-system` as active ledgers for product definition, data modeling, performance evidence, and next-feature work. [A1, C6]
3. **The operator owns decisions and intent.** Agents can read threads, edit repo or ledger state, and reply in `# AGENT` sections, but product-boundary decisions remain operator-owned unless a future card assigns ownership. [A4, D5]
4. **The product is currently local-first.** The confirmed runtime is a local workspace server on `127.0.0.1`, not a hosted SaaS deployment. [B7, B9, D2]

---

## 2. What can the operator do?

1. **Inspect and edit ledger canvases.** The operator can open route-addressed ledgers, review cards, zones, groups, and relationships, then move or edit them on the canvas. [A2, A3, C1]
2. **Create and maintain decision objects.** Cards, zones, groups, relationships, summaries, Markdown content, fields, and report or mockup cards are the main working objects. [A2, A3, C6]
3. **Use threads for operator-agent collaboration.** The operator writes notes, records voice notes, pastes images or files, and receives durable agent replies through `# AGENT` sections. [A3, C5, C8]
4. **Review evidence and product context in-place.** Performance notes, specs, task cards, image carousels, HTML card assets, and report mockups can all live inside the workspace. [A2, A6, B8, C2]
5. **Use CLI workflows for maintenance and queues.** `ledger-cli` and `generator-cli` support maintenance, agent queue work, and generated workspace artifacts. [A2, A3, B2, C4]

---

## 3. How is the workspace shaped?

1. **Ledgers are the top-level work areas.** `Specs` holds behavior contracts, `Data` holds base classes and relationships, `Performances` holds measured canvas performance evidence, and `Tasks System` holds next features. [C6]
2. **The canvas is the main spatial model.** The operator works with cards, zones, groups, relationships, viewport position, zoom/detail mode, and selection state. [C1, C2, C3]
3. **Cards are the core content unit.** A card can contain Markdown, fields, images, HTML assets, comments, thread links, and persisted image dimensions. [A2, B4, C5, C9]
4. **Threads are the collaboration layer.** They connect operator notes, agent replies, pasted files, voice transcription, retry states, progress history, and recovery context. [A7, C3, C5]
5. **The frontend owns interaction state while the filesystem remains canonical.** The operator experiences route, viewport, selection, tabs, drafts, voice capture, and refresh state in the browser, while durable content stays in workspace files. [B4, B5, C3]

---

## 4. How does the operator use it?

1. **Open a workspace route.** Entry points include `/`, `/ledgers`, `/<ledgerId>`, the tab registry, and direct ledger routes. [B3, C4]
2. **Navigate the canvas.** The operator pans, zooms, selects objects, switches detail modes, and manipulates cards, zones, groups, or relationships. [A2, C1, C3]
3. **Open the thread panel when collaboration is needed.** `A` opens or focuses the thread panel for notes, agent replies, uploads, and voice-driven work. [C1, C4, C5]
4. **Use voice when typing is not the best input.** Voice capture moves from browser media capture to upload, transcription, optimistic note update, and retry if transcription fails. [A2, B3, C5]
5. **React to external updates.** Filesystem edits can refresh the client through server-sent events, so CLI or agent changes can appear without a full manual reload. [B3, C5]

---

## 5. What controls and entry points matter?

1. **Keyboard contract.** `A` opens or focuses threads, `X` starts or stops the active voice note, `Esc` cancels capture or clears active UI, and `Del` confirms deletion for selected objects. [C7]
2. **Clipboard and sizing controls.** `Ctrl+C` copies selected cards, zones, and groups; `Ctrl+V` pastes them; `Ctrl+D` resizes selected cards to content and selected zones to contained cards. [C7]
3. **Visible UI entry points.** The tab registry, toolbox, canvas controls, card controls, thread buttons, upload and paste controls, voice dock, and hidden ledgers overview are relevant surfaces. [C2, C4]
4. **Deletion is guarded.** Delete actions require confirmation, and deletion confirmation modals support keyboard handling. [C2, C7, C9]
5. **Thread and voice controls must respect editing.** Thread and voice tooling must not steal editing keystrokes from active text work. [C9]

---

## 6. What content and handoffs matter?

1. **Operator notes hand work to agents.** Notes are durable thread content; agents answer in `# AGENT` sections and may also update cards or repo files. [A4, C5, C8]
2. **Card Markdown hands off through hydration and rendering.** The backend hydrates card content, and the frontend renders Markdown, images, HTML assets, and media layouts. [B4, B5, C5]
3. **Image and HTML assets are first-class card content.** Markdown image assets can render in cards, adjacent images can form carousels, and HTML card assets can be embedded when they stay under allowed card asset paths. [A2, C9]
4. **Voice notes depend on optional local transcription settings.** Transcription uses workspace settings and an OpenAI transcription provider when configured. [B6, D5]
5. **Live refresh bridges external edits back to the UI.** Server-sent refresh events carry filesystem changes into the browser runtime. [B3, C5]

---

## 7. What constraints and decisions affect continuation?

1. **Thread scope needs a product decision.** Threads currently carry conversation history, work queue, lock, status model, progress log, and recovery surface, which creates unresolved product pressure. [A7]
2. **Report UX needs a boundary decision.** Reports could become a card view, ledger type, goal cockpit tab, or embedded reader; the source does not resolve that choice. [A7, D5]
3. **Watcher loops, task queues, summaries, and goal objects remain active next-feature territory.** `tasks-system` is the current surface for those decisions. [A6, D5]
4. **Canvas performance remains a use constraint.** Drag, pan, overlay rendering, rich cards, zone labels, and relationship routing must preserve responsive frame production. [A7, B8, C9]
5. **Several areas are not verified in this pass.** Browser behavior, automated tests, live workspace state, transcription key validity, current performance, accessibility, and external adoption were not checked. [D3]

---

## Evidence Index

1. `A` = Product Context from the source card.
2. `B` = Technical Context from the source card.
3. `C` = UX Context from the source card.
4. `D` = Context Boundaries from the source card.
---

Codex run completed: exit code 0
