export function applyPersistedGeometryToLedger(ledger: unknown, geometry: unknown): void {
  if (!ledger || typeof ledger !== 'object' || !geometry || typeof geometry !== 'object') return;
  const document = ledger as { cards?: Array<Record<string, unknown>>; annotations?: Array<Record<string, unknown>> };
  const records = geometry as Record<string, Record<string, Record<string, number>>>;
  for (const card of document.cards ?? []) {
    const record = records.cards?.[String(card.id ?? '')];
    if (!record) continue;
    card.x = Number(record.x);
    card.y = Number(record.y);
    card.w = Math.max(220, Number(record.width));
    card.h = Math.max(132, Number(record.height));
  }
  for (const annotation of document.annotations ?? []) {
    const id = String(annotation.id ?? '');
    const record = records.zones?.[id] ?? records.groups?.[id];
    if (!record) continue;
    annotation.x = Number(record.x);
    annotation.y = Number(record.y);
    annotation.width = Math.max(180, Number(record.width));
    annotation.height = Math.max(140, Number(record.height));
  }
}
