/**
 * WHAT: Saves and restores the independent conversation and Codex Log viewports.
 * WHY: Switching threads or tabs must not move the operator's reading position in either surface.
 */
import { state, type ThreadPanelTab } from '../../state.js';

type ThreadScrollSurface = ThreadPanelTab;

function threadScrollState(surface: ThreadScrollSurface): Record<string, number> {
  const key = surface === 'codex-log' ? 'threadLogScrollTopByThreadId' : 'threadScrollTopByThreadId';
  if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
  return state[key] as Record<string, number>;
}

export function threadScrollElement(surface: ThreadScrollSurface = 'thread'): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (surface === 'codex-log') {
    return document.querySelector('.thread-panel .thread-log-scroll') as HTMLElement | null;
  }
  return (document.querySelector('.thread-panel .thread-conversation-scroll')
    ?? document.querySelector('.thread-panel .chat')) as HTMLElement | null;
}

export function hasSavedThreadScrollPosition(threadId = String(state.threadId ?? ''), surface: ThreadScrollSurface = 'thread'): boolean {
  if (!threadId) return false;
  return Object.prototype.hasOwnProperty.call(threadScrollState(surface), threadId);
}

export function saveThreadScrollPosition(threadId = String(state.threadId ?? ''), surface: ThreadScrollSurface = 'thread'): void {
  if (!threadId) return;
  const viewport = threadScrollElement(surface);
  if (!viewport) return;
  const scrollTop = Number(viewport.scrollTop);
  if (!Number.isFinite(scrollTop)) return;
  threadScrollState(surface)[threadId] = Math.max(0, scrollTop);
}

export function saveThreadPanelScrollPositions(threadId = String(state.threadId ?? '')): void {
  saveThreadScrollPosition(threadId, 'thread');
  saveThreadScrollPosition(threadId, 'codex-log');
}

export function restoreThreadScrollPosition(threadId = String(state.threadId ?? ''), surface: ThreadScrollSurface = 'thread'): boolean {
  if (!hasSavedThreadScrollPosition(threadId, surface)) return false;
  const viewport = threadScrollElement(surface);
  if (!viewport) return false;
  const savedScrollTop = threadScrollState(surface)[threadId];
  const restore = () => {
    const maxScrollTop = Math.max(0, Number(viewport.scrollHeight ?? 0) - Number(viewport.clientHeight ?? 0));
    viewport.scrollTop = Math.min(savedScrollTop, maxScrollTop || savedScrollTop);
  };
  restore();
  globalThis.requestAnimationFrame?.(() => restore());
  return true;
}
