import { state } from '../../state.js';
import { cardsIntersectingZone } from '../../zone/helper/cards-intersecting-zone.js';
import { resolveGroupMembership } from '../../group/helper/resolve-group-membership.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { selectThread } from '../../thread/effect/select-thread.js';
import { threadIdForTarget } from '../../thread/helper/thread-id-for-target.js';
import { renderSelectionState } from '../effect/render-selection-state.js';
import { renderThreadPanel } from '../../thread/effect/render-thread-panel.js';
import { renderTelemetry } from '../../telemetry/effect/render-telemetry.js';

export function selectTarget(kind: string, id: string, additive: boolean): void {
  if (!id) return;
  telemetry('resolve-selection-target', { kind, id, additive });
  if (!additive) selectThread(threadIdForTarget(kind, id));
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
    const membership = resolveGroupMembership(id);
    state.selection.groupIds = membership.groupIds;
    state.selection.zoneIds = membership.zoneIds;
    state.selection.cardIds = membership.cardIds;
    telemetry('resolve-group-membership', { groupId: id, selection: state.selection });
  }
  renderSelectionState();
  if (state.threadPanelOpen || state.activeTool === 'thread') renderThreadPanel();
  else renderTelemetry();
}
