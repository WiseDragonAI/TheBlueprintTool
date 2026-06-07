import { state } from '../../state.js';
import type { LedgerGeometry } from '../../ledger/helper/active-ledger-geometry.js';

export const lowZoomRenderDensityThreshold = 0.2;
export const lowZoomRenderDensity = 4;

let activeRenderDensity = 1;

export function resolvedRenderDensity(scale = Number(state.viewport.scale)): number {
  return state.activeLedger && scale < lowZoomRenderDensityThreshold ? lowZoomRenderDensity : 1;
}

export function currentRenderDensity(): number {
  return state.activeLedger ? activeRenderDensity : 1;
}

export function syncRenderDensity(): boolean {
  const nextDensity = resolvedRenderDensity();
  if (nextDensity === activeRenderDensity) return false;
  activeRenderDensity = nextDensity;
  return true;
}

export function effectiveViewportScale(scale = Number(state.viewport.scale)): number {
  return scale * currentRenderDensity();
}

export function renderLength(value: number): number {
  return value / currentRenderDensity();
}

export function renderGeometry(geometry: LedgerGeometry): LedgerGeometry {
  return {
    x: renderLength(geometry.x),
    y: renderLength(geometry.y),
    width: renderLength(geometry.width),
    height: renderLength(geometry.height)
  };
}
