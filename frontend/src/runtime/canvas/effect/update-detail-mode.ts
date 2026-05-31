import { canvas } from '../../dom.js';
import { state } from '../../state.js';

export function invalidateDetailModeCardSizeCache(): void {
  // Card geometry is ledger-owned; this legacy hook remains for callers that
  // update explicit card dimensions, but zoom detail no longer measures layout.
}

export function updateDetailMode(): void {
  const shouldUseLowDetail = state.viewport.scale < 0.35;
  const shouldUseOverviewDetail = state.viewport.scale < 0.18;
  const hasLowDetail = canvas.classList.contains('low-detail');
  const hasOverviewDetail = canvas.classList.contains('overview-detail');
  if (hasLowDetail !== shouldUseLowDetail) canvas.classList.toggle('low-detail', shouldUseLowDetail);
  if (hasOverviewDetail !== shouldUseOverviewDetail) canvas.classList.toggle('overview-detail', shouldUseOverviewDetail);
}
