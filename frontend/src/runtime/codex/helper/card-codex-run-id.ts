/**
 * WHAT: Resolves the Codex run id owned by one thread target card.
 * WHY: Live log hydration must support explicit fields and durable generated-card fallbacks.
 */
import { ledgerCardBody } from '../../ledger/helper/ledger-card-body.js';
import { cardCodexThreadRunId } from './card-codex-thread-run-id.js';

export { cardCodexThreadRunId } from './card-codex-thread-run-id.js';

export function cardCodexRunId(card: Record<string, unknown>): string {
  const fieldRunId = String(card.codexActiveRunId ?? '').trim() || cardCodexThreadRunId(card) || String(card.codexRunId ?? '').trim();
  // WHAT: Prefer an explicit validated run field over generated-card fallbacks.
  // WHY: Explicit ownership is the least ambiguous and cheapest lookup path.
  if (/^codex-skill-[^\s]+$/.test(fieldRunId)) return fieldRunId;
  const bodyMatch = ledgerCardBody(card).match(/^Codex run:\s*(codex-skill-[^\s]+)/m);
  // WHAT: Recover the run id stored in hydrated card content.
  // WHY: File-backed cards may keep their durable run marker outside the ledger record.
  if (bodyMatch?.[1]) return bodyMatch[1].trim();
  const idMatch = String(card.id ?? '').match(/^card-(codex-skill-[^\s]+)$/);
  return String(idMatch?.[1] ?? '').trim();
}
