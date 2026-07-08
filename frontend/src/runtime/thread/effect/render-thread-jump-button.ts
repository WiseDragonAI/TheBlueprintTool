/**
 * WHAT: Renders and updates the thread feed jump-to-bottom control.
 * WHY: Long threads need a quick return path to the newest note without moving the composer.
 */
const threadJumpScrollHandlers = new WeakMap<HTMLElement, EventListener>();

function threadChatElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.thread-panel .chat') as HTMLElement | null;
}

function threadJumpButton(chat = threadChatElement()): HTMLButtonElement | null {
  if (!chat || typeof chat.querySelector !== 'function') return null;
  return chat?.querySelector('.thread-jump-bottom') as HTMLButtonElement | null;
}

export function syncThreadJumpButtonVisibility(): void {
  const chat = threadChatElement();
  const button = threadJumpButton(chat);
  if (!chat || !button) return;
  const scrollTop = Math.max(0, Number(chat.scrollTop ?? 0));
  const scrollHeight = Math.max(0, Number(chat.scrollHeight ?? 0));
  const clientHeight = Math.max(0, Number(chat.clientHeight ?? 0));
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const bottomDistance = Math.max(0, maxScrollTop - scrollTop);
  const shouldShow = maxScrollTop > 8 && bottomDistance > 72;
  button.hidden = !shouldShow;
  button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

export function renderThreadJumpButton(): void {
  const chat = threadChatElement();
  if (!chat) return;
  let frame = chat.querySelector('.thread-jump-bottom-frame') as HTMLElement | null;
  let button = threadJumpButton(chat);
  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'thread-jump-bottom-frame';
    chat.append(frame);
  }
  if (!button) {
    button = document.createElement('button');
    button.className = 'thread-jump-bottom';
    button.type = 'button';
    button.dataset.action = 'jump-thread-bottom';
    button.title = 'Jump to bottom';
    button.setAttribute('aria-label', button.title);
    const chevron = document.createElement('span');
    chevron.className = 'thread-jump-bottom-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    button.replaceChildren(chevron);
    frame.append(button);
  }
  if (!threadJumpScrollHandlers.has(chat)) {
    const sync = () => syncThreadJumpButtonVisibility();
    chat.addEventListener('scroll', sync, { passive: true });
    threadJumpScrollHandlers.set(chat, sync);
  }
  syncThreadJumpButtonVisibility();
  globalThis.requestAnimationFrame?.(() => syncThreadJumpButtonVisibility());
}
