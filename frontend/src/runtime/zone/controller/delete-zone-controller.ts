import { telemetry } from '../../telemetry/effect/telemetry.js';
import { deleteSelectedZones } from '../effect/delete-selected-zones.js';

export function deleteZoneController(): void {
  telemetry('delete-zone-controller', {});
  deleteSelectedZones();
}
