/**
 * WHAT: Owns response-time replacement of the active ledger.
 * WHY: Loads and mutations can resolve out of order while local canvas work continues.
 */
import { state, type LedgerReconciliationState, type SelectionState } from '../../state.js';
import { renderSelectionState } from '../../selection/effect/render-selection-state.js';
import { pruneSelectionToActiveLedger } from '../../selection/helper/prune-selection-to-active-ledger.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { ledgerGeometryRevisionKey } from '../helper/active-ledger-geometry.js';
import { mergeLocalCanvasStateIntoLedger } from '../helper/merge-local-canvas-state.js';
import { mergeLocalThreadNotes } from '../helper/merge-local-thread-notes.js';
import { refreshZoneAttributionCache } from '../helper/zone-attribution-cache.js';

type AnyRecord = Record<string, any>;

export type LedgerReconciliationRequest = {
  ledgerStateId: string;
  routeEpoch: number;
  sequence: number;
  localGeometryRevisions: Record<string, number>;
};

export type LedgerRouteReconciliationSnapshot = Pick<LedgerReconciliationState,
  'routeLedgerStateId' | 'lastAppliedServerRevision' | 'lastAppliedSequence' | 'localGeometryRevisions'>;

export type ReconcileActiveLedgerInput = {
  ledger: unknown;
  request: LedgerReconciliationRequest;
  serverRevision: number | null;
  source: string;
  submittedGeometryRevisions?: Record<string, number>;
};

export const ledgerRevisionHeader = 'x-decision-os-ledger-revision';

function reconciliationState(): LedgerReconciliationState {
  return state.ledgerReconciliation as LedgerReconciliationState;
}

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function emptySelection(): SelectionState {
  return { cardIds: [], zoneIds: [], groupIds: [] };
}

function recordIds(ledger: AnyRecord): Set<string> {
  const ids = new Set<string>();
  for (const card of Array.isArray(ledger.cards) ? ledger.cards : []) {
    const id = String(card?.id ?? '');
    // WHAT: Track only addressable card geometry records.
    // WHY: Empty IDs cannot own a local revision.
    if (id) ids.add(ledgerGeometryRevisionKey('card', id));
  }
  for (const annotation of Array.isArray(ledger.annotations) ? ledger.annotations : []) {
    const id = String(annotation?.id ?? '');
    // WHAT: Track only addressable annotation geometry records.
    // WHY: Empty IDs cannot own a local revision.
    if (id) ids.add(ledgerGeometryRevisionKey('annotation', id));
  }
  return ids;
}

function localGeometryIds(ledger: AnyRecord): { cardIds: Set<string>; annotationIds: Set<string> } {
  const cardIds = new Set<string>();
  const annotationIds = new Set<string>();
  for (const card of Array.isArray(ledger.cards) ? ledger.cards : []) {
    const id = String(card?.id ?? '');
    // WHAT: Collect addressable local cards for possible geometry preservation.
    // WHY: Reconciliation cannot merge a record without stable identity.
    if (id) cardIds.add(id);
  }
  for (const annotation of Array.isArray(ledger.annotations) ? ledger.annotations : []) {
    const id = String(annotation?.id ?? '');
    // WHAT: Collect addressable local annotations for possible geometry preservation.
    // WHY: Reconciliation cannot merge a record without stable identity.
    if (id) annotationIds.add(id);
  }
  return { cardIds, annotationIds };
}

function geometryIdsToPreserve(input: ReconcileActiveLedgerInput, localLedger: AnyRecord): {
  cardIds: Set<string>;
  annotationIds: Set<string>;
  retainMissingCardIds: Set<string>;
  retainMissingAnnotationIds: Set<string>;
} {
  const reconciliation = reconciliationState();
  const { cardIds, annotationIds } = localGeometryIds(localLedger);
  const retainMissingCardIds = new Set<string>();
  const retainMissingAnnotationIds = new Set<string>();
  const submitted = input.submittedGeometryRevisions ?? {};
  const keys = new Set([
    ...Object.keys(input.request.localGeometryRevisions),
    ...Object.keys(reconciliation.localGeometryRevisions),
    ...Object.keys(submitted)
  ]);
  for (const key of keys) {
    const requestRevision = Number(input.request.localGeometryRevisions[key] ?? 0);
    const currentRevision = Number(reconciliation.localGeometryRevisions[key] ?? 0);
    const submittedRevision = submitted[key];
    const changedAfterRequest = currentRevision > requestRevision;
    const changedAfterSubmission = submittedRevision !== undefined && currentRevision !== submittedRevision;
    const cardId = key.startsWith('card:') ? key.slice('card:'.length) : '';
    const annotationId = key.startsWith('annotation:') ? key.slice('annotation:'.length) : '';
    // WHAT: Accept server geometry only when it acknowledges the latest submitted local revision.
    // WHY: A matching acknowledgement no longer needs local preservation.
    if (submittedRevision !== undefined && currentRevision === submittedRevision) {
      if (cardId) cardIds.delete(cardId);
      if (annotationId) annotationIds.delete(annotationId);
      continue;
    }
    // WHAT: Ignore records unchanged since both request and submission boundaries.
    // WHY: Their server representation is safe to accept directly.
    if (!changedAfterRequest && !changedAfterSubmission) continue;
    // WHAT: Retain locally created or edited records missing from an older response.
    // WHY: Optimistic work must survive stale server snapshots.
    if (cardId) retainMissingCardIds.add(cardId);
    if (annotationId) retainMissingAnnotationIds.add(annotationId);
  }
  return { cardIds, annotationIds, retainMissingCardIds, retainMissingAnnotationIds };
}

function pruneGeometryRevisions(ledger: AnyRecord): void {
  const reconciliation = reconciliationState();
  const retainedKeys = recordIds(ledger);
  reconciliation.localGeometryRevisions = Object.fromEntries(
    Object.entries(reconciliation.localGeometryRevisions).filter(([key]) => retainedKeys.has(key))
  );
}

function repaintVisibleSelection(): void {
  // WHAT: Skip DOM repaint in non-browser runtimes.
  // WHY: Reconciliation state is also exercised by headless integration tests.
  if (!globalThis.document?.querySelectorAll) return;
  renderSelectionState({ renderControls: false });
}

function replaceActiveLedger(ledger: AnyRecord, ledgerStateId: string): void {
  // This is the only production assignment boundary for the whole active ledger.
  state.activeLedger = ledger;
  state.activeLedgerId = ledgerStateId;
}

export function snapshotLedgerReconciliationRoute(): LedgerRouteReconciliationSnapshot {
  const reconciliation = reconciliationState();
  return {
    routeLedgerStateId: reconciliation.routeLedgerStateId,
    lastAppliedServerRevision: reconciliation.lastAppliedServerRevision,
    lastAppliedSequence: reconciliation.lastAppliedSequence,
    localGeometryRevisions: { ...reconciliation.localGeometryRevisions }
  };
}

export function advanceLedgerRouteEpoch(ledgerStateId: string): number {
  const reconciliation = reconciliationState();
  reconciliation.routeEpoch += 1;
  reconciliation.routeLedgerStateId = ledgerStateId;
  reconciliation.lastAppliedServerRevision = -1;
  reconciliation.lastAppliedSequence = 0;
  reconciliation.localGeometryRevisions = {};
  return reconciliation.routeEpoch;
}

export function restoreLedgerReconciliationRoute(snapshot: LedgerRouteReconciliationSnapshot): void {
  const reconciliation = reconciliationState();
  reconciliation.routeEpoch += 1;
  reconciliation.routeLedgerStateId = snapshot.routeLedgerStateId;
  reconciliation.lastAppliedServerRevision = snapshot.lastAppliedServerRevision;
  reconciliation.lastAppliedSequence = snapshot.lastAppliedSequence;
  reconciliation.localGeometryRevisions = { ...snapshot.localGeometryRevisions };
}

export function beginActiveLedgerRequest(ledgerStateId: string): LedgerReconciliationRequest {
  const reconciliation = reconciliationState();
  // WHAT: Advance the route epoch when a request targets a different ledger surface.
  // WHY: Responses from the previous route must become permanently ineligible.
  if (reconciliation.routeLedgerStateId !== ledgerStateId) advanceLedgerRouteEpoch(ledgerStateId);
  const sequence = reconciliation.nextRequestSequence;
  reconciliation.nextRequestSequence += 1;
  return {
    ledgerStateId,
    routeEpoch: reconciliation.routeEpoch,
    sequence,
    localGeometryRevisions: { ...reconciliation.localGeometryRevisions }
  };
}

export function ledgerRevisionFromResponse(response: { headers?: { get?(name: string): string | null } } | undefined): number | null {
  const raw = response?.headers?.get?.(ledgerRevisionHeader);
  // WHAT: Preserve compatibility with mocks and servers that omit the revision header.
  // WHY: Request-sequence ordering remains the fallback contract.
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export function recordActiveLedgerLoadFailure(input: {
  request: LedgerReconciliationRequest;
  source: string;
  reason: string;
}): void {
  const reconciliation = reconciliationState();
  reconciliation.failedLoadCount += 1;
  reconciliation.lastFailedLoad = {
    at: new Date().toISOString(),
    ledgerStateId: input.request.ledgerStateId,
    routeEpoch: input.request.routeEpoch,
    sequence: input.request.sequence,
    source: input.source,
    reason: input.reason
  };
  telemetry('active-ledger-reconciliation-failed', reconciliation.lastFailedLoad);
}

export function ensureCoordinatorOwnedActiveLedger(ledgerStateId: string): AnyRecord {
  // WHAT: Reuse the current active ledger when it already has the required object shape.
  // WHY: Optimistic note insertion must not replace an existing ledger identity.
  if (isRecord(state.activeLedger)) return state.activeLedger;
  const ledger = { cards: [], annotations: [], relationships: [], notes: {} };
  replaceActiveLedger(ledger, ledgerStateId);
  return ledger;
}

export function reconcileActiveLedgerState(input: ReconcileActiveLedgerInput): boolean {
  const reconciliation = reconciliationState();
  // WHAT: Reject non-object response bodies at the single assignment boundary.
  // WHY: Invalid server data must leave the visible ledger untouched.
  if (!isRecord(input.ledger)) {
    recordActiveLedgerLoadFailure({ request: input.request, source: input.source, reason: 'invalid-ledger' });
    return false;
  }
  // WHAT: Reject responses from a previous route epoch or ledger identity.
  // WHY: Navigation makes every older request ineligible regardless of arrival order.
  if (input.request.routeEpoch !== reconciliation.routeEpoch || input.request.ledgerStateId !== reconciliation.routeLedgerStateId) {
    telemetry('active-ledger-reconciliation-rejected', { source: input.source, reason: 'route-epoch', request: input.request });
    return false;
  }
  const serverRevision = input.serverRevision ?? reconciliation.lastAppliedServerRevision;
  // WHAT: Reject a backend snapshot older than the last accepted ledger revision.
  // WHY: Network response order must not roll visible state backward.
  if (serverRevision < reconciliation.lastAppliedServerRevision) {
    telemetry('active-ledger-reconciliation-rejected', { source: input.source, reason: 'server-revision', serverRevision, lastAppliedServerRevision: reconciliation.lastAppliedServerRevision });
    return false;
  }
  // WHAT: Use request order to break ties at the same or missing server revision.
  // WHY: Legacy responses still need deterministic stale-response rejection.
  if (serverRevision === reconciliation.lastAppliedServerRevision && input.request.sequence <= reconciliation.lastAppliedSequence) {
    telemetry('active-ledger-reconciliation-rejected', { source: input.source, reason: 'request-sequence', sequence: input.request.sequence, lastAppliedSequence: reconciliation.lastAppliedSequence });
    return false;
  }

  const sameLedger = Boolean(state.activeLedger && state.activeLedgerId === input.request.ledgerStateId);
  const localLedger = sameLedger ? state.activeLedger : null;
  const preserve = sameLedger && isRecord(localLedger)
    ? geometryIdsToPreserve(input, localLedger)
    : {
      cardIds: new Set<string>(),
      annotationIds: new Set<string>(),
      retainMissingCardIds: new Set<string>(),
      retainMissingAnnotationIds: new Set<string>()
    };
  const withLocalNotes = sameLedger ? mergeLocalThreadNotes(input.ledger) : input.ledger;
  const reconciledLedger = sameLedger
    ? mergeLocalCanvasStateIntoLedger(withLocalNotes, localLedger, {
      preserveCardIds: preserve.cardIds,
      preserveAnnotationIds: preserve.annotationIds,
      retainMissingCardIds: preserve.retainMissingCardIds,
      retainMissingAnnotationIds: preserve.retainMissingAnnotationIds
    })
    : withLocalNotes;
  // WHAT: Guard the final assignment after local-note and geometry merging.
  // WHY: A helper must not be able to pass an invalid replacement into active state.
  if (!isRecord(reconciledLedger)) return false;

  replaceActiveLedger(reconciledLedger, input.request.ledgerStateId);
  state.selection = sameLedger ? pruneSelectionToActiveLedger(state.selection) : emptySelection();
  reconciliation.lastAppliedServerRevision = serverRevision;
  reconciliation.lastAppliedSequence = input.request.sequence;
  pruneGeometryRevisions(reconciledLedger);
  refreshZoneAttributionCache(`active-ledger-reconciliation:${input.source}`);
  repaintVisibleSelection();
  telemetry('active-ledger-reconciliation-applied', {
    source: input.source,
    ledgerStateId: input.request.ledgerStateId,
    routeEpoch: input.request.routeEpoch,
    sequence: input.request.sequence,
    serverRevision,
    preservedCards: Array.from(preserve.cardIds),
    preservedAnnotations: Array.from(preserve.annotationIds)
  });
  return true;
}
