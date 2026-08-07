/**
 * WHAT: Renders the fixed Ledgers indicator at real-ledger minimum zoom.
 * WHY: Operators need a visible affordance before the extra wheel-out enters the parent canvas.
 */
import { canvas } from '../../dom.js';
import {
  commandBindingForElement,
  containCommandRegistrationFailure,
  createCommandDescriptor,
  tryRegisterCommandElement,
  updateCommandElementDescriptor,
} from '../../input/command-ownership.js';
import { state } from '../../state.js';
import { minCanvasZoomScale } from '../helper/canvas-zoom-constants.js';

function indicatorDescriptor(action: 'open-ledgers-canvas' | 'open-projects-canvas') {
  const generation = Number(state.ledgerReconciliation?.routeEpoch ?? 0);
  return createCommandDescriptor({
    commandId: 'canvas.open-parent-canvas',
    stateOwner: 'canvas-navigation-state',
    transitionOwner: 'canvas-parent-navigation',
    resourceIdentity: `${String(state.projectId ?? '')}:${String(state.activeTab ?? '')}:${action}`,
    presentationGeneration: Number.isFinite(generation) && generation >= 0 ? generation : 0,
    pendingPolicy: 'ignore',
    reconciliationPolicy: 'confirmed-state',
  });
}

function syncIndicatorCommand(indicator: HTMLButtonElement, action: 'open-ledgers-canvas' | 'open-projects-canvas'): void {
  const descriptor = indicatorDescriptor(action);
  if (!commandBindingForElement(indicator)) {
    tryRegisterCommandElement({
      element: indicator,
      descriptor,
      ownershipClass: 'delegated',
      surface: 'ledgers-min-zoom-indicator',
    });
    return;
  }
  try {
    updateCommandElementDescriptor(indicator, descriptor);
    delete indicator.dataset.commandOwnershipError;
  } catch (error) {
    containCommandRegistrationFailure('ledgers-min-zoom-indicator', descriptor.commandId, error);
    indicator.dataset.commandOwnershipError = 'true';
  }
}

export function renderLedgersIndicator(): void {
  if (!canvas) return;
  let indicator = canvas.querySelector(':scope > .ledgers-min-zoom-indicator') as HTMLButtonElement | null;
  const visible = (state.canvasMode === 'ledger' || state.canvasMode === 'ledgers')
    && Number(state.viewport.scale) <= minCanvasZoomScale + 0.00001;
  if (!visible) {
    indicator?.remove();
    return;
  }
  if (!indicator) {
    indicator = document.createElement('button');
    indicator.className = 'ledgers-min-zoom-indicator';
    indicator.type = 'button';
    canvas.append(indicator);
  }
  const action = state.canvasMode === 'ledger' ? 'open-ledgers-canvas' : 'open-projects-canvas';
  indicator.dataset.action = action;
  syncIndicatorCommand(indicator, action);
  indicator.textContent = state.canvasMode === 'ledger' ? 'Ledgers' : 'Projects';
}
