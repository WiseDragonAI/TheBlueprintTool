# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-1","timestamp":"2026-07-08T07:41:55.911Z","status":"running","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-2","timestamp":"2026-07-08T07:41:55.911Z","status":"running","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-3","timestamp":"2026-07-07T13:05:20.953Z","status":"Codex message","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’ll use the `human-context-synthesis` skill and write only the target Markdown card. I’m treating the pasted source card as the locked source set, so I won’t inspect or mutate ledger JSON.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-4","timestamp":"2026-07-07T13:05:20.954Z","status":"in_progress","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md && pwd && ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md && pwd && ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-5","timestamp":"2026-07-07T13:05:20.955Z","status":"completed","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md && pwd && ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md && pwd && ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md"`
Status: completed
Exit code: 0

````text
---
name: human-context-synthesis
description: Turn source-backed facts into concise human-readable context for a specific audience. Use when Codex must synthesize a corpus, extraction register, card, report, repo notes, PRD discovery, documentation, or feature inventory into a reader-facing summary about what the subject is for, what people can do with it, how they use it, key features, controls, workflows, surfaces, affordances, and only the supporting system facts that matter to that reader.
---

# Human Context Synthesis

## Job

Convert extracted or source-visible facts into an essential human report.

Keep the report:

- source-bound;
- audience-specific;
- focused on use, value, and continuation;
- concise enough to read without re-analysis.

## Workflow

1. **Lock the source.** Name the allowed source set. Use only that set unless the user asks for wider research.
2. **Lock the reader.** Name the reader, what they need to understand, and what they need to do next.
3. **Extract usable facts.** Pull purpose, capabilities, workflows, controls, surfaces, spatial model, content types, roles, handoffs, and use constraints.
4. **Select by reader value.** Keep facts that help the reader understand, use, judge, or continue the subject.
5. **Write the report.** Group facts into reader questions, not internal taxonomy.
6. **Check for drift.** Delete anything true-but-useless, off-source, or more technical than the reader needs.

## Audience Lens

| Reader | Promote | Demote |
|---|---|---|
| Operator or end user | purpose, capabilities, workflows, controls, shortcuts, visible surfaces, spatial model, content they manipulate, decisions they own | storage paths, repo layout, implementation internals, test commands, agent mechanics |
| Product owner | user value, main workflows, active capabilities, product boundaries, adoption or decision signals | low-level APIs, build details, file ownership |
| Developer | architecture, data flow, APIs, state ownership, source paths, tests, constraints | broad value claims, marketing phrasing |
| Agent | task boundary, source policy, handoffs, editable files, acceptance signals | product explanation already obvious from the task |

## Feature Extraction

Before summarizing, create a small internal register of source-backed usable facts.

Each item needs:

- a normalized statement;
- a type: `purpose`, `spatial_model`, `surface`, `feature`, `action`, `workflow`, `control`, `content_type`, `handoff`, `role`, or `use_constraint`;
- source pointer;
- importance: `primary`, `supporting`, or `detail`.

For operator or end-user reports, missing source-mentioned controls, shortcuts, visible features, or spatial behavior is a failure.

## Selection Gate

Keep a fact when it answers at least one question:

1. **Purpose:** what is this for?
2. **Capability:** what can the reader do with it?
3. **Workflow:** how does the reader use it?
4. **Control or surface:** where does it happen, or what input triggers it?
5. **Continuation:** what must the reader decide or do next?

Drop a fact when it is only:

- true but not useful to the reader;
- implementation detail for a non-developer;
- stale status or current-work noise;
- a count, KPI, or inventory number with no source-backed reader value;
- an agent/process detail that does not change the reader's action.

## Report Shape

Use sections that answer the reader's natural questions. Prefer:

1. **What is it for?**
2. **What can the reader do?**
3. **How is the workspace, object, or process shaped?**
4. **How does the reader use it?**
5. **What controls, shortcuts, or entry points matter?**
6. **What content, surfaces, or handoffs matter?**
7. **What decisions or constraints affect use?**

Omit sections that the source does not support. Do not add decorative labels, dashboards, scores, counts, or "first read" style framing unless the source or user asks for them.

## Reading Format

Use compact blocks:

- 3 to 4 bullets is ideal;
- 5 bullets is the maximum;
- each bullet carries one idea;
- sentences stay short;
- **bold** marks the human-facing claim;
- `backticks` mark paths, routes, commands, UI labels, object names, and concrete system terms.

For Markdown cards, use numbered sections, `---` separators, and numbered bullets.

Keep evidence visible but secondary: use compact source refs, footnotes, or an evidence index instead of burying the report in citations.

## Final Check

Before finishing, verify:

- every important claim is supported by the allowed source set;
- the first section explains what the subject is for;
- operator/end-user reports foreground features, workflows, controls, surfaces, and spatial model;
- no section exceeds 5 bullets;
- no important source-mentioned affordance is missing;
- no section exists only because it sounds generally useful.
/home/jbb/dev/EditorBP/decision-os
-rw-rw-r-- 1 jbb jbb 132 Jul  7 20:05 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-6","timestamp":"2026-07-07T13:05:20.956Z","status":"Codex message","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"6","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_2"} -->

I’ve confirmed the target file exists and the skill instructions are loaded. Next I’m replacing that card body with an operator-facing synthesis: purpose, actions, workspace shape, controls, handoffs, and open decisions from the provided source only.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-7","timestamp":"2026-07-07T13:05:20.957Z","status":"in_progress","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"7","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-8","timestamp":"2026-07-07T13:05:20.958Z","status":"completed","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"8","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md"`
Status: completed
Exit code: 0

````text
# human-context-synthesis result

Status: processing

Source card: Decision OS Context
Codex run: codex-skill-1783429520950-bad8c87c
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-9","timestamp":"2026-07-07T13:05:20.959Z","status":"in_progress","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"9","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_4"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-10","timestamp":"2026-07-07T13:05:20.960Z","status":"completed","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"10","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_4"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-11","timestamp":"2026-07-07T13:05:20.961Z","status":"Codex message","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"11","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_5"} -->

The target card has been written. I’m doing a final read now to catch formatting issues and make sure every section stays compact and source-bound.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-12","timestamp":"2026-07-07T13:05:20.962Z","status":"in_progress","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"12","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-13","timestamp":"2026-07-07T13:05:20.963Z","status":"completed","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"13","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md"`
Status: completed
Exit code: 0

````text
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
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-14","timestamp":"2026-07-07T13:05:20.964Z","status":"Codex message","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"14","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_7"} -->

Wrote the operator-facing synthesis to [.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783429520950-bad8c87c.md).

I used only the provided source card, kept the result in English, and did not edit the source card or ledger JSON.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783429520950-bad8c87c-line-15","timestamp":"2026-07-07T13:05:20.965Z","status":"complete","codexRunId":"codex-skill-1783429520950-bad8c87c","codexLine":"15","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.
