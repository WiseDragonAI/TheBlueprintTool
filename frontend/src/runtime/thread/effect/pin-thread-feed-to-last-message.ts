/**
 * WHAT: Pins the thread conversation viewport to the newest rendered note.
 * WHY: Opening a card thread should land on the latest operator/agent exchange.
 */
import { syncThreadJumpButtonVisibility } from './render-thread-jump-button.js';
import { state, type ThreadPanelTab } from '../../state.js';
import { isThreadFollowingBottom, setThreadFollowBottom } from '../helper/thread-follow-bottom.js';
import { threadScrollElement } from './persist-thread-scroll.js';

export function pinThreadFeedToLastMessage(options: { behavior?: ScrollBehavior; follow?: boolean } = {}): void {
  pinThreadSurfaceToBottom('thread', options);
}

export function pinThreadSurfaceToBottom(surface: ThreadPanelTab, options: { behavior?: ScrollBehavior; follow?: boolean } = {}): void {
  const chat = threadScrollElement(surface);
  const list = document.querySelector('.thread-note-list') as HTMLElement | null;
  if (!chat) return;
  const threadId = String(state.threadId ?? '');
  if (options.follow) setThreadFollowBottom(threadId, true, surface);
  const scrollOptions: ScrollIntoViewOptions = options.behavior === 'smooth'
    ? { block: 'end', inline: 'nearest', behavior: options.behavior }
    : { block: 'end', inline: 'nearest' };
  const pin = () => {
    const lastItem = surface === 'thread' ? list?.lastElementChild as HTMLElement | null : chat.lastElementChild as HTMLElement | null;
    lastItem?.scrollIntoView?.(scrollOptions);
    if (options.behavior === 'smooth' && typeof chat.scrollTo === 'function') {
      chat.scrollTo({ top: chat.scrollHeight, behavior: options.behavior });
    } else {
      chat.scrollTop = chat.scrollHeight;
    }
    syncThreadJumpButtonVisibility();
  };
  pin();
  globalThis.requestAnimationFrame?.(() => {
    // WHAT: Yield the delayed entry alignment when the reader has already scrolled away.
    // WHY: A queued programmatic pin must not overwrite newer user ownership of the viewport.
    if (String(state.threadId ?? '') !== threadId || (threadId && !isThreadFollowingBottom(threadId, surface))) return;
    pin();
  });
}
