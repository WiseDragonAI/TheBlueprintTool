import { modal } from '../../dom.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function confirmZoneDeletionController(): void {
  telemetry('confirm-zone-deletion-controller', { zoneIds: state.selection.zoneIds });
  telemetry('confirm-zone-deletion', { zoneIds: state.selection.zoneIds });
  modal.showModal?.();
}
