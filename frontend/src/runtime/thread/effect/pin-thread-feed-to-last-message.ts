/**
 * WHAT: Pins the thread conversation viewport to the newest rendered note.
 * WHY: Opening a card thread should land on the latest operator/agent exchange.
 */
export function pinThreadFeedToLastMessage(): void {
  const chat = document.querySelector('.thread-panel .chat') as HTMLElement | null;
  const list = document.querySelector('.thread-note-list') as HTMLElement | null;
  if (!chat) return;
  const pin = () => {
    const lastNote = list?.lastElementChild as HTMLElement | null;
    lastNote?.scrollIntoView?.({ block: 'end', inline: 'nearest' });
    chat.scrollTop = chat.scrollHeight;
  };
  pin();
  globalThis.requestAnimationFrame?.(() => pin());
}
