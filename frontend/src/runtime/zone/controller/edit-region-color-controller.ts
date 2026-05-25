import { telemetry } from '../../telemetry/effect/telemetry.js';
import { applyZoneColorEdit, previewZoneColorEdit } from '../effect/apply-zone-color-edit.js';

export function editRegionColorController(zone: HTMLElement | null, color: string): void {
  if (!zone) return;
  telemetry('edit-region-color-controller', { zoneId: zone.dataset.zoneId, color });
  applyZoneColorEdit(zone, color);
}

export function previewRegionColorController(zone: HTMLElement | null, color: string): void {
  if (!zone) return;
  telemetry('preview-region-color-controller', { zoneId: zone.dataset.zoneId, color });
  previewZoneColorEdit(zone, color);
}
