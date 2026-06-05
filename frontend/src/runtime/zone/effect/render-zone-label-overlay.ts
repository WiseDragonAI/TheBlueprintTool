import { content } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { dragTraceHook } from '../../performance/drag-trace-span.js';

export function renderZoneLabelOverlay(): void {
  const span = dragTraceHook();
  if (!span) {
    renderZoneLabelOverlayBody();
    return;
  }
  span('renderZoneLabelOverlay', () => renderZoneLabelOverlayBody(span));
}

function renderZoneLabelOverlayBody(span?: NonNullable<ReturnType<typeof dragTraceHook>>): void {
    const overlay = span ? span('renderZoneLabelOverlay:resolveZoneLabelOverlay', () => resolveZoneLabelOverlay()) : resolveZoneLabelOverlay();
    if (span) span('renderZoneLabelOverlay:replaceChildren', () => overlay.replaceChildren());
    else overlay.replaceChildren();
    const zones = span ? span('renderZoneLabelOverlay:queryZones', () => Array.from(content.querySelectorAll(':scope > .zone[data-zone-id], :scope > .zone[data-group-id]')) as HTMLElement[]) : Array.from(content.querySelectorAll(':scope > .zone[data-zone-id], :scope > .zone[data-group-id]')) as HTMLElement[];
    const buildLabels = () => {
      for (const zone of zones) {
        if (zone.hidden || zone.style.display === 'none') continue;
        const title = span ? span('renderZoneLabelOverlay:queryZoneTitle', () => zone.querySelector('.zone-title') as HTMLElement | null) : zone.querySelector('.zone-title') as HTMLElement | null;
        const text = title?.textContent?.trim();
        if (!title || !text) continue;
        if (title.classList.contains('editing')) continue;
        const label = document.createElement('div');
        label.className = 'zone-label-proxy';
        label.textContent = text;
        label.dataset.zoneLabelFor = zone.dataset.zoneId ?? zone.dataset.groupId ?? '';
        const readLayoutAndStyle = () => {
          label.style.left = `${zone.offsetLeft + title.offsetLeft}px`;
          label.style.top = `${zone.offsetTop + title.offsetTop}px`;
          label.style.maxWidth = `${Math.max(0, zone.offsetWidth - title.offsetLeft)}px`;
          const titleStyle = getComputedStyle(title);
          label.style.color = titleStyle.color;
          label.style.textShadow = titleStyle.textShadow;
        };
        if (span) span('renderZoneLabelOverlay:readLayoutAndStyle', readLayoutAndStyle);
        else readLayoutAndStyle();
        if (span) span('renderZoneLabelOverlay:appendLabel', () => overlay.append(label));
        else overlay.append(label);
      }
    };
    if (span) span('renderZoneLabelOverlay:buildLabels', buildLabels);
    else buildLabels();
    if (span) span('renderZoneLabelOverlay:telemetry', () => telemetry('render-zone-label-overlay', { labels: overlay.childElementCount }));
    else telemetry('render-zone-label-overlay', { labels: overlay.childElementCount });
}

function resolveZoneLabelOverlay(): HTMLElement {
  const existing = content.querySelector(':scope > .zone-label-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.className = 'zone-label-overlay';
  content.insertBefore(overlay, content.querySelector('.marquee'));
  return overlay;
}
