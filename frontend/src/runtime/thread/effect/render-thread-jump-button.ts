/**
 * WHAT: Renders and updates the thread feed jump-to-bottom control.
 * WHY: Long threads need a quick return path to the newest note without moving the composer.
 */
import { state, type ThreadPanelTab } from '../../state.js';
import { setThreadFollowBottom } from '../helper/thread-follow-bottom.js';
import { saveThreadScrollPosition, scheduleThreadViewportPersistence, threadScrollElement } from './persist-thread-scroll.js';

const threadJumpScrollHandlers = new WeakMap<HTMLElement, EventListener>();
const previousScrollTop = new WeakMap<HTMLElement, number>();

function activeSurface(): ThreadPanelTab {
  return state.threadActiveTabByThreadId?.[String(state.threadId ?? '')] === 'codex-log' ? 'codex-log' : 'thread';
}

function threadChatElement(): HTMLElement | null {
  return threadScrollElement(activeSurface());
}

function threadJumpFrameHost(chat = threadChatElement()): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (document.querySelector('.thread-panel .thread-chat-shell') as HTMLElement | null) ?? chat;
}

function threadJumpFrame(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.thread-panel .thread-jump-bottom-frame') as HTMLElement | null;
}

function threadJumpButton(): HTMLButtonElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.thread-panel .thread-jump-bottom') as HTMLButtonElement | null;
}

export function syncThreadJumpButtonVisibility(options: { persistScroll?: boolean } = {}): void {
  const chat = threadChatElement();
  const button = threadJumpButton();
  if (!chat || !button) return;
  const surface = activeSurface();
  const scrollTop = Math.max(0, Number(chat.scrollTop ?? 0));
  const scrollHeight = Math.max(0, Number(chat.scrollHeight ?? 0));
  const clientHeight = Math.max(0, Number(chat.clientHeight ?? 0));
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const bottomDistance = Math.max(0, maxScrollTop - scrollTop);
  const lastTop = previousScrollTop.get(chat) ?? scrollTop;
  previousScrollTop.set(chat, scrollTop);
  saveThreadScrollPosition(String(state.threadId ?? ''), surface, { persist: false });
  if (options.persistScroll) scheduleThreadViewportPersistence();
  if (bottomDistance > 72 && scrollTop < lastTop) setThreadFollowBottom(String(state.threadId ?? ''), false, surface);
  if (button.dataset.action === 'close-thread-text') {
    button.hidden = false;
    button.setAttribute('aria-hidden', 'false');
    return;
  }
  const shouldShow = maxScrollTop > 8 && bottomDistance > 72;
  button.hidden = !shouldShow;
  button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

export function renderThreadJumpButton(visible = true): void {
  const chat = threadChatElement();
  const host = threadJumpFrameHost(chat);
  if (!chat || !host) return;
  let frame = threadJumpFrame();
  let button = threadJumpButton();
  if (!visible && frame) frame.hidden = true;
  if (!visible && button) {
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
    return;
  }
  if (!frame) {
    frame = document.createElement('div');
    frame.className = 'thread-jump-bottom-frame';
  }
  if (frame.parentElement !== host) {
    host.append(frame);
  }
  frame.hidden = false;
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
  }
  if (button.parentElement !== frame) {
    frame.append(button);
  }
  if (!threadJumpScrollHandlers.has(chat)) {
    const sync = () => syncThreadJumpButtonVisibility({ persistScroll: true });
    chat.addEventListener('scroll', sync, { passive: true });
    threadJumpScrollHandlers.set(chat, sync);
    previousScrollTop.set(chat, Math.max(0, Number(chat.scrollTop ?? 0)));
  }
  syncThreadJumpButtonVisibility();
  globalThis.requestAnimationFrame?.(() => syncThreadJumpButtonVisibility());
}
