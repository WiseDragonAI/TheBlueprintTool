/**
 * WHAT: Creates a process-local monotonic revision tracker keyed by ledger ID.
 * WHY: HTTP reads, mutations, and scoped filesystem events need one revision sequence per ledger.
 */
export type LedgerRevisionTracker = {
  current(ledgerId: string): number;
  advance(ledgerId: string): number;
};

export function createLedgerRevisionTracker(): LedgerRevisionTracker {
  const revisions = new Map<string, number>();
  return {
    current(ledgerId) {
      return revisions.get(ledgerId) ?? 0;
    },
    advance(ledgerId) {
      const nextRevision = (revisions.get(ledgerId) ?? 0) + 1;
      revisions.set(ledgerId, nextRevision);
      return nextRevision;
    }
  };
}
