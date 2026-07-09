type AnyRecord = Record<string, unknown>;

export type CodexLaunchZoneContext = {
  zone: {
    id: string;
    label: string;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  cards: Array<{
    id: string;
    title: string;
    status: string;
    contentFile: string;
  }>;
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cardRect(card: AnyRecord): Rect {
  const left = numeric(card.x, 0);
  const top = numeric(card.y, 0);
  const width = Math.max(0, numeric(card.w ?? card.width, 280));
  const height = Math.max(0, numeric(card.h ?? card.height, 132));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function zoneRect(zone: AnyRecord): Rect {
  const left = numeric(zone.x, 0);
  const top = numeric(zone.y, 0);
  const width = Math.max(0, numeric(zone.width ?? zone.w, 0));
  const height = Math.max(0, numeric(zone.height ?? zone.h, 0));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function overlapArea(first: Rect, second: Rect): number {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
  return width * height;
}

function intersects(first: Rect, second: Rect): boolean {
  return overlapArea(first, second) > 0;
}

function regularZones(annotations: unknown): AnyRecord[] {
  return Array.isArray(annotations)
    ? (annotations as AnyRecord[]).filter((zone) => zone.variant !== 'group' && typeof zone.color === 'string' && String(zone.id ?? '').trim())
    : [];
}

function resolveCardZone(card: AnyRecord, zones: AnyRecord[]): AnyRecord | null {
  const rect = cardRect(card);
  let bestZone: AnyRecord | null = null;
  let bestArea = 0;
  for (const zone of zones) {
    const area = overlapArea(rect, zoneRect(zone));
    if (area <= bestArea) continue;
    bestArea = area;
    bestZone = zone;
  }
  return bestZone;
}

function cardContentFile(card: AnyRecord): string {
  const comment = card.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return typeof comment.contentFile === 'string' ? comment.contentFile.trim() : '';
}

function summarizeZone(zone: AnyRecord): NonNullable<CodexLaunchZoneContext['zone']> {
  const rect = zoneRect(zone);
  return {
    id: String(zone.id ?? ''),
    label: String(zone.label ?? ''),
    color: String(zone.color ?? ''),
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function resolveCodexLaunchZoneContext(input: { ledger: AnyRecord; sourceCardId: string; excludeCardIds?: string[] }): CodexLaunchZoneContext {
  const cards = Array.isArray(input.ledger.cards) ? input.ledger.cards as AnyRecord[] : [];
  const source = cards.find((card) => String(card.id ?? '') === input.sourceCardId);
  const zone = source ? resolveCardZone(source, regularZones(input.ledger.annotations)) : null;
  if (!zone) return { zone: null, cards: [] };

  const excluded = new Set((input.excludeCardIds ?? []).map((id) => String(id)).filter(Boolean));
  const rect = zoneRect(zone);
  const zoneCards = cards
    .filter((card) => {
      const id = String(card.id ?? '');
      return id && !excluded.has(id) && intersects(rect, cardRect(card));
    })
    .map((card) => ({
      id: String(card.id ?? ''),
      title: String(card.title ?? ''),
      status: String(card.status ?? ''),
      contentFile: cardContentFile(card),
    }));

  return { zone: summarizeZone(zone), cards: zoneCards };
}

export function formatCodexLaunchZoneContext(context: CodexLaunchZoneContext): string {
  if (!context.zone) return 'Launch zone: not resolved from the launch card geometry.';
  const zone = context.zone;
  const lines = [
    `Launch zone id: ${zone.id}`,
    `Launch zone label: ${zone.label}`,
    `Launch zone color: ${zone.color}`,
    `Launch zone geometry: x=${zone.x}, y=${zone.y}, width=${zone.width}, height=${zone.height}`,
    'Cards in launch zone:',
  ];
  if (context.cards.length === 0) {
    lines.push('- none');
    return lines.join('\n');
  }
  for (const card of context.cards) {
    lines.push(`- ${card.id} | title: ${card.title} | status: ${card.status} | contentFile: ${card.contentFile || '(inline or missing)'}`);
  }
  return lines.join('\n');
}
