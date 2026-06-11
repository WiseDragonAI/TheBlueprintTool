## A. Actual Command Path

1. **Entrypoint.** `bin/ledger-cli.mjs` spawns `ledger-cli/bin/ledger-cli.ts` through the package-local `tsx` loader and preserves the caller cwd.
2. **Dispatch.** `ledger-cli/bin/ledger-cli.ts` calls `dispatchLedgerCliCommandController(process.argv.slice(2))`.
3. **Argument parsing.** `parseLedgerCliArgv` maps `unanswered --ledger <path> --json` to `mode: "unanswered"`, `ledgerJsonFile: <path>`, and `json: true`.
4. **Ledger read.** `manageLedgerJsonController` reads the committed ledger JSON through `readLedgerJson`.
5. **Thread hydration.** Before `unanswered` runs, `hydrateLedgerThreadNotes` loads every sidecar listed in `ledger.threadFiles` and writes parsed notes into `ledger.notes[threadId]` in memory.
6. **Thread discovery.** `findUnansweredThreads(ledger.value, ledgerJsonFile)` derives the output records.
7. **Formatting.** `formatUnansweredThreads(threads, true)` returns `JSON.stringify({ threads }, null, 2)`.

---

## B. Current JSON Shape

1. **Top level.** The output is an object with one key: `threads`.
2. **`threads`.** Array of unanswered thread records. It is empty when no thread has an operator note after the last agent answer.
3. **Thread record keys.** Each record contains `answerCommand`, `editInstruction`, `lastNote`, `pendingNotes`, `targetId`, `threadFile`, `threadId`, and `title`.
4. **Note record keys.** `lastNote` and each `pendingNotes[]` item contain `error`, `id`, `message`, `role`, `status`, `timestamp`, and `voiceFileRef`.
5. **String normalization.** Missing note fields become empty strings because `toThreadNote` uses `text(value)`.

---

## C. Field Derivation

1. **`threadId`.** Comes from the key in `ledger.notes`, after sidecar hydration.
2. **`targetId`.** Derived with `threadId.replace(/^thread-/, "")`.
3. **`title`.** Resolved from the target card title, then annotation label, then `targetId`, then `threadId`.
4. **`threadFile`.** Uses `ledger.threadFiles[threadId]` when present; otherwise falls back to `.blueprinttool/threads/<ledger-stem>/<thread-id>.md`.
5. **`answerCommand`.** Built as `ledger-cli answer --ledger <ledgerJsonFile> --thread-id <threadId> --message "..."`.
6. **`editInstruction`.** Built from `threadFile` and tells the agent to patch the Markdown sidecar directly with one `# AGENT` section.
7. **`pendingNotes`.** All meaningful non-agent notes after the last agent or assistant note.
8. **`lastNote`.** The final item in `pendingNotes`.

---

## D. Pending Logic

1. **Meaningful note filter.** A note is meaningful if it has any of `role`, `message`, `body`, `status`, or `voiceFileRef`.
2. **Agent answer detection.** A note is treated as answered when `role` is `agent` or `assistant`.
3. **Last answer boundary.** The command finds the last agent/assistant note index in the meaningful notes.
4. **Pending slice.** It takes notes after that index and filters out agent/assistant notes.
5. **Thread inclusion.** A thread is included only when that pending slice has at least one note.

---

## E. Important Gaps For Watcher Context

1. **No card body.** The output does not include the target card markdown content.
2. **No full thread body.** It includes note messages, but not the raw sidecar markdown or earlier answered context beyond the pending slice.
3. **No zone context.** It does not identify containing zones, neighboring cards, or zone intent.
4. **No queue metadata.** It does not include `to_process`, `processing`, trigger source, batch ordering, or watcher run id.
5. **No workspace summary.** It preserves relative ledger/thread paths but does not include route id, tab title, or workspace cwd.
