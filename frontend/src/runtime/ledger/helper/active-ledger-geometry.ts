/**
 * WHAT: Reads, normalizes, and patches active-ledger canvas geometry.
 * WHY: Canvas effects need one geometry contract across cards, zones, and groups.
 */
import { state, type SelectionState } from '../../state.js';
import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';

export type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type LedgerGeometry = { x: number; y: number; width: number; height: number };

type LedgerRecord = Record<string, unknown>;

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function ledgerCardGeometry(card: LedgerRecord): LedgerGeometry {
  return {
    x: finiteNumber(card.x, 0),
    y: finiteNumber(card.y, 0),
    width: Math.max(220, finiteNumber(card.w ?? card.width, 280)),
    height: Math.max(132, finiteNumber(card.h ?? card.height, 132))
  };
}

export function ledgerAnnotationGeometry(annotation: LedgerRecord): LedgerGeometry {
  const minWidth = annotation.variant === 'group' ? 220 : 180;
  const minHeight = annotation.variant === 'group' ? 160 : 140;
  return {
    x: finiteNumber(annotation.x, 0),
    y: finiteNumber(annotation.y, 0),
    width: Math.max(minWidth, finiteNumber(annotation.width ?? annotation.w, 280)),
    height: Math.max(minHeight, finiteNumber(annotation.height ?? annotation.h, 180))
  };
}

export function geometryToRect(geometry: LedgerGeometry): CanvasRect {
  return {
    left: geometry.x,
    top: geometry.y,
    right: geometry.x + geometry.width,
    bottom: geometry.y + geometry.height,
    width: geometry.width,
    height: geometry.height
  };
}

export function activeLedgerCardRectMap(): Map<string, CanvasRect> {
  const ledger = state.activeLedger as { cards?: unknown } | null;
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as LedgerRecord[] : [];
  const entries: Array<[string, CanvasRect]> = [];
  for (const card of cards) {
    const id = String(card.id ?? '');
    if (id) entries.push([id, geometryToRect(ledgerCardGeometry(card))]);
  }
  return new Map(entries);
}

export function activeLedgerCardMap(): Map<string, LedgerRecord> {
  const ledger = state.activeLedger as { cards?: unknown } | null;
  const cards = Array.isArray(ledger?.cards) ? ledger.cards as LedgerRecord[] : [];
  const entries: Array<[string, LedgerRecord]> = [];
  for (const card of cards) {
    const id = String(card.id ?? '');
    if (id) entries.push([id, card]);
  }
  return new Map(entries);
}

export function activeLedgerAnnotationMap(): Map<string, LedgerRecord> {
  const ledger = state.activeLedger as { annotations?: unknown } | null;
  const annotations = Array.isArray(ledger?.annotations) ? ledger.annotations as LedgerRecord[] : [];
  const entries: Array<[string, LedgerRecord]> = [];
  for (const annotation of annotations) {
    const id = String(annotation.id ?? '');
    if (id) entries.push([id, annotation]);
  }
  return new Map(entries);
}

export function patchLedgerCardGeometry(card: LedgerRecord, geometry: LedgerGeometry): LedgerGeometry {
  const current = ledgerCardGeometry(card);
  const next = {
    x: Number.isFinite(geometry.x) ? geometry.x : current.x,
    y: Number.isFinite(geometry.y) ? geometry.y : current.y,
    width: Number.isFinite(geometry.width) ? Math.max(220, geometry.width) : current.width,
    height: Number.isFinite(geometry.height) ? Math.max(132, geometry.height) : current.height
  };
  card.x = next.x;
  card.y = next.y;
  card.w = next.width;
  card.h = next.height;
  return next;
}

export function patchLedgerAnnotationGeometry(annotation: LedgerRecord, geometry: LedgerGeometry): LedgerGeometry {
  const current = ledgerAnnotationGeometry(annotation);
  const minWidth = annotation.variant === 'group' ? 220 : 180;
  const minHeight = annotation.variant === 'group' ? 160 : 140;
  const next = {
    x: Number.isFinite(geometry.x) ? geometry.x : current.x,
    y: Number.isFinite(geometry.y) ? geometry.y : current.y,
    width: Number.isFinite(geometry.width) ? Math.max(minWidth, geometry.width) : current.width,
    height: Number.isFinite(geometry.height) ? Math.max(minHeight, geometry.height) : current.height
  };
  annotation.x = next.x;
  annotation.y = next.y;
  annotation.width = next.width;
  annotation.height = next.height;
  return ledgerAnnotationGeometry(annotation);
}

export function selectedLedgerGeometryPayload(selection: Partial<SelectionState> = state.selection): {
  cards: Record<string, LedgerGeometry>;
  zones: Record<string, LedgerGeometry>;
  groups: Record<string, LedgerGeometry>;
} {
  const current = cloneSelectionState(selection);
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  const payload = { cards: {}, zones: {}, groups: {} } as {
    cards: Record<string, LedgerGeometry>;
    zones: Record<string, LedgerGeometry>;
    groups: Record<string, LedgerGeometry>;
  };
  for (const id of current.cardIds) {
    const card = cards.get(id);
    if (card) payload.cards[id] = ledgerCardGeometry(card);
  }
  for (const id of current.zoneIds) {
    const annotation = annotations.get(id);
    if (annotation) payload.zones[id] = ledgerAnnotationGeometry(annotation);
  }
  for (const id of current.groupIds) {
    const annotation = annotations.get(id);
    if (annotation) payload.groups[id] = ledgerAnnotationGeometry(annotation);
  }
  return payload;
}
