/**
 * WHAT: Renders contextual card, zone, and group controls for hovered and selected canvas targets.
 * WHY: Control placement must follow current geometry and may use an explicit gesture selection.
 */
import { canvas, content, controlOverlay as initialControlOverlay } from '../../dom.js';
import { renderLedgerCardDeleteButton } from '../../ledger/component/render-ledger-card-delete-button.js';
import { renderLedgerCardStatusButton } from '../../ledger/component/render-ledger-card-status-button.js';
import { state, type SelectionState } from '../../state.js';

type ControlTarget = {
  kind: 'card' | 'zone' | 'group';
  id: string;
};

let hoveredTarget: ControlTarget | null = null;
let hoverBindingInitialized = false;
const removalTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const controlFadeDurationMs = 160;

function targetKey(target: ControlTarget | null): string {
  return target ? `${target.kind}:${target.id}` : '';
}

function sameTarget(a: ControlTarget | null, b: ControlTarget | null): boolean {
  return targetKey(a) === targetKey(b);
}

function resolveControlOverlay(): HTMLElement | null {
  if (initialControlOverlay?.isConnected) return initialControlOverlay;
  if (!canvas || typeof canvas.querySelector !== 'function') return null;
  const existing = canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
  if (existing) return existing;
  const overlay = document.createElement('div');
  overlay.className = 'canvas-control-overlay';
  canvas.append(overlay);
  return overlay;
}

function existingControlOverlay(): HTMLElement | null {
  if (initialControlOverlay?.isConnected) return initialControlOverlay;
  if (!canvas || typeof canvas.querySelector !== 'function') return null;
  return canvas.querySelector(':scope > .canvas-control-overlay') as HTMLElement | null;
}

function clearCanvasControlOverlay(): void {
  hoveredTarget = null;
  existingControlOverlay()?.replaceChildren();
}

export function hideCanvasControlOverlay(): void {
  existingControlOverlay()?.replaceChildren();
}

function controlsDisabled(): boolean {
  return Boolean(canvas?.classList?.contains('low-detail'));
}

function targetFromElement(element: EventTarget | null): ControlTarget | null {
  const node = element as HTMLElement | null;
  const control = node?.closest?.('.canvas-control') as HTMLElement | null;
  if (control?.dataset.cardId) return { kind: 'card', id: control.dataset.cardId };
  if (control?.dataset.zoneId) return { kind: 'zone', id: control.dataset.zoneId };
  if (control?.dataset.groupId) return { kind: 'group', id: control.dataset.groupId };

  const canvasNode = node?.closest?.('.canvas-content > .card[data-card-id], .canvas-content > .zone[data-zone-id], .canvas-content > .zone[data-group-id]') as HTMLElement | null;
  if (canvasNode?.dataset.cardId) return { kind: 'card', id: canvasNode.dataset.cardId };
  if (canvasNode?.dataset.zoneId) return { kind: 'zone', id: canvasNode.dataset.zoneId };
  if (canvasNode?.dataset.groupId) return { kind: 'group', id: canvasNode.dataset.groupId };
  return null;
}

function sourceElement(target: ControlTarget): HTMLElement | null {
  if (!content) return null;
  if (target.kind === 'card') return content.querySelector(`:scope > .card[data-card-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
  if (target.kind === 'zone') return content.querySelector(`:scope > .zone[data-zone-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
  return content.querySelector(`:scope > .zone[data-group-id="${CSS.escape(target.id)}"]`) as HTMLElement | null;
}

function selectedTargets(selection: Partial<SelectionState>): ControlTarget[] {
  const targets: ControlTarget[] = [];
  for (const id of new Set(selection.zoneIds ?? [])) targets.push({ kind: 'zone', id });
  for (const id of new Set(selection.groupIds ?? [])) targets.push({ kind: 'group', id });
  return targets;
}

function visibleTargets(selection: Partial<SelectionState>): ControlTarget[] {
  const byKey = new Map<string, ControlTarget>();
  for (const target of selectedTargets(selection)) byKey.set(targetKey(target), target);
  if (hoveredTarget) byKey.set(targetKey(hoveredTarget), hoveredTarget);
  return [...byKey.values()];
}

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(callback);
  else setTimeout(callback, 0);
}

function cancelScheduledRemoval(control: HTMLElement): void {
  const timer = removalTimers.get(control);
  if (timer) clearTimeout(timer);
  removalTimers.delete(control);
}

function scheduleRemoval(control: HTMLElement): void {
  if (removalTimers.has(control)) return;
  control.classList.remove('is-visible');
  const timer = setTimeout(() => {
    if (!control.classList.contains('is-visible')) control.remove();
    removalTimers.delete(control);
  }, controlFadeDurationMs);
  removalTimers.set(control, timer);
}

function placeControlGroup(group: HTMLElement, source: HTMLElement, align: 'left' | 'right', yOffset = 6): boolean {
  const canvasRect = canvas.getBoundingClientRect();
  const rect = source.getBoundingClientRect();
  if (rect.right < canvasRect.left || rect.left > canvasRect.right || rect.bottom < canvasRect.top || rect.top > canvasRect.bottom) return false;
  const x = align === 'right' ? rect.right - canvasRect.left - 6 : rect.left - canvasRect.left + 6;
  const y = rect.top - canvasRect.top + yOffset;
  group.style.left = `${Math.round(x)}px`;
  group.style.top = `${Math.round(y)}px`;
  group.style.transform = align === 'right' ? 'translateX(-100%)' : 'none';
  return true;
}

function syncCardControls(group: HTMLElement, card: HTMLElement): boolean {
  if (!card.classList.contains('ledger-node')) return false;
  const cardId = card.dataset.cardId ?? '';
  if (!cardId) return false;
  const persistedStatus = card.dataset.cardStatus === 'done' ? 'done' : 'todo';
  const visibleStatus = card.dataset.cardWorkStatus === 'processing' ? 'processing' : persistedStatus;
  const cardZoneColor = card.dataset.cardZoneColor || card.style.getPropertyValue('--card-zone-color').trim();
  group.className = 'canvas-control canvas-control--card';
  group.dataset.cardId = cardId;
  if (cardZoneColor) group.style.setProperty('--card-zone-color', cardZoneColor);
  else group.style.removeProperty('--card-zone-color');
  const edit = document.createElement('button');
  edit.className = 'icon-button terminal-button terminal-button--compact';
  edit.type = 'button';
  edit.dataset.action = 'edit-card-title';
  edit.dataset.cardId = cardId;
  edit.title = card.dataset.targetLedgerId ? 'Edit ledger name' : 'Edit card title';
  edit.ariaLabel = edit.title;
  edit.textContent = '✎';
  const editBody = document.createElement('button');
  editBody.className = 'ledger-card-edit-toggle terminal-button terminal-button--compact';
  editBody.type = 'button';
  editBody.dataset.action = 'edit-card-description';
  editBody.dataset.cardId = cardId;
  editBody.title = 'Edit card content';
  editBody.setAttribute('aria-label', editBody.title);
  editBody.textContent = 'edit';
  const skill = document.createElement('button');
  skill.className = 'ledger-card-skill-toggle terminal-button terminal-button--compact';
  skill.type = 'button';
  skill.dataset.action = 'open-card-process-modal';
  skill.dataset.cardId = cardId;
  skill.title = 'Run Codex skill';
  skill.setAttribute('aria-label', skill.title);
  skill.textContent = 'fx';
  const controls = card.dataset.targetLedgerId
    ? [edit, renderLedgerCardDeleteButton(cardId)]
    : [skill, renderLedgerCardStatusButton(cardId, persistedStatus, visibleStatus), editBody, renderLedgerCardDeleteButton(cardId)];
  group.replaceChildren(...controls);
  return placeControlGroup(group, card, 'right');
}

function syncZoneControls(group: HTMLElement, zone: HTMLElement, kind: 'zone' | 'group'): boolean {
  const id = kind === 'zone' ? zone.dataset.zoneId ?? '' : zone.dataset.groupId ?? '';
  if (!id) return false;
  group.className = `canvas-control canvas-control--${kind}`;
  if (kind === 'zone') group.dataset.zoneId = id;
  else group.dataset.groupId = id;

  const edit = document.createElement('button');
  edit.className = 'icon-button terminal-button terminal-button--compact';
  edit.type = 'button';
  edit.dataset.action = 'edit-zone';
  if (kind === 'zone') edit.dataset.zoneId = id;
  else edit.dataset.groupId = id;
  edit.title = kind === 'zone' ? 'Edit zone name' : 'Edit group name';
  edit.ariaLabel = edit.title;
  edit.textContent = '✎';
  const controls: HTMLElement[] = [edit];

  if (kind === 'zone') {
    const color = document.createElement('input');
    color.type = 'color';
    color.className = 'zone-color-edit';
    color.dataset.action = 'edit-zone-color';
    color.dataset.zoneId = id;
    color.ariaLabel = 'Edit zone color';
    color.value = zone.style.getPropertyValue('--zone-color').trim() || '#55b8ff';
    controls.push(color);
  } else if (zone.classList.contains('ledger-node')) {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'ledger-group-delete terminal-button terminal-button--compact';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'confirm-delete-group';
    deleteButton.dataset.groupId = id;
    deleteButton.title = 'Delete group';
    deleteButton.setAttribute('aria-label', 'Delete group');
    deleteButton.textContent = 'X';
    controls.push(deleteButton);
  }

  group.replaceChildren(...controls);
  return placeControlGroup(group, zone, kind === 'group' ? 'right' : 'left', 32);
}

export function renderCanvasControlOverlay(selection: Partial<SelectionState> = state.selection): void {
  if (controlsDisabled()) {
    clearCanvasControlOverlay();
    return;
  }
  const overlay = resolveControlOverlay();
  if (!overlay || !canvas || !content) return;
  const activeKeys = new Set<string>();
  for (const target of visibleTargets(selection)) {
    const source = sourceElement(target);
    if (!source || source.hidden || source.style.display === 'none') continue;
    const key = targetKey(target);
    let control = overlay.querySelector(`[data-control-key="${CSS.escape(key)}"]`) as HTMLElement | null;
    const isNew = !control;
    if (!control) {
      control = document.createElement('div');
      control.dataset.controlKey = key;
    }
    const visible = target.kind === 'card'
      ? syncCardControls(control, source)
      : syncZoneControls(control, source, target.kind);
    if (!visible) continue;
    activeKeys.add(key);
    cancelScheduledRemoval(control);
    if (isNew) {
      overlay.append(control);
      nextFrame(() => nextFrame(() => control?.classList.add('is-visible')));
    } else {
      control.classList.add('is-visible');
    }
  }
  for (const control of Array.from(overlay.querySelectorAll('.canvas-control')) as HTMLElement[]) {
    if (!activeKeys.has(control.dataset.controlKey ?? '')) scheduleRemoval(control);
  }
}

export function bindCanvasControlOverlayHover(): void {
  if (hoverBindingInitialized || !canvas) return;
  hoverBindingInitialized = true;
  canvas.addEventListener('mouseover', (event) => {
    if (controlsDisabled()) {
      clearCanvasControlOverlay();
      return;
    }
    const next = targetFromElement(event.target);
    if (!next || sameTarget(hoveredTarget, next)) return;
    hoveredTarget = next;
    renderCanvasControlOverlay();
  });
  canvas.addEventListener('mouseout', (event) => {
    if (controlsDisabled()) {
      clearCanvasControlOverlay();
      return;
    }
    const previous = targetFromElement(event.target);
    if (!previous) return;
    const next = targetFromElement(event.relatedTarget);
    if (sameTarget(previous, next)) return;
    if (sameTarget(previous, hoveredTarget)) {
      hoveredTarget = next;
      renderCanvasControlOverlay();
    }
  });
}
