/**
 * WHAT: Extracts the Codex run id embedded in a skill output card body.
 * WHY: The output card is the durable anchor for live run hydration.
 */
import { ledgerCardBody } from '../../ledger/helper/ledger-card-body.js';

export function cardCodexRunId(card: Record<string, unknown>): string {
  const match = ledgerCardBody(card).match(/^Codex run:\s*(codex-skill-[^\s]+)/m);
  return String(match?.[1] ?? '').trim();
}
