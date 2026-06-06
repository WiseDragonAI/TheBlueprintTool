/**
 * WHAT: Renders the current viewport scale and detail mode in the zoom debug overlay.
 * WHY: Operators need exact scale numbers at the visible zoom step where pan behavior changes.
 */
import { canvas } from '../../../dom.js';
import { state } from '../../../state.js';
import { resolveDetailModeCssScale } from '../../../canvas/helper/resolve-detail-mode-css-scale.js';
import { countLedgerCardDetailStates } from '../helper/count-ledger-card-detail-states.js';
import { countZoomDebugSurvivorStates } from '../helper/count-zoom-debug-survivor-states.js';
import { markZoomDebugDetailExposure } from '../helper/mark-zoom-debug-detail-exposure.js';
import { resolveZoomDebugDetailLabel } from '../helper/resolve-zoom-debug-detail-label.js';
import { resolveZoomDebugOverlay } from '../helper/resolve-zoom-debug-overlay.js';
import { zoomDebugState } from '../helper/zoom-debug-state.js';

export function renderZoomDebugOverlay(): void {
  if (!zoomDebugState.enabled) {
    // Branch: Normal runtime keeps the debug overlay inert unless the operator opted in.
    return;
  }
  const scale = Number(state.viewport.scale) || 0;
  const cssScale = resolveDetailModeCssScale(scale, scale < 0.35);
  if (!canvas.classList.contains('low-detail')) {
    // Branch: Detail-mode debug should mark persistent survivor nodes so later low-detail can show history contamination.
    markZoomDebugDetailExposure();
  }
  const detailStates = countLedgerCardDetailStates();
  const survivorStates = countZoomDebugSurvivorStates();
  const details = [
    'ZOOM DEBUG',
    `scale ${scale.toFixed(6)}`,
    `zoom ${(scale * 100).toFixed(2)}%`,
    resolveZoomDebugDetailLabel(scale),
    `low ${canvas.classList.contains('low-detail') ? 'on' : 'off'}`,
    `cards ${detailStates.cards}`,
    `detail-dom ${detailStates.detailLayers}`,
    `mounted ${detailStates.mounted}`,
    `mounting ${detailStates.mounting}`,
    `unmounting ${detailStates.unmounting}`,
    `overview ${survivorStates.overviewLayers}/${survivorStates.overviewSawDetail}`,
    `zone-titles ${survivorStates.zoneTitles}/${survivorStates.zoneTitlesSawDetail}`,
    `rel-text ${survivorStates.relationshipTexts}/${survivorStates.relationshipTextsSawDetail}`,
    `shells ${survivorStates.cardShells}/${survivorStates.cardShellsSawDetail}`,
    `zone-proxies ${survivorStates.zoneLabelProxies}`,
    `connected ${survivorStates.connectedCards}`,
    `pan-text ${survivorStates.textShadowTargets}`,
    `pan-box ${survivorStates.boxShadowTargets}`,
    `will-change ${survivorStates.willChangeOpacity}`,
    `reveal-attrs ${survivorStates.detailRevealAttrs}`,
    `reveal-staged ${survivorStates.detailRevealStaged}`,
    `css ${cssScale.viewportScale.toFixed(4)} / inv ${cssScale.inverseViewportScale.toFixed(4)}`,
    `x ${Math.round(Number(state.viewport.x) || 0)} y ${Math.round(Number(state.viewport.y) || 0)}`
  ];
  resolveZoomDebugOverlay().textContent = details.join(' | ');
}
