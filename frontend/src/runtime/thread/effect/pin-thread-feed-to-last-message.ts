/**
 * WHAT: Pins the thread conversation viewport to the newest rendered note.
 * WHY: Opening a card thread should land on the latest operator/agent exchange.
 */
import { syncThreadJumpButtonVisibility } from './render-thread-jump-button.js';

export function pinThreadFeedToLastMessage(options: { behavior?: ScrollBehavior } = {}): void {
  const chat = (document.querySelector('.thread-panel .thread-conversation-scroll')
    ?? document.querySelector('.thread-panel .chat')) as HTMLElement | null;
  const list = document.querySelector('.thread-note-list') as HTMLElement | null;
  if (!chat) return;
  const scrollOptions: ScrollIntoViewOptions = options.behavior === 'smooth'
    ? { block: 'end', inline: 'nearest', behavior: options.behavior }
    : { block: 'end', inline: 'nearest' };
  const pin = () => {
    const lastNote = list?.lastElementChild as HTMLElement | null;
    lastNote?.scrollIntoView?.(scrollOptions);
    if (options.behavior === 'smooth' && typeof chat.scrollTo === 'function') {
      chat.scrollTo({ top: chat.scrollHeight, behavior: options.behavior });
    } else {
      chat.scrollTop = chat.scrollHeight;
    }
    syncThreadJumpButtonVisibility();
  };
  pin();
  globalThis.requestAnimationFrame?.(() => pin());
}
