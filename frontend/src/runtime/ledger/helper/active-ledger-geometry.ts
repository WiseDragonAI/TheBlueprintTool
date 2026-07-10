/**
 * WHAT: Reads, normalizes, and patches active-ledger canvas geometry.
 * WHY: Canvas effects need one geometry contract across cards, zones, and groups.
 */
import { state, type SelectionState } from '../../state.js';
import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';

export type CanvasRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type LedgerGeometry = { x: number; y: number; width: number; height: number };

export type LedgerRecord = Record<string, unknown>;
export type LedgerGeometryRecordKind = 'card' | 'annotation';

export function ledgerGeometryRevisionKey(kind: LedgerGeometryRecordKind, id: string): string {
  return `${kind}:${id}`;
}

export function currentLedgerGeometryRevision(kind: LedgerGeometryRecordKind, id: string): number {
  const key = ledgerGeometryRevisionKey(kind, id);
  return Number(state.ledgerReconciliation?.localGeometryRevisions?.[key] ?? 0);
}

export function advanceLedgerGeometryRevision(kind: LedgerGeometryRecordKind, id: string): number {
  // WHAT: Refuse to create revision entries without a stable record ID.
  // WHY: Anonymous geometry cannot be acknowledged by a later server mutation.
  if (!id) return 0;
  const reconciliation = state.ledgerReconciliation;
  reconciliation.localGeometryRevisions ??= {};
  const key = ledgerGeometryRevisionKey(kind, id);
  const nextRevision = currentLedgerGeometryRevision(kind, id) + 1;
  reconciliation.localGeometryRevisions[key] = nextRevision;
  return nextRevision;
}

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
    // WHAT: Include only addressable cards in the runtime rectangle index.
    // WHY: Selection and gestures require stable IDs.
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
    // WHAT: Include only addressable cards in the active-ledger index.
    // WHY: Optimistic operations resolve records by stable ID.
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
    // WHAT: Include only addressable annotations in the active-ledger index.
    // WHY: Optimistic operations resolve zones and groups by stable ID.
    if (id) entries.push([id, annotation]);
  }
  return new Map(entries);
}

export function insertActiveLedgerCard(card: LedgerRecord): boolean {
  // WHAT: Require an object-shaped active ledger before optimistic insertion.
  // WHY: The reconciliation coordinator owns active-ledger initialization.
  if (!state.activeLedger || typeof state.activeLedger !== 'object') return false;
  const id = String(card.id ?? '');
  // WHAT: Reject cards without stable identity.
  // WHY: Replacement and revision tracking are keyed by card ID.
  if (!id) return false;
  const cards = Array.isArray(state.activeLedger.cards) ? state.activeLedger.cards as LedgerRecord[] : [];
  state.activeLedger.cards = cards.filter((record) => String(record.id ?? '') !== id).concat(card);
  advanceLedgerGeometryRevision('card', id);
  return true;
}

export function insertActiveLedgerAnnotation(annotation: LedgerRecord): boolean {
  // WHAT: Require an object-shaped active ledger before optimistic insertion.
  // WHY: The reconciliation coordinator owns active-ledger initialization.
  if (!state.activeLedger || typeof state.activeLedger !== 'object') return false;
  const id = String(annotation.id ?? '');
  // WHAT: Reject annotations without stable identity.
  // WHY: Replacement and revision tracking are keyed by annotation ID.
  if (!id) return false;
  const annotations = Array.isArray(state.activeLedger.annotations) ? state.activeLedger.annotations as LedgerRecord[] : [];
  state.activeLedger.annotations = annotations.filter((record) => String(record.id ?? '') !== id).concat(annotation);
  advanceLedgerGeometryRevision('annotation', id);
  return true;
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
  // WHAT: Advance the local card revision only when normalized geometry changed.
  // WHY: No-op measurements must not create false reconciliation conflicts.
  if (next.x !== current.x || next.y !== current.y || next.width !== current.width || next.height !== current.height) {
    advanceLedgerGeometryRevision('card', String(card.id ?? ''));
  }
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
  // WHAT: Advance the local annotation revision only when normalized geometry changed.
  // WHY: No-op measurements must not create false reconciliation conflicts.
  if (next.x !== current.x || next.y !== current.y || next.width !== current.width || next.height !== current.height) {
    advanceLedgerGeometryRevision('annotation', String(annotation.id ?? ''));
  }
  return ledgerAnnotationGeometry(annotation);
}

export function geometryRevisionSnapshot(geometry: {
  cards?: Record<string, unknown>;
  zones?: Record<string, unknown>;
  groups?: Record<string, unknown>;
} | undefined): Record<string, number> {
  const revisions: Record<string, number> = {};
  for (const id of Object.keys(geometry?.cards ?? {})) {
    revisions[ledgerGeometryRevisionKey('card', id)] = currentLedgerGeometryRevision('card', id);
  }
  for (const id of [...Object.keys(geometry?.zones ?? {}), ...Object.keys(geometry?.groups ?? {})]) {
    revisions[ledgerGeometryRevisionKey('annotation', id)] = currentLedgerGeometryRevision('annotation', id);
  }
  return revisions;
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
    // WHAT: Serialize geometry only for selected cards still present in active state.
    // WHY: Stale selection IDs must not produce phantom mutation records.
    if (card) payload.cards[id] = ledgerCardGeometry(card);
  }
  for (const id of current.zoneIds) {
    const annotation = annotations.get(id);
    // WHAT: Serialize geometry only for selected zones still present in active state.
    // WHY: Stale selection IDs must not produce phantom mutation records.
    if (annotation) payload.zones[id] = ledgerAnnotationGeometry(annotation);
  }
  for (const id of current.groupIds) {
    const annotation = annotations.get(id);
    // WHAT: Serialize geometry only for selected groups still present in active state.
    // WHY: Stale selection IDs must not produce phantom mutation records.
    if (annotation) payload.groups[id] = ledgerAnnotationGeometry(annotation);
  }
  return payload;
}
