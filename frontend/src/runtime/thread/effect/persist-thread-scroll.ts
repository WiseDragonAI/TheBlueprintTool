import { state } from '../../state.js';

function threadScrollState(): Record<string, number> {
  if (!state.threadScrollTopByThreadId || typeof state.threadScrollTopByThreadId !== 'object') {
    state.threadScrollTopByThreadId = {};
  }
  return state.threadScrollTopByThreadId;
}

function threadScrollElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('.thread-panel .chat') as HTMLElement | null;
}

export function hasSavedThreadScrollPosition(threadId = String(state.threadId ?? '')): boolean {
  if (!threadId) return false;
  return Object.prototype.hasOwnProperty.call(threadScrollState(), threadId);
}

export function saveThreadScrollPosition(threadId = String(state.threadId ?? '')): void {
  if (!threadId) return;
  const chat = threadScrollElement();
  if (!chat) return;
  const scrollTop = Number(chat.scrollTop);
  if (!Number.isFinite(scrollTop)) return;
  threadScrollState()[threadId] = Math.max(0, scrollTop);
}

export function restoreThreadScrollPosition(threadId = String(state.threadId ?? '')): boolean {
  if (!hasSavedThreadScrollPosition(threadId)) return false;
  const chat = threadScrollElement();
  if (!chat) return false;
  const savedScrollTop = threadScrollState()[threadId];
  const restore = () => {
    const maxScrollTop = Math.max(0, Number(chat.scrollHeight ?? 0) - Number(chat.clientHeight ?? 0));
    chat.scrollTop = Math.min(savedScrollTop, maxScrollTop || savedScrollTop);
  };
  restore();
  globalThis.requestAnimationFrame?.(() => restore());
  return true;
}
