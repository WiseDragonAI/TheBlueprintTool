/**
 * WHAT: Creates the one-shot viewport intent for a thread entry transition.
 * WHY: Persisted follow state describes continuation; it must not decide where a newly activated surface opens.
 */
import {
  state,
  type ThreadPanelTab,
  type ThreadViewportEntryReason,
  type ThreadViewportPinRequest,
} from '../../state.js';
import { setThreadFollowBottom } from '../helper/thread-follow-bottom.js';

export function requestThreadViewportEntry(
  threadId: string,
  surface: ThreadPanelTab,
  reason: ThreadViewportEntryReason,
): ThreadViewportPinRequest | null {
  // WHAT: Reject entry intents without an owner identity.
  // WHY: An anonymous request could be consumed by whichever thread renders next.
  if (!threadId) return null;
  const openGeneration = Math.max(0, Number(state.threadViewportOpenGeneration ?? 0)) + 1;
  const request: ThreadViewportPinRequest = { threadId, surface, openGeneration, reason };
  state.threadViewportOpenGeneration = openGeneration;
  state.threadViewportPinRequest = request;
  setThreadFollowBottom(threadId, true, surface);
  return request;
}
