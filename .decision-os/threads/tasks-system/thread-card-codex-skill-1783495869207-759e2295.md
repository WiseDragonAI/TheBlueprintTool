# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-1","timestamp":"2026-07-08T07:34:02.980Z","status":"running","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-2","timestamp":"2026-07-08T07:34:02.980Z","status":"running","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-3","timestamp":"2026-07-08T07:34:02.980Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’m using the `screen-content-planner` skill for this card-to-screen-plan handoff, and I’ll keep the output scoped to the requested Markdown card only.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-4","timestamp":"2026-07-08T07:34:02.980Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc 'ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-5","timestamp":"2026-07-08T07:34:02.980Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc 'ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'ls -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'`
Status: completed
Exit code: 0

````text
-rw-rw-r-- 1 jbb jbb 176 Jul  8 14:31 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-6","timestamp":"2026-07-08T07:34:02.980Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"6","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-7","timestamp":"2026-07-08T07:34:02.980Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"7","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: screen-content-planner
description: Turn one product analysis card, implementation plan, UX analysis, or equivalent planning artifact into a complete screen-content plan for future visual mockups. Use when Codex needs to determine which screens are needed, what each screen must contain, what product data and states each screen requires, and what information is still missing before a separate mockup-generation skill begins. Do not use for generating visual mockups, styling systems, image assets, or implementation code.
---

# Screen Content Planner

## Purpose

Create a screen-by-screen content plan from one analysis card or equivalent source artifact.

This skill is the first step in a two-skill workflow:

1. This skill defines screen scope, content, data, states, reuse constraints, and unresolved blockers.
2. A later visual mockup skill turns the plan into mockups.

Do not create visual mockups, image assets, high-fidelity layouts, styling systems, routes, or product code.

## Inputs

Start from one analysis card or equivalent artifact that may include:

- Requested product change
- Active stack and UI framework
- Component system or design system
- Routing model
- Data-loading pattern
- Current UX context
- Existing screens and user flows
- Existing product behavior
- Implementation or product plan
- Roles, permissions, states, edge cases, and constraints

If the user provides only partial context, extract what is present, identify what is missing, and ask only for missing facts that block accurate screen definition.

## Workflow

1. **Extract confirmed facts.** Capture the requested change, product area, actors, goals, workflow, current behavior, planned behavior, constraints, and any source facts that must be preserved.
2. **Extract stack and UI constraints.** Identify the tech stack, UI framework, component system, routing model, data-loading pattern, design constraints, and reusable UI patterns. If absent and material to screen content, ask for it.
3. **Map existing product context.** Identify existing screens, surfaces, features, components, flows, permissions, and behavior that the plan must reuse or respect.
4. **Map planned behavior.** Use the provided implementation or product plan to identify workflows, states, roles, data entities, edge cases, failure modes, and permission differences that need screen coverage.
5. **Determine the screen inventory.** Infer the needed screens when the source is sufficient. Ask focused questions only when screen count or screen boundaries cannot be determined confidently.
6. **Define each screen.** For every screen, specify content, sections, components, data, controls, navigation, states, permissions, and feature mapping.
7. **Separate blockers from assumptions.** List unresolved questions that block accurate screen definition. List non-blocking assumptions separately and continue when the assumption is low-risk and implied by the source.
8. **Prepare the handoff.** End with a clean handoff note for the later visual mockup skill, without doing visual design work.

## Clarification Rules

Ask only questions that would change screen definition.

Ask when missing information affects:

- Screen count or screen boundaries
- User roles or primary actors
- Feature boundaries
- Route names or surfaces
- Data entities or required fields
- Data sources or loading patterns
- Empty, loading, error, or permission states
- Existing UI references or reusable patterns
- Critical workflow order
- Access control or destructive actions

Do not ask for visual style details such as color palette, typography, illustration direction, spacing, motion, or high-fidelity layout preferences. Those belong to the later mockup creation skill.

When a decision is low-risk and implied by the source, state the assumption and continue.

## Output Format

Use this structure.

### 1. Source Summary

- **Requested change:**
- **Product area:**
- **Primary actors:**
- **Workflow goal:**
- **Confirmed constraints:**
- **Existing product context:**
- **Plan context:**

### 2. Confirmed Facts

List concrete facts extracted from the source. Keep each fact traceable to the source artifact. Do not add generic process claims.

### 3. Non-Blocking Assumptions

List assumptions that are implied by the source and safe enough to proceed with. For each assumption, explain why it is low-risk.

### 4. Blocking Questions

List only questions that block accurate screen definition. If there are no blockers, write `No blocking questions.`

### 5. Screen Inventory

Provide a table with one row per screen:

| Screen | Purpose | Route or surface | Primary actor | Workflow position | Grounding |
| --- | --- | --- | --- | --- | --- |

Rules:

- Use the route or surface when known.
- Write `Unknown` when the source does not provide it.
- The grounding column must reference the relevant feature, requirement, workflow, existing screen, or stated assumption.

### 6. Per-Screen Definitions

For each screen, use this template:

#### Screen: `<screen name>`

- **Purpose:**
- **Route or surface:**
- **Primary actor:**
- **Workflow position:**
- **Grounded by:**
- **Existing patterns to reuse or respect:**

**Required sections**

- List each section and the job it performs.

**Required components**

- List components or component types. Name existing components when known.

**Required data fields**

- List visible fields, identifiers, labels, counts, metadata, status values, timestamps, ownership fields, or computed fields.

**Controls and actions**

- List buttons, menus, inputs, filters, toggles, dialogs, destructive actions, confirmation steps, and disabled states.

**Navigation affordances**

- List entry points, exits, back links, tabs, breadcrumbs, deep links, cross-links, and post-action destinations.

**States**

- **Empty:**
- **Loading:**
- **Error:**
- **Permission:**
- **Edge cases:**

**Data requirements**

- **Source data:**
- **Derived values:**
- **Mock data needed:**
- **Facts to preserve from source:**

**Feature mapping**

- Map the screen back to source requirements, workflows, implementation plan items, constraints, or acceptance criteria.

### 7. Cross-Screen Coverage Check

Confirm that the plan covers:

- Primary workflow
- Secondary workflows
- Entry and exit points
- Empty states
- Loading states
- Error states
- Permission states
- Role differences
- Data dependencies
- Edge cases named by the source
- Existing screen or component reuse

### 8. Handoff to Visual Mockup Skill

Write a concise handoff that states:

- The screen list is ready or blocked.
- Which screens should be mocked first.
- Which missing facts must be resolved before visual mockups.
- Which existing UI patterns the mockup skill must respect.

Do not include color palettes, high-fidelity layout instructions, image-generation prompts, or final visual mockups.

## Quality Bar

Before finishing, check that:

- Every proposed screen is grounded in the source artifact, current product context, stack constraints, or an explicit assumption.
- Every screen has content, data, controls, navigation, states, permission handling, and feature mapping.
- Missing data is separated from assumptions.
- Questions are limited to blockers.
- The output gives enough detail for a later visual mockup skill to work without rediscovering product intent.
- No unrelated screens are invented.
- No product code, route scaffolding, or visual mockups are produced.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-8","timestamp":"2026-07-08T07:34:02.980Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"8","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_3"} -->

The target card exists, so I’m checking its current contents before replacing it with the generated planning result.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-9","timestamp":"2026-07-08T07:34:02.980Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"9","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_4","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-10","timestamp":"2026-07-08T07:34:02.980Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"10","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_4","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md"`
Status: completed
Exit code: 0

````text
# screen-content-planner result

Status: processing

Source card: product-analysis result
Codex run: codex-skill-1783495869207-759e2295
Codex model: gpt-5.5
Codex effort: xhigh
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-11","timestamp":"2026-07-08T07:34:02.980Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"11","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_5"} -->

I have enough context to draft the plan. I’m treating the pipeline builder as a modal/toolbox workflow, because the source explicitly rules out a ledger/canvas route and only marks exact labels/schema as unresolved.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-12","timestamp":"2026-07-08T07:34:02.980Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"12","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_6"} -->

I’m going to replace the placeholder processing card with the completed screen-content plan now. The edit is limited to the requested Markdown result file.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-13","timestamp":"2026-07-08T07:34:08.975Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"13","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_7"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-14","timestamp":"2026-07-08T07:34:08.975Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"14","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_7"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-15","timestamp":"2026-07-08T07:34:14.976Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"15","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_8"} -->

The result file is updated. I’m doing a quick readback to catch formatting problems or accidental omissions before I finish.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-16","timestamp":"2026-07-08T07:34:14.976Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"16","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_9","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-17","timestamp":"2026-07-08T07:34:14.976Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"17","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_9","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md"`
Status: completed
Exit code: 0

````text
# Screen Content Plan: Step-Based Codex Skill Pipeline

Source card: `card-codex-skill-1783443647691-91eae060` / `product-analysis result`

## 1. Source Summary

- **Requested change:** Add a Decision OS pipeline configuration workflow where an operator creates ordered pipeline steps, assigns one or more ordered Codex skills inside each step, and runs those skills sequentially in independent headless Codex sessions.
- **Product area:** Decision OS Codex skill execution, skill/pipeline configuration UI, toolbox entry points, browser canvas card creation, card geometry, card fields, Codex run widgets, and backend Codex orchestration.
- **Primary actors:** Operator using the browser canvas and pipeline configuration UI. Headless Codex sessions are system-executed backend workers.
- **Workflow goal:** Let the operator define a pipeline, start it from the UI, receive one card per step, and observe one independent Codex run per configured skill with strict sequential execution.
- **Confirmed constraints:** The pipeline builder is not a ledger and not a canvas route. It is likely opened from the toolbox in a modal. Existing top-level ledger tab routing must not be disturbed. A one-step pipeline with multiple skills is valid. The former one-skill flow remains representable as a one-step, one-skill pipeline.
- **Existing product context:** The app already has a browser canvas, toolbox rail, card controls, a `Codex Skills` modal with search/category filters/model/effort/process action, card field tabs, card resize behavior, output cards with Codex run status, run logs, and card thread events.
- **Plan context:** The source is a product analysis card, not a final implementation spec. It identifies missing durable schema, orchestration, cancellation, prompt-context, and exact modal copy decisions. This plan defines screen content without inventing code or visual design.

## 2. Confirmed Facts

- The existing workflow is card-scoped: a selected card can use a `Run Codex skill` card control.
- The existing skill modal supports skill search, category filters, one selected `skillName`, model, effort, and one `Process` action.
- `frontend/index.html` contains a toolbox rail and `.skill-modal`, but no observed pipeline builder tool or pipeline modal.
- Existing card fields render simple `name` / `type` pairs; no observed field schema stores pipeline steps or skill lists.
- Existing resize flows can resize cards to measured content and refresh changed cards after content updates.
- Existing backend skill execution accepts one source card and one skill, creates one `codex-skill-run` output card, links it to the source card, and spawns one `codex exec` child process.
- Existing prompt building tells headless Codex to treat one source card as the complete incoming card content and write to one output Markdown file.
- Existing run polling derives one run's progress from one JSONL/log pair and persists run events into the output card thread.
- Existing cancellation targets one active run in the current server runtime.
- Ledger navigation is driven by `.decision-os/state.json` ledgers and route tabs.
- The updated operator note says the builder is not a ledger and not a canvas, and is probably a toolbox-opened modal.
- Expected pipeline behavior: the operator creates a pipeline, creates one or more steps, assigns one or more ordered skills to each step, runs the pipeline, and receives one card per step.
- Expected execution behavior: every skill inside a step runs sequentially in an independent `codex exec` session.
- Acceptance signal: for `S` steps and `K` total skills, the operator can define step order and skill order, start the pipeline, observe `S` step cards, observe `K` distinct Codex run IDs/logs, and observe skill `n + 1` starting only after skill `n` completes.
- The source does not specify exact entry label, modal title, durable pipeline schema, step-card creation timing, prompt context for later skills, pipeline cancellation, or queue recovery behavior.

## 3. Non-Blocking Assumptions

- **A toolbox entry opens the builder.** This is low-risk because the source says the builder is likely toolbox-opened and explicitly rules out a ledger/canvas route.
- **The pipeline builder is one modal with internal sections, not a new route.** This is low-risk because route-level tabs are constrained by existing navigation specs and the source points to a modal workflow.
- **The skill picker can reuse content patterns from the existing `Codex Skills` modal.** This is low-risk because the current modal already provides the needed skill search, filters, model, and effort controls for one skill.
- **Pipeline configuration can be mocked with a draft in-memory pipeline object.** This is low-risk for screen planning because the durable schema is unresolved, but the visible fields are known: steps, skill order, model, effort, source card, and status.
- **Step cards are shown on the existing browser canvas after pipeline start.** This is low-risk because the acceptance signal requires the operator to observe one card per step and the current product already creates Codex output cards on the canvas.
- **Run status appears on each step card and/or its existing thread/run widget surface.** This is low-risk because the current run reader persists run events into the output card thread and derives progress from JSONL/log files.
- **Only one operator role needs screen coverage.** This is low-risk because the source names only the operator actor and no permission model or role split.

## 4. Blocking Questions

No blocking questions.

The following are unresolved product decisions, but they do not block first-pass screen definition:

- Exact toolbox label, modal title, and button copy.
- Whether the existing `.skill-modal` is extended or a new pipeline modal is introduced.
- Durable pipeline schema, including pipeline id, step id, skill order, run ids, and step-card association.
- Whether step cards are created during configuration, at pipeline start, or just before each step runs.
- Whether a later skill receives only current step-card content, the original source card, all prior step outputs, or a structured context bundle.
- Pipeline-level cancellation and restart recovery behavior.
- Queue behavior after one pipeline completes when other pipelines are pending.

## 5. Screen Inventory

| Screen | Purpose | Route or surface | Primary actor | Workflow position | Grounding |
| --- | --- | --- | --- | --- | --- |
| Canvas With Pipeline Entry | Let the operator enter the pipeline workflow from the existing canvas/toolbox context. | Browser canvas with toolbox rail; no new route. | Operator | Start | Source says the builder is probably opened from the toolbox and is not a ledger/canvas route. |
| Pipeline Builder Modal | Let the operator define the pipeline, add ordered steps, add ordered skills to each step, validate the draft, and start execution. | Modal opened from toolbox; exact selector/title unknown. | Operator | Configure | Source requires ordered pipeline steps with ordered skills, likely in a toolbox-opened modal. |
| Skill Picker and Skill Settings Panel | Let the operator search skills, filter categories, choose a skill, and set model/effort before adding it to a step. | Nested modal section or panel inside Pipeline Builder Modal. | Operator | Configure skill within step | Existing `Codex Skills` modal has search, category filters, one selected skill, model, and effort. |
| Generated Step Cards on Canvas | Show one card per pipeline step, card placement, relationships, status, and active/completed run summaries. | Existing browser canvas card surface. | Operator | Run and observe | Acceptance signal requires `S` step cards and current product already creates linked Codex output cards. |
| Step Card Run Detail and Thread Status | Show per-skill run sequence, distinct run IDs/logs, thread events, errors, cancellation state, and final card content. | Existing card detail/thread/run-widget surface; exact route unknown. | Operator | Inspect and recover | Existing run route derives JSONL/log progress and persists run events into output card thread. |

## 6. Per-Screen Definitions

#### Screen: `Canvas With Pipeline Entry`

- **Purpose:** Provide the operator's entry point into pipeline creation without changing ledger tab navigation.
- **Route or surface:** Existing browser canvas with toolbox rail; no new route.
- **Primary actor:** Operator.
- **Workflow position:** Start.
- **Grounded by:** The source states the builder is likely toolbox-opened, not a ledger and not a canvas route.
- **Existing patterns to reuse or respect:** Existing toolbox rail, card selection behavior, route-addressable ledger tabs, active tab derived from browser path, canvas controls, and current selected-card context.

**Required sections**

- Canvas workspace: shows the current ledger graph and selected source card context.
- Toolbox rail: includes the pipeline builder entry alongside existing tool controls.
- Selection context summary: identifies the selected source card when a card-scoped pipeline starts from selection.
- Existing route/tab context: remains unchanged while the modal opens.

**Required components**

- Toolbox action button or tool item for opening pipeline builder.
- Selected card affordance or card control if the pipeline starts from a selected card.
- Existing canvas cards and relationships.
- Existing navigation/tab shell.
- Disabled tooltip or inline message when no valid source card is selected, if the workflow requires a source card.

**Required data fields**

- Active ledger id and title.
- Selected source card id.
- Selected source card title.
- Selected source card type/status when available.
- Count of selected cards.
- Pipeline entry enabled/disabled state.
- Disabled reason, such as no selected card or invalid selection.

**Controls and actions**

- Open pipeline builder.
- Select a source card on the canvas.
- Close any existing canvas/card tooling before or while opening the modal, if current modal behavior requires it.
- Disabled state when the required source card context is missing.

**Navigation affordances**

- Entry from toolbox rail.
- Optional entry from selected-card control if the existing single-skill control is migrated or complemented.
- Modal close returns to the same canvas and active ledger route.
- No new navbar tab or ledger route.

**States**

- **Empty:** No card selected; pipeline entry either opens with no source selected if allowed or is disabled with a clear reason.
- **Loading:** Skill metadata or selected-card metadata is not yet available; entry can show pending state or open the builder with loading content.
- **Error:** Skill discovery or source-card lookup fails; show recoverable error before configuration.
- **Permission:** No role model is specified; assume same operator permissions as existing skill execution. If permission is later added, disable entry and show reason.
- **Edge cases:** Multiple selected cards, selected card missing content file, active ledger invalid, existing single-skill modal already open.

**Data requirements**

- **Source data:** Active ledger, selected card, available skill metadata if preloaded.
- **Derived values:** Whether pipeline creation is available for the current selection; initial source card label.
- **Mock data needed:** One active ledger, one selected source card, optional no-selection state.
- **Facts to preserve from source:** Builder must not become a ledger tab or route; existing tab registry must remain unchanged.

**Feature mapping**

- Covers the toolbox/modal entry requirement.
- Respects navigation specs `12749dcd`, `ac137fe2`, `51a6af83`, `e6a91d34`, and `f2d6c8b1`.
- Preserves current canvas and selected-card context.

#### Screen: `Pipeline Builder Modal`

- **Purpose:** Let the operator assemble and validate a step-based pipeline before execution.
- **Route or surface:** Modal opened from the toolbox; exact title and selector unknown.
- **Primary actor:** Operator.
- **Workflow position:** Configure and start.
- **Grounded by:** The requested workflow requires creating a pipeline, creating ordered steps, and assigning ordered skills inside each step.
- **Existing patterns to reuse or respect:** Existing `.skill-modal` modal behavior, current skill model/effort controls, card-scoped skill workflow, and modal-local state.

**Required sections**

- Header: modal title, close action, and source card context.
- Source card summary: source card title/id and active ledger.
- Pipeline summary: draft name or generated label, step count, total skill count, validation status.
- Step list: ordered steps with index, name/title, skill count, and status preview.
- Step editor: selected step details and ordered skill list.
- Validation panel: missing skills, empty steps, invalid skill references, unavailable model/effort settings.
- Footer actions: cancel/close, save draft if supported, start pipeline.

**Required components**

- Modal container.
- Step list with reorder controls.
- Step row/card item with step index, name, skill count, and remove/duplicate controls if supported.
- Add step button.
- Step name input.
- Ordered skill list inside selected step.
- Add skill action that opens the Skill Picker and Skill Settings Panel.
- Skill row with skill name, order, model, effort, remove action, and reorder controls.
- Start pipeline action.
- Validation summary.
- Confirmation dialog for removing a step that contains skills, if destructive removal is supported.

**Required data fields**

- Pipeline draft id or temporary client id.
- Pipeline display name.
- Source card id and title.
- Active ledger id.
- Step id.
- Step order index.
- Step name/title.
- Step skill count.
- Skill id/name.
- Skill description or summary.
- Skill order index inside step.
- Skill model.
- Skill effort.
- Total step count `S`.
- Total skill count `K`.
- Draft validity.
- Validation errors.

**Controls and actions**

- Add step.
- Rename step.
- Reorder step up/down or drag reorder.
- Remove step with confirmation when non-empty.
- Select step for editing.
- Add skill to selected step.
- Reorder skill inside step.
- Remove skill from step.
- Edit skill model and effort.
- Start pipeline.
- Cancel/close modal.
- Disabled start when there are zero steps, an empty step, zero total skills, invalid skill references, or no source card if required.

**Navigation affordances**

- Opens from toolbox entry.
- Closes back to the same canvas state.
- After successful start, modal may close and focus generated step cards on the canvas.
- No route change, no navbar tab, and no ledger switch.

**States**

- **Empty:** New pipeline has no steps; show add-step action and disabled start.
- **Loading:** Skill list or source card context is loading; keep structural controls visible but disable start.
- **Error:** Skill discovery fails, source card cannot be found, or pipeline start request fails.
- **Permission:** No role split specified; use same permission behavior as current Codex skill execution. If unavailable, disable start and skill changes.
- **Edge cases:** One step with multiple skills; one step with one skill; many steps; empty step between valid steps; duplicate skills in one step; skill removed from discovery after selection; model/effort missing for a selected skill.

**Data requirements**

- **Source data:** Source card metadata, active ledger, discovered skills, model options, effort options.
- **Derived values:** Step count `S`, total skill count `K`, draft validity, per-step validity, start-disabled reason, step labels if unnamed.
- **Mock data needed:** A valid one-step/three-skill pipeline, a three-step pipeline with mixed skill counts, and invalid states for empty step and missing skill.
- **Facts to preserve from source:** One-step multi-skill pipeline must be valid. Former one-skill behavior must remain representable as a one-step, one-skill pipeline.

**Feature mapping**

- Covers ordered pipeline steps.
- Covers ordered skills inside each step.
- Covers configuration before backend orchestration exists.
- Keeps pipeline builder modal-local and separate from ledger routing.

#### Screen: `Skill Picker and Skill Settings Panel`

- **Purpose:** Let the operator choose one valid Codex skill and configure its run settings before inserting it into a step.
- **Route or surface:** Nested panel, drawer, or sub-dialog inside the Pipeline Builder Modal.
- **Primary actor:** Operator.
- **Workflow position:** Configure a skill within a selected step.
- **Grounded by:** Existing `Codex Skills` modal supports search, category filters, skill selection, model, effort, and one process action; pipeline needs repeated skill selection into ordered step lists.
- **Existing patterns to reuse or respect:** Existing skill search/filter UI, skill descriptions, model control, effort control, and skill discovery data.

**Required sections**

- Search and filters: find skills by name/category.
- Skill results: list discovered skills with descriptions.
- Selected skill detail: selected skill name, description, source/category if available.
- Run settings: model and effort for this skill.
- Placement summary: selected step name/index and insertion position.
- Add action: add selected skill to the selected step.

**Required components**

- Search input.
- Category filter controls.
- Skill result list.
- Skill result item.
- Selected skill detail panel.
- Model selector.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-18","timestamp":"2026-07-08T07:34:14.976Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"18","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc 'wc -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'wc -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-19","timestamp":"2026-07-08T07:34:14.976Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"19","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc 'wc -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'wc -l /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'`
Status: completed
Exit code: 0

````text
512 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-20","timestamp":"2026-07-08T07:34:18.978Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"20","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_11"} -->

The first readback is clean, and the file is 512 lines. I’m checking the tail as well to verify the handoff section is present.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-21","timestamp":"2026-07-08T07:34:18.978Z","status":"in_progress","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"21","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc 'tail -n 120 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'tail -n 120 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-22","timestamp":"2026-07-08T07:34:18.978Z","status":"completed","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"22","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc 'tail -n 120 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'tail -n 120 /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md'`
Status: completed
Exit code: 0

````text
- **Mock data needed:** A three-step pipeline with five total skills, a one-step/three-skill pipeline, a failed second skill, and a completed pipeline with resized content.
- **Facts to preserve from source:** Current backend creates one output card per skill, but the updated model requires one card per step while multiple skills may run against the same step card.

**Feature mapping**

- Covers the `S` step cards acceptance signal.
- Shows sequential per-skill progress at step-card level.
- Preserves existing card/canvas surfaces instead of inventing a pipeline route.
- Supports existing card resize behavior after Codex content changes.

#### Screen: `Step Card Run Detail and Thread Status`

- **Purpose:** Let the operator inspect the sequence of independent Codex runs attached to one step card, including run IDs, logs, events, failures, and final content.
- **Route or surface:** Existing card detail, card tabs, thread panel, or run widget surface; exact route unknown.
- **Primary actor:** Operator.
- **Workflow position:** Inspect, verify, cancel, or diagnose.
- **Grounded by:** Existing run reader derives progress from JSONL/log files and persists run events into the output card thread; acceptance requires `K` distinct run IDs/logs.
- **Existing patterns to reuse or respect:** Existing Codex run widgets, card thread event rendering, `Description` / `Fields` card tabs, and current one-run polling behavior.

**Required sections**

- Step identity: step card title/id, pipeline id, step order.
- Skill run timeline: ordered list of skill runs for the step.
- Active run detail: current skill, run id, process status, start/end timestamps when available.
- Logs and events: links or summaries for JSONL/log-derived progress and thread notes.
- Output content: current step card Markdown after each completed skill or final output.
- Failure/cancellation area: visible reason and recovery action if available.

**Required components**

- Card detail/header component.
- Run timeline list.
- Run status widget per skill or active/latest skill.
- Thread event list.
- Log link or log summary row.
- Card field tab content if pipeline metadata is exposed as fields.
- Cancel active run action if supported.
- Retry/resume controls only if later specified; otherwise show unresolved.

**Required data fields**

- Step card id.
- Pipeline id.
- Step id.
- Step order.
- Skill order.
- Skill name.
- Run id.
- JSONL path or log reference.
- Stderr log reference.
- Run status: pending, running, succeeded, failed, cancelled.
- Start timestamp.
- End timestamp.
- Exit code or error reason if available.
- Thread event id/content/timestamp.
- Final output card content path.

**Controls and actions**

- Open log detail or reveal log reference.
- Cancel active run if the active run is still owned by the server runtime.
- Refresh run status.
- Open source card or previous/next step card if relationships exist.
- Copy run id or log reference if supported.
- Disabled cancel for completed, failed, pending, or restart-orphaned runs.

**Navigation affordances**

- Open from selecting a step card or interacting with its run widget/thread.
- Return to canvas.
- Cross-link to source card and adjacent step cards when relationships are available.
- No standalone route required by the source.

**States**

- **Empty:** Step card exists but no run has started yet.
- **Loading:** Run status is being read from JSONL/log files.
- **Error:** Run status cannot be read, log path missing, thread event persistence fails, or backend returns unknown run.
- **Permission:** No role split specified; assume same operator controls as existing run widget/cancellation behavior.
- **Edge cases:** Multiple run ids attached to one step card; failed run blocks the next skill; cancelled active run leaves pending skills; server restart loses in-memory cancellation ownership; later skill prompt context unresolved; thread contains events from multiple skills.

**Data requirements**

- **Source data:** Per-skill run records, JSONL/log files, thread events, card content, pipeline/step metadata.
- **Derived values:** Current skill index, next skill eligibility, step-level status from child run statuses, duration per run, total progress count.
- **Mock data needed:** Running first skill, completed first skill with second queued, failed second skill, cancelled run, completed all skills with final content.
- **Facts to preserve from source:** Each skill must have a distinct process, run ID, stdout JSONL, stderr log, status record, and widget/thread behavior.

**Feature mapping**

- Covers the `K` distinct Codex run IDs/logs acceptance signal.
- Covers strict sequential execution visibility: skill `n + 1` starts only after skill `n` completes.
- Surfaces current limitations around cancellation and restart recovery without inventing implementation behavior.

## 7. Cross-Screen Coverage Check

- **Primary workflow:** Covered from canvas/toolbox entry, through modal configuration, skill selection, pipeline start, generated step cards, and run detail inspection.
- **Secondary workflows:** Covered for one-step/one-skill legacy equivalent, one-step/multi-skill pipeline, multi-step pipeline, skill removal/reorder, and run inspection.
- **Entry and exit points:** Entry is toolbox/canvas. Exits return to the same canvas. No new ledger route or navbar tab is introduced.
- **Empty states:** Covered for no selected source card, no pipeline steps, no skills discovered, no generated step cards, and no run started.
- **Loading states:** Covered for source/skill metadata loading, pipeline start, card creation, content refresh, and run status polling.
- **Error states:** Covered for skill discovery failure, invalid selected skill, source card lookup failure, pipeline start failure, card creation failure, run/log read failure, skill run failure, and cancellation limitations.
- **Permission states:** No source role split exists. Plan assumes the same operator permission model as current Codex skill execution and marks restricted behavior as future-gated.
- **Role differences:** Only the operator role is specified; headless Codex is represented as backend/system execution, not as a separate UI role.
- **Data dependencies:** Covered for active ledger, source card, skill metadata, model/effort options, pipeline draft, steps, skills, step cards, relationships, run ids, JSONL/log references, thread events, and card content.
- **Edge cases named by the source:** Covered for one-step multi-skill pipeline, old one-skill behavior as one-skill step, one card per step, multiple independent Codex sessions per step, sequential run gating, pending pipeline queue uncertainty, and cancellation/restart uncertainty.
- **Existing screen or component reuse:** Covered for toolbox rail, `.skill-modal` patterns, existing canvas cards, card fields/tabs, Codex run widgets, card thread events, relationships, and card resize behavior.

## 8. Handoff to Visual Mockup Skill

The screen list is ready for first-pass visual mockups. Mock these first:

1. `Pipeline Builder Modal`
2. `Skill Picker and Skill Settings Panel`
3. `Generated Step Cards on Canvas`
4. `Step Card Run Detail and Thread Status`

The mockups should respect existing Decision OS surfaces: browser canvas, toolbox rail, modal-local workflows, current skill modal content patterns, card components, card field/thread/run-widget surfaces, and ledger tab routing constraints.

Before final implementation-grade mockups, resolve these product facts: exact toolbox/modal labels, whether the existing `.skill-modal` is extended or a new modal is introduced, durable pipeline schema, step-card creation timing, prompt context for later skills, cancellation behavior, and queue/restart recovery behavior.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-23","timestamp":"2026-07-08T07:34:28.019Z","status":"Codex message","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"23","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_13"} -->

Done. I wrote the screen-content plan to [card-codex-skill-1783495869207-759e2295.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/tasks-system/card-codex-skill-1783495869207-759e2295.md).

I verified the file contains the full handoff structure: source summary, confirmed facts, assumptions, screen inventory, per-screen definitions, coverage check, and visual mockup handoff. Source card and ledger JSON were not edited.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783495869207-759e2295-line-24","timestamp":"2026-07-08T07:34:28.019Z","status":"complete","codexRunId":"codex-skill-1783495869207-759e2295","codexLine":"24","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.
