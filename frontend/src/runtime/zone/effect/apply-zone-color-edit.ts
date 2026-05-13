import { renderCardZoneColors } from '../../card/effect/render-card-zone-colors.js';
import { syncActiveLedgerRegionEdit } from '../../ledger/effect/sync-active-ledger-region-edit.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function applyZoneColorEdit(zone: HTMLElement, color: string): void {
  zone.style.setProperty('--zone-color', color);
  syncActiveLedgerRegionEdit(zone, { color });
  persistState();
  renderCardZoneColors();
  renderZoneLabelOverlay();
  telemetry('commit-ledger-edit', { zoneId: zone.dataset.zoneId, color });
}
