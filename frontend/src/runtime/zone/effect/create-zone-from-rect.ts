import { content } from '../../dom.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function createZoneFromRect(rect: { x: number; y: number; width: number; height: number }): void {
  const zoneId = `zone-draft-${state.zoneCounter++}`;
  const zone = document.createElement('article');
  zone.className = 'zone regular-zone selected';
  zone.dataset.zoneId = zoneId;
  zone.dataset.threadId = `thread-${zoneId}`;
  zone.dataset.spec = '20000002 20000003 20000004 20000006 20000014 20000017';
  zone.style.left = `${Math.max(0, rect.x)}px`;
  zone.style.top = `${Math.max(0, rect.y)}px`;
  zone.style.width = `${Math.max(180, rect.width)}px`;
  zone.style.height = `${Math.max(140, rect.height)}px`;
  zone.style.setProperty('--zone-color', state.zoneColor);
  zone.innerHTML = `
    <div class="resize-handle nw"></div>
    <div class="resize-handle ne"></div>
    <div class="resize-handle sw"></div>
    <div class="resize-handle se"></div>
    <div class="zone-title">New zone</div>
    <p>Created from the zone drawing tool.</p>
    <div class="zone-actions">
      <button class="icon-button" type="button" data-action="edit-zone" data-spec="3fd7a96a" title="Edit zone name" aria-label="Edit zone name">✎</button>
      <input class="zone-color-edit" type="color" value="${state.zoneColor}" data-action="edit-zone-color" data-spec="3fd7a96a" aria-label="Edit zone color">
      <button type="button" data-action="open-zone-thread">Notes</button>
    </div>`;
  content.insertBefore(zone, content.querySelector('.marquee'));
  state.selection = { cardIds: [], zoneIds: [zoneId], groupIds: [] };
  telemetry('commit-ledger-edit', { createZone: zoneId, geometry: rect, color: state.zoneColor });
  telemetry('render-zone-layer', { created: zoneId });
}
