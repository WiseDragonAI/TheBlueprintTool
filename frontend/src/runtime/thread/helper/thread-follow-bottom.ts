/**
 * WHAT: Owns per-thread conversation follow-bottom state.
 * WHY: The jump action and render lifecycle must share one explicit follow contract.
 */
import { state, type ThreadPanelTab } from '../../state.js';
import { persistThreadViewportState } from '../effect/persist-thread-scroll.js';

function followBottomState(surface: ThreadPanelTab): Record<string, boolean> {
  const key = surface === 'codex-log' ? 'threadLogFollowBottomByThreadId' : 'threadFollowBottomByThreadId';
  if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) {
    state[key] = {};
  }
  return state[key] as Record<string, boolean>;
}

export function setThreadFollowBottom(threadId: string, following: boolean, surface: ThreadPanelTab = 'thread'): void {
  if (!threadId) return;
  const records = followBottomState(surface);
  if (records[threadId] === following) return;
  records[threadId] = following;
  persistThreadViewportState();
}

export function isThreadFollowingBottom(threadId = String(state.threadId ?? ''), surface: ThreadPanelTab = 'thread'): boolean {
  return Boolean(threadId && followBottomState(surface)[threadId] !== false);
}
