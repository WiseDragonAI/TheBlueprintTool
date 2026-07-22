import { clampReadableHsvColor, renderCardZoneColors } from '../../card/effect/render-card-zone-colors.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { previewCachedZoneColor } from '../../ledger/helper/zone-attribution-cache.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';

export function previewZoneColorEdit(zone: HTMLElement, color: string): void {
  // Spec a2f9c013: preview native color-picker drags without committing ledger rerenders.
  zone.style.setProperty('--zone-color', color);
  const readableColor = clampReadableHsvColor(color);
  if (readableColor) zone.style.setProperty('--zone-readable-color', readableColor);
  else zone.style.removeProperty('--zone-readable-color');
  if (state.activeLedger && zone.dataset.zoneId) previewCachedZoneColor(zone.dataset.zoneId, color);
  else renderCardZoneColors();
  renderZoneLabelOverlay();
  telemetry('preview-region-color-edit', { zoneId: zone.dataset.zoneId, color });
}

export function applyZoneColorEdit(zone: HTMLElement, color: string): void {
  previewZoneColorEdit(zone, color);
  if (state.activeLedger && zone.dataset.zoneId) {
    const zoneId = zone.dataset.zoneId;
    if (state.canvasMode === 'ledger') {
      void runOptimisticActiveLedgerMutation({
        mutation: { action: 'patch-region', region: { id: zoneId, kind: 'zone', color } },
        apply: (ledger) => {
          const region = (ledger.annotations ?? []).find((entry: Record<string, unknown>) => String(entry.id ?? '') === zoneId);
          if (region) region.color = color;
        },
        render: (outcome) => {
          if (outcome !== 'optimistic') renderCanvasSurface({ renderThreadPanel: false });
        },
      });
    } else void commitActiveLedgerMutation({ action: 'patch-region', region: { id: zoneId, kind: 'zone', color } }, { render: true });
    return;
  }
  persistState();
  telemetry('commit-static-surface-edit', { zoneId: zone.dataset.zoneId, color });
}
