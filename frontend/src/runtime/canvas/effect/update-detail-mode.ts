import { canvas } from '../../dom.js';
import { state } from '../../state.js';
import { beginStagedDetailReveal, cancelStagedDetailReveal, scheduleStagedDetailReveal } from './stage-detail-reveal.js';

export function invalidateDetailModeCardSizeCache(): void {
  // Card geometry is ledger-owned; this legacy hook remains for callers that
  // update explicit card dimensions, but zoom detail no longer measures layout.
}

export function updateDetailMode(): void {
  const shouldUseLowDetail = state.viewport.scale < 0.35;
  const shouldUseOverviewDetail = state.viewport.scale < 0.18;
  const shouldSuppressGrid = state.viewport.scale < 0.45;
  const hasLowDetail = canvas.classList.contains('low-detail');
  const hasOverviewDetail = canvas.classList.contains('overview-detail');
  const hasSuppressedGrid = canvas.classList.contains('zoom-grid-suppressed');
  if (shouldUseLowDetail) cancelStagedDetailReveal();
  else if (hasLowDetail) beginStagedDetailReveal();
  if (hasLowDetail !== shouldUseLowDetail) canvas.classList.toggle('low-detail', shouldUseLowDetail);
  if (hasOverviewDetail !== shouldUseOverviewDetail) canvas.classList.toggle('overview-detail', shouldUseOverviewDetail);
  if (hasSuppressedGrid !== shouldSuppressGrid) canvas.classList.toggle('zoom-grid-suppressed', shouldSuppressGrid);
  if (!shouldUseLowDetail) scheduleStagedDetailReveal();
}
