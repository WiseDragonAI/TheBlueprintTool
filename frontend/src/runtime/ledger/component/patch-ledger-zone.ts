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
  element.style.left = `${Number(zone.x ?? 0)}px`;
  element.style.top = `${Number(zone.y ?? 0)}px`;
  element.style.width = `${Math.max(180, Number(zone.width ?? 280))}px`;
  element.style.height = `${Math.max(120, Number(zone.height ?? 180))}px`;
  if (typeof zone.color === 'string') element.style.setProperty('--zone-color', zone.color);
  else element.style.removeProperty('--zone-color');
  const title = document.createElement('div');
  title.className = 'zone-title';
  title.textContent = String(zone.label ?? id);
  element.replaceChildren(title);
  return element;
}
