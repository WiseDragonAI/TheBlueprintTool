import { telemetry } from '../../telemetry/effect/telemetry.js';
import { applyZoneColorEdit } from '../effect/apply-zone-color-edit.js';

export function editRegionColorController(zone: HTMLElement | null, color: string): void {
  if (!zone) return;
  telemetry('edit-region-color-controller', { zoneId: zone.dataset.zoneId, color });
  applyZoneColorEdit(zone, color);
}
