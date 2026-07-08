type AnyRecord = Record<string, any>;

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

export function mergeLocalCanvasStateIntoLedger(incomingLedger: unknown, localLedger: unknown): unknown {
  if (!isRecord(incomingLedger) || !isRecord(localLedger)) return incomingLedger;
  const localCards = byId(localLedger.cards);
  const localAnnotations = byId(localLedger.annotations);
  if (Array.isArray(incomingLedger.cards)) {
    for (const incomingCard of incomingLedger.cards as AnyRecord[]) {
      const localCard = localCards.get(String(incomingCard.id ?? ''));
      if (localCard) copyCardGeometry(localCard, incomingCard);
    }
  }
  if (Array.isArray(incomingLedger.annotations)) {
    for (const incomingAnnotation of incomingLedger.annotations as AnyRecord[]) {
      const localAnnotation = localAnnotations.get(String(incomingAnnotation.id ?? ''));
      if (localAnnotation) copyAnnotationGeometry(localAnnotation, incomingAnnotation);
    }
  }
  return incomingLedger;
}
