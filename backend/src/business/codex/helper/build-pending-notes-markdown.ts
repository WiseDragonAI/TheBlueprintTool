/**
 * WHAT: Renders the active thread notes that ledger-cli classifies as awaiting an agent answer.
 * WHY: <PENDING_NOTES> must reuse the CLI's authoritative last-agent boundary without duplicating its selection algorithm.
 */
import { findUnansweredThreads } from '../../../../../ledger-cli/src/business/ledger/helper/find-unanswered-threads.js';
import { formatThreadMarkdown } from '../../ledger/helper/thread-content-file.js';

type AnyRecord = Record<string, unknown>;

export function buildPendingNotesMarkdown(input: {
  ledger: unknown;
  ledgerJsonFile: string;
  threadId: string;
}): string {
  const pending = findUnansweredThreads(input.ledger, input.ledgerJsonFile)
    .find((thread) => thread.threadId === input.threadId);
  // WHAT: Inject no notes when ledger-cli finds no unanswered entry for the active thread.
  // WHY: An answered thread must not replay superseded operator instructions.
  if (!pending) return '';
  return formatThreadMarkdown(pending.pendingNotes as AnyRecord[]);
}
