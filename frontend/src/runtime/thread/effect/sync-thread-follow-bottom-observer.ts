/**
 * WHAT: Keeps the followed thread surface pinned when mounted content changes size after render.
 * WHY: Lazy images and expanding run output can move the newest content after the entry pin has executed.
 */
import { state, type ThreadPanelTab } from '../../state.js';
import { isThreadFollowingBottom } from '../helper/thread-follow-bottom.js';
import { threadScrollElement } from './persist-thread-scroll.js';
import { syncThreadJumpButtonVisibility } from './render-thread-jump-button.js';

let resizeObserver: ResizeObserver | null = null;
let observedContent: Element | null = null;
let observedIdentity = '';
let resizeFrame: number | null = null;

export function disconnectThreadFollowBottomObserver(): void {
  resizeObserver?.disconnect();
  if (resizeFrame !== null) globalThis.cancelAnimationFrame?.(resizeFrame);
  resizeObserver = null;
  observedContent = null;
  observedIdentity = '';
  resizeFrame = null;
}

export function syncThreadFollowBottomObserver(input: { active: boolean; threadId: string; surface: ThreadPanelTab }): void {
  const viewport = input.active ? threadScrollElement(input.surface) : null;
  const content = input.surface === 'thread'
    ? document.querySelector('.thread-panel .thread-note-list')
    : document.querySelector('.thread-panel .thread-codex-log');
  const identity = `${input.threadId}:${input.surface}`;
  // WHAT: Release observation when the active surface cannot own delayed layout.
  // WHY: Hidden, anonymous, unmounted, and unsupported surfaces must not retain callbacks.
  if (!input.active || !input.threadId || !viewport || !content || typeof globalThis.ResizeObserver !== 'function') {
    disconnectThreadFollowBottomObserver();
    return;
  }
  // WHAT: Keep the existing observer when its complete ownership identity is unchanged.
  // WHY: Ordinary rerenders should not multiply resize callbacks.
  if (resizeObserver && observedContent === content && observedIdentity === identity) return;
  disconnectThreadFollowBottomObserver();
  observedContent = content;
  observedIdentity = identity;
  resizeObserver = new ResizeObserver(() => {
    // WHAT: Coalesce resize deliveries into one post-layout scroll write.
    // WHY: Calling the full entry pin helper inside ResizeObserver can create a layout-and-scroll feedback cycle.
    if (resizeFrame !== null) return;
    resizeFrame = globalThis.requestAnimationFrame?.(() => {
      resizeFrame = null;
      const currentSurface = state.threadActiveTabByThreadId?.[input.threadId] === 'codex-log' ? 'codex-log' : 'thread';
      // WHAT: Ignore delayed work after ownership or follow state changes.
      // WHY: A queued frame must not move a paused reader or a different thread surface.
      if (!state.threadPanelOpen
        || String(state.threadId ?? '') !== input.threadId
        || currentSurface !== input.surface
        || !isThreadFollowingBottom(input.threadId, input.surface)) return;
      const currentViewport = threadScrollElement(input.surface);
      // WHAT: Apply one direct bottom alignment to the active viewport.
      // WHY: Delayed content growth needs no entry animation or descendant `scrollIntoView` side effects.
      if (!currentViewport) return;
      currentViewport.scrollTop = currentViewport.scrollHeight;
      syncThreadJumpButtonVisibility();
    }) ?? null;
  });
  resizeObserver.observe(content);
}
