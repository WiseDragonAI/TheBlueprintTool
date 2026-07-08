# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-1","timestamp":"2026-07-08T03:57:42.095Z","status":"running","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"1","codexKind":"run_status","codexEventType":"thread.started"} -->

Codex thread started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-2","timestamp":"2026-07-08T03:57:42.095Z","status":"running","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"2","codexKind":"run_status","codexEventType":"turn.started"} -->

Codex turn started.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-3","timestamp":"2026-07-07T18:19:09.583Z","status":"Codex message","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"3","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_0"} -->

I’m using `human-context-synthesis` for this card and will write only the synthesized operator-facing result to the requested Markdown file. I’ll keep the source card unchanged and avoid touching ledger JSON.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-4","timestamp":"2026-07-07T18:19:09.584Z","status":"in_progress","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"4","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"pwd && sed -n '1,220p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md\""} -->

**Tool call** `/usr/bin/zsh -lc "pwd && sed -n '1,220p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-5","timestamp":"2026-07-07T18:19:09.585Z","status":"completed","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"5","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_1","codexTool":"/usr/bin/zsh -lc \"pwd && sed -n '1,220p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "pwd && sed -n '1,220p' /home/jbb/.codex/skills/human-context-synthesis/SKILL.md"`
Status: completed
Exit code: 0

````text
/home/jbb/dev/EditorBP/decision-os
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
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-6","timestamp":"2026-07-07T18:19:09.586Z","status":"in_progress","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"6","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"if [ -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md ]; then sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md; else printf 'MISSING\\\\n'; fi\""} -->

**Tool call** `/usr/bin/zsh -lc "if [ -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md ]; then sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md; else printf 'MISSING\\n'; fi"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-7","timestamp":"2026-07-07T18:19:09.587Z","status":"completed","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"7","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_2","codexTool":"/usr/bin/zsh -lc \"if [ -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md ]; then sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md; else printf 'MISSING\\\\n'; fi\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "if [ -f /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md ]; then sed -n '1,220p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md; else printf 'MISSING\\n'; fi"`
Status: completed
Exit code: 0

````text
# human-context-synthesis result

Status: processing

Source card: Planning Skill Inventory
Codex run: codex-skill-1783448349580-e919e6f8
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-8","timestamp":"2026-07-07T18:19:09.588Z","status":"Codex message","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"8","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_3"} -->

The target file is just a processing stub, so I’m replacing it with a concise synthesis rather than appending. The useful output should help the operator choose the right planning path without rereading the full inventory.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-9","timestamp":"2026-07-07T18:19:09.589Z","status":"in_progress","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"9","codexKind":"file_change","codexEventType":"item.started","codexItemId":"item_4"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-10","timestamp":"2026-07-07T18:19:09.590Z","status":"completed","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"10","codexKind":"file_change","codexEventType":"item.completed","codexItemId":"item_4"} -->

- /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md: add

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-11","timestamp":"2026-07-07T18:19:09.591Z","status":"Codex message","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"11","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_5"} -->

The synthesized card is written. I’m doing a quick readback now to catch formatting or content drift against the requested Markdown shape.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-12","timestamp":"2026-07-07T18:19:09.592Z","status":"in_progress","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"12","codexKind":"tool_call","codexEventType":"item.started","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md\""} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md"`
Status: in_progress

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-13","timestamp":"2026-07-07T18:19:09.593Z","status":"completed","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"13","codexKind":"tool_call","codexEventType":"item.completed","codexItemId":"item_6","codexTool":"/usr/bin/zsh -lc \"sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md\"","codexExitCode":"0"} -->

**Tool call** `/usr/bin/zsh -lc "sed -n '1,260p' /home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md"`
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
````

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-14","timestamp":"2026-07-07T18:19:09.594Z","status":"Codex message","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"14","codexKind":"agent_message","codexEventType":"item.completed","codexItemId":"item_7"} -->

Done. I wrote the synthesized operator-facing Markdown result to:

[card-codex-skill-1783448349580-e919e6f8.md](/home/jbb/dev/EditorBP/decision-os/.decision-os/cards/skills/card-codex-skill-1783448349580-e919e6f8.md)

I did not edit the source card or ledger JSON.

# AGENT
<!-- decision-os:note {"id":"codex-codex-skill-1783448349580-e919e6f8-line-15","timestamp":"2026-07-07T18:19:09.595Z","status":"complete","codexRunId":"codex-skill-1783448349580-e919e6f8","codexLine":"15","codexKind":"run_status","codexEventType":"turn.completed"} -->

Codex turn completed.
