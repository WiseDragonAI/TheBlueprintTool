import { content } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function renderZoneLabelOverlay(): void {
  const overlay = resolveZoneLabelOverlay();
  overlay.replaceChildren();
  const zones = Array.from(content.querySelectorAll(':scope > .zone[data-zone-id], :scope > .zone[data-group-id]')) as HTMLElement[];
  for (const zone of zones) {
    if (zone.hidden || zone.style.display === 'none') continue;
    const title = zone.querySelector('.zone-title') as HTMLElement | null;
    const text = title?.textContent?.trim();
    if (!title || !text) continue;
    if (title.classList.contains('editing')) continue;
    const label = document.createElement('div');
    label.className = 'zone-label-proxy';
    label.textContent = text;
    label.dataset.zoneLabelFor = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
    label.style.left = `${zone.offsetLeft + title.offsetLeft}px`;
    label.style.top = `${zone.offsetTop + title.offsetTop}px`;
    label.style.maxWidth = `${Math.max(0, zone.offsetWidth - title.offsetLeft)}px`;
    const titleStyle = getComputedStyle(title);
    label.style.color = titleStyle.color;
    label.style.textShadow = titleStyle.textShadow;
    overlay.append(label);
  }
  telemetry('render-zone-label-overlay', { labels: overlay.childElementCount });
}

function resolveZoneLabelOverlay(): HTMLElement {
  const existing = content.querySelector(':scope > .zone-label-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.className = 'zone-label-overlay';
  content.insertBefore(overlay, content.querySelector('.marquee'));
  return overlay;
}
