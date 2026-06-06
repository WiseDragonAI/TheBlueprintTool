/**
 * WHAT: Starts teardown for every mounted low-detail branch in the active surface.
 * WHY: Detail mode should never reuse low-detail survivor nodes from an earlier transition.
 */
import { content } from '../../dom.js';
import { beginUnmountLedgerCardLowDetail } from './begin-unmount-ledger-card-low-detail.js';

export function unmountAllLedgerCardLowDetail(): void {
  for (const card of content.querySelectorAll<HTMLElement>('.card[data-card-id]')) {
    // Branch: Every card shell gets a teardown attempt because only mounted branches will actually remove nodes.
    beginUnmountLedgerCardLowDetail(card);
  }
}
