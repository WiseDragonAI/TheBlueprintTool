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
  const handles = ['nw', 'ne', 'sw', 'se'].map((position) => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${position}`;
    return handle;
  });
  const title = document.createElement('div');
  title.className = 'zone-title';
  title.textContent = String(zone.label ?? id);
  const actions = document.createElement('div');
  actions.className = 'zone-actions';
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'icon-button';
  edit.dataset.action = 'edit-zone';
  edit.dataset.spec = '3fd7a96a';
  edit.title = isGroup ? 'Edit group name' : 'Edit zone name';
  edit.ariaLabel = edit.title;
  edit.textContent = '✎';
  actions.append(edit);
  if (!isGroup) {
    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'zone-color-edit';
    color.dataset.action = 'edit-zone-color';
    color.dataset.spec = '3fd7a96a a2f9c013';
    color.ariaLabel = 'Edit zone color';
    color.value = typeof zone.color === 'string' ? zone.color : '#55b8ff';
    actions.append(color);
  }
  element.replaceChildren(...handles, title, actions);
  return element;
}
