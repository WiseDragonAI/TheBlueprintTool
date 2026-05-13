import { selectTarget } from '../../selection/controller/select-target.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { beginZoneLabelEdit } from '../effect/begin-zone-label-edit.js';

export function editRegionController(region: HTMLElement | null): void {
  if (region?.dataset.zoneId) selectTarget('zone', region.dataset.zoneId, false);
  if (region?.dataset.groupId) selectTarget('group', region.dataset.groupId, false);
  telemetry('edit-region-controller', { regionId: region?.dataset.zoneId ?? region?.dataset.groupId });
  telemetry('open-zone-edit-panel', { regionId: region?.dataset.zoneId ?? region?.dataset.groupId });
  if (region) beginZoneLabelEdit(region);
}
