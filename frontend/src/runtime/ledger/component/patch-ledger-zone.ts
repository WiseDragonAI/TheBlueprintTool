import { renderGeometry } from '../../canvas/helper/render-density.js';

export function patchLedgerZone(zone: Record<string, unknown>, existing?: HTMLElement | null): HTMLElement {
  const element = existing ?? document.createElement('article');
  const id = String(zone.id ?? '');
  const isGroup = zone.variant === 'group';
  const variant = isGroup ? 'group-zone' : 'regular-zone';
  element.className = `zone ${variant} ledger-node`;
  delete element.dataset.groupId;
  delete element.dataset.zoneId;
  if (isGroup) element.dataset.groupId = id;
  else element.dataset.zoneId = id;
  element.dataset.threadId = `thread-${id}`;
  element.dataset.ledgerNode = 'zone';
  const geometry = {
    x: Number(zone.x ?? 0),
    y: Number(zone.y ?? 0),
    width: Math.max(180, Number(zone.width ?? 280)),
    height: Math.max(120, Number(zone.height ?? 180))
  };
  const renderedGeometry = renderGeometry(geometry);
  element.style.left = `${renderedGeometry.x}px`;
  element.style.top = `${renderedGeometry.y}px`;
  element.style.width = `${renderedGeometry.width}px`;
  element.style.height = `${renderedGeometry.height}px`;
  element.style.minHeight = `${renderedGeometry.height}px`;
  if (typeof zone.color === 'string') element.style.setProperty('--zone-color', zone.color);
  else element.style.removeProperty('--zone-color');
  const handles = ['nw', 'ne', 'sw', 'se'].map((position) => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${position}`;
    return handle;
  });
  const title = document.createElement('div');
  title.className = 'zone-title';
  title.textContent = String(zone.label ?? id);
  element.replaceChildren(...handles, title);
  return element;
}
