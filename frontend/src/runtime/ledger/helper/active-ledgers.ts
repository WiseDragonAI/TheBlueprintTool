/**
 * WHAT: Returns the canonical frontend ledger registry with legacy fallback.
 * WHY: Runtime code is migrating from tab language to ledger language without breaking older call sites.
 */
import { state } from '../../state.js';

export function activeLedgers(): Array<{ id: string; title?: string; ledgerFile?: string; cardId?: string }> {
  const ledgers = Array.isArray(state.ledgers) ? state.ledgers : [];
  const legacyTabs = Array.isArray(state.ledgerTabs) ? state.ledgerTabs : [];
  const ledgerIds = new Set(ledgers.map((entry: { id?: string }) => entry.id));
  if (legacyTabs.some((entry: { id?: string }) => entry.id && !ledgerIds.has(entry.id))) return legacyTabs;
  return ledgers.length > 0 ? ledgers : legacyTabs;
}
