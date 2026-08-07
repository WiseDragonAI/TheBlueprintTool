/**
 * WHAT: Normalizes decision-os workspace state to the canonical ledgers registry.
 * WHY: The app no longer exposes tabs as the model name; legacy tabs are read only for migration.
 */
export type DecisionOsLedgerEntry = {
  id: string;
  title: string;
  ledgerFile: string;
  cardId?: string;
};

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeDecisionOsState(rawState: unknown): { state: { ledgers: DecisionOsLedgerEntry[] }; migrated: boolean } {
  if (!isRecord(rawState)) throw new Error('invalid_decision_os_state_root');
  const source = rawState;
  const hasLedgers = Object.hasOwn(source, 'ledgers');
  const hasTabs = Object.hasOwn(source, 'tabs');
  if (hasLedgers && !Array.isArray(source.ledgers)) throw new Error('invalid_decision_os_state_ledgers');
  if (hasTabs && !Array.isArray(source.tabs)) throw new Error('invalid_decision_os_state_tabs');
  if (!hasLedgers && !hasTabs) throw new Error('decision_os_state_registry_missing');
  if (hasLedgers && hasTabs) throw new Error('ambiguous_decision_os_state_registry');
  const rawLedgers = (hasLedgers ? source.ledgers : source.tabs) as unknown[];
  const ledgers = rawLedgers.map((entry) => {
    if (!isRecord(entry)) throw new Error('invalid_decision_os_state_ledger_entry');
    const record = entry;
    const id = String(record.id ?? '').trim();
    const title = String(record.title ?? id).trim();
    const ledgerFile = String(record.ledgerFile ?? '').trim();
    if (!id || !title || !ledgerFile) throw new Error('invalid_decision_os_state_ledger_entry');
    const cardId = String(record.cardId ?? '').trim();
    return { id, title, ledgerFile, ...(cardId ? { cardId } : {}) };
  }) as DecisionOsLedgerEntry[];
  if (new Set(ledgers.map((entry) => entry.id)).size !== ledgers.length) throw new Error('duplicate_decision_os_state_ledger');
  const migrated = !hasLedgers;
  return { state: { ledgers }, migrated };
}
