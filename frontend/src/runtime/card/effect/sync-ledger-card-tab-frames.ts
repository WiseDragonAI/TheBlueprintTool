export function syncLedgerCardTabFrames(root: ParentNode = document): void {
  const frames = root instanceof HTMLElement && root.matches('.ledger-card-tab-frame')
    ? [root]
    : Array.from(root.querySelectorAll('.ledger-card-tab-frame')) as HTMLElement[];
  for (const frame of frames) {
    const description = frame.querySelector('[data-card-panel="description"]') as HTMLElement | null;
    if (!description) continue;
    const descriptionTop = description.getBoundingClientRect().top;
    const contentHeight = Array.from(description.children).reduce((height, child) => {
      const rect = (child as HTMLElement).getBoundingClientRect();
      return Math.max(height, rect.bottom - descriptionTop);
    }, 0);
    const height = Math.max(96, Math.ceil(contentHeight));
    frame.style.setProperty('--ledger-card-tab-height', `${height}px`);
  }
}
