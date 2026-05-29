/**
 * WHAT: Complete ledger Markdown export grouped by canvas zones.
 * WHY: operators need a readable whole-ledger artifact ordered like the spatial ledger.
 */
type JsonObject = Record<string, unknown>;

type Rect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function rectFor(entry: JsonObject): Rect | undefined {
  const id = stringValue(entry.id);
  const x = numberValue(entry.x);
  const y = numberValue(entry.y);
  const w = numberValue(entry.w) ?? numberValue(entry.width);
  const h = numberValue(entry.h) ?? numberValue(entry.height);

  if (!id || x === undefined || y === undefined || w === undefined || h === undefined || w <= 0 || h <= 0) {
    return undefined;
  }

  return { id, x, y, w, h };
}

function sortByCanvasPosition<T extends JsonObject>(left: T, right: T): number {
  const leftX = numberValue(left.x) ?? 0;
  const rightX = numberValue(right.x) ?? 0;
  const leftY = numberValue(left.y) ?? 0;
  const rightY = numberValue(right.y) ?? 0;
  return leftX - rightX || leftY - rightY || String(left.id ?? '').localeCompare(String(right.id ?? ''));
}

function zoneTitle(zone: JsonObject): string {
  return stringValue(zone.label) ?? stringValue(zone.title) ?? stringValue(zone.name) ?? stringValue(zone.id) ?? 'Untitled zone';
}

function cardTitle(card: JsonObject): string {
  return stringValue(card.title) ?? stringValue(card.label) ?? stringValue(card.id) ?? 'Untitled card';
}

function cleanHeading(value: string): string {
  return value.replace(/\s+/g, ' ').trim() || 'Untitled';
}

function overlapArea(left: Rect, right: Rect): number {
  const x = Math.max(0, Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x));
  const y = Math.max(0, Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y));
  return x * y;
}

function markdownJson(value: unknown): string {
  return ['````json', JSON.stringify(value, null, 2), '````'].join('\n');
}

function metadataLines(card: JsonObject): string[] {
  const lines: string[] = [];
  const id = stringValue(card.id);
  const cardType = stringValue(card.cardType);
  const domainId = stringValue(card.domainId);
  const status = stringValue(card.status);
  const labels = Array.isArray(card.labels) ? card.labels.map((label) => String(label).trim()).filter(Boolean) : [];

  if (id) lines.push(`- id: \`${id}\``);
  if (cardType) lines.push(`- type: \`${cardType}\``);
  if (domainId) lines.push(`- domain: \`${domainId}\``);
  if (status) lines.push(`- status: \`${status}\``);
  if (labels.length > 0) lines.push(`- labels: ${labels.map((label) => `\`${label}\``).join(', ')}`);

  return lines;
}

function commentText(card: JsonObject): string | undefined {
  if (typeof card.comment === 'string') return card.comment.trimEnd();
  if (!isRecord(card.comment)) return undefined;
  return stringValue(card.comment.what)?.trimEnd()
    ?? stringValue(card.comment.body)?.trimEnd()
    ?? stringValue(card.comment.description)?.trimEnd();
}

function renderObjectList(title: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  const lines = [`### ${title}`, ''];
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      lines.push(`- ${String(entry)}`);
      return;
    }

    const itemTitle = stringValue(entry.title) ?? stringValue(entry.label) ?? stringValue(entry.name) ?? stringValue(entry.id);
    const body = stringValue(entry.what)
      ?? stringValue(entry.message)
      ?? stringValue(entry.value)
      ?? stringValue(entry.text)
      ?? stringValue(entry.body)
      ?? stringValue(entry.description)
      ?? stringValue(entry.content);

    if (itemTitle) lines.push(`#### ${cleanHeading(itemTitle)}`, '');
    else lines.push(`#### ${title.slice(0, -1)} ${index + 1}`, '');

    if (body) lines.push(body.trimEnd(), '');

    const knownKeys = new Set(['body', 'content', 'description', 'id', 'label', 'message', 'name', 'text', 'title', 'value', 'what']);
    const extra = Object.fromEntries(Object.entries(entry).filter(([key]) => !knownKeys.has(key)));
    if (Object.keys(extra).length > 0) lines.push(markdownJson(extra), '');
  });

  return lines;
}

function renderExtraContent(card: JsonObject): string[] {
  const layoutKeys = new Set([
    'backgroundColor',
    'borderColor',
    'cardType',
    'color',
    'comment',
    'domainId',
    'facts',
    'fields',
    'h',
    'height',
    'id',
    'imageSizes',
    'label',
    'labels',
    'rotation',
    'status',
    'title',
    'w',
    'width',
    'x',
    'y',
    'zIndex',
  ]);
  const extra = Object.fromEntries(Object.entries(card).filter(([key]) => !layoutKeys.has(key)));
  if (Object.keys(extra).length === 0) return [];
  return ['### Extra content', '', markdownJson(extra), ''];
}

function renderCard(card: JsonObject): string[] {
  const lines = [`## ${cleanHeading(cardTitle(card))}`, ''];
  const metadata = metadataLines(card);
  if (metadata.length > 0) lines.push(...metadata, '');

  const comment = commentText(card);
  if (comment) lines.push(comment, '');

  lines.push(...renderObjectList('Facts', card.facts));
  lines.push(...renderObjectList('Fields', card.fields));
  lines.push(...renderExtraContent(card));

  return lines;
}

function zoneOwner(card: JsonObject, zones: JsonObject[]): string | undefined {
  const cardRect = rectFor(card);
  if (!cardRect) return undefined;

  let bestZone: string | undefined;
  let bestArea = 0;
  for (const zone of zones) {
    const zoneRect = rectFor(zone);
    if (!zoneRect) continue;

    const area = overlapArea(cardRect, zoneRect);
    if (area > bestArea) {
      bestArea = area;
      bestZone = zoneRect.id;
    }
  }

  return bestArea > 0 ? bestZone : undefined;
}

export function formatLedgerMarkdownExport(ledger: unknown): string {
  if (!isRecord(ledger)) return '# Invalid ledger\n';

  const cards = Array.isArray(ledger.cards) ? ledger.cards.filter(isRecord).sort(sortByCanvasPosition) : [];
  const zones = Array.isArray(ledger.annotations)
    ? ledger.annotations.filter((annotation) => isRecord(annotation) && annotation.variant !== 'group').sort(sortByCanvasPosition)
    : [];

  const cardsByZone = new Map<string, JsonObject[]>();
  const unzonedCards: JsonObject[] = [];
  for (const card of cards) {
    const ownerId = zoneOwner(card, zones);
    if (!ownerId) {
      unzonedCards.push(card);
      continue;
    }
    cardsByZone.set(ownerId, [...(cardsByZone.get(ownerId) ?? []), card]);
  }

  const lines: string[] = [];
  for (const zone of zones) {
    const id = String(zone.id ?? '');
    const zoneCards = cardsByZone.get(id) ?? [];
    if (zoneCards.length === 0) continue;

    lines.push(`# ${cleanHeading(zoneTitle(zone))}`, '');
    for (const card of zoneCards) {
      lines.push(...renderCard(card), '');
    }
  }

  if (unzonedCards.length > 0 || lines.length === 0) {
    lines.push('# Unzoned', '');
    for (const card of unzonedCards) {
      lines.push(...renderCard(card), '');
    }
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
