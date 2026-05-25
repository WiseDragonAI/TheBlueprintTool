import { renderCardZoneColors } from '../../card/effect/render-card-zone-colors.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function previewZoneColorEdit(zone: HTMLElement, color: string): void {
  zone.style.setProperty('--zone-color', color);
  renderCardZoneColors();
  renderZoneLabelOverlay();
  telemetry('preview-region-color-edit', { zoneId: zone.dataset.zoneId, color });
}

export function applyZoneColorEdit(zone: HTMLElement, color: string): void {
  previewZoneColorEdit(zone, color);
  if (state.activeLedger && zone.dataset.zoneId) {
    void commitActiveLedgerMutation({ action: 'patch-region', region: { id: zone.dataset.zoneId, kind: 'zone', color } }, { render: true });
    return;
  }
  persistState();
  telemetry('commit-static-surface-edit', { zoneId: zone.dataset.zoneId, color });
}
