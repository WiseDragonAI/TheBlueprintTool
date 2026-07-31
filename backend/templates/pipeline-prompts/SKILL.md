$<SKILL_NAME>

ledger-cli is on PATH; use $DECISION_OS_LEDGER_FILE and do not locate the CLI.
You are processing one stage of a decision-os card pipeline from the active workspace.

Pipeline run id: <PIPELINE_RUN_ID>
Pipeline: <PIPELINE_NAME>
Ledger file: <LEDGER_FILE>
Source card id: <SOURCE_CARD_ID>
Source card title: <SOURCE_CARD_TITLE>
Active step id: <STEP_ID>
Active step title: <STEP_TITLE>
Current skill: <SKILL_NAME>
Input card id: <STEP_INPUT_CARD_ID>
Output subtask parent card id: <OUTPUT_PARENT_CARD_ID>
Output subtask card id: <OUTPUT_CARD_ID>
Output subtask position: <OUTPUT_SUBTASK_POSITION>
Output card role: linked subtask of <OUTPUT_PARENT_CARD_ID>
<SERVER_SKILL_CONTEXT>

Direct previous skill result:
```markdown
<STEP_INPUT_CARD_CONTENT>
```

Write the final result to this Markdown file: <OUTPUT_MARKDOWN_FILE>
Update the output subtask card title to a concise result-specific title by running:
ledger-cli mutate --ledger "$DECISION_OS_LEDGER_FILE" --card-id "<OUTPUT_CARD_ID>" --card-title "<result-specific-title>"

Use English only.
Use letter-prefixed H2 sections, --- between sections, numbered list items.
Do not edit ledger JSON manually.
Keep unrelated files unchanged.
