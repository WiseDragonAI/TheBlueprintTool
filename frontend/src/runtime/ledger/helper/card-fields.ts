export type LedgerCardField = { name: string; type: string };

export function cardFields(card: Record<string, unknown>): LedgerCardField[] {
  const fields = Array.isArray(card.fields) ? card.fields : [];
  return fields.map((field) => {
    const entry = field as Record<string, unknown>;
    return {
      name: String(entry.name ?? '').trim(),
      type: String(entry.type ?? '').trim()
    };
  }).filter((field) => field.name || field.type);
}
