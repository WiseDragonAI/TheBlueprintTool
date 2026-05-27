import { state } from '../../state.js';

export const ctrlPanOnlySpec = '9f04b1c2';

export function derivePointerIntent(event: PointerEvent, targetKind: string, resizeHandle: HTMLElement | null): string {
  if (event.ctrlKey) return 'pan';
  if (resizeHandle) return 'resize';
  if (event.shiftKey && targetKind === 'canvas') return 'marquee';
  if (state.activeTool === 'card' && targetKind === 'canvas') return 'draw-card';
  if (state.activeTool === 'zone' && targetKind === 'canvas') return 'draw-zone';
  if (state.activeTool === 'group' && targetKind === 'canvas') return 'draw-group';
  if (targetKind === 'canvas') return 'pan';
  const group = (event.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
  if (targetKind === 'group' && !state.selection.groupIds.includes(group?.dataset.groupId)) return 'pan';
  if (targetKind === 'group') return 'group';
  const zone = (event.target as HTMLElement).closest('[data-zone-id]') as HTMLElement | null;
  if (targetKind === 'zone' && !state.selection.zoneIds.includes(zone?.dataset.zoneId)) return 'pan';
  return 'drag';
}
