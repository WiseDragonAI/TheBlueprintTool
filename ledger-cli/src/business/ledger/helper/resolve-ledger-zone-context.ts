/**
 * WHAT: Read-only card and zone context resolution for ledger-cli.
 * WHY: skills need stable ledger facts without reimplementing canvas geometry.
 */
import type { Result } from '../../../lib/types.js';
import { resolveCardContentFile } from './card-content-file.js';

type JsonObject = Record<string, unknown>;

type Rect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type CardSummary = {
  id: string;
  title: string;
  status: string;
  cardType: string;
  geometry: Rect | null;
  contentFile: string;
  absoluteContentFile: string;
};

export type LedgerCardContext = {
  card: JsonObject;
  contentFile: string;
  absoluteContentFile: string;
  relationships: {
    inbound: JsonObject[];
    outbound: JsonObject[];
  };
  zone: JsonObject | null;
};

export type LedgerZoneCardsContext = {
  zone: JsonObject;
  cards: CardSummary[];
};

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function rectFor(entry: JsonObject): Rect | null {
  const id = text(entry.id);
  const x = numberValue(entry.x);
  const y = numberValue(entry.y);
  const w = numberValue(entry.w) ?? numberValue(entry.width);
  const h = numberValue(entry.h) ?? numberValue(entry.height);
  return id && x !== undefined && y !== undefined && w !== undefined && h !== undefined && w > 0 && h > 0
    ? { id, x, y, w, h }
    : null;
}

function overlapArea(left: Rect, right: Rect): number {
  const width = Math.max(0, Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y));
  return width * height;
}

export function sortByCanvasPosition<T extends JsonObject>(left: T, right: T): number {
  const leftX = numberValue(left.x) ?? 0;
  const rightX = numberValue(right.x) ?? 0;
  const leftY = numberValue(left.y) ?? 0;
  const rightY = numberValue(right.y) ?? 0;
  return leftX - rightX || leftY - rightY || text(left.id).localeCompare(text(right.id));
}

export function zoneTitle(zone: JsonObject): string {
  return text(zone.label) || text(zone.title) || text(zone.name) || text(zone.id) || 'Untitled zone';
}

function cardContentFileRef(card: JsonObject): string {
  const comment = isRecord(card.comment) ? card.comment : {};
  return text(comment.contentFile);
}

function absoluteContentFile(ledgerJsonFile: string, card: JsonObject): string {
  return resolveCardContentFile(ledgerJsonFile, cardContentFileRef(card)) ?? '';
}

function relationshipFromId(relationship: JsonObject): string {
  const direct = text(relationship.from);
  if (direct) return direct;
  const source = isRecord(relationship.source) ? relationship.source : {};
  return text(source.cardId);
}

function relationshipToId(relationship: JsonObject): string {
  const direct = text(relationship.to);
  if (direct) return direct;
  const target = isRecord(relationship.target) ? relationship.target : {};
  return text(target.cardId);
}

function zoneAnnotations(ledger: JsonObject): JsonObject[] {
  const annotations = Array.isArray(ledger.annotations) ? ledger.annotations.filter(isRecord) : [];
  return annotations.filter((annotation) => {
    const variant = text(annotation.variant);
    return variant === 'zone' || variant === '';
  });
}

function cards(ledger: JsonObject): JsonObject[] {
  return Array.isArray(ledger.cards) ? ledger.cards.filter(isRecord) : [];
}

function relationships(ledger: JsonObject): JsonObject[] {
  return Array.isArray(ledger.relationships) ? ledger.relationships.filter(isRecord) : [];
}

function cardSummary(ledgerJsonFile: string, card: JsonObject): CardSummary {
  return {
    id: text(card.id),
    title: text(card.title),
    status: text(card.status),
    cardType: text(card.cardType),
    geometry: rectFor(card),
    contentFile: cardContentFileRef(card),
    absoluteContentFile: absoluteContentFile(ledgerJsonFile, card),
  };
}

export function resolveCardZone(card: JsonObject, zones: JsonObject[]): JsonObject | null {
  const cardRect = rectFor(card);
  if (!cardRect) return null;

  let owner: JsonObject | null = null;
  let bestArea = 0;
  for (const zone of zones) {
    const zoneRect = rectFor(zone);
    if (!zoneRect) continue;
    const area = overlapArea(cardRect, zoneRect);
    if (area > bestArea) {
      bestArea = area;
      owner = zone;
    }
  }
  return bestArea > 0 ? owner : null;
}

export function resolveLedgerCardContext(input: { ledger: unknown; ledgerJsonFile: string; cardId?: string }): Result<LedgerCardContext> {
  if (!input.cardId) return { ok: false, error: 'card-context requires --card-id.' };
  if (!isRecord(input.ledger)) return { ok: false, error: 'card-context requires an object ledger.' };

  const card = cards(input.ledger).find((entry) => text(entry.id) === input.cardId);
  if (!card) return { ok: false, error: `Card not found: ${input.cardId}` };

  const related = relationships(input.ledger);
  return {
    ok: true,
    value: {
      card,
      contentFile: cardContentFileRef(card),
      absoluteContentFile: absoluteContentFile(input.ledgerJsonFile, card),
      relationships: {
        inbound: related.filter((relationship) => relationshipToId(relationship) === input.cardId),
        outbound: related.filter((relationship) => relationshipFromId(relationship) === input.cardId),
      },
      zone: resolveCardZone(card, zoneAnnotations(input.ledger)),
    },
  };
}

export function resolveLedgerZoneCardsContext(input: { ledger: unknown; ledgerJsonFile: string; zoneId?: string }): Result<LedgerZoneCardsContext> {
  if (!input.zoneId) return { ok: false, error: 'zone-cards requires --zone-id.' };
  if (!isRecord(input.ledger)) return { ok: false, error: 'zone-cards requires an object ledger.' };

  const zones = zoneAnnotations(input.ledger);
  const zone = zones.find((entry) => text(entry.id) === input.zoneId);
  if (!zone) return { ok: false, error: `Zone not found: ${input.zoneId}` };

  return {
    ok: true,
    value: {
      zone,
      cards: cards(input.ledger)
        .filter((card) => text(resolveCardZone(card, zones)?.id) === input.zoneId)
        .sort(sortByCanvasPosition)
        .map((card) => cardSummary(input.ledgerJsonFile, card)),
    },
  };
}
