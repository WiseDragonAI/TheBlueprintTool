export function ledgerCardBody(card: Record<string, unknown>): string {
  const comment = card.comment && typeof card.comment === 'object' ? (card.comment as Record<string, unknown>).what : '';
  const fields = Array.isArray(card.fields) ? `Fields: ${card.fields.map((field: { name?: string }) => field.name).filter(Boolean).join(', ')}` : '';
  return String(comment || fields || card.cardType || 'Ledger card');
}
