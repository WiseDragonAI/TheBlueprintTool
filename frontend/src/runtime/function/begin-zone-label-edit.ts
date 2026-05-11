import { telemetry } from './telemetry.js';

export function beginZoneLabelEdit(zone: HTMLElement): void {
  const title = zone.querySelector('.zone-title') as HTMLElement | null;
  if (!title) return;
  title.contentEditable = 'true';
  title.classList.add('editing');
  title.focus();
  document.getSelection()?.selectAllChildren(title);
  title.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Enter') return;
    event.preventDefault();
    title.blur();
  }, { once: true });
  title.addEventListener('blur', () => {
    title.contentEditable = 'false';
    title.classList.remove('editing');
    telemetry('commit-ledger-edit', { zoneId: zone.dataset.zoneId, label: title.textContent?.trim() });
  }, { once: true });
  telemetry('open-zone-inline-label-edit', { zoneId: zone.dataset.zoneId });
}
