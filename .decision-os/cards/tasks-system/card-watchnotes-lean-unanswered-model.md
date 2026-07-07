## A. Problem

1. **Current payload is bloated.** `answerCommand`, `editInstruction`, `lastNote`, `threadId`, `targetId`, `title`, and full `ThreadNote` metadata duplicate information the agent either already knows from the skill or does not need for treatment.
2. **Current payload misses useful context.** The agent needs the thread file, card file, pending note text, zone title, zone summary, and nearby card summaries more than it needs note ids, statuses, timestamps, or generated answer commands.
3. **Instruction location is wrong.** Markdown patching rules belong in `decision-os-treat-open-notes`, not in every `ledger-cli unanswered` record.
4. **Pending notes must stay separated.** Multiple unanswered operator notes must be preserved as separate strings in chronological order so each message keeps its own context.

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
   * Pending operator messages in chronological order.
   * Each array item is one operator message; do not concatenate them.
   */
  pendingOperatorMessages: string[];
}
```
