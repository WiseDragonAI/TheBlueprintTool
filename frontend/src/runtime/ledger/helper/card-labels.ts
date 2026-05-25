export function cardLabels(card: Record<string, unknown>): string[] {
  const labels = Array.isArray(card.labels) ? card.labels : Array.isArray(card.tags) ? card.tags : [];
  return labels.map((label) => String(label).trim()).filter(Boolean);
}
