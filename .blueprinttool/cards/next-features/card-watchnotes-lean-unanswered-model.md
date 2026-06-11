## A. Problem

1. **Current payload is bloated.** `answerCommand`, `editInstruction`, `lastNote`, `threadId`, `targetId`, `title`, and full `ThreadNote` metadata duplicate information the agent either already knows from the skill or does not need for treatment.
2. **Current payload misses useful context.** The agent needs the thread file, card file, pending note text, zone title, zone summary, and nearby card summaries more than it needs note ids, statuses, timestamps, or generated answer commands.
3. **Instruction location is wrong.** Markdown patching rules belong in `corev2-treat-open-notes`, not in every `ledger-cli unanswered` record.
4. **Pending notes need one readable unit.** Multiple unanswered operator notes must be preserved separately, but also provided as one concatenated text block so the agent handles the full request.

---

## B. Target Output Shape

1. **New command contract.** The watcher-facing command should return a lean context payload:

```ts
/**
 * Proposed watcher-facing output for:
 * ledger-cli unanswered --ledger <ledger-json> --json --context=watcher
 */
interface WatcherUnansweredOutput {
  /**
   * Workspace and ledger scope used for this scan.
   */
  scope: {
    workspaceCwd: string;
    ledgerFile: string;
    routeId?: string;
    tabTitle?: string;
  };

  /**
   * One item per thread that needs agent treatment.
   */
  threads: WatcherThreadContext[];
}

interface WatcherThreadContext {
  /**
   * Markdown thread file to patch when answering.
   * The skill owns the exact patch format.
   */
  threadFile: string;

  /**
   * Target card markdown file, when the thread belongs to a card.
   * The agent can open this for durable content edits.
   */
  cardFile?: string;

  /**
   * Zone context for the target card or thread.
   */
  zone?: {
    id: string;
    title: string;
    summary: string;
  };

  /**
   * Compact context for cards in the same zone.
   */
  zoneCards: Array<{
    id: string;
    title: string;
    summary: string;
    contentFile?: string;
  }>;

  /**
   * Pending operator notes in chronological order.
   * Keep separators so individual notes remain identifiable.
   */
  pendingText: string;
}
```

---

## C. Removed Fields

1. **Remove `answerCommand`.** Short-answer commands are not useful for the watcher path; the agent should patch the thread file according to the skill.
2. **Remove `editInstruction`.** The instruction belongs in the skill and should not be repeated in every payload item.
3. **Remove `lastNote`.** The agent should receive all pending note text, not a privileged final note.
4. **Remove `threadId` from the agent payload.** The thread file is the actionable target. Internal implementation can still use `threadId`.
5. **Remove `targetId` and `title`.** Card and zone context are more useful than a generic target id or title fallback.
6. **Remove note metadata fields.** `error`, `id`, `role`, `status`, `timestamp`, and `voiceFileRef` should not be in the watcher prompt unless a specific workflow needs them.

---

## D. Summary Features

1. **Zone summary.** Add a durable one or two sentence summary field for zones.
2. **Card summary.** Add a durable one or two sentence summary field for cards.
3. **Generated fallback.** Until summaries exist, the CLI can fall back to card title plus first meaningful content excerpt.
4. **Update workflow.** Summaries should be editable and should travel with ledger/card persistence, not live only in transient watcher state.

---

## E. Pending Text Format

1. **Concatenate all pending notes.** The payload should include every unanswered operator note since the last agent answer.
2. **Preserve boundaries.** Separate notes with stable headings such as `Pending note 1`, `Pending note 2`, and so on.
3. **Text only by default.** The watcher prompt needs the note text. Metadata can remain available in internal CLI data but should not be sent to the agent unless explicitly requested.

---

## F. Implementation Path

1. **Keep current command for compatibility.** Leave `ledger-cli unanswered --json` available until callers migrate.
2. **Add watcher context mode.** Implement `--context=watcher` or a dedicated `watcher-unanswered` command for the lean payload.
3. **Move instructions to skill.** Keep Markdown answer rules in `corev2-treat-open-notes`.
4. **Resolve card and zone context.** Map thread targets to cards, map cards to containing zones, then collect zone and sibling-card summaries.
5. **Add tests.** Cover multiple pending notes, no containing zone, missing card file, missing summaries, multiple selected ledgers, and compatibility with the existing `unanswered --json` output.
