/**
 * WHAT: Creates a zone annotation from a drawn rectangle in active-ledger or standalone DOM mode.
 * WHY: Draw gestures need immediate local feedback while active-ledger persistence reconciles asynchronously.
 */
import { content } from '../../dom.js';
import { commitActiveLedgerMutation } from '../../ledger/effect/commit-active-ledger-mutation.js';
import { createLedgerObjectId } from '../../ledger/helper/create-ledger-object-id.js';
import { createLedgerZoneAnnotation } from '../../ledger/helper/create-ledger-zone-annotation.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { insertActiveLedgerAnnotation } from '../../ledger/helper/active-ledger-geometry.js';
import { refreshZoneAttributionCache } from '../../ledger/helper/zone-attribution-cache.js';
import { renderCanvasSurface } from '../../canvas/effect/render-canvas-surface.js';

export async function createZoneFromRect(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
  const zoneId = createLedgerObjectId('zone');
  // WHAT: Insert and render the zone immediately when ledger state owns the canvas.
  // WHY: The operator should not wait for a server round trip before seeing the drawn record.
  if (state.activeLedger) {
    const annotation = createLedgerZoneAnnotation({ id: zoneId, rect, color: state.zoneColor });
    insertActiveLedgerAnnotation(annotation);
    refreshZoneAttributionCache('optimistic-create-zone');
    state.selection = { cardIds: [], zoneIds: [zoneId], groupIds: [] };
    telemetry('render-zone-layer', { created: zoneId, activeTab: state.activeTab, authority: 'optimistic-client' });
    renderCanvasSurface({ renderThreadPanel: false });
    await commitActiveLedgerMutation({ action: 'create-zone', annotation });
    return;
  }
  const zone = document.createElement('article');
  zone.className = 'zone regular-zone selected';
  zone.dataset.zoneId = zoneId;
  zone.dataset.threadId = `thread-${zoneId}`;
  zone.dataset.spec = '20000002 20000003 20000004 20000006 20000014 20000017';
  zone.style.left = `${rect.x}px`;
  zone.style.top = `${rect.y}px`;
  zone.style.width = `${Math.max(180, rect.width)}px`;
  zone.style.height = `${Math.max(140, rect.height)}px`;
  zone.style.setProperty('--zone-color', state.zoneColor);
  zone.innerHTML = `
    <div class="resize-handle nw"></div>
    <div class="resize-handle ne"></div>
    <div class="resize-handle sw"></div>
    <div class="resize-handle se"></div>
    <div class="zone-title">New zone</div>
    <p>Created from the zone drawing tool.</p>`;
  content.insertBefore(zone, content.querySelector('.marquee'));
  state.selection = { cardIds: [], zoneIds: [zoneId], groupIds: [] };
  telemetry('commit-static-surface-edit', { createZone: zoneId, geometry: rect, color: state.zoneColor });
  telemetry('render-zone-layer', { created: zoneId });
}
