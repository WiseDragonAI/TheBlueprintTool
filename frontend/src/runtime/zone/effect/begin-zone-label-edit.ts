import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { runOptimisticActiveLedgerMutation } from '../../ledger/effect/run-optimistic-active-ledger-mutation.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function beginZoneLabelEdit(zone: HTMLElement): void {
  const title = zone.querySelector('.zone-title') as HTMLElement | null;
  if (!title) return;
  const regionId = zone.dataset.zoneId ?? zone.dataset.groupId;
  const regionKind = zone.dataset.groupId ? 'group' : 'zone';
  title.contentEditable = 'true';
  title.classList.add('editing');
  renderZoneLabelOverlay();
  title.focus();
  document.getSelection()?.selectAllChildren(title);
  title.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Enter') return;
    event.preventDefault();
    title.blur();
  }, { once: true });
  title.addEventListener('blur', () => {
    const label = title.textContent?.trim() ?? '';
    title.contentEditable = 'false';
    title.classList.remove('editing');
    if (state.activeLedger && regionId) {
      if (state.canvasMode === 'ledger') {
        void runOptimisticActiveLedgerMutation({
          mutation: { action: 'patch-region', region: { id: regionId, kind: regionKind, label } },
          apply: (ledger) => {
            const region = (ledger.annotations ?? []).find((entry: Record<string, unknown>) => String(entry.id ?? '') === regionId);
            if (region) region.label = label;
          },
          render: () => renderCanvasSurface({ renderThreadPanel: false }),
        });
      } else void commitActiveLedgerMutation({ action: 'patch-region', region: { id: regionId, kind: regionKind, label } }, { render: true });
      return;
    }
    persistState();
    renderZoneLabelOverlay();
    telemetry('commit-static-surface-edit', { regionKind, regionId, label });
  }, { once: true });
  telemetry('open-zone-inline-label-edit', { regionKind, regionId });
}
