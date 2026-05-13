import { cardsIntersectingZone } from '../../zone/helper/cards-intersecting-zone.js';
import { elementsIntersectingBox } from '../../selection/helper/elements-intersecting-box.js';

export function resolveGroupMembership(groupId: string): { cardIds: string[]; zoneIds: string[]; groupIds: string[] } {
  const group = document.querySelector(`[data-group-id="${groupId}"]`) as HTMLElement | null;
  const zoneIds = group ? elementsIntersectingBox(group, '[data-zone-id]', 'zoneId') : [];
  const cardIds = group ? elementsIntersectingBox(group, '[data-card-id]', 'cardId') : [];
  for (const zoneId of zoneIds) {
    const zoneCardIds = cardsIntersectingZone(zoneId);
    for (const cardId of zoneCardIds) {
      if (!cardIds.includes(cardId)) cardIds.push(cardId);
    }
  }
  return { cardIds, zoneIds, groupIds: group ? [groupId] : [] };
}
