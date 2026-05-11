import { state } from '../state.js';
import { cardsIntersectingZone } from './cards-intersecting-zone.js';
import { elementsIntersectingBox } from './elements-intersecting-box.js';
import { renderCanvasSurface } from './render-canvas-surface.js';
import { telemetry } from './telemetry.js';

export function selectTarget(kind: string, id: string, additive: boolean): void {
  if (!id) return;
  telemetry('resolve-selection-target', { kind, id, additive });
  if (!additive) state.selection = { cardIds: [], zoneIds: [], groupIds: [] };
  const key = kind === 'card' ? 'cardIds' : kind === 'zone' ? 'zoneIds' : 'groupIds';
  if (additive && state.selection[key].includes(id)) {
    state.selection[key] = state.selection[key].filter((selectedId: string) => selectedId !== id);
  } else if (!state.selection[key].includes(id)) {
    state.selection[key].push(id);
  }
  if (kind === 'zone') {
    const intersectingCards = cardsIntersectingZone(id);
    for (const cardId of intersectingCards) {
      if (!state.selection.cardIds.includes(cardId)) state.selection.cardIds.push(cardId);
    }
    telemetry('resolve-zone-intersections', { zoneId: id, cardIds: intersectingCards });
  }
  if (kind === 'group') {
    const group = document.querySelector(`[data-group-id="${id}"]`) as HTMLElement | null;
    const groupCardIds = group ? elementsIntersectingBox(group, '[data-card-id]', 'cardId') : [];
    state.selection.zoneIds = group ? elementsIntersectingBox(group, '[data-zone-id]', 'zoneId') : [];
    state.selection.cardIds = [...groupCardIds];
    for (const zoneId of state.selection.zoneIds) {
      const zoneCardIds = cardsIntersectingZone(zoneId);
      for (const cardId of zoneCardIds) {
        if (!state.selection.cardIds.includes(cardId)) state.selection.cardIds.push(cardId);
      }
    }
    telemetry('resolve-group-membership', { groupId: id, selection: state.selection });
  }
  renderCanvasSurface();
}
