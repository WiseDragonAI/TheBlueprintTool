import { applyPersistedGeometry } from './apply-persisted-geometry.js';

export function hydratePersistedGeometry(geometry: unknown): void {
  const records = geometry && typeof geometry === 'object' ? geometry as Record<string, Record<string, Record<string, number>>> : {};
  applyPersistedGeometry('[data-card-id]', 'cardId', records.cards);
  applyPersistedGeometry('[data-zone-id]', 'zoneId', records.zones);
  applyPersistedGeometry('[data-group-id]', 'groupId', records.groups);
}
