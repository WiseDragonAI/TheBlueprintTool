/**
 * WHAT: Clears terminal active-run ownership while preserving the card's resumable run identity.
 * WHY: A settled run must not remain projected as active, and a newer run must never be cleared by an older callback.
 */
import { readFileSync, writeFileSync } from 'node:fs';

type AnyRecord = Record<string, unknown>;

export function clearCardCodexActiveRun(input: { ledgerPath: string; cardId: string; runId: string }): boolean {
  try {
    const ledger = JSON.parse(readFileSync(input.ledgerPath, 'utf8')) as AnyRecord & { cards?: AnyRecord[] };
    const card = (ledger.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
    if (!card || String(card.codexActiveRunId ?? '') !== input.runId) return false;
    delete card.codexActiveRunId;
    writeFileSync(input.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
    return true;
  } catch {
    // The run is still settled in memory when its project was removed during shutdown.
    return false;
  }
}
