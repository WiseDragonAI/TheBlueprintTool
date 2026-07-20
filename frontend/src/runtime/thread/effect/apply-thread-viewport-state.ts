/**
 * WHAT: Applies the final viewport decision after the active thread surface has mounted its content.
 * WHY: Entry, continuation, and delayed-layout paths need one scroll writer with explicit precedence.
 */
import { isThreadFollowingBottom } from '../helper/thread-follow-bottom.js';
import { consumeThreadViewportEntry } from './consume-thread-viewport-entry.js';
import { pinThreadSurfaceToBottom } from './pin-thread-feed-to-last-message.js';
import { restoreThreadScrollPosition } from './persist-thread-scroll.js';
import { syncThreadFollowBottomObserver } from './sync-thread-follow-bottom-observer.js';
import { syncThreadJumpButtonVisibility } from './render-thread-jump-button.js';
import type { ThreadPanelTab } from '../../state.js';

export function applyThreadViewportState(input: { active: boolean; threadId: string; surface: ThreadPanelTab }): void {
  const viewportEntry = input.active ? consumeThreadViewportEntry(input.threadId, input.surface) : null;
  const shouldFollowBottom = Boolean(input.active && isThreadFollowingBottom(input.threadId, input.surface));
  // WHAT: Give a matched entry transition precedence over continuation state.
  // WHY: Opening and activation always land on newest content, while ordinary rerenders preserve a paused reader.
  if (viewportEntry || shouldFollowBottom) pinThreadSurfaceToBottom(input.surface);
  else if (input.active) restoreThreadScrollPosition(input.threadId, input.surface);
  syncThreadFollowBottomObserver(input);
  syncThreadJumpButtonVisibility();
}
