# Prompt Expression And System-Prompt Catalog

## A. Expression Languages

1. `{{PROMPT_NAME}}`
   1. **WHAT:** Recursively includes the committed Markdown of another registered `pipeline-prompt` during immutable admission.
   2. **WHY:** Prompt graphs compose reusable authored instructions without copying their content into every root prompt.
2. `<RUNTIME_NAME>`
   1. **WHAT:** Injects one typed runtime value immediately before process launch; names use `<[A-Z][A-Z0-9_]*>`.
   2. **WHY:** Admission can freeze authored instructions while launch supplies execution-specific identity and context.
3. Legacy `{{RUNTIME_NAME}}`
   1. **WHAT:** Renders the version-1 runtime variables `MASTER_TASK`, `SUB_CONTEXT`, `FULL_THREAD`, `FILE_MAP`, `PREVIOUS_SKILL_RESULT`, and `EXECUTION_CONTEXT` for persisted runs without a syntax-version discriminator.
   2. **WHY:** Historical executions must remain replayable after syntax version 2 separated prompt references from runtime values.

Runtime values are rendered once and are not scanned recursively. An unknown uppercase runtime token rejects execution. A provider outside the active execution boundary returns an empty string.

---

## B. Shared Runtime Expressions

1. `<PLATFORM>`
   1. **WHAT:** Supplies the authoritative runtime platform, such as `linux` or `termux`.
   2. **WHY:** Platform-sensitive instructions must select the correct execution and browser procedures without filesystem inference.
2. `<LEDGER_FILE>`
   1. **WHAT:** Supplies the absolute path of the active Decision OS ledger.
   2. **WHY:** `ledger-cli` must target the admitted ledger without rediscovering or guessing its location.

---

## C. Pipeline Identity Expressions

1. `<SKILL_NAME>`
   1. **WHAT:** Supplies the admitted skill identity for the active pipeline stage.
   2. **WHY:** The skill wrapper must invoke and describe the exact selected skill.
2. `<PIPELINE_RUN_ID>`
   1. **WHAT:** Supplies the durable identity of the owning pipeline run.
   2. **WHY:** Stage work and diagnostics must remain attributable to one pipeline execution.
3. `<PIPELINE_NAME>`
   1. **WHAT:** Supplies the human-readable admitted pipeline name.
   2. **WHY:** The agent needs the workflow identity that gives the current stage meaning.
4. `<SOURCE_CARD_ID>`
   1. **WHAT:** Supplies the source card identity that initiated the pipeline.
   2. **WHY:** Reads, relationships, and progress updates must remain scoped to the initiating task.
5. `<SOURCE_CARD_TITLE>`
   1. **WHAT:** Supplies the current human-readable source-card title.
   2. **WHY:** Prompt context should name the task without forcing an additional identity lookup.
6. `<STEP_ID>`
   1. **WHAT:** Supplies the structural identity of the active pipeline step.
   2. **WHY:** Execution evidence and dynamic continuation must identify the exact stage being processed.
7. `<STEP_TITLE>`
   1. **WHAT:** Supplies the human-readable title of the active pipeline step.
   2. **WHY:** The agent needs the stage purpose alongside its structural identity.
8. `<STEP_INPUT_CARD_ID>`
   1. **WHAT:** Supplies the card identity selected as input to the active step.
   2. **WHY:** The stage must know which durable artifact owns its direct input.
9. `<STEP_INPUT_CARD_CONTENT>`
   1. **WHAT:** Supplies the admitted Markdown content of the active step's input card.
   2. **WHY:** A stage must receive its direct predecessor result without performing an ambiguous repository search.
10. `<OUTPUT_PARENT_CARD_ID>`
    1. **WHAT:** Supplies the parent card under which the stage output is structurally linked.
    2. **WHY:** Output creation and progress mutation must preserve the admitted task hierarchy.
11. `<OUTPUT_CARD_ID>`
    1. **WHAT:** Supplies the durable card identity assigned to the active stage output.
    2. **WHY:** The stage must update the exact preallocated output rather than create an unrelated artifact.
12. `<OUTPUT_SUBTASK_POSITION>`
    1. **WHAT:** Supplies the output card's admitted position among sibling subtasks.
    2. **WHY:** Pipeline output order must remain structural and deterministic.
13. `<OUTPUT_MARKDOWN_FILE>`
    1. **WHAT:** Supplies the exact Markdown path where the stage writes its final result.
    2. **WHY:** The next stage requires one deterministic durable handoff artifact.
14. `<SERVER_SKILL_CONTEXT>`
    1. **WHAT:** Supplies optional instructions packaged by the canonical server-owned skill; workspace-discovered skills receive an empty value.
    2. **WHY:** Server-governed skills can carry trusted execution context without changing natural workspace skill discovery.

---

## D. Authored Context Expressions

1. `<MASTER_TASK>`
   1. **WHAT:** Supplies the admitted master-task Markdown.
   2. **WHY:** Gates and strategic summaries need the complete governing objective and current task state.
2. `<SUB_CONTEXT>`
   1. **WHAT:** Supplies the admitted local subtask context selected for the active stage.
   2. **WHY:** Recursive work needs its relevant child boundary without loading unrelated task history.
3. `<FULL_THREAD>`
   1. **WHAT:** Supplies the complete admitted thread conversation.
   2. **WHY:** A gate or authored prompt may require the full operator-agent decision history.
4. `<FILE_MAP>`
   1. **WHAT:** Supplies the generated repository file map when the compiled prompt references it.
   2. **WHY:** Code-oriented stages can navigate the repository from a bounded structural inventory instead of broad discovery.
5. `<PREVIOUS_SKILL_RESULT>`
   1. **WHAT:** Supplies the direct result produced by the preceding pipeline skill.
   2. **WHY:** Dynamic gate recursion needs an explicit one-step handoff without conflating it with the full task context.
6. `<EXECUTION_CONTEXT>`
   1. **WHAT:** Supplies the admitted execution-context object serialized as formatted JSON.
   2. **WHY:** Authored prompts need one structured boundary for execution-specific facts that do not belong in prompt Markdown.

---

## E. Direct Card-Run Expressions

1. `<PROJECT_ID>`
   1. **WHAT:** Supplies the registered project identity owning the direct run.
   2. **WHY:** Multi-project servers must keep card reads, execution state, and writes inside the selected project.
2. `<CARD_ID>`
   1. **WHAT:** Supplies the card identity owning the direct run.
   2. **WHY:** Direct execution and `ledger-cli` mutations must target the exact admitted task.
3. `<THREAD_ID>`
   1. **WHAT:** Supplies the thread identity associated with the direct-run card.
   2. **WHY:** The final answer and thread reads must remain attached to the correct conversation.
4. `<RUN_SKILL_POLICY>`
   1. **WHAT:** Expands to `- Do not invoke or use any skill for this run. Execute the operator request directly.` when `disallowSkills` is true; otherwise it is empty.
   2. **WHY:** The direct-run admission decision must be able to prohibit recursive skill invocation without maintaining a second prompt template.
5. `<PROTECTED_GIT_PATCH>`
   1. **WHAT:** When the workspace Git index is non-empty, reads the complete `git diff --cached --no-ext-diff --no-color --unified=0` patch and injects it with an instruction not to modify, overwrite, or unstage those lines; otherwise it is empty.
   2. **WHY:** Staged hunks are operator-approved and must remain visible as an exact protected boundary to the direct-run agent.

`PROTECTED_GIT_PATCH` is currently serialized inside the compiled `developer_instructions` Codex CLI argument. Large staged patches can exceed operating-system argument limits and fail process creation with `spawn E2BIG`; prompt admission currently has no staged-patch size boundary.

---

## F. Four Mandatory System Prompts

1. `SYSTEM_PROMPT`
   1. **WHAT:** Provides common Decision OS developer instructions, including `<PLATFORM>` and the required Git commit-message contract.
   2. **WHY:** Every pipeline and direct run needs one shared policy root before its execution-specific wrapper.
2. `SKILL`
   1. **WHAT:** Wraps a normal pipeline skill with pipeline, step, input, output, server-skill, ledger, and handoff expressions.
   2. **WHY:** Every skill stage must receive the same deterministic execution contract regardless of the selected skill.
3. `CLI_TOOLS`
   1. **WHAT:** Defines the `ledger-cli` commands for dynamic continuation, task inspection, repository maps, operator answers, progress, and authorized completion.
   2. **WHY:** Pipeline prompts need one reusable command contract instead of duplicating mutable CLI instructions.
4. `CODEX_RUN`
   1. **WHAT:** Wraps a direct card and thread Codex run with its operator-facing behavior, formatting, CLI guidance, and referenced direct-run context.
   2. **WHY:** Direct runs need a dedicated prompt boundary distinct from pipeline-stage execution while retaining the shared system policy.

The admitted root graphs are `SYSTEM_PROMPT` followed by `SKILL` for a normal skill, `SYSTEM_PROMPT` followed by the selected authored prompt for a gate, and `SYSTEM_PROMPT` followed by `CODEX_RUN` for a direct card or thread run. `CLI_TOOLS` is included only when another prompt references it.

---

## G. Canonical Owners

1. Runtime-token names and syntax belong to `backend/src/business/codex/helper/pipeline-prompt-library.ts`.
2. Direct-run providers belong to `backend/src/business/codex/helper/build-thread-codex-prompt.ts`.
3. Staged-patch extraction belongs to `backend/src/business/git-review/helper/git-review-patch.ts`.
4. Codex CLI serialization belongs to `backend/src/business/codex/helper/resolve-codex-command.ts`.
5. Packaged mandatory prompt Markdown belongs to `backend/templates/pipeline-prompts/`.
6. Live prompt Markdown and registration belong to the server-owned `.decision-os/pipeline-prompts/` directory and `.decision-os/codex-pipelines.json`.
