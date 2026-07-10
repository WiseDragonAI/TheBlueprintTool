/**
 * WHAT: Resolves the live DOM node for a pointer target after a canvas remount.
 * WHY: Gesture state retains target identity, while refresh may detach the element captured on pointer down.
 */
export type PointerTargetKind = 'card' | 'zone' | 'group';

export function resolveCurrentPointerTarget(
  kind: PointerTargetKind,
  id: string,
  savedTarget: HTMLElement | null
): HTMLElement | null {
  // WHAT: Preserve the saved node for non-ledger targets that have no stable id.
  // WHY: Static canvas resize behavior still relies on the pointer-down element.
  if (!id) return savedTarget;

  const datasetKey = kind === 'card' ? 'cardId' : kind === 'group' ? 'groupId' : 'zoneId';
  // WHAT: Reuse the original node only while it still represents the active target in the document.
  // WHY: A refresh can leave the saved object detached or replace it with a node for the same id.
  if (savedTarget?.dataset[datasetKey] === id && savedTarget.isConnected !== false) return savedTarget;

  const attribute = kind === 'card' ? 'data-card-id' : kind === 'group' ? 'data-group-id' : 'data-zone-id';
  const escapedId = globalThis.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
  return document.querySelector(`[${attribute}="${escapedId}"]`) as HTMLElement | null;
}
