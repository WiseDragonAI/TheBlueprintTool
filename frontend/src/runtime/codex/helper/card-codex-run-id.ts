/**
 * WHAT: Extracts the Codex run id embedded in a skill output card body.
 * WHY: The output card is the durable anchor for live run hydration.
 */
import { ledgerCardBody } from '../../ledger/helper/ledger-card-body.js';

export function cardCodexThreadRunId(card: Record<string, unknown> | null | undefined): string {
  const runId = String(card?.codexThreadRunId ?? '').trim();
  return /^codex-skill-[^\s]+$/.test(runId) ? runId : '';
}

export function cardCodexRunId(card: Record<string, unknown>): string {
  const fieldRunId = cardCodexThreadRunId(card) || String(card.codexRunId ?? '').trim();
  if (/^codex-skill-[^\s]+$/.test(fieldRunId)) return fieldRunId;
  const bodyMatch = ledgerCardBody(card).match(/^Codex run:\s*(codex-skill-[^\s]+)/m);
  if (bodyMatch?.[1]) return bodyMatch[1].trim();
  const idMatch = String(card.id ?? '').match(/^card-(codex-skill-[^\s]+)$/);
  return String(idMatch?.[1] ?? '').trim();
}
