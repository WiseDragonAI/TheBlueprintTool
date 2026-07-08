# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-1","timestamp":"2026-07-08T04:41:10.718Z","status":"running","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-2","timestamp":"2026-07-08T04:41:10.718Z","status":"running","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-3","timestamp":"2026-07-08T04:43:25.106Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’m using `skill-creator` for this run because the card is asking for a Codex skill definition. I’ll keep the work scoped to the requested output Markdown card and leave the source card and ledgers untouched.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-4","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc pwd"} -->

**Tool call** `/usr/bin/zsh -lc pwd`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-5","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc pwd","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc pwd`
Status: completed
Exit code: 0

````text
/home/jbb/dev/EditorBP/decision-os
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-6","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"6","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc 'ls -la .decision-os/cards/skills'"} -->

**Tool call** `/usr/bin/zsh -lc 'ls -la .decision-os/cards/skills'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-7","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"7","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc 'ls -la .decision-os/cards/skills'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'ls -la .decision-os/cards/skills'`
Status: completed
Exit code: 0

````text
total 40
drwxrwxr-x 2 jbb jbb  4096 Jul  8 11:41 .
drwxrwxr-x 7 jbb jbb  4096 Jul  8 00:06 ..
-rw-rw-r-- 1 jbb jbb  4161 Jul  8 11:30 card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md
-rw-rw-r-- 1 jbb jbb 10241 Jul  8 01:04 card-9a1d7843-0bf4-47e8-b6df-cbc4e5571e39.md
-rw-rw-r-- 1 jbb jbb  5079 Jul  8 01:19 card-codex-skill-1783448349580-e919e6f8.md
-rw-rw-r-- 1 jbb jbb   151 Jul  8 11:41 card-codex-skill-1783485668635-1989a1e2.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-8","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"8","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"if [ -f .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md ]; then sed -n '1,240p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md; fi\""} -->

**Tool call** `/usr/bin/zsh -lc "if [ -f .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md ]; then sed -n '1,240p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md; fi"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-9","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"9","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"if [ -f .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md ]; then sed -n '1,240p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md; fi\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "if [ -f .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md ]; then sed -n '1,240p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md; fi"`
Status: completed
Exit code: 0

````text
# skill-creator result

Status: processing

Source card: New card
Codex run: codex-skill-1783485668635-1989a1e2
Codex model: gpt-5.5
Codex effort: high
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-10","timestamp":"2026-07-08T04:43:25.106Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"10","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_4"} -->

The target result card currently only has a processing stub. I’m going to replace it with a complete, reusable skill package proposal: recommended folder name, trigger metadata, `SKILL.md` content, and validation notes.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-11","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"11","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-12","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"12","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md"`
Status: completed
Exit code: 0

````text
# Planning Skill Inventory: Operator Context

Allowed source set: source card `card-9a1d7843-0bf4-47e8-b6df-cbc4e5571e39`, `Planning Skill Inventory`.

Reader: operator choosing which planning or execution skill to use for a broad goal, weak ticket, product decomposition, feature plan, bug plan, or executor-led implementation scaffold.

---

## 1. What is this for?

1. **This inventory prevents using one planning skill for every job.** The source separates goal normalization, ticket improvement, product decomposition, feature planning, bug RCA, OpenSpec task creation, executor scaffolding, and downstream implementation.
2. **The key correction is that earlier findings must be merged, not replaced.** `ticket-solver`, `openticket`, `improveticket`, `product-analysis`, and the executor skills remain part of the planning inventory.
3. **The operator choice depends on the desired workflow state.** Use local Codex skills for operator-facing issue preparation, OpenSpec skills for artifact-driven task lists, DroidFactory roles for GitLab pipeline progression, and executor skills for local implementation ledgers.
4. **`ticket-solver` is not the broad-goal starting point.** It belongs after a ticket exists and can then create a working DAG, implement, test, and report evidence.

---

## 2. Which entry point should the operator choose?

1. **Broad operator problem to approved GitLab issue:** use `openticket`. It performs code-first analysis, drafts requirements, scope, impact, blockers, DAG, and acceptance checks, then opens the issue after approval.
2. **Existing weak issue:** use `improveticket` locally, or `ticket/improver` in DroidFactory. Both normalize the issue; the Factory role also classifies it into `feature` or `bug` pipeline flow.
3. **OpenSpec goal to task list:** use `openspec-ff-change`. It creates the OpenSpec artifact sequence through `tasks.md`, which is the implementation checklist.
4. **Product goal that must become many tickets:** use the DroidFactory product and epic chain, ending in feature issues that can enter feature planning.
5. **Single feature or bug already scoped:** use `feature/analyzer -> feature/planner` for feature work, and `bug/rca` for bug work.

---

## 3. How are the planning systems shaped?

1. **Local Codex planning prepares or upgrades work.** `openticket`, `improveticket`, and `product-analysis` help define the problem or issue before downstream execution.
2. **OpenSpec planning creates ordered artifacts.** The planning path runs from proposal to spec to design to `tasks.md`; `openspec-apply-change` executes only after that structure exists.
3. **DroidFactory planning is label-driven.** Product, epic, feature, bug, research, and refactor pipelines progress through labeled stages and role-specific outputs.
4. **Executor planning is ledger-driven.** `executor-precheck`, `executor-stack`, and `executor-spec` build toward a `Master Ledger`; `executor-implement` consumes that ledger rather than inventing architecture.

---

## 4. What are the main handoffs?

1. **Factory broad-goal chain:** `ticket/improver -> product/analyzer/RFC/architecture/PRD -> product/decomposer -> epic/analyzer/architect/quality-planner -> epic/decomposer -> feature/analyzer -> feature/planner -> feature/implementer`.
2. **Product decomposition handoff:** `product/decomposer` creates child epics; `epic/decomposer` creates child feature tickets.
3. **Feature planning handoff:** `feature/analyzer` maps intent to code evidence, then `feature/planner` produces the implementation plan and `Ideal Control-flow DAG`.
4. **Bug planning handoff:** `bug/rca` produces reproduction status, trace, root cause, fix scope, fix DAG, regression test plan, and fixer checklist before implementation.

---

## 5. What constraints affect use?

1. **Do not treat analysis-only skills as implementers.** `product-analysis`, `openspec-explore`, research stages, and analyzer roles build evidence or plans but do not execute.
2. **Do not ask implementation skills to infer missing planning structure.** `executor-implement`, `openspec-apply-change`, and `ticket-solver` should consume prepared plans, tickets, artifacts, or ledgers.
3. **Use Factory when GitLab issues and labels are the workflow state.** Use executor skills when the desired output is a local `Master Ledger` implementation scaffold.
4. **For bugs, start with RCA rather than feature planning.** The source identifies `bug/rca` as the bug planner because it produces the fix DAG and regression test plan.

---

## 6. Evidence index

1. **Sections A-B:** correction boundary, merged source set, local Codex skills, executor roles, and `ticket-solver` placement.
2. **Section C:** OpenSpec artifact flow and `openspec-ff-change` as the strongest goal-to-`tasks.md` path.
3. **Sections D-E:** DroidFactory role outputs and label-based product, epic, feature, bug, research, and refactor pipelines.
4. **Section F:** extracted decisions naming the best skill for each operator scenario and the correct broad-goal DroidFactory chain.
---

Codex run completed: exit code 0
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-13","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"13","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-14","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"14","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md"`
Status: completed
Exit code: 0

````text
## A. Goal

1. **Skill purpose:** Create a Codex skill that turns an analysis card into a complete screen-content plan for future mockups.
2. **Primary outcome:** The skill must determine which screens are needed, what each screen must contain, and what source data is still missing before visual mockup creation begins.
3. **Workflow position:** This is the first skill in a two-skill workflow. It prepares screen definitions only; the visual mockup creation skill is out of scope and will be specified later.

---

## B. Input Contract

1. **Required source:** The skill starts from one analysis card or equivalent card content that describes the requested product change, stack context, implementation plan, current UX context, and relevant constraints.
2. **Stack alignment:** The skill must extract or request the active tech stack, UI framework, component system, routing model, data-loading pattern, and any design constraints that affect screen content.
3. **Existing product alignment:** The skill must account for existing screens, existing features, current user flows, reusable UI patterns, and already-defined product behavior.
4. **Plan alignment:** The skill must use the provided implementation or product plan to understand which workflows, states, roles, and edge cases need screen coverage.

---

## C. Clarification Rules

1. **Screen count check:** The skill must infer the number of screens when the analysis content is sufficient, and must ask focused questions when the number of screens cannot be determined confidently.
2. **Missing data check:** The skill must identify missing information that would change screen content, including user roles, feature boundaries, route names, data entities, states, permissions, and existing UI references.
3. **Question discipline:** The skill should ask only questions that block accurate screen definition. It should not ask for visual style details reserved for the later mockup creation skill.
4. **Assumption handling:** When a decision is low-risk and implied by the analysis card, the skill may state the assumption and continue instead of blocking.

---

## D. Screen Definition Output

1. **Screen inventory:** The skill must output the final list of screens, including each screen name, purpose, route or surface when known, primary actor, and workflow position.
2. **Per-screen content:** For every screen, the skill must define the required sections, components, data fields, controls, navigation affordances, empty states, loading states, error states, and permission states.
3. **Data requirements:** For every screen, the skill must identify required data sources, derived values, mock data needs, and any source facts that must be preserved from the analysis card.
4. **Feature mapping:** Every screen must map back to the relevant feature, requirement, or workflow from the analysis card so the later visual mockup skill has traceable intent.
5. **Reuse guidance:** The skill must name existing screens, components, or patterns that should be reused or respected when producing visual mockups later.

---

## E. Out Of Scope

1. **No visual mockups:** This skill must not generate final UI mockups, image assets, high-fidelity layouts, or visual styling systems.
2. **No implementation:** This skill must not edit product code, scaffold components, or implement routes.
3. **No detached invention:** This skill must not invent screens that are unrelated to the analysis card, current stack, current feature set, or existing workflows.

---

## F. Acceptance Criteria

1. **Completeness:** The output gives enough screen-by-screen content detail for a separate visual mockup skill to generate mockups without rediscovering product intent.
2. **Grounding:** Each proposed screen is grounded in the analysis card, existing product context, stack constraints, or an explicitly stated assumption.
3. **Clarified scope:** Any unresolved blockers are listed as concrete questions, and non-blocking assumptions are separated from confirmed facts.
4. **Two-skill boundary:** The final output clearly hands off to a later visual mockup creation skill without doing that visual work itself.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-15","timestamp":"2026-07-08T04:43:25.106Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"15","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_7"} -->

I’m going to write the result as an operator-ready skill specification rather than installing a new skill folder, because the explicit requested artifact is the decision-os result Markdown file. The result will include the complete `SKILL.md` content so it can be installed later without reinterpreting the source card.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-16","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"16","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_8"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: delete

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-17","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"17","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_8"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: delete

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-18","timestamp":"2026-07-08T04:43:25.106Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"18","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_9"} -->

The stub has been removed. I’m adding the final Markdown result now with the skill name, trigger metadata, full skill body, and a concise installation/validation note.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-19","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"19","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_10"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-20","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"20","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_10"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-21","timestamp":"2026-07-08T04:43:25.106Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"21","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_11"} -->

The result file is in place. I’m doing a quick validation pass now: checking the Markdown content and whether the referenced skill-creator helper scripts exist, so the handoff does not point to a bad command.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-22","timestamp":"2026-07-08T04:43:25.106Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"22","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-23","timestamp":"2026-07-08T04:43:25.106Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"23","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: completed
Exit code: 0

`````text
# Screen Content Planning Skill

Allowed source set: source card `card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93`, `New card`.

Result type: Codex skill definition for turning one analysis card into a complete screen-content plan for later visual mockup creation.

Recommended skill name: `screen-content-planner`

Recommended skill folder: `${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner`

Resource decision: v1 needs only `SKILL.md`. No scripts, references, or assets are required because the work is reasoning-heavy, source-dependent, and output-format driven.

---

## Complete `SKILL.md`

````markdown
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

---

## Suggested `agents/openai.yaml` Values

These values can be passed to `scripts/init_skill.py` or `scripts/generate_openai_yaml.py` with `--interface key=value` if the skill is installed later.

```yaml
display_name: Screen Content Planner
short_description: Convert analysis cards into screen-by-screen content plans for mockups.
default_prompt: Turn this analysis card into a complete screen-content plan for future mockups.
```

---

## Installation Command

If the operator wants to install the skill into the default Codex skills directory:

```bash
/home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface display_name="Screen Content Planner" --interface short_description="Convert analysis cards into screen-by-screen content plans for mockups." --interface default_prompt="Turn this analysis card into a complete screen-content plan for future mockups."
```

Then replace the generated `SKILL.md` with the content above and run:

```bash
/home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner"
```

---

## Operator Handoff

This result defines the first skill in the requested two-skill workflow. It prepares grounded screen definitions only. The later visual mockup creation skill should consume the `Screen Inventory`, `Per-Screen Definitions`, `Cross-Screen Coverage Check`, and `Handoff to Visual Mockup Skill` sections produced by this skill, then create visual artifacts from that structured plan.

No visual mockup instructions, product implementation steps, or unrelated screen inventions are included.
`````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-24","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"24","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_13","codexTool":"/usr/bin/zsh -lc 'ls -la /home/jbb/.codex/skills/.system/skill-creator/scripts'"} -->

**Tool call** `/usr/bin/zsh -lc 'ls -la /home/jbb/.codex/skills/.system/skill-creator/scripts'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-25","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"25","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_13","codexTool":"/usr/bin/zsh -lc 'ls -la /home/jbb/.codex/skills/.system/skill-creator/scripts'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'ls -la /home/jbb/.codex/skills/.system/skill-creator/scripts'`
Status: completed
Exit code: 0

````text
total 40
drwxrwxr-x 3 jbb jbb  4096 Jul  7 11:19 .
drwxrwxr-x 6 jbb jbb  4096 Jul  5 21:01 ..
drwxrwxr-x 2 jbb jbb  4096 Jul  7 11:19 __pycache__
-rw-rw-r-- 1 jbb jbb  6619 Jul  5 21:01 generate_openai_yaml.py
-rw-rw-r-- 1 jbb jbb 14602 Jul  5 21:01 init_skill.py
-rw-rw-r-- 1 jbb jbb  3293 Jul  5 21:01 quick_validate.py
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-26","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"26","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_14","codexTool":"/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-27","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"27","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_14","codexTool":"/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'`
Status: completed
Exit code: 0

````text
?? .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md
?? .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-28","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"28","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_15"} -->

The helper scripts exist, but they are not executable on disk. I’m correcting the installation commands to call them through `python3`, which is the reliable form in this workspace.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-29","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"29","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_16"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-30","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"30","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_16"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-31","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"31","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_17","codexTool":"/usr/bin/zsh -lc \"sed -n '190,245p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '190,245p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-32","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"32","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_17","codexTool":"/usr/bin/zsh -lc \"sed -n '190,245p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '190,245p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: completed
Exit code: 0

`````text
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

---

## Suggested `agents/openai.yaml` Values

These values can be passed to `scripts/init_skill.py` or `scripts/generate_openai_yaml.py` with `--interface key=value` if the skill is installed later.

```yaml
display_name: Screen Content Planner
short_description: Convert analysis cards into screen-by-screen content plans for mockups.
default_prompt: Turn this analysis card into a complete screen-content plan for future mockups.
```

---

## Installation Command

If the operator wants to install the skill into the default Codex skills directory:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface display_name="Screen Content Planner" --interface short_description="Convert analysis cards into screen-by-screen content plans for mockups." --interface default_prompt="Turn this analysis card into a complete screen-content plan for future mockups."
```

Then replace the generated `SKILL.md` with the content above and run:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner"
```

---
`````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-33","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"33","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_18","codexTool":"/usr/bin/zsh -lc \"python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help | sed -n '1,160p'\""} -->

**Tool call** `/usr/bin/zsh -lc "python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help | sed -n '1,160p'"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-34","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"34","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_18","codexTool":"/usr/bin/zsh -lc \"python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help | sed -n '1,160p'\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help | sed -n '1,160p'"`
Status: completed
Exit code: 0

````text
usage: init_skill.py [-h] --path PATH [--resources RESOURCES] [--examples]
                     [--interface INTERFACE]
                     skill_name

Create a new skill directory with a SKILL.md template.

positional arguments:
  skill_name            Skill name (normalized to hyphen-case)

options:
  -h, --help            show this help message and exit
  --path PATH           Output directory for the skill
  --resources RESOURCES
                        Comma-separated list: scripts,references,assets
  --examples            Create example files inside the selected resource
                        directories
  --interface INTERFACE
                        Interface override in key=value format (repeatable)
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-35","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"35","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_19","codexTool":"/usr/bin/zsh -lc 'git diff -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'git diff -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-36","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"36","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_19","codexTool":"/usr/bin/zsh -lc 'git diff -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git diff -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md'`
Status: completed
Exit code: 0

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-37","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"37","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_20"} -->

Done. I wrote the final skill definition result to [card-codex-skill-1783485668635-1989a1e2.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md).

I kept the source card and ledger JSON untouched. I also checked the referenced `skill-creator` helper script interface and adjusted the install commands to use `python3`, since those scripts are not executable on disk.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-38","timestamp":"2026-07-08T05:12:28.707Z","status":"complete","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"38","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-39","timestamp":"2026-07-08T05:12:28.707Z","status":"running","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"39","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-40","timestamp":"2026-07-08T05:12:28.707Z","status":"running","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"40","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-41","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"41","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’ll create the approved `screen-content-planner` skill now using the `skill-creator` workflow, then validate it. I’ll install it under the default Codex skills directory unless an existing folder forces a careful update path.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-42","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"42","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-43","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"43","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations.
metadata:
  short-description: Create or update a skill
---

# Skill Creator

This skill provides guidance for creating effective skills.

## About Skills

Skills are modular, self-contained folders that extend Codex's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform Codex from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else Codex needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: Codex is already very smart.** Only add context Codex doesn't already have. Challenge each piece of information: "Does Codex really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

**High freedom (text-based instructions)**: Use when multiple approaches are valid, decisions depend on context, or heuristics guide the approach.

**Medium freedom (pseudocode or scripts with parameters)**: Use when a preferred pattern exists, some variation is acceptable, or configuration affects behavior.

**Low freedom (specific scripts, few parameters)**: Use when operations are fragile and error-prone, consistency is critical, or a specific sequence must be followed.

Think of Codex as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

### Protect Validation Integrity

You may use subagents during iteration to validate whether a skill works on realistic tasks or whether a suspected problem is real. This is most useful when you want an independent pass on the skill's behavior, outputs, or failure modes after a revision.  Only do this when it is possible to start new subagents.

When using subagents for validation, treat that as an evaluation surface. The goal is to learn whether the skill generalizes, not whether another agent can reconstruct the answer from leaked context.

Prefer raw artifacts such as example prompts, outputs, diffs, logs, or traces. Give the minimum task-local context needed to perform the validation. Avoid passing the intended answer, suspected bug, intended fix, or your prior conclusions unless the validation explicitly requires them.

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
├── agents/ (recommended)
│   └── openai.yaml - UI metadata for skill lists and chips
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields. These are the only fields that Codex reads to determine when the skill gets used, thus it is very important to be clear and comprehensive in describing what the skill is, and when it should be used.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the skill triggers (if at all).

#### Agents metadata (recommended)

- UI-facing metadata for skill lists and chips
- Read references/openai_yaml.md before generating values and follow its descriptions and constraints
- Create: human-facing `display_name`, `short_description`, and `default_prompt` by reading the skill
- Generate deterministically by passing the values as `--interface key=value` to `scripts/generate_openai_yaml.py` or `scripts/init_skill.py`
- On updates: validate `agents/openai.yaml` still matches SKILL.md; regenerate if stale
- Only include other optional interface fields (icons, brand color) if explicitly provided
- See references/openai_yaml.md for field definitions and examples

#### Bundled Resources (optional)

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, may be executed without loading into context
- **Note**: Scripts may still need to be read by Codex for patching or environment-specific adjustments

##### References (`references/`)

Documentation and reference material intended to be loaded as needed into context to inform Codex's process and thinking.

- **When to include**: For documentation that Codex should reference while working
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for company NDA template, `references/policies.md` for company policies, `references/api_docs.md` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when Codex determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both. Prefer references files for detailed information unless it's truly core to the skill—this keeps SKILL.md lean while making information discoverable without hogging the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to references files.

##### Assets (`assets/`)

Files not intended to be loaded into context, but rather used within the output Codex produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates, `assets/frontend-template/` for HTML/React boilerplate, `assets/font.ttf` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified
- **Benefits**: Separates output resources from documentation, enables Codex to use files without loading them into context

#### What to Not Include in a Skill

A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- etc.

The skill should only contain the information needed for an AI agent to do the job at hand. It should not contain auxiliary context about the process that went into creating it, setup and testing procedures, user-facing documentation, etc. Creating additional documentation files just adds clutter and confusion.

### Progressive Disclosure Design Principle

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Codex (Unlimited because scripts can be executed without reading into context window)

#### Progressive Disclosure Patterns

Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat. Split content into separate files when approaching this limit. When splitting out content into other files, it is very important to reference them from SKILL.md and describe clearly when to read them, to ensure the reader of the skill knows they exist and when to use them.

**Key principle:** When a skill supports multiple variations, frameworks, or options, keep only the core workflow and selection guidance in SKILL.md. Move variant-specific details (patterns, examples, configuration) into separate reference files.

**Pattern 1: High-level guide with references**

```markdown
# PDF Processing

## Quick start

Extract text with pdfplumber:
[code example]

## Advanced features

- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
- **Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

Codex loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

**Pattern 2: Domain-specific organization**

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context:

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

When a user asks about sales metrics, Codex only reads sales.md.

Similarly, for skills supporting multiple frameworks or variants, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

When the user chooses AWS, Codex only reads aws.md.

**Pattern 3: Conditional details**

Show basic content, link to advanced content:

```markdown
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

Codex reads REDLINING.md or OOXML.md only when the user needs those features.

**Important guidelines:**

- **Avoid deeply nested references** - Keep references one level deep from SKILL.md. All reference files should link directly from SKILL.md.
- **Structure longer reference files** - For files longer than 100 lines, include a table of contents at the top so Codex can see the full scope when previewing.

## Skill Creation Process

Skill creation involves these steps:

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (run init_skill.py)
4. Edit the skill (implement resources and write SKILL.md)
5. Validate the skill (run quick_validate.py)
6. Iterate based on real usage and forward-test complex skills.

Follow these steps in order, skipping only if there is a clear reason why they are not applicable.

### Skill Naming

- Use lowercase letters, digits, and hyphens only; normalize user-provided titles to hyphen-case (e.g., "Plan Mode" -> `plan-mode`).
- When generating names, generate a name under 64 characters (letters, digits, hyphens).
- Prefer short, verb-led phrases that describe the action.
- Namespace by tool when it improves clarity or triggering (e.g., `gh-address-comments`, `linear-address-issue`).
- Name the skill folder exactly after the skill name.

### Step 1: Understanding the Skill with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood. It remains valuable even when working with an existing skill.

To create an effective skill, clearly understand concrete examples of how the skill will be used. This understanding can come from either direct user examples or generated examples that are validated with user feedback.

For example, when building an image-editor skill, relevant questions include:

- "What functionality should the image-editor skill support? Editing, rotating, anything else?"
- "Can you give some examples of how this skill would be used?"
- "I can imagine users asking for things like 'Remove the red-eye from this image' or 'Rotate this image'. Are there other ways you imagine this skill being used?"
- "What would a user say that should trigger this skill?"
- "Where should I create this skill? If you do not have a preference, I will place it in `$CODEX_HOME/skills` (or `~/.codex/skills` when `CODEX_HOME` is unset) so Codex can discover it automatically."

To avoid overwhelming users, avoid asking too many questions in a single message. Start with the most important questions and follow up as needed for better effectiveness.

Conclude this step when there is a clear sense of the functionality the skill should support.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-44","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"44","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/references/openai_yaml.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/references/openai_yaml.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-45","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"45","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/references/openai_yaml.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/.system/skill-creator/references/openai_yaml.md"`
Status: completed
Exit code: 0

````text
# openai.yaml fields (full example + descriptions)

`agents/openai.yaml` is an extended, product-specific config intended for the machine/harness to read, not the agent. Other product-specific config can also live in the `agents/` folder.

## Full example

```yaml
interface:
  display_name: "Optional user-facing name"
  short_description: "Optional user-facing description"
  icon_small: "./assets/small-400px.png"
  icon_large: "./assets/large-logo.svg"
  brand_color: "#3B82F6"
  default_prompt: "Optional surrounding prompt to use the skill with"

dependencies:
  tools:
    - type: "mcp"
      value: "github"
      description: "GitHub MCP server"
      transport: "streamable_http"
      url: "https://api.githubcopilot.com/mcp/"

policy:
  allow_implicit_invocation: true
```

## Field descriptions and constraints

Top-level constraints:

- Quote all string values.
- Keep keys unquoted.
- For `interface.default_prompt`: generate a helpful, short (typically 1 sentence) example starting prompt based on the skill. It must explicitly mention the skill as `$skill-name` (e.g., "Use $skill-name-here to draft a concise weekly status update.").

- `interface.display_name`: Human-facing title shown in UI skill lists and chips.
- `interface.short_description`: Human-facing short UI blurb (25–64 chars) for quick scanning.
- `interface.icon_small`: Path to a small icon asset (relative to skill dir). Default to `./assets/` and place icons in the skill's `assets/` folder.
- `interface.icon_large`: Path to a larger logo asset (relative to skill dir). Default to `./assets/` and place icons in the skill's `assets/` folder.
- `interface.brand_color`: Hex color used for UI accents (e.g., badges).
- `interface.default_prompt`: Default prompt snippet inserted when invoking the skill.
- `dependencies.tools[].type`: Dependency category. Only `mcp` is supported for now.
- `dependencies.tools[].value`: Identifier of the tool or dependency.
- `dependencies.tools[].description`: Human-readable explanation of the dependency.
- `dependencies.tools[].transport`: Connection type when `type` is `mcp`.
- `dependencies.tools[].url`: MCP server URL when `type` is `mcp`.
- `policy.allow_implicit_invocation`: When false, the skill is not injected into
  the model context by default, but can still be invoked explicitly via `$skill`.
  Defaults to true.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-46","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"46","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc 'if [ -e \"${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner\" ]; then find \"${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner\" -maxdepth 3 -type f -print | sort; else echo '\"'missing'; fi\""} -->

**Tool call** `/usr/bin/zsh -lc 'if [ -e "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner" ]; then find "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner" -maxdepth 3 -type f -print | sort; else echo '"'missing'; fi"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-47","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"47","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc 'if [ -e \"${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner\" ]; then find \"${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner\" -maxdepth 3 -type f -print | sort; else echo '\"'missing'; fi\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'if [ -e "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner" ]; then find "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner" -maxdepth 3 -type f -print | sort; else echo '"'missing'; fi"`
Status: completed
Exit code: 0

````text
missing
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-48","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"48","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_4"} -->

The destination folder does not exist, so this is a clean creation. I also found one metadata constraint: the default prompt should explicitly mention `$screen-content-planner`, so I’ll bake that into the generated `agents/openai.yaml`.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-49","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"49","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"sed -n '261,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '261,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-50","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"50","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_5","codexTool":"/usr/bin/zsh -lc \"sed -n '261,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '261,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md"`
Status: completed
Exit code: 0

````text
### Step 2: Planning the Reusable Skill Contents

To turn concrete examples into an effective skill, analyze each example by:

1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful when executing these workflows repeatedly

Example: When building a `pdf-editor` skill to handle queries like "Help me rotate this PDF," the analysis shows:

1. Rotating a PDF requires re-writing the same code each time
2. A `scripts/rotate_pdf.py` script would be helpful to store in the skill

Example: When designing a `frontend-webapp-builder` skill for queries like "Build me a todo app" or "Build me a dashboard to track my steps," the analysis shows:

1. Writing a frontend webapp requires the same boilerplate HTML/React each time
2. An `assets/hello-world/` template containing the boilerplate HTML/React project files would be helpful to store in the skill

Example: When building a `big-query` skill to handle queries like "How many users have logged in today?" the analysis shows:

1. Querying BigQuery requires re-discovering the table schemas and relationships each time
2. A `references/schema.md` file documenting the table schemas would be helpful to store in the skill

To establish the skill's contents, analyze each concrete example to create a list of the reusable resources to include: scripts, references, and assets.

### Step 3: Initializing the Skill

At this point, it is time to actually create the skill.

Skip this step only if the skill being developed already exists. In this case, continue to the next step.

Before running `init_skill.py`, ask where the user wants the skill created. If they do not specify a location, default to `$CODEX_HOME/skills`; when `CODEX_HOME` is unset, fall back to `~/.codex/skills` so the skill is auto-discovered.

When creating a new skill from scratch, always run the `init_skill.py` script. The script conveniently generates a new template skill directory that automatically includes everything a skill requires, making the skill creation process much more efficient and reliable.

Usage:

```bash
scripts/init_skill.py <skill-name> --path <output-directory> [--resources scripts,references,assets] [--examples]
```

Examples:

```bash
scripts/init_skill.py my-skill --path "${CODEX_HOME:-$HOME/.codex}/skills"
scripts/init_skill.py my-skill --path "${CODEX_HOME:-$HOME/.codex}/skills" --resources scripts,references
scripts/init_skill.py my-skill --path ~/work/skills --resources scripts --examples
```

The script:

- Creates the skill directory at the specified path
- Generates a SKILL.md template with proper frontmatter and TODO placeholders
- Creates `agents/openai.yaml` using agent-generated `display_name`, `short_description`, and `default_prompt` passed via `--interface key=value`
- Optionally creates resource directories based on `--resources`
- Optionally adds example files when `--examples` is set

After initialization, customize the SKILL.md and add resources as needed. If you used `--examples`, replace or delete placeholder files.

Generate `display_name`, `short_description`, and `default_prompt` by reading the skill, then pass them as `--interface key=value` to `init_skill.py` or regenerate with:

```bash
scripts/generate_openai_yaml.py <path/to/skill-folder> --interface key=value
```

Only include other optional interface fields when the user explicitly provides them. For full field descriptions and examples, see references/openai_yaml.md.

### Step 4: Edit the Skill

When editing the (newly-generated or existing) skill, remember that the skill is being created for another instance of Codex to use. Include information that would be beneficial and non-obvious to Codex. Consider what procedural knowledge, domain-specific details, or reusable assets would help another Codex instance execute these tasks more effectively.

After substantial revisions, or if the skill is particularly tricky, you should use subagents to forward-test the skill on realistic tasks or artifacts. When doing so, pass the artifact under validation rather than your diagnosis of what is wrong, and keep the prompt generic enough that success depends on transferable reasoning rather than hidden ground truth.

#### Start with Reusable Skill Contents

To begin implementation, start with the reusable resources identified above: `scripts/`, `references/`, and `assets/` files. Note that this step may require user input. For example, when implementing a `brand-guidelines` skill, the user may need to provide brand assets or templates to store in `assets/`, or documentation to store in `references/`.

Added scripts must be tested by actually running them to ensure there are no bugs and that the output matches what is expected. If there are many similar scripts, only a representative sample needs to be tested to ensure confidence that they all work while balancing time to completion.

If you used `--examples`, delete any placeholder files that are not needed for the skill. Only create resource directories that are actually required.

#### Update SKILL.md

**Writing Guidelines:** Always use imperative/infinitive form.

##### Frontmatter

Write the YAML frontmatter with `name` and `description`:

- `name`: The skill name
- `description`: This is the primary triggering mechanism for your skill, and helps Codex understand when to use the skill.
  - Include both what the Skill does and specific triggers/contexts for when to use it.
  - Include all "when to use" information here - Not in the body. The body is only loaded after triggering, so "When to Use This Skill" sections in the body are not helpful to Codex.
  - Example description for a `docx` skill: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Codex needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

Do not include any other fields in YAML frontmatter.

##### Body

Write instructions for using the skill and its bundled resources.

### Step 5: Validate the Skill

Once development of the skill is complete, validate the skill folder to catch basic issues early:

```bash
scripts/quick_validate.py <path/to/skill-folder>
```

The validation script checks YAML frontmatter format, required fields, and naming rules. If validation fails, fix the reported issues and run the command again.

### Step 6: Iterate

After testing the skill, you may detect the skill is complex enough that it requires forward-testing; or users may request improvements.

User testing often this happens right after using the skill, with fresh context of how the skill performed.

**Forward-testing and iteration workflow:**

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again
5. Forward-test if it is reasonable and appropriate

## Forward-testing

To forward-test, launch subagents as a way to stress test the skill with minimal context.
Subagents should *not* know that they are being asked to test the skill.  They should be treated as
an agent asked to perform a task by the user.  Prompts to subagents should look like:
  `Use $skill-x at /path/to/skill-x to solve problem y`
Not:
  `Review the skill at /path/to/skill-x; pretend a user asks you to...`

Decision rule for forward-testing:
  - Err on the side of forward-testing
  - Ask for approval if you think there's a risk that forward-testing would:
    * take a long time,
    * require additional approvals from the user, or
    * modify live production systems

  In these cases, show the user your proposed prompt and request (1) a yes/no decision, and
  (2) any suggested modifictions.

Considerations when forward-testing:
   - use fresh threads for independent passes
   - pass the skill, and a request in a similar way the user would.
   - pass raw artifacts, not your conclusions
   - avoid showing expected answers or intended fixes
   - rebuild context from source artifacts after each iteration
   - review the subagent's output and reasoning and emitted artifacts
   - avoid leaving artifacts the agent can find on disk between iterations;
     clean up subagents' artifacts to avoid additional contamination.

If forward-testing only succeeds when subagents see leaked context, tighten the skill or the
forward-testing setup before trusting the result.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-51","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"51","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-52","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"52","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py --help'`
Status: completed
Exit code: 0

````text
usage: init_skill.py [-h] --path PATH [--resources RESOURCES] [--examples]
                     [--interface INTERFACE]
                     skill_name

Create a new skill directory with a SKILL.md template.

positional arguments:
  skill_name            Skill name (normalized to hyphen-case)

options:
  -h, --help            show this help message and exit
  --path PATH           Output directory for the skill
  --resources RESOURCES
                        Comma-separated list: scripts,references,assets
  --examples            Create example files inside the selected resource
                        directories
  --interface INTERFACE
                        Interface override in key=value format (repeatable)
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-53","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"53","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py --help'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py --help'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-54","timestamp":"2026-07-08T05:12:28.707Z","status":"failed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"54","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py --help'","codexExitCode":"1"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py --help'`
Status: failed
Exit code: 1

````text
SKILL.md not found
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-55","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"55","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_8"} -->

The skill-creator instructions are fully loaded. I’m going to initialize the skill with no bundled resources, then replace the generated template with the approved `SKILL.md` content.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-56","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"56","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_9","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path \"${CODEX_HOME:-$HOME/.codex}/skills\" --interface display_name=\"Screen Content Planner\" --interface short_description=\"Plan mockup screen content.\" --interface default_prompt=\"Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups.\"'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface display_name="Screen Content Planner" --interface short_description="Plan mockup screen content." --interface default_prompt="Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups."'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-57","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"57","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_9","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path \"${CODEX_HOME:-$HOME/.codex}/skills\" --interface display_name=\"Screen Content Planner\" --interface short_description=\"Plan mockup screen content.\" --interface default_prompt=\"Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups.\"'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface display_name="Screen Content Planner" --interface short_description="Plan mockup screen content." --interface default_prompt="Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups."'`
Status: completed
Exit code: 0

````text
Initializing skill: screen-content-planner
   Location: /home/jbb/.codex/skills
   Resources: none (create as needed)

[OK] Created skill directory: /home/jbb/.codex/skills/screen-content-planner
[OK] Created SKILL.md
[OK] Created agents/openai.yaml

[OK] Skill 'screen-content-planner' initialized successfully at /home/jbb/.codex/skills/screen-content-planner

Next steps:
1. Edit SKILL.md to complete the TODO items and update the description
2. Create resource directories only if needed (scripts/, references/, assets/)
3. Update agents/openai.yaml if the UI metadata should differ
4. Run the validator when ready to check the skill structure
5. Forward-test complex skills with realistic user requests to ensure they work as intended
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-58","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"58","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-59","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"59","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_10","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: screen-content-planner
description: [TODO: Complete and informative explanation of what the skill does and when to use it. Include WHEN to use this skill - specific scenarios, file types, or tasks that trigger it.]
---

# Screen Content Planner

## Overview

[TODO: 1-2 sentences explaining what this skill enables]

## Structuring This Skill

[TODO: Choose the structure that best fits this skill's purpose. Common patterns:

**1. Workflow-Based** (best for sequential processes)
- Works well when there are clear step-by-step procedures
- Example: DOCX skill with "Workflow Decision Tree" -> "Reading" -> "Creating" -> "Editing"
- Structure: ## Overview -> ## Workflow Decision Tree -> ## Step 1 -> ## Step 2...

**2. Task-Based** (best for tool collections)
- Works well when the skill offers different operations/capabilities
- Example: PDF skill with "Quick Start" -> "Merge PDFs" -> "Split PDFs" -> "Extract Text"
- Structure: ## Overview -> ## Quick Start -> ## Task Category 1 -> ## Task Category 2...

**3. Reference/Guidelines** (best for standards or specifications)
- Works well for brand guidelines, coding standards, or requirements
- Example: Brand styling with "Brand Guidelines" -> "Colors" -> "Typography" -> "Features"
- Structure: ## Overview -> ## Guidelines -> ## Specifications -> ## Usage...

**4. Capabilities-Based** (best for integrated systems)
- Works well when the skill provides multiple interrelated features
- Example: Product Management with "Core Capabilities" -> numbered capability list
- Structure: ## Overview -> ## Core Capabilities -> ### 1. Feature -> ### 2. Feature...

Patterns can be mixed and matched as needed. Most skills combine patterns (e.g., start with task-based, add workflow for complex operations).

Delete this entire "Structuring This Skill" section when done - it's just guidance.]

## [TODO: Replace with the first main section based on chosen structure]

[TODO: Add content here. See examples in existing skills:
- Code samples for technical skills
- Decision trees for complex workflows
- Concrete examples with realistic user requests
- References to scripts/templates/references as needed]

## Resources (optional)

Create only the resource directories this skill actually needs. Delete this section if no resources are required.

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Codex for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Codex's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Codex should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Codex produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Not every skill requires all three types of resources.**
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-60","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"60","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_11","codexTool":"/usr/bin/zsh -lc \"sed -n '1,120p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,120p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-61","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"61","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_11","codexTool":"/usr/bin/zsh -lc \"sed -n '1,120p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,120p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: completed
Exit code: 0

````text
interface:
  display_name: "Screen Content Planner"
  short_description: "Plan mockup screen content."
  default_prompt: "Use -content-planner to turn this analysis card into a complete screen-content plan for future mockups."
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-62","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"62","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'"} -->

**Tool call** `/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-63","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"63","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_12","codexTool":"/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'`
Status: completed
Exit code: 0

````text
/home/jbb/.codex/skills/screen-content-planner/SKILL.md
/home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-64","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"64","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_13"} -->

The initializer exposed a shell quoting issue in `agents/openai.yaml`: `$screen-content-planner` was expanded by the shell. I’m patching that metadata and replacing the placeholder `SKILL.md` with the final skill instructions.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-65","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"65","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_14"} -->

- /home/jbb/.codex/skills/screen-content-planner/SKILL.md: delete

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-66","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"66","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_14"} -->

- /home/jbb/.codex/skills/screen-content-planner/SKILL.md: delete

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-67","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"67","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_15"} -->

The generated placeholder `SKILL.md` is removed. I’m adding the finished version now.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-68","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"68","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_16"} -->

- /home/jbb/.codex/skills/screen-content-planner/SKILL.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-69","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"69","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_16"} -->

- /home/jbb/.codex/skills/screen-content-planner/SKILL.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-70","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"70","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_17"} -->

The skill body is installed. I’m patching the UI metadata now so the default prompt contains the literal `$screen-content-planner` trigger and remains valid YAML.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-71","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"71","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_18"} -->

- /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-72","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"72","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_18"} -->

- /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-73","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"73","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_19"} -->

The files are now in their final shape. I’m running the skill validator and a couple of quick sanity checks for leftover placeholders and metadata.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-74","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"74","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_20","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"TODO|\\\\[TODO|Use -content-planner\\\" /home/jbb/.codex/skills/screen-content-planner || true\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"TODO|\\[TODO|Use -content-planner\" /home/jbb/.codex/skills/screen-content-planner || true"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-75","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"75","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_20","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"TODO|\\\\[TODO|Use -content-planner\\\" /home/jbb/.codex/skills/screen-content-planner || true\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"TODO|\\[TODO|Use -content-planner\" /home/jbb/.codex/skills/screen-content-planner || true"`
Status: completed
Exit code: 0

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-76","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"76","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_21","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md && sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md && sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-77","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"77","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_21","codexTool":"/usr/bin/zsh -lc \"sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md && sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,220p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md && sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
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
interface:
  display_name: "Screen Content Planner"
  short_description: "Plan mockup screen content."
  default_prompt: "Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups."
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-78","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"78","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_22","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-79","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"79","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_22","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: completed
Exit code: 0

````text
Skill is valid!
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-80","timestamp":"2026-07-08T05:12:28.707Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"80","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_23"} -->

Validation passed and there are no leftover template markers. I’m updating the decision-os result card with the actual installation status so the operator sees that the approved skill now exists, not just the proposed definition.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-81","timestamp":"2026-07-08T05:12:28.707Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"81","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_24"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-82","timestamp":"2026-07-08T05:12:28.707Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"82","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_24"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-83","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"83","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_25","codexTool":"/usr/bin/zsh -lc \"sed -n '215,280p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '215,280p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-84","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"84","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_25","codexTool":"/usr/bin/zsh -lc \"sed -n '215,280p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '215,280p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: completed
Exit code: 0

````text
---

## Suggested `agents/openai.yaml` Values

These values can be passed to `scripts/init_skill.py` or `scripts/generate_openai_yaml.py` with `--interface key=value` if the skill is installed later.

```yaml
display_name: Screen Content Planner
short_description: Convert analysis cards into screen-by-screen content plans for mockups.
default_prompt: Turn this analysis card into a complete screen-content plan for future mockups.
```

---

## Installation Command

If the operator wants to install the skill into the default Codex skills directory:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface display_name="Screen Content Planner" --interface short_description="Convert analysis cards into screen-by-screen content plans for mockups." --interface default_prompt="Turn this analysis card into a complete screen-content plan for future mockups."
```

Then replace the generated `SKILL.md` with the content above and run:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner"
```

---

## Operator Handoff

Status: created and validated.

Installed skill folder: `/home/jbb/.codex/skills/screen-content-planner`

Installed files:

- `/home/jbb/.codex/skills/screen-content-planner/SKILL.md`
- `/home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml`

Validation command:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner
```

Validation result: `Skill is valid!`

This skill defines the first step in the requested two-skill workflow. It prepares grounded screen definitions only. The later visual mockup creation skill should consume the `Screen Inventory`, `Per-Screen Definitions`, `Cross-Screen Coverage Check`, and `Handoff to Visual Mockup Skill` sections produced by this skill, then create visual artifacts from that structured plan.

No visual mockup instructions, product implementation steps, or unrelated screen inventions are included.
---

Codex run completed: exit code 0
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-85","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"85","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_26","codexTool":"/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'"} -->

**Tool call** `/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-86","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"86","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_26","codexTool":"/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'find /home/jbb/.codex/skills/screen-content-planner -maxdepth 3 -type f -print | sort'`
Status: completed
Exit code: 0

````text
/home/jbb/.codex/skills/screen-content-planner/SKILL.md
/home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-87","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"87","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_27","codexTool":"/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'"} -->

**Tool call** `/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-88","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"88","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_27","codexTool":"/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'git status --short -- .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md'`
Status: completed
Exit code: 0

````text
?? .decision-os/cards/skills/card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93.md
?? .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-89","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"89","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_28","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-90","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"90","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_28","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: completed
Exit code: 0

````text
Skill is valid!
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-91","timestamp":"2026-07-08T05:12:28.708Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"91","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_29"} -->

The skill itself is valid. I noticed the older proposal section in the result card still showed the pre-install prompt text, so I’m aligning that documentation with the installed metadata.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-92","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"92","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_30"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-93","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"93","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_30"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-94","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"94","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_31","codexTool":"/usr/bin/zsh -lc \"sed -n '220,285p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '220,285p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-95","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"95","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_31","codexTool":"/usr/bin/zsh -lc \"sed -n '220,285p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '220,285p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: completed
Exit code: 0

````text
These values can be passed to `scripts/init_skill.py` or `scripts/generate_openai_yaml.py` with `--interface key=value` if the skill is installed later.

```yaml
display_name: Screen Content Planner
short_description: Plan mockup screen content.
default_prompt: Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups.
```

---

## Installation Command Reference

Command used to initialize the skill in the default Codex skills directory:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface 'display_name=Screen Content Planner' --interface 'short_description=Plan mockup screen content.' --interface 'default_prompt=Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups.'
```

Then replace the generated `SKILL.md` with the content above and run:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner"
```

---

## Operator Handoff

Status: created and validated.

Installed skill folder: `/home/jbb/.codex/skills/screen-content-planner`

Installed files:

- `/home/jbb/.codex/skills/screen-content-planner/SKILL.md`
- `/home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml`

Validation command:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner
```

Validation result: `Skill is valid!`

This skill defines the first step in the requested two-skill workflow. It prepares grounded screen definitions only. The later visual mockup creation skill should consume the `Screen Inventory`, `Per-Screen Definitions`, `Cross-Screen Coverage Check`, and `Handoff to Visual Mockup Skill` sections produced by this skill, then create visual artifacts from that structured plan.

No visual mockup instructions, product implementation steps, or unrelated screen inventions are included.
---

Codex run completed: exit code 0
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-96","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"96","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_32","codexTool":"/usr/bin/zsh -lc \"sed -n '1,60p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,60p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-97","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"97","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_32","codexTool":"/usr/bin/zsh -lc \"sed -n '1,60p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,60p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: completed
Exit code: 0

````text
interface:
  display_name: "Screen Content Planner"
  short_description: "Plan mockup screen content."
  default_prompt: "Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups."
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-98","timestamp":"2026-07-08T05:12:28.708Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"98","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_33","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-99","timestamp":"2026-07-08T05:12:28.708Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"99","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_33","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: completed
Exit code: 0

````text
Skill is valid!
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-100","timestamp":"2026-07-08T05:12:28.708Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"100","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_34"} -->

Created the skill at:

`/home/jbb/.codex/skills/screen-content-planner`

Installed files:
- `SKILL.md`
- `agents/openai.yaml`

Validation passed with:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner
```

Result: `Skill is valid!`

I also updated the decision-os result card with the installed status and validation evidence: [.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md).

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-101","timestamp":"2026-07-08T05:12:28.708Z","status":"complete","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"101","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.

# OPERATOR
<!-- decision-os:note {"id":"note-1783497273541-e905539a7061d","timestamp":"2026-07-08T07:54:33.555Z","voiceFileRef":"/home/jbb/dev/EditorBP/decision-os/.decision-os/voice-uploads/voice-1783497273565-a5cc99c8-27e3-4558-b713-9c286a38bcf0.wav","status":"transcribed","transcriptionStartedAt":"2026-07-08T07:54:33.610Z"} -->

ce skill, il doit vérifier la langue de l'application, en plus de la tech stack, il doit vérifier si c'est du mobile ou si c'est sur du web pour savoir dans quel format il faut faire les choses. Et il faut bien vérifier que tous les wordings, il n'y a pas de wordings qui sont du développement ou machin. On est en train de faire des applications qui face de la production, donc ça, c'est ultra important.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-102","timestamp":"2026-07-08T07:54:39.984Z","status":"running","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"102","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-103","timestamp":"2026-07-08T07:54:39.984Z","status":"running","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"103","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-104","timestamp":"2026-07-08T07:54:55.977Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"104","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’ll update `screen-content-planner` with these production requirements: application language, target platform format, and user-facing wording quality. I’ll patch both the installed skill and the decision-os result card so they stay aligned, then rerun validation.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-105","timestamp":"2026-07-08T07:54:55.977Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"105","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-106","timestamp":"2026-07-08T07:54:55.977Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"106","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: screen-content-planner
description: Turn one product analysis card, implementation plan, UX analysis, or equivalent planning artifact into a complete screen-content plan for future visual mockups. Use when Codex needs to determine which screens are needed, what each screen must contain, what product data and states each screen requires, and what information is still missing before a separate mockup-generation skill begins. Do not use for generating visual mockups, styling systems, image assets, or implementation code.
---

# Screen Content Planner

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

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
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-107","timestamp":"2026-07-08T07:54:55.977Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"107","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-108","timestamp":"2026-07-08T07:54:55.977Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"108","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md"`
Status: completed
Exit code: 0

`````text
# Screen Content Planning Skill

Allowed source set: source card `card-1ed7edae-2bff-4f0e-a922-1bb57a0b6e93`, `New card`.

Result type: Codex skill definition for turning one analysis card into a complete screen-content plan for later visual mockup creation.

Recommended skill name: `screen-content-planner`

Recommended skill folder: `${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner`

Resource decision: v1 needs only `SKILL.md`. No scripts, references, or assets are required because the work is reasoning-heavy, source-dependent, and output-format driven.

---

## Complete `SKILL.md`

````markdown
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

---

## Suggested `agents/openai.yaml` Values

These values can be passed to `scripts/init_skill.py` or `scripts/generate_openai_yaml.py` with `--interface key=value` if the skill is installed later.

```yaml
display_name: Screen Content Planner
short_description: Plan mockup screen content.
default_prompt: Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups.
```

---

## Installation Command Reference

Command used to initialize the skill in the default Codex skills directory:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/init_skill.py screen-content-planner --path "${CODEX_HOME:-$HOME/.codex}/skills" --interface 'display_name=Screen Content Planner' --interface 'short_description=Plan mockup screen content.' --interface 'default_prompt=Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups.'
```

Then replace the generated `SKILL.md` with the content above and run:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py "${CODEX_HOME:-$HOME/.codex}/skills/screen-content-planner"
```

---

## Operator Handoff

Status: created and validated.

Installed skill folder: `/home/jbb/.codex/skills/screen-content-planner`

Installed files:

- `/home/jbb/.codex/skills/screen-content-planner/SKILL.md`
- `/home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml`

Validation command:

```bash
python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner
`````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-109","timestamp":"2026-07-08T07:54:55.977Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"109","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"sed -n '1,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-110","timestamp":"2026-07-08T07:54:55.977Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"110","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_3","codexTool":"/usr/bin/zsh -lc \"sed -n '1,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,620p' /home/jbb/.codex/skills/.system/skill-creator/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations.
metadata:
  short-description: Create or update a skill
---

# Skill Creator

## A. Formatting Contract

1. **Headings:** use `H2` card sections with uppercase letters: `## A. Scope`, `## B. Contract`, `## C. Acceptance Criteria`.
2. **Dividers:** put `---` between card sections.
3. **Lists:** write section content as numbered list items: `1.`, `2.`, `3.`.
4. **Bold:** use **bold** for the important words that carry the point.
5. **Backticks:** use `backticks` for technical, secondary, exact, or literal terms: file paths, routes, config keys, commands, IDs, statuses, branch names, code symbols, and literal values.

This skill provides guidance for creating effective skills.

## About Skills

Skills are modular, self-contained folders that extend Codex's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform Codex from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else Codex needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: Codex is already very smart.** Only add context Codex doesn't already have. Challenge each piece of information: "Does Codex really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match the level of specificity to the task's fragility and variability:

**High freedom (text-based instructions)**: Use when multiple approaches are valid, decisions depend on context, or heuristics guide the approach.

**Medium freedom (pseudocode or scripts with parameters)**: Use when a preferred pattern exists, some variation is acceptable, or configuration affects behavior.

**Low freedom (specific scripts, few parameters)**: Use when operations are fragile and error-prone, consistency is critical, or a specific sequence must be followed.

Think of Codex as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

### Protect Validation Integrity

You may use subagents during iteration to validate whether a skill works on realistic tasks or whether a suspected problem is real. This is most useful when you want an independent pass on the skill's behavior, outputs, or failure modes after a revision.  Only do this when it is possible to start new subagents.

When using subagents for validation, treat that as an evaluation surface. The goal is to learn whether the skill generalizes, not whether another agent can reconstruct the answer from leaked context.

Prefer raw artifacts such as example prompts, outputs, diffs, logs, or traces. Give the minimum task-local context needed to perform the validation. Avoid passing the intended answer, suspected bug, intended fix, or your prior conclusions unless the validation explicitly requires them.

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
├── agents/ (recommended)
│   └── openai.yaml - UI metadata for skill lists and chips
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields. These are the only fields that Codex reads to determine when the skill gets used, thus it is very important to be clear and comprehensive in describing what the skill is, and when it should be used.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the skill triggers (if at all).

#### Agents metadata (recommended)

- UI-facing metadata for skill lists and chips
- Read references/openai_yaml.md before generating values and follow its descriptions and constraints
- Create: human-facing `display_name`, `short_description`, and `default_prompt` by reading the skill
- Generate deterministically by passing the values as `--interface key=value` to `scripts/generate_openai_yaml.py` or `scripts/init_skill.py`
- On updates: validate `agents/openai.yaml` still matches SKILL.md; regenerate if stale
- Only include other optional interface fields (icons, brand color) if explicitly provided
- See references/openai_yaml.md for field definitions and examples

#### Bundled Resources (optional)

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, may be executed without loading into context
- **Note**: Scripts may still need to be read by Codex for patching or environment-specific adjustments

##### References (`references/`)

Documentation and reference material intended to be loaded as needed into context to inform Codex's process and thinking.

- **When to include**: For documentation that Codex should reference while working
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for company NDA template, `references/policies.md` for company policies, `references/api_docs.md` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when Codex determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both. Prefer references files for detailed information unless it's truly core to the skill—this keeps SKILL.md lean while making information discoverable without hogging the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to references files.

##### Assets (`assets/`)

Files not intended to be loaded into context, but rather used within the output Codex produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates, `assets/frontend-template/` for HTML/React boilerplate, `assets/font.ttf` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified
- **Benefits**: Separates output resources from documentation, enables Codex to use files without loading them into context

#### What to Not Include in a Skill

A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- etc.

The skill should only contain the information needed for an AI agent to do the job at hand. It should not contain auxiliary context about the process that went into creating it, setup and testing procedures, user-facing documentation, etc. Creating additional documentation files just adds clutter and confusion.

### Progressive Disclosure Design Principle

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Codex (Unlimited because scripts can be executed without reading into context window)

#### Progressive Disclosure Patterns

Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat. Split content into separate files when approaching this limit. When splitting out content into other files, it is very important to reference them from SKILL.md and describe clearly when to read them, to ensure the reader of the skill knows they exist and when to use them.

**Key principle:** When a skill supports multiple variations, frameworks, or options, keep only the core workflow and selection guidance in SKILL.md. Move variant-specific details (patterns, examples, configuration) into separate reference files.

**Pattern 1: High-level guide with references**

```markdown
# PDF Processing

## Quick start

Extract text with pdfplumber:
[code example]

## Advanced features

- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
- **Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

Codex loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

**Pattern 2: Domain-specific organization**

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context:

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

When a user asks about sales metrics, Codex only reads sales.md.

Similarly, for skills supporting multiple frameworks or variants, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

When the user chooses AWS, Codex only reads aws.md.

**Pattern 3: Conditional details**

Show basic content, link to advanced content:

```markdown
# DOCX Processing

## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

Codex reads REDLINING.md or OOXML.md only when the user needs those features.

**Important guidelines:**

- **Avoid deeply nested references** - Keep references one level deep from SKILL.md. All reference files should link directly from SKILL.md.
- **Structure longer reference files** - For files longer than 100 lines, include a table of contents at the top so Codex can see the full scope when previewing.

## Skill Creation Process

Skill creation involves these steps:

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (run init_skill.py)
4. Edit the skill (implement resources and write SKILL.md)
5. Validate the skill (run quick_validate.py)
6. Iterate based on real usage and forward-test complex skills.

Follow these steps in order, skipping only if there is a clear reason why they are not applicable.

### Skill Naming

- Use lowercase letters, digits, and hyphens only; normalize user-provided titles to hyphen-case (e.g., "Plan Mode" -> `plan-mode`).
- When generating names, generate a name under 64 characters (letters, digits, hyphens).
- Prefer short, verb-led phrases that describe the action.
- Namespace by tool when it improves clarity or triggering (e.g., `gh-address-comments`, `linear-address-issue`).
- Name the skill folder exactly after the skill name.

### Step 1: Understanding the Skill with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood. It remains valuable even when working with an existing skill.

To create an effective skill, clearly understand concrete examples of how the skill will be used. This understanding can come from either direct user examples or generated examples that are validated with user feedback.

For example, when building an image-editor skill, relevant questions include:

- "What functionality should the image-editor skill support? Editing, rotating, anything else?"
- "Can you give some examples of how this skill would be used?"
- "I can imagine users asking for things like 'Remove the red-eye from this image' or 'Rotate this image'. Are there other ways you imagine this skill being used?"
- "What would a user say that should trigger this skill?"
- "Where should I create this skill? If you do not have a preference, I will place it in `$CODEX_HOME/skills` (or `~/.codex/skills` when `CODEX_HOME` is unset) so Codex can discover it automatically."

To avoid overwhelming users, avoid asking too many questions in a single message. Start with the most important questions and follow up as needed for better effectiveness.

Conclude this step when there is a clear sense of the functionality the skill should support.

### Step 2: Planning the Reusable Skill Contents

To turn concrete examples into an effective skill, analyze each example by:

1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful when executing these workflows repeatedly

Example: When building a `pdf-editor` skill to handle queries like "Help me rotate this PDF," the analysis shows:

1. Rotating a PDF requires re-writing the same code each time
2. A `scripts/rotate_pdf.py` script would be helpful to store in the skill

Example: When designing a `frontend-webapp-builder` skill for queries like "Build me a todo app" or "Build me a dashboard to track my steps," the analysis shows:

1. Writing a frontend webapp requires the same boilerplate HTML/React each time
2. An `assets/hello-world/` template containing the boilerplate HTML/React project files would be helpful to store in the skill

Example: When building a `big-query` skill to handle queries like "How many users have logged in today?" the analysis shows:

1. Querying BigQuery requires re-discovering the table schemas and relationships each time
2. A `references/schema.md` file documenting the table schemas would be helpful to store in the skill

To establish the skill's contents, analyze each concrete example to create a list of the reusable resources to include: scripts, references, and assets.

### Step 3: Initializing the Skill

At this point, it is time to actually create the skill.

Skip this step only if the skill being developed already exists. In this case, continue to the next step.

Before running `init_skill.py`, ask where the user wants the skill created. If they do not specify a location, default to `$CODEX_HOME/skills`; when `CODEX_HOME` is unset, fall back to `~/.codex/skills` so the skill is auto-discovered.

When creating a new skill from scratch, always run the `init_skill.py` script. The script conveniently generates a new template skill directory that automatically includes everything a skill requires, making the skill creation process much more efficient and reliable.

Usage:

```bash
scripts/init_skill.py <skill-name> --path <output-directory> [--resources scripts,references,assets] [--examples]
```

Examples:

```bash
scripts/init_skill.py my-skill --path "${CODEX_HOME:-$HOME/.codex}/skills"
scripts/init_skill.py my-skill --path "${CODEX_HOME:-$HOME/.codex}/skills" --resources scripts,references
scripts/init_skill.py my-skill --path ~/work/skills --resources scripts --examples
```

The script:

- Creates the skill directory at the specified path
- Generates a SKILL.md template with proper frontmatter and TODO placeholders
- Creates `agents/openai.yaml` using agent-generated `display_name`, `short_description`, and `default_prompt` passed via `--interface key=value`
- Optionally creates resource directories based on `--resources`
- Optionally adds example files when `--examples` is set

After initialization, customize the SKILL.md and add resources as needed. If you used `--examples`, replace or delete placeholder files.

Generate `display_name`, `short_description`, and `default_prompt` by reading the skill, then pass them as `--interface key=value` to `init_skill.py` or regenerate with:

```bash
scripts/generate_openai_yaml.py <path/to/skill-folder> --interface key=value
```

Only include other optional interface fields when the user explicitly provides them. For full field descriptions and examples, see references/openai_yaml.md.

### Step 4: Edit the Skill

When editing the (newly-generated or existing) skill, remember that the skill is being created for another instance of Codex to use. Include information that would be beneficial and non-obvious to Codex. Consider what procedural knowledge, domain-specific details, or reusable assets would help another Codex instance execute these tasks more effectively.

After substantial revisions, or if the skill is particularly tricky, you should use subagents to forward-test the skill on realistic tasks or artifacts. When doing so, pass the artifact under validation rather than your diagnosis of what is wrong, and keep the prompt generic enough that success depends on transferable reasoning rather than hidden ground truth.

#### Start with Reusable Skill Contents

To begin implementation, start with the reusable resources identified above: `scripts/`, `references/`, and `assets/` files. Note that this step may require user input. For example, when implementing a `brand-guidelines` skill, the user may need to provide brand assets or templates to store in `assets/`, or documentation to store in `references/`.

Added scripts must be tested by actually running them to ensure there are no bugs and that the output matches what is expected. If there are many similar scripts, only a representative sample needs to be tested to ensure confidence that they all work while balancing time to completion.

If you used `--examples`, delete any placeholder files that are not needed for the skill. Only create resource directories that are actually required.

#### Update SKILL.md

**Writing Guidelines:** Always use imperative/infinitive form.

##### Frontmatter

Write the YAML frontmatter with `name` and `description`:

- `name`: The skill name
- `description`: This is the primary triggering mechanism for your skill, and helps Codex understand when to use the skill.
  - Include both what the Skill does and specific triggers/contexts for when to use it.
  - Include all "when to use" information here - Not in the body. The body is only loaded after triggering, so "When to Use This Skill" sections in the body are not helpful to Codex.
  - Example description for a `docx` skill: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Codex needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

Do not include any other fields in YAML frontmatter.

##### Body

Write instructions for using the skill and its bundled resources.

### Step 5: Validate the Skill

Once development of the skill is complete, validate the skill folder to catch basic issues early:

```bash
scripts/quick_validate.py <path/to/skill-folder>
```

The validation script checks YAML frontmatter format, required fields, and naming rules. If validation fails, fix the reported issues and run the command again.

### Step 6: Iterate

After testing the skill, you may detect the skill is complex enough that it requires forward-testing; or users may request improvements.

User testing often this happens right after using the skill, with fresh context of how the skill performed.

**Forward-testing and iteration workflow:**

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again
5. Forward-test if it is reasonable and appropriate

## Forward-testing

To forward-test, launch subagents as a way to stress test the skill with minimal context.
Subagents should *not* know that they are being asked to test the skill.  They should be treated as
an agent asked to perform a task by the user.  Prompts to subagents should look like:
  `Use $skill-x at /path/to/skill-x to solve problem y`
Not:
  `Review the skill at /path/to/skill-x; pretend a user asks you to...`

Decision rule for forward-testing:
  - Err on the side of forward-testing
  - Ask for approval if you think there's a risk that forward-testing would:
    * take a long time,
    * require additional approvals from the user, or
    * modify live production systems

  In these cases, show the user your proposed prompt and request (1) a yes/no decision, and
  (2) any suggested modifictions.

Considerations when forward-testing:
   - use fresh threads for independent passes
   - pass the skill, and a request in a similar way the user would.
   - pass raw artifacts, not your conclusions
   - avoid showing expected answers or intended fixes
   - rebuild context from source artifacts after each iteration
   - review the subagent's output and reasoning and emitted artifacts
   - avoid leaving artifacts the agent can find on disk between iterations;
     clean up subagents' artifacts to avoid additional contamination.

If forward-testing only succeeds when subagents see leaked context, tighten the skill or the
forward-testing setup before trusting the result.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-111","timestamp":"2026-07-08T07:55:18.179Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"111","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_4"} -->

I found the installed skill has drifted from the result card: it contains an unrelated formatting-contract section. I’m going to remove that and add the operator’s new requirements directly into the core workflow and output contract.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-112","timestamp":"2026-07-08T07:55:23.292Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"112","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_5"} -->

The update will make the skill explicitly verify three things before screen planning: app language, target platform/form factor, and production-ready user-facing wording. It will also require each screen definition to include copy requirements and forbid development/internal wording in UI text.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-113","timestamp":"2026-07-08T07:55:51.986Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"113","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_6"} -->

- /home/jbb/.codex/skills/screen-content-planner/SKILL.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-114","timestamp":"2026-07-08T07:55:51.986Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"114","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_6"} -->

- /home/jbb/.codex/skills/screen-content-planner/SKILL.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-115","timestamp":"2026-07-08T07:55:55.986Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"115","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc \"sed -n '1,280p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,280p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-116","timestamp":"2026-07-08T07:55:55.986Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"116","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_7","codexTool":"/usr/bin/zsh -lc \"sed -n '1,280p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,280p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: screen-content-planner
description: Turn one product analysis card, implementation plan, UX analysis, or equivalent planning artifact into a complete screen-content plan for future visual mockups. Use when Codex needs to determine which screens are needed, what each screen must contain, what app language, platform format, product wording, data, states, and missing information are required before a separate mockup-generation skill begins. Do not use for generating visual mockups, styling systems, image assets, or implementation code.
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
- Application language, locale, and localization constraints
- Target platform and form factor, such as web, mobile web, native mobile, tablet, desktop, or responsive multi-platform
- Current UX context
- Existing screens and user flows
- Existing product behavior
- Production-facing wording standards and existing product copy conventions
- Implementation or product plan
- Roles, permissions, states, edge cases, and constraints

If the user provides only partial context, extract what is present, identify what is missing, and ask only for missing facts that block accurate screen definition.

## Workflow

1. **Extract confirmed facts.** Capture the requested change, product area, actors, goals, workflow, current behavior, planned behavior, constraints, and any source facts that must be preserved.
2. **Extract stack, platform, and UI constraints.** Identify the tech stack, UI framework, component system, routing model, data-loading pattern, target platform, form factor, design constraints, and reusable UI patterns. If absent and material to screen content, ask for it.
3. **Verify app language and wording constraints.** Identify the required application language, locale, tone constraints, terminology, and existing product copy conventions. Treat missing language requirements as blocking when the output includes user-facing text or labels.
4. **Map existing product context.** Identify existing screens, surfaces, features, components, flows, permissions, behavior, and copy patterns that the plan must reuse or respect.
5. **Map planned behavior.** Use the provided implementation or product plan to identify workflows, states, roles, data entities, edge cases, failure modes, and permission differences that need screen coverage.
6. **Determine the screen inventory.** Infer the needed screens when the source is sufficient. Ask focused questions only when screen count or screen boundaries cannot be determined confidently.
7. **Define each screen.** For every screen, specify content, sections, components, data, controls, navigation, states, permissions, production wording needs, and feature mapping.
8. **Review wording for production readiness.** Ensure labels, headings, empty states, errors, CTAs, helper text, and status messages are written for end users, not developers or implementation teams.
9. **Separate blockers from assumptions.** List unresolved questions that block accurate screen definition. List non-blocking assumptions separately and continue when the assumption is low-risk and implied by the source.
10. **Prepare the handoff.** End with a clean handoff note for the later visual mockup skill, without doing visual design work.

## Clarification Rules

Ask only questions that would change screen definition.

Ask when missing information affects:

- Screen count or screen boundaries
- User roles or primary actors
- Feature boundaries
- Application language, locale, or required terminology
- Target platform, form factor, or responsive coverage
- Route names or surfaces
- Data entities or required fields
- Data sources or loading patterns
- Production wording, if the source uses internal labels, development jargon, placeholder copy, or unclear user-facing text
- Empty, loading, error, or permission states
- Existing UI references or reusable patterns
- Critical workflow order
- Access control or destructive actions

Do not ask for visual style details such as color palette, typography, illustration direction, spacing, motion, or high-fidelity layout preferences. Those belong to the later mockup creation skill.

When a decision is low-risk and implied by the source, state the assumption and continue.

## Production Wording Rules

Treat UI copy as part of screen content.

Use wording that a real end user can understand in the application language. Avoid implementation wording, internal team shorthand, database names, component names, raw enum values, route names, debug labels, placeholder text, and developer instructions unless the product itself is for developers and the source explicitly requires that vocabulary.

Flag and replace wording such as:

- `TODO`, `TBD`, `lorem ipsum`, or placeholder copy
- Raw states such as `isLoading`, `ERR_403`, `null`, `undefined`, or `empty_array`
- Implementation labels such as `modal`, `CRUD`, `endpoint`, `API response`, `payload`, `mutation`, `component`, or `route`
- Internal process text such as `admin only unless flag enabled`, `ask backend`, or `wire this later`

When exact final copy is not available, define the copy requirement and provide production-ready draft wording in the required application language, marked as draft copy.

## Output Format

Use this structure.

### 1. Source Summary

- **Requested change:**
- **Product area:**
- **Primary actors:**
- **Workflow goal:**
- **Confirmed constraints:**
- **Application language and locale:**
- **Target platform and form factor:**
- **Existing product context:**
- **Existing wording conventions:**
- **Plan context:**

### 2. Confirmed Facts

List concrete facts extracted from the source. Keep each fact traceable to the source artifact. Do not add generic process claims.

### 3. Non-Blocking Assumptions

List assumptions that are implied by the source and safe enough to proceed with. For each assumption, explain why it is low-risk.

### 4. Blocking Questions

List only questions that block accurate screen definition. If there are no blockers, write `No blocking questions.`

### 5. Screen Inventory

Provide a table with one row per screen:

| Screen | Purpose | Platform format | Route or surface | Primary actor | Workflow position | Grounding |
| --- | --- | --- | --- | --- | --- | --- |

Rules:

- Use the platform format when known, such as web, mobile web, native mobile, tablet, desktop, or responsive.
- Use the route or surface when known.
- Write `Unknown` when the source does not provide it.
- The grounding column must reference the relevant feature, requirement, workflow, existing screen, or stated assumption.

### 6. Per-Screen Definitions

For each screen, use this template:

#### Screen: `<screen name>`

- **Purpose:**
- **Platform format:**
- **Route or surface:**
- **Primary actor:**
- **Workflow position:**
- **Grounded by:**
- **Existing patterns to reuse or respect:**
- **Application language:**

**Required sections**

- List each section and the job it performs.

**Required components**

- List components or component types. Name existing components when known.

**Required data fields**

- List visible fields, identifiers, labels, counts, metadata, status values, timestamps, ownership fields, or computed fields.

**Controls and actions**

- List buttons, menus, inputs, filters, toggles, dialogs, destructive actions, confirmation steps, and disabled states.

**Production wording**

- List required headings, labels, CTAs, helper text, empty-state copy, error copy, permission copy, and status text.
- Ensure every wording item is end-user-facing, in the application language, and free of development or implementation jargon.
- Mark uncertain wording as draft copy and list the source fact or blocker needed to finalize it.

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
- Application language and terminology
- Web, mobile, native, desktop, tablet, or responsive platform format
- Production-ready wording with no developer-facing labels or placeholders

### 8. Handoff to Visual Mockup Skill

Write a concise handoff that states:

- The screen list is ready or blocked.
- Which screens should be mocked first.
- Which missing facts must be resolved before visual mockups.
- Which existing UI patterns the mockup skill must respect.
- Which application language and platform format the mockup skill must use.
- Which wording requirements or draft copy the mockup skill must preserve.

Do not include color palettes, high-fidelity layout instructions, image-generation prompts, or final visual mockups.

## Quality Bar

Before finishing, check that:

- Every proposed screen is grounded in the source artifact, current product context, stack constraints, or an explicit assumption.
- Every screen has content, data, controls, navigation, states, permission handling, and feature mapping.
- Every screen identifies the application language and platform format when known.
- User-facing wording is production-ready, in the application language, and free of development jargon, internal shorthand, raw technical states, placeholders, and implementation labels.
- Missing data is separated from assumptions.
- Questions are limited to blockers.
- The output gives enough detail for a later visual mockup skill to work without rediscovering product intent.
- No unrelated screens are invented.
- No product code, route scaffolding, or visual mockups are produced.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-117","timestamp":"2026-07-08T07:55:59.986Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"117","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_8"} -->

The installed skill now includes the new checks and the unrelated formatting section is gone. I’m applying the same contract changes to the decision-os result card so the documented `SKILL.md` matches the installed one.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-118","timestamp":"2026-07-08T07:56:33.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"118","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_9"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-119","timestamp":"2026-07-08T07:56:33.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"119","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_9"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-120","timestamp":"2026-07-08T07:56:39.995Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"120","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_10"} -->

The result card now mirrors the revised `SKILL.md`. I’m updating the UI-facing metadata to reflect the production wording requirement, then I’ll run validation and placeholder checks.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-121","timestamp":"2026-07-08T07:56:41.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"121","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_11"} -->

- /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-122","timestamp":"2026-07-08T07:56:41.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"122","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_11"} -->

- /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-123","timestamp":"2026-07-08T07:56:47.976Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"123","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_12"} -->

The installed metadata is updated. I’m making the result card’s metadata snippet match it as well.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-124","timestamp":"2026-07-08T07:56:53.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"124","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_13"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-125","timestamp":"2026-07-08T07:56:53.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"125","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_13"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md: update

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-126","timestamp":"2026-07-08T07:57:01.976Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"126","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_14"} -->

The edits are complete. I’m running the validator and checking for leftover placeholders or stale metadata before I close this out.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-127","timestamp":"2026-07-08T07:57:01.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"127","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_15","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-128","timestamp":"2026-07-08T07:57:01.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"128","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_16","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"TODO|\\\\[TODO|Plan mockup|Use -content-planner|lorem ipsum\\\" /home/jbb/.codex/skills/screen-content-planner .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md || true\""} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"TODO|\\[TODO|Plan mockup|Use -content-planner|lorem ipsum\" /home/jbb/.codex/skills/screen-content-planner .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md || true"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-129","timestamp":"2026-07-08T07:57:01.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"129","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_16","codexTool":"/usr/bin/zsh -lc \"rg -n \\\"TODO|\\\\[TODO|Plan mockup|Use -content-planner|lorem ipsum\\\" /home/jbb/.codex/skills/screen-content-planner .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md || true\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "rg -n \"TODO|\\[TODO|Plan mockup|Use -content-planner|lorem ipsum\" /home/jbb/.codex/skills/screen-content-planner .decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md || true"`
Status: completed
Exit code: 0

````text
.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md:101:- `TODO`, `TBD`, `lorem ipsum`, or placeholder copy
/home/jbb/.codex/skills/screen-content-planner/SKILL.md:84:- `TODO`, `TBD`, `lorem ipsum`, or placeholder copy
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-130","timestamp":"2026-07-08T07:57:01.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"130","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_15","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/.codex/skills/screen-content-planner/SKILL.md"`
Status: completed
Exit code: 0

````text
---
name: screen-content-planner
description: Turn one product analysis card, implementation plan, UX analysis, or equivalent planning artifact into a complete screen-content plan for future visual mockups. Use when Codex needs to determine which screens are needed, what each screen must contain, what app language, platform format, product wording, data, states, and missing information are required before a separate mockup-generation skill begins. Do not use for generating visual mockups, styling systems, image assets, or implementation code.
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
- Application language, locale, and localization constraints
- Target platform and form factor, such as web, mobile web, native mobile, tablet, desktop, or responsive multi-platform
- Current UX context
- Existing screens and user flows
- Existing product behavior
- Production-facing wording standards and existing product copy conventions
- Implementation or product plan
- Roles, permissions, states, edge cases, and constraints

If the user provides only partial context, extract what is present, identify what is missing, and ask only for missing facts that block accurate screen definition.

## Workflow

1. **Extract confirmed facts.** Capture the requested change, product area, actors, goals, workflow, current behavior, planned behavior, constraints, and any source facts that must be preserved.
2. **Extract stack, platform, and UI constraints.** Identify the tech stack, UI framework, component system, routing model, data-loading pattern, target platform, form factor, design constraints, and reusable UI patterns. If absent and material to screen content, ask for it.
3. **Verify app language and wording constraints.** Identify the required application language, locale, tone constraints, terminology, and existing product copy conventions. Treat missing language requirements as blocking when the output includes user-facing text or labels.
4. **Map existing product context.** Identify existing screens, surfaces, features, components, flows, permissions, behavior, and copy patterns that the plan must reuse or respect.
5. **Map planned behavior.** Use the provided implementation or product plan to identify workflows, states, roles, data entities, edge cases, failure modes, and permission differences that need screen coverage.
6. **Determine the screen inventory.** Infer the needed screens when the source is sufficient. Ask focused questions only when screen count or screen boundaries cannot be determined confidently.
7. **Define each screen.** For every screen, specify content, sections, components, data, controls, navigation, states, permissions, production wording needs, and feature mapping.
8. **Review wording for production readiness.** Ensure labels, headings, empty states, errors, CTAs, helper text, and status messages are written for end users, not developers or implementation teams.
9. **Separate blockers from assumptions.** List unresolved questions that block accurate screen definition. List non-blocking assumptions separately and continue when the assumption is low-risk and implied by the source.
10. **Prepare the handoff.** End with a clean handoff note for the later visual mockup skill, without doing visual design work.

## Clarification Rules

Ask only questions that would change screen definition.

Ask when missing information affects:

- Screen count or screen boundaries
- User roles or primary actors
- Feature boundaries
- Application language, locale, or required terminology
- Target platform, form factor, or responsive coverage
- Route names or surfaces
- Data entities or required fields
- Data sources or loading patterns
- Production wording, if the source uses internal labels, development jargon, placeholder copy, or unclear user-facing text
- Empty, loading, error, or permission states
- Existing UI references or reusable patterns
- Critical workflow order
- Access control or destructive actions

Do not ask for visual style details such as color palette, typography, illustration direction, spacing, motion, or high-fidelity layout preferences. Those belong to the later mockup creation skill.

When a decision is low-risk and implied by the source, state the assumption and continue.

## Production Wording Rules

Treat UI copy as part of screen content.

Use wording that a real end user can understand in the application language. Avoid implementation wording, internal team shorthand, database names, component names, raw enum values, route names, debug labels, placeholder text, and developer instructions unless the product itself is for developers and the source explicitly requires that vocabulary.

Flag and replace wording such as:

- `TODO`, `TBD`, `lorem ipsum`, or placeholder copy
- Raw states such as `isLoading`, `ERR_403`, `null`, `undefined`, or `empty_array`
- Implementation labels such as `modal`, `CRUD`, `endpoint`, `API response`, `payload`, `mutation`, `component`, or `route`
- Internal process text such as `admin only unless flag enabled`, `ask backend`, or `wire this later`

When exact final copy is not available, define the copy requirement and provide production-ready draft wording in the required application language, marked as draft copy.

## Output Format

Use this structure.

### 1. Source Summary

- **Requested change:**
- **Product area:**
- **Primary actors:**
- **Workflow goal:**
- **Confirmed constraints:**
- **Application language and locale:**
- **Target platform and form factor:**
- **Existing product context:**
- **Existing wording conventions:**
- **Plan context:**

### 2. Confirmed Facts

List concrete facts extracted from the source. Keep each fact traceable to the source artifact. Do not add generic process claims.

### 3. Non-Blocking Assumptions

List assumptions that are implied by the source and safe enough to proceed with. For each assumption, explain why it is low-risk.

### 4. Blocking Questions

List only questions that block accurate screen definition. If there are no blockers, write `No blocking questions.`

### 5. Screen Inventory

Provide a table with one row per screen:

| Screen | Purpose | Platform format | Route or surface | Primary actor | Workflow position | Grounding |
| --- | --- | --- | --- | --- | --- | --- |

Rules:

- Use the platform format when known, such as web, mobile web, native mobile, tablet, desktop, or responsive.
- Use the route or surface when known.
- Write `Unknown` when the source does not provide it.
- The grounding column must reference the relevant feature, requirement, workflow, existing screen, or stated assumption.

### 6. Per-Screen Definitions

For each screen, use this template:

#### Screen: `<screen name>`

- **Purpose:**
- **Platform format:**
- **Route or surface:**
- **Primary actor:**
- **Workflow position:**
- **Grounded by:**
- **Existing patterns to reuse or respect:**
- **Application language:**

**Required sections**

- List each section and the job it performs.

**Required components**

- List components or component types. Name existing components when known.

**Required data fields**

- List visible fields, identifiers, labels, counts, metadata, status values, timestamps, ownership fields, or computed fields.

**Controls and actions**

- List buttons, menus, inputs, filters, toggles, dialogs, destructive actions, confirmation steps, and disabled states.

**Production wording**

- List required headings, labels, CTAs, helper text, empty-state copy, error copy, permission copy, and status text.
- Ensure every wording item is end-user-facing, in the application language, and free of development or implementation jargon.
- Mark uncertain wording as draft copy and list the source fact or blocker needed to finalize it.

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
- Application language and terminology
- Web, mobile, native, desktop, tablet, or responsive platform format
- Production-ready wording with no developer-facing labels or placeholders

### 8. Handoff to Visual Mockup Skill

Write a concise handoff that states:

- The screen list is ready or blocked.
- Which screens should be mocked first.
- Which missing facts must be resolved before visual mockups.
- Which existing UI patterns the mockup skill must respect.
- Which application language and platform format the mockup skill must use.
- Which wording requirements or draft copy the mockup skill must preserve.

Do not include color palettes, high-fidelity layout instructions, image-generation prompts, or final visual mockups.

## Quality Bar

Before finishing, check that:

- Every proposed screen is grounded in the source artifact, current product context, stack constraints, or an explicit assumption.
- Every screen has content, data, controls, navigation, states, permission handling, and feature mapping.
- Every screen identifies the application language and platform format when known.
- User-facing wording is production-ready, in the application language, and free of development jargon, internal shorthand, raw technical states, placeholders, and implementation labels.
- Missing data is separated from assumptions.
- Questions are limited to blockers.
- The output gives enough detail for a later visual mockup skill to work without rediscovering product intent.
- No unrelated screens are invented.
- No product code, route scaffolding, or visual mockups are produced.
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-131","timestamp":"2026-07-08T07:57:01.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"131","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_17","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-132","timestamp":"2026-07-08T07:57:01.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"132","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_17","codexTool":"/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc 'python3 /home/jbb/.codex/skills/.system/skill-creator/scripts/quick_validate.py /home/jbb/.codex/skills/screen-content-planner'`
Status: completed
Exit code: 0

````text
Skill is valid!
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-133","timestamp":"2026-07-08T07:57:01.976Z","status":"in_progress","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"133","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_18","codexTool":"/usr/bin/zsh -lc \"sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-134","timestamp":"2026-07-08T07:57:01.976Z","status":"completed","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"134","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_18","codexTool":"/usr/bin/zsh -lc \"sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,80p' /home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml"`
Status: completed
Exit code: 0

````text
interface:
  display_name: "Screen Content Planner"
  short_description: "Plan production screen content."
  default_prompt: "Use $screen-content-planner to turn this analysis card into a complete screen-content plan for future mockups."
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-135","timestamp":"2026-07-08T07:57:07.977Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"135","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_19"} -->

The validator passes. The placeholder scan only found the intentional banned-word examples inside the wording rules, not unresolved template text.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-136","timestamp":"2026-07-08T07:57:10.354Z","status":"Codex message","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"136","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_20"} -->

Updated `screen-content-planner` with the operator’s requirements.

The skill now explicitly checks:
- Application language, locale, and terminology.
- Target platform/form factor: web, mobile web, native mobile, tablet, desktop, or responsive.
- Production-ready user-facing wording, with no developer/internal labels, placeholders, raw enum states, debug text, or implementation jargon.

Files updated:
- [SKILL.md](/home/jbb/.codex/skills/screen-content-planner/SKILL.md)
- [openai.yaml](/home/jbb/.codex/skills/screen-content-planner/agents/openai.yaml)
- [decision-os result card](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783485668635-1989a1e2.md)

Validation passed again: `Skill is valid!`

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783485668635-1989a1e2-line-137","timestamp":"2026-07-08T07:57:10.354Z","status":"complete","codexRunId":"codex-skill-1783485668635-1989a1e2","codexLine":"137","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.
