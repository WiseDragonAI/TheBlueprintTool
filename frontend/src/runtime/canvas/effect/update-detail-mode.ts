import { canvas } from '../../dom.js';
import { state } from '../../state.js';

export function invalidateDetailModeCardSizeCache(): void {
  // Card geometry is ledger-owned; this legacy hook remains for callers that
  // update explicit card dimensions, but zoom detail no longer measures layout.
}

export function updateDetailMode(): boolean {
  const shouldUseLowDetail = state.viewport.scale < 0.35;
  const shouldUseOverviewDetail = state.viewport.scale < 0.18;
  const shouldUseWideZoneBorders = state.viewport.scale < 0.06;
  const shouldUseFineZoneBorders = state.viewport.scale > 0.15;
  const hasLowDetail = canvas.classList.contains('low-detail');
  const hasOverviewDetail = canvas.classList.contains('overview-detail');
  const hasWideZoneBorders = canvas.classList.contains('low-detail-zone-border-wide');
  const hasFineZoneBorders = canvas.classList.contains('low-detail-zone-border-fine');
  if (hasLowDetail !== shouldUseLowDetail) canvas.classList.toggle('low-detail', shouldUseLowDetail);
  if (hasOverviewDetail !== shouldUseOverviewDetail) canvas.classList.toggle('overview-detail', shouldUseOverviewDetail);
  if (hasWideZoneBorders !== shouldUseWideZoneBorders) canvas.classList.toggle('low-detail-zone-border-wide', shouldUseWideZoneBorders);
  if (hasFineZoneBorders !== shouldUseFineZoneBorders) canvas.classList.toggle('low-detail-zone-border-fine', shouldUseFineZoneBorders);
  return hasLowDetail !== shouldUseLowDetail || hasOverviewDetail !== shouldUseOverviewDetail;
}
