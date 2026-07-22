/**
 * WHAT: Creates one deterministic optimistic copy of the current clipboard selection.
 * WHY: The local canvas and backend must use identical pasted IDs while older responses are in flight.
 */
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import {
  activeLedgerAnnotationMap,
  activeLedgerCardMap,
  type LedgerRecord
} from '../../ledger/helper/active-ledger-geometry.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { cloneSelectionState } from '../../selection/helper/clone-selection-state.js';
import { state, type SelectionState } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

function cloneRecord(record: LedgerRecord): LedgerRecord {
  // WHAT: Prefer the platform clone for structured ledger records.
  // WHY: The JSON fallback keeps deterministic behavior in older test and browser runtimes.
  return typeof structuredClone === 'function'
    ? structuredClone(record)
    : JSON.parse(JSON.stringify(record)) as LedgerRecord;
}

function pasteSuffix(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `copy-${random}`;
}

function offsetRecord(record: LedgerRecord, id: string): LedgerRecord {
  const copy = cloneRecord(record);
  copy.id = id;
  copy.x = Number(record.x ?? 0) + 48;
  copy.y = Number(record.y ?? 0) + 48;
  return copy;
}

export async function pasteSelectionController(): Promise<void> {
  // WHAT: Require both a captured selection and an active ledger before optimistic paste.
  // WHY: DOM-only mode has no ledger records to clone consistently with the backend.
  if (!state.clipboard || !state.activeLedger) return;
  const sourceSelection = cloneSelectionState(state.clipboard);
  const suffix = pasteSuffix();
  const cards = activeLedgerCardMap();
  const annotations = activeLedgerAnnotationMap();
  const pastedSelection: SelectionState = { cardIds: [], zoneIds: [], groupIds: [] };
  const pastedCards: LedgerRecord[] = [];
  const pastedAnnotations: LedgerRecord[] = [];

  for (const sourceId of sourceSelection.cardIds) {
    const source = cards.get(sourceId);
    // WHAT: Skip clipboard IDs missing from the current active ledger.
    // WHY: Reconciliation may have removed a record after the clipboard was captured.
    if (!source) continue;
    const id = `${sourceId}-${suffix}`;
    pastedCards.push(offsetRecord(source, id));
    pastedSelection.cardIds.push(id);
  }
  for (const sourceId of sourceSelection.zoneIds) {
    const source = annotations.get(sourceId);
    // WHAT: Copy only existing non-group annotations through the zone path.
    // WHY: Variant ownership determines the backend selection collection.
    if (!source || source.variant === 'group') continue;
    const id = `${sourceId}-${suffix}`;
    pastedAnnotations.push(offsetRecord(source, id));
    pastedSelection.zoneIds.push(id);
  }
  for (const sourceId of sourceSelection.groupIds) {
    const source = annotations.get(sourceId);
    // WHAT: Copy only existing group annotations through the group path.
    // WHY: Variant ownership determines the backend selection collection.
    if (!source || source.variant !== 'group') continue;
    const id = `${sourceId}-${suffix}`;
    pastedAnnotations.push(offsetRecord(source, id));
    pastedSelection.groupIds.push(id);
  }
  const pastedCount = pastedSelection.cardIds.length + pastedSelection.zoneIds.length + pastedSelection.groupIds.length;
  // WHAT: Keep a clipboard with no surviving source records write-free.
  // WHY: An empty optimistic selection has no server mutation to reconcile.
  if (pastedCount === 0) return;

  const previousSelection = structuredClone(state.selection);
  state.selection = pastedSelection;
  await runOptimisticActiveLedgerMutation({
    mutation: { action: 'paste-selection', selection: sourceSelection, pasteSuffix: suffix },
    apply: (ledger) => {
      const cardIds = new Set(pastedCards.map((card) => String(card.id ?? '')));
      const annotationIds = new Set(pastedAnnotations.map((annotation) => String(annotation.id ?? '')));
      ledger.cards = (ledger.cards ?? []).filter((card: LedgerRecord) => !cardIds.has(String(card.id ?? ''))).concat(pastedCards.map(cloneRecord));
      ledger.annotations = (ledger.annotations ?? []).filter((annotation: LedgerRecord) => !annotationIds.has(String(annotation.id ?? ''))).concat(pastedAnnotations.map(cloneRecord));
    },
    render: (outcome) => {
      if (outcome === 'rejected') state.selection = previousSelection;
      refreshZoneAttributionCache(`optimistic-paste-selection:${outcome}`);
      telemetry('paste-selection-controller', { sourceSelection, pastedSelection, pasteSuffix: suffix, outcome });
      renderCanvasSurface({ renderThreadPanel: false });
    },
  });
}
