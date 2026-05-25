/**
 * WHAT: Resolves the canonical thread id for a selected canvas target.
 * WHY: Selecting a card, zone, or group should open that object's thread by default.
 */
export function threadIdForTarget(kind: string, id: string): string {
  if (!id) return '';
  if (kind === 'card' || kind === 'zone' || kind === 'group') return `thread-${id}`;
  return '';
}
