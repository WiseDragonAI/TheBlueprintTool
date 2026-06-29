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
  const source = isRecord(rawState) ? rawState : {};
  const rawLedgers = Array.isArray(source.ledgers) ? source.ledgers : Array.isArray(source.tabs) ? source.tabs : [];
  const ledgers = rawLedgers.map((entry) => {
    const record = isRecord(entry) ? entry : {};
    const id = String(record.id ?? '').trim();
    const title = String(record.title ?? id).trim();
    const ledgerFile = String(record.ledgerFile ?? '').trim();
    if (!id || !title || !ledgerFile) return null;
    const cardId = String(record.cardId ?? '').trim();
    return { id, title, ledgerFile, ...(cardId ? { cardId } : {}) };
  }).filter(Boolean) as DecisionOsLedgerEntry[];
  const migrated = !Array.isArray(source.ledgers) || Array.isArray(source.tabs);
  return { state: { ledgers }, migrated };
}
