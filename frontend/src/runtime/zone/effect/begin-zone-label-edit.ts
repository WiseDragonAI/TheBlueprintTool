import { syncActiveLedgerRegionEdit } from '../../ledger/effect/sync-active-ledger-region-edit.js';
import { persistState } from '../../persistence/effect/persist-state.js';
import { renderZoneLabelOverlay } from './render-zone-label-overlay.js';
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
    syncActiveLedgerRegionEdit(zone, { label });
    persistState();
    renderZoneLabelOverlay();
    telemetry('commit-ledger-edit', { regionKind, regionId, label });
  }, { once: true });
  telemetry('open-zone-inline-label-edit', { regionKind, regionId });
}
