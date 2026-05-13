import { state } from '../../state.js';

export function derivePointerIntent(event: PointerEvent, targetKind: string, resizeHandle: HTMLElement | null): string {
  if (resizeHandle) return 'resize';
  if (state.activeTool === 'zone' && targetKind === 'canvas') return 'draw-zone';
  if (state.activeTool === 'group' && targetKind === 'canvas') return 'draw-group';
  if (event.ctrlKey && targetKind === 'canvas') return 'marquee';
  if (targetKind === 'canvas') return 'pan';
  const group = (event.target as HTMLElement).closest('[data-group-id]') as HTMLElement | null;
  if (targetKind === 'group' && !state.selection.groupIds.includes(group?.dataset.groupId)) return 'pan';
  if (targetKind === 'group') return 'group';
  const zone = (event.target as HTMLElement).closest('[data-zone-id]') as HTMLElement | null;
  if (targetKind === 'zone' && !state.selection.zoneIds.includes(zone?.dataset.zoneId)) return 'pan';
  return 'drag';
}
