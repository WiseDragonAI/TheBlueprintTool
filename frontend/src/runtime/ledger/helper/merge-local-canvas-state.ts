/**
 * WHAT: Merges locally revised canvas geometry and optimistic records into an incoming ledger.
 * WHY: Authoritative responses may be older than visible operator work that must survive reconciliation.
 */
type AnyRecord = Record<string, any>;
type MergeLocalCanvasStateOptions = {
  preserveCardIds?: Iterable<string>;
  preserveAnnotationIds?: Iterable<string>;
  retainMissingCardIds?: Iterable<string>;
  retainMissingAnnotationIds?: Iterable<string>;
};

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function byId(records: unknown): Map<string, AnyRecord> {
  const entries = Array.isArray(records) ? records as AnyRecord[] : [];
  return new Map(entries.flatMap((record) => {
    const id = String(record?.id ?? '');
    return id ? [[id, record] as [string, AnyRecord]] : [];
  }));
}

function stringSet(values: Iterable<string> | undefined): Set<string> {
  return new Set(Array.from(values ?? [], (value) => String(value)));
}

function appendPreservedMissingRecords(incoming: AnyRecord[], local: Map<string, AnyRecord>, preservedIds: Set<string>): void {
  const incomingIds = new Set(incoming.map((record) => String(record?.id ?? '')).filter(Boolean));
  for (const id of preservedIds) {
    const localRecord = local.get(id);
    // WHAT: Append only locally owned records absent from the incoming snapshot.
    // WHY: Optimistic creation must survive older server responses without duplicating existing records.
    if (localRecord && !incomingIds.has(id)) incoming.push({ ...localRecord });
  }
}

function copyCardGeometry(local: AnyRecord, incoming: AnyRecord): void {
  const x = finiteNumber(local.x);
  const y = finiteNumber(local.y);
  const width = finiteNumber(local.w ?? local.width);
  const height = finiteNumber(local.h ?? local.height);
  if (x !== null) incoming.x = x;
  if (y !== null) incoming.y = y;
  // WHAT: Preserve the incoming card's established width field convention.
  // WHY: Ledgers support both legacy `width` and canonical `w` shapes.
  if (width !== null) {
    if ('width' in incoming && !('w' in incoming)) incoming.width = width;
    else incoming.w = width;
  }
  if (height !== null) {
    if ('height' in incoming && !('h' in incoming)) incoming.height = height;
    else incoming.h = height;
  }
}

function copyAnnotationGeometry(local: AnyRecord, incoming: AnyRecord): void {
  const x = finiteNumber(local.x);
  const y = finiteNumber(local.y);
  const width = finiteNumber(local.width ?? local.w);
  const height = finiteNumber(local.height ?? local.h);
  if (x !== null) incoming.x = x;
  if (y !== null) incoming.y = y;
  if (width !== null) incoming.width = width;
  if (height !== null) incoming.height = height;
}

export function mergeLocalCanvasStateIntoLedger(incomingLedger: unknown, localLedger: unknown, options: MergeLocalCanvasStateOptions = {}): unknown {
  // WHAT: Leave the incoming value untouched when either merge operand is not a ledger record.
  // WHY: Validation belongs to the reconciliation boundary, not this geometry helper.
  if (!isRecord(incomingLedger) || !isRecord(localLedger)) return incomingLedger;
  const localCards = byId(localLedger.cards);
  const localAnnotations = byId(localLedger.annotations);
  const preserveCardIds = stringSet(options.preserveCardIds);
  const preserveAnnotationIds = stringSet(options.preserveAnnotationIds);
  const retainMissingCardIds = stringSet(options.retainMissingCardIds);
  const retainMissingAnnotationIds = stringSet(options.retainMissingAnnotationIds);
  // WHAT: Merge card geometry only when the incoming ledger declares a card collection.
  // WHY: Missing collections remain server-authoritative rather than being invented here.
  if (Array.isArray(incomingLedger.cards)) {
    for (const incomingCard of incomingLedger.cards as AnyRecord[]) {
      const cardId = String(incomingCard.id ?? '');
      // WHAT: Copy local card geometry only for revisions selected by reconciliation.
      // WHY: Unchanged records should accept the server response directly.
      if (!preserveCardIds.has(cardId)) continue;
      const localCard = localCards.get(cardId);
      if (localCard) copyCardGeometry(localCard, incomingCard);
    }
    appendPreservedMissingRecords(incomingLedger.cards as AnyRecord[], localCards, retainMissingCardIds);
  }
  // WHAT: Merge annotation geometry only when the incoming ledger declares that collection.
  // WHY: Missing collections remain server-authoritative rather than being invented here.
  if (Array.isArray(incomingLedger.annotations)) {
    for (const incomingAnnotation of incomingLedger.annotations as AnyRecord[]) {
      const annotationId = String(incomingAnnotation.id ?? '');
      // WHAT: Copy local annotation geometry only for revisions selected by reconciliation.
      // WHY: Unchanged records should accept the server response directly.
      if (!preserveAnnotationIds.has(annotationId)) continue;
      const localAnnotation = localAnnotations.get(annotationId);
      if (localAnnotation) copyAnnotationGeometry(localAnnotation, incomingAnnotation);
    }
    appendPreservedMissingRecords(incomingLedger.annotations as AnyRecord[], localAnnotations, retainMissingAnnotationIds);
  }
  return incomingLedger;
}
