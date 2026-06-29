## A. Actual Command Path

1. **Entrypoint.** `bin/ledger-cli.mjs` spawns `ledger-cli/bin/ledger-cli.ts` through the package-local `tsx` loader and preserves the caller cwd.
2. **Dispatch.** `ledger-cli/bin/ledger-cli.ts` calls `dispatchLedgerCliCommandController(process.argv.slice(2))`.
3. **Argument parsing.** `parseLedgerCliArgv` maps `unanswered --ledger <path> --json` to `mode: "unanswered"`, `ledgerJsonFile: <path>`, and `json: true`.
4. **Ledger read.** `manageLedgerJsonController` reads the committed ledger JSON through `readLedgerJson`.
5. **Thread hydration.** Before `unanswered` runs, `hydrateLedgerThreadNotes` loads every content file listed in `ledger.threadFiles` and writes parsed notes into `ledger.notes[threadId]` in memory.
6. **Thread discovery.** `findUnansweredThreads(ledger.value, ledgerJsonFile)` derives the output records.
7. **Formatting.** `formatUnansweredThreads(threads, true)` returns `JSON.stringify({ threads }, null, 2)`.

---

## B. Current JSON Shape

1. **Actual output contract.** `ledger-cli unanswered --json` currently returns this shape:

```ts
/**
 * Output of:
 * node ./bin/ledger-cli.mjs unanswered --ledger <ledger-json> --json
 */
interface UnansweredThreadsOutput {
  /**
   * Empty when every thread is closed by a later agent/assistant note.
   * One item appears for each thread that still has operator notes after
   * the last agent/assistant answer.
   */
  threads: UnansweredThread[];
}

interface UnansweredThread {
  /**
   * Convenience CLI command for short answers.
   * For structured answers, the editInstruction is preferred.
   */
  answerCommand: string;

  /**
   * Exact instruction for patching the Markdown content file directly.
   * It always tells the agent to append one # AGENT section with
   * a decision-os:note metadata comment.
   */
  editInstruction: string;

  /**
   * Last pending operator note after the last agent/assistant answer.
   */
  lastNote: ThreadNote;

  /**
   * All meaningful non-agent notes after the last agent/assistant answer.
   * Multiple operator notes can accumulate here before treatment.
   */
  pendingNotes: ThreadNote[];

  /**
   * threadId without the leading "thread-" prefix.
   */
  targetId: string;

  /**
   * Markdown content file path, usually from ledger.threadFiles[threadId].
   */
  threadFile: string;

  /**
   * Key from ledger.notes after content file hydration.
   */
  threadId: string;

  /**
   * Card title, annotation label, targetId, or threadId fallback.
   */
  title: string;
}

interface ThreadNote {
  /**
   * Voice transcription or note-processing error. Empty string when absent.
   */
  error: string;

  /**
   * Note id from the thread content file metadata, or generated parser fallback.
   */
  id: string;

  /**
   * Parsed Markdown body for the note.
   */
  message: string;

  /**
   * "operator", "agent", "assistant", or empty string.
   */
  role: string;

  /**
   * Voice/transcription status such as "transcribed"; empty string when absent.
   */
  status: string;

  /**
   * ISO timestamp from note metadata; empty string when absent.
   */
  timestamp: string;

  /**
   * Workspace-local or absolute voice upload path; empty string when absent.
   */
  voiceFileRef: string;
}
```

---

## C. Field Derivation

1. **Thread identity.** `threadId` comes from the hydrated `ledger.notes` key. `targetId` is `threadId.replace(/^thread-/, "")`.
2. **Display title.** `title` resolves in this order: target card `title`, target annotation `label`, `targetId`, `threadId`.
3. **Thread file.** `threadFile` uses `ledger.threadFiles[threadId]` first, then falls back to `.decision-os/threads/<ledger-stem>/<thread-id>.md`.
4. **Pending notes.** `pendingNotes` is the meaningful non-agent slice after the last `agent` or `assistant` note.
5. **Last note.** `lastNote` is `pendingNotes.at(-1)`.
6. **String coercion.** Note fields are normalized through `text(value)`, so missing values become `""` instead of `undefined`.

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
2. **No full thread body.** It includes note messages, but not the raw card content file Markdown or earlier answered context beyond the pending slice.
3. **No zone context.** It does not identify containing zones, neighboring cards, or zone intent.
4. **No queue metadata.** It does not include `to_process`, `processing`, trigger source, batch ordering, or watcher run id.
5. **No workspace summary.** It preserves relative ledger/thread paths but does not include route id, tab title, or workspace cwd.
