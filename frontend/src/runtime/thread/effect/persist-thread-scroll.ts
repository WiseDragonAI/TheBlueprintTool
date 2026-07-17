/**
 * WHAT: Saves and restores the independent conversation and Codex Log viewports.
 * WHY: Switching threads or tabs must not move the operator's reading position in either surface.
 */
import { state, type ThreadPanelTab } from '../../state.js';
import { readPersistedState } from '../../persistence/helper/read-persisted-state.js';

type ThreadScrollSurface = ThreadPanelTab;
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;

function finiteNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, entry]) => Boolean(key) && Number.isFinite(Number(entry)) && Number(entry) >= 0)
    .map(([key, entry]) => [key, Number(entry)]));
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key, entry]) => Boolean(key) && typeof entry === 'boolean')) as Record<string, boolean>;
}

export function hydrateThreadViewportState(persisted: Record<string, unknown>): void {
  state.threadScrollTopByThreadId = finiteNumberRecord(persisted.threadScrollTopByThreadId);
  state.threadLogScrollTopByThreadId = finiteNumberRecord(persisted.threadLogScrollTopByThreadId);
  state.threadFollowBottomByThreadId = booleanRecord(persisted.threadFollowBottomByThreadId);
  state.threadLogFollowBottomByThreadId = booleanRecord(persisted.threadLogFollowBottomByThreadId);
}

export function persistThreadViewportState(): void {
  if (typeof localStorage === 'undefined') return;
  const persisted = readPersistedState();
  localStorage.setItem('decision-os.canvas.state', JSON.stringify({
    ...persisted,
    threadScrollTopByThreadId: state.threadScrollTopByThreadId,
    threadLogScrollTopByThreadId: state.threadLogScrollTopByThreadId,
    threadFollowBottomByThreadId: state.threadFollowBottomByThreadId,
    threadLogFollowBottomByThreadId: state.threadLogFollowBottomByThreadId,
  }));
}

export function scheduleThreadViewportPersistence(): void {
  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(() => {
    persistenceTimer = null;
    persistThreadViewportState();
  }, 80);
  (persistenceTimer as { unref?: () => void }).unref?.();
}

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

export function saveThreadScrollPosition(threadId = String(state.threadId ?? ''), surface: ThreadScrollSurface = 'thread', options: { persist?: boolean } = {}): void {
  if (!threadId) return;
  const viewport = threadScrollElement(surface);
  if (!viewport) return;
  const scrollTop = Number(viewport.scrollTop);
  if (!Number.isFinite(scrollTop)) return;
  threadScrollState(surface)[threadId] = Math.max(0, scrollTop);
  if (options.persist !== false) persistThreadViewportState();
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
