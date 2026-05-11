import { snapshotElementsGeometry } from './snapshot-elements-geometry.js';

export function snapshotCanvasGeometry(): Record<string, Record<string, Record<string, number>>> {
  return {
    cards: snapshotElementsGeometry('[data-card-id]', 'cardId'),
    zones: snapshotElementsGeometry('[data-zone-id]', 'zoneId'),
    groups: snapshotElementsGeometry('[data-group-id]', 'groupId')
  };
}
