/**
 * WHAT: Runtime helper that hydrates persisted cards, zones, and groups.
 * WHY: Boot and refresh need one restore path with card-size guards before relationship routing runs.
 */
import { applyPersistedGeometry } from './apply-persisted-geometry.js';

export function hydratePersistedGeometry(geometry: unknown): void {
  const records = geometry && typeof geometry === 'object' ? geometry as Record<string, Record<string, Record<string, number>>> : {};
  applyPersistedGeometry('[data-card-id]', 'cardId', records.cards, { minWidth: 250, minHeight: 132 });
  applyPersistedGeometry('[data-zone-id]', 'zoneId', records.zones, { minWidth: 180, minHeight: 140 });
  applyPersistedGeometry('[data-group-id]', 'groupId', records.groups, { minWidth: 220, minHeight: 160 });
}
