import { state } from '../../state.js';
import { syncLedgerCardTabFrames } from '../effect/sync-ledger-card-tab-frames.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';

export function switchCardTabController(cardElement: HTMLElement, tab: 'description' | 'fields'): void {
  const cardId = cardElement.dataset.cardId;
  if (!cardId) return;
  state.cardUi = {
    ...(state.cardUi ?? {}),
    activeTabByCardId: {
      ...(state.cardUi?.activeTabByCardId ?? {}),
      [cardId]: tab
    }
  };
  cardElement.dataset.activeCardTab = tab;
  const frame = cardElement.querySelector('.ledger-card-tab-frame') as HTMLElement | null;
  frame?.setAttribute('data-active-card-tab', tab);
  cardElement.querySelectorAll('.ledger-card-tab').forEach((node) => {
    const tabButton = node as HTMLElement;
    const isActive = tabButton.dataset.cardTab === tab;
    tabButton.classList.toggle('is-active', isActive);
    tabButton.setAttribute('aria-selected', String(isActive));
  });
  cardElement.querySelectorAll('.ledger-card-panel').forEach((node) => {
    const panel = node as HTMLElement;
    panel.classList.toggle('is-active', panel.dataset.cardPanel === tab);
  });
  syncLedgerCardTabFrames(cardElement);
  telemetry('switch-card-tab', { cardId, tab });
}
