import { state } from '../state.js';
import { telemetry } from './telemetry.js';

export function resizeSelectedZone(dx: number, dy: number): void {
  const zone = state.pointer?.target as HTMLElement | null;
  if (!zone) return;
  const handle = state.pointer.resizeHandle as HTMLElement | null;
  const handleName = String(handle?.className ?? '');
  const west = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('sw'));
  const east = Boolean(handle?.classList.contains('ne') || handle?.classList.contains('se'));
  const north = Boolean(handle?.classList.contains('nw') || handle?.classList.contains('ne'));
  const south = Boolean(handle?.classList.contains('sw') || handle?.classList.contains('se'));
  const minWidth = 180;
  const minHeight = 140;
  let nextLeft = zone.offsetLeft;
  let nextTop = zone.offsetTop;
  let nextWidth = zone.offsetWidth;
  let nextHeight = zone.offsetHeight;
  if (west) {
    const clampedDx = Math.min(dx, zone.offsetWidth - minWidth);
    nextLeft = zone.offsetLeft + clampedDx;
    nextWidth = zone.offsetWidth - clampedDx;
  }
  if (east) nextWidth = Math.max(minWidth, zone.offsetWidth + dx);
  if (north) {
    const clampedDy = Math.min(dy, zone.offsetHeight - minHeight);
    nextTop = zone.offsetTop + clampedDy;
    nextHeight = zone.offsetHeight - clampedDy;
  }
  if (south) nextHeight = Math.max(minHeight, zone.offsetHeight + dy);
  zone.style.left = `${nextLeft}px`;
  zone.style.top = `${nextTop}px`;
  zone.style.width = `${nextWidth}px`;
  zone.style.height = `${nextHeight}px`;
  telemetry(zone.dataset.groupId ? 'render-group-layer' : 'render-zone-layer', { resized: zone.dataset.zoneId ?? zone.dataset.groupId, geometry: zone.getBoundingClientRect().toJSON?.() });
}
