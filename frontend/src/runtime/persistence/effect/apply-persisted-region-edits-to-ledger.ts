type RegionEdit = { label?: string; color?: string };

export function applyPersistedRegionEditsToLedger(ledger: unknown, edits: unknown): void {
  const document = ledger as { annotations?: Array<Record<string, unknown>> };
  const regionEdits = edits as { zones?: Record<string, RegionEdit>; groups?: Record<string, RegionEdit> } | undefined;
  for (const annotation of document.annotations ?? []) {
    const id = String(annotation.id ?? '');
    const isGroup = annotation.variant === 'group';
    const edit = isGroup ? regionEdits?.groups?.[id] : regionEdits?.zones?.[id];
    if (!edit) continue;
    if (typeof edit.label === 'string') annotation.label = edit.label;
    if (!isGroup && typeof edit.color === 'string') annotation.color = edit.color;
  }
}
