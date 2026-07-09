type AnyRecord = Record<string, any>;
type MergeLocalCanvasStateOptions = {
  skipCardIds?: Iterable<string>;
  skipAnnotationIds?: Iterable<string>;
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

function copyCardGeometry(local: AnyRecord, incoming: AnyRecord): void {
  const x = finiteNumber(local.x);
  const y = finiteNumber(local.y);
  const width = finiteNumber(local.w ?? local.width);
  const height = finiteNumber(local.h ?? local.height);
  if (x !== null) incoming.x = x;
  if (y !== null) incoming.y = y;
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
  if (!isRecord(incomingLedger) || !isRecord(localLedger)) return incomingLedger;
  const localCards = byId(localLedger.cards);
  const localAnnotations = byId(localLedger.annotations);
  const skipCardIds = stringSet(options.skipCardIds);
  const skipAnnotationIds = stringSet(options.skipAnnotationIds);
  if (Array.isArray(incomingLedger.cards)) {
    for (const incomingCard of incomingLedger.cards as AnyRecord[]) {
      const cardId = String(incomingCard.id ?? '');
      if (skipCardIds.has(cardId)) continue;
      const localCard = localCards.get(cardId);
      if (localCard) copyCardGeometry(localCard, incomingCard);
    }
  }
  if (Array.isArray(incomingLedger.annotations)) {
    for (const incomingAnnotation of incomingLedger.annotations as AnyRecord[]) {
      const annotationId = String(incomingAnnotation.id ?? '');
      if (skipAnnotationIds.has(annotationId)) continue;
      const localAnnotation = localAnnotations.get(annotationId);
      if (localAnnotation) copyAnnotationGeometry(localAnnotation, incomingAnnotation);
    }
  }
  return incomingLedger;
}
