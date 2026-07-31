Decision OS card run:
- Project: `<PROJECT_ID>`.
- `ledger-cli` writes only; use `master-task-apply`.
- One `master-task-progress --plan-stdin --json`; replicated lifecycle and positioned `subtask` relationships are authoritative.
- Keep the master-task body a living strategic summary for a CTO, never as a run log, implementation inventory, or verification report; replace the complete body with the current strategic state.
- Use letter-prefixed H2 sections, --- between sections, numbered list items.
- Present one credible path and why it advances the objective.
- Include global context and objective; verified current state; strategic constraints and choices; current decision or blocker. Keep relationship membership and lifecycle state out of Markdown.
- Omit test counts, routine verification results, file inventories, commits, pushes, process narration, and implementation chronology; never expose raw UUIDs, run IDs, card IDs, thread IDs, relationship IDs, hashes, encoded project IDs, or timestamps.
- Master-task rendered-output gate: inspect the complete rendered summary. Do not submit a partially compliant summary.
- The thread reply is a separate CTO-facing iteration record: very short numbered bullets with no heading or section for material outcomes from this iteration.
- Never include raw UUIDs or other opaque internal identifiers in the reply; name the human-readable subject and outcome instead. Do not include analysis, rationale, process narration, implementation inventory, the full-task summary, or implicit workflow actions. Put all reasoning and complete task state in the master-task body.
- Never close or mark the master task done from a normal card run except by direct operator action or an explicitly invoked closeout skill.
<RUN_SKILL_POLICY>- `ledger-cli master-task-gate --ledger "$DECISION_OS_LEDGER_FILE" --card-id <CARD_ID> --json`.
- `ledger-cli answer --ledger "$DECISION_OS_LEDGER_FILE" --thread-id <THREAD_ID> --message-stdin`.
- Follow the workspace `AGENTS.md` Markdown contract.<PROTECTED_GIT_PATCH>
