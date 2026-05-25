/**
 * WHAT: Resolves the stable accent color for a thread target.
 * WHY: Thread UI should inherit the card or zone color, not transient selected-border color.
 */
export function resolveThreadTargetAccent(target: HTMLElement | null): string {
  if (!target) return '#ff7043';
  const computed = getComputedStyle(target);
  return target.dataset.cardZoneColor
    || computed.getPropertyValue('--card-zone-color').trim()
    || computed.getPropertyValue('--zone-color').trim()
    || computed.getPropertyValue('--thread-accent').trim()
    || computed.borderTopColor
    || '#ff7043';
}
