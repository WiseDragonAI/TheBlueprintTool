/**
 * WHAT: Owns per-thread conversation follow-bottom state.
 * WHY: The jump action and render lifecycle must share one explicit follow contract.
 */
import { state } from '../../state.js';

function followBottomState(): Record<string, boolean> {
  if (!state.threadFollowBottomByThreadId || typeof state.threadFollowBottomByThreadId !== 'object' || Array.isArray(state.threadFollowBottomByThreadId)) {
    state.threadFollowBottomByThreadId = {};
  }
  return state.threadFollowBottomByThreadId as Record<string, boolean>;
}

export function setThreadFollowBottom(threadId: string, following: boolean): void {
  if (!threadId) return;
  followBottomState()[threadId] = following;
}

export function isThreadFollowingBottom(threadId = String(state.threadId ?? '')): boolean {
  return Boolean(threadId && followBottomState()[threadId]);
}
