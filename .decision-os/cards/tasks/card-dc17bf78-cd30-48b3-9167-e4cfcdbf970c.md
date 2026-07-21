#master-task #task-complete

Ledger: Specs
Waiting since: 2026-07-12T08:48:25.797Z
Queue rank: 3
Active since: 2026-07-12T08:49:48.706Z
Completed at: 2026-07-12T11:21:01.110Z

## A. Scope

1. **Objective:** Make recoverable `apply_patch` verification failures non-actionable in the Codex Log while preserving the raw run log.
2. **Prior commit audit:** Verify that commit `76e63b4` contains the complete file-change normalization, lifecycle grouping, relative-path presentation, metrics, tests, and typecheck evidence.
3. **Runtime requirement:** Ensure the operator-facing server loads committed source before judging the rendered result.

---

## B. Findings

1. **Patch failure cause:** The prior agent patched thread transcription text that no longer matched the file, so Codex emitted `apply_patch verification failed` and then completed the work through a corrected patch.
2. **Misleading diagnostic:** The visible `readFile` line was expected patch context, not a diagnostic named `Refile`.
3. **Stale runtime:** The screenshot shows pre-`76e63b4` behavior: standalone `file_change` cards, duplicate lifecycle rows, and absolute paths. The committed code normalizes file changes to `tool_call`, coalesces lifecycle identities in the frontend reducer, and relativizes workspace paths.

---

## C. Implementation

1. **Diagnostic classification:** Suppress the known non-terminal `apply_patch verification failed` stderr record and its multiline expected-context payload from actionable diagnostics and failed-status inference.
2. **Evidence retention:** Keep the complete patch failure in the raw `.log` artifact.
3. **Regression coverage:** Verify a failed patch followed by an active run reports `running`, `errorCount: 0`, and no actionable diagnostic.

---

## D. Acceptance Criteria

1. **Recoverable patch failure:** A context mismatch does not produce a red error card or mark the run failed.
2. **Real failures:** Spawn, `ENOENT`, cancellation, and other actionable stderr records retain their existing status behavior.
3. **File changes:** One compact `Files` tool row uses workspace-relative paths and the latest lifecycle status after the server reloads commit `76e63b4`.
4. **Verification:** Focused backend tests and backend TypeScript checks pass.

---

## E. Subtasks

1. **Direct treatment:** No subtask cards are required for this two-file diagnostic-classification fix.
