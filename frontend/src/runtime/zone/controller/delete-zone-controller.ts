import { telemetry } from '../../telemetry/effect/telemetry.js';
import { deleteSelectedZones } from '../effect/delete-selected-zones.js';

export async function deleteZoneController(): Promise<void> {
  telemetry('delete-zone-controller', {});
  await deleteSelectedZones();
}
