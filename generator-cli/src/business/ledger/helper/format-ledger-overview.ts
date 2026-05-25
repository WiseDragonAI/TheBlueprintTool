/**
 * WHAT: Formats a low-noise card and relationship overview from a ledger JSON object.
 * WHY: operators need a compact global view without browser layout, comments, geometry, annotations, or notes.
 */
type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function cardLabel(card: JsonObject | undefined, fallbackId: string): string {
  if (!card) return fallbackId;
  const title = text(card.title) || fallbackId;
  const id = text(card.id) || fallbackId;
  return `${title} (${id})`;
}

export function formatLedgerOverview(ledger: unknown): string {
  if (!isRecord(ledger)) {
    return 'Ledger overview unavailable: root value is not an object.';
  }

  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(isRecord) : [];
  const relationships = Array.isArray(ledger.relationships) ? ledger.relationships.filter(isRecord) : [];
  const cardById = new Map<string, JsonObject>();
  for (const card of cards) {
    const id = text(card.id);
    if (id) cardById.set(id, card);
  }

  const lines: string[] = [
    `Cards (${cards.length})`,
    ...cards.map((card) => {
      const id = text(card.id) || '(missing-id)';
      const title = text(card.title) || '(untitled)';
      const type = text(card.cardType);
      return type ? `- ${id} :: ${title} [${type}]` : `- ${id} :: ${title}`;
    }),
    '',
    `Relationships (${relationships.length})`,
    ...relationships.map((relationship) => {
      const id = text(relationship.id) || '(missing-id)';
      const from = text(relationship.from);
      const to = text(relationship.to);
      const label = text(relationship.label);
      const edge = label ? ` --${label}--> ` : ' --> ';
      return `- ${id}: ${cardLabel(cardById.get(from), from || '(missing-from)')}${edge}${cardLabel(cardById.get(to), to || '(missing-to)')}`;
    }),
  ];

  return lines.join('\n');
}
