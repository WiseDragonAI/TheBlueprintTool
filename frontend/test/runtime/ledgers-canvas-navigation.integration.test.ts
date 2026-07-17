import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerEndpointForTab } from '../../src/runtime/ledger/helper/ledger-endpoint-for-tab.js';
import { minScaleCenteredLedgerViewport } from '../../src/runtime/ledger/helper/min-scale-centered-ledger-viewport.js';
import { resolveHoveredOverviewTargetLedger } from '../../src/runtime/ledger/helper/resolve-overview-target-ledger.js';
import { routeCanvasMode } from '../../src/runtime/navigation/helper/route-canvas-mode.js';
import { state } from '../../src/runtime/state.js';

test('ledgers canvas route and endpoint resolve separately from real ledgers', () => {
  const previousMode = state.canvasMode;
  const previousLedgers = state.ledgers;
  const previousTabs = state.ledgerTabs;
  try {
    state.ledgers = [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }];
    state.ledgerTabs = state.ledgers;
    assert.equal(routeCanvasMode('/ledgers'), 'ledgers');
    assert.equal(routeCanvasMode('/projects'), 'ledger');
    assert.equal(routeCanvasMode('/projects-canvas'), 'projects');
    assert.equal(routeCanvasMode('/p/project-a/ledgers'), 'ledgers');
    assert.equal(routeCanvasMode('/p/project-a/ledgers/specs'), 'ledger');
    assert.equal(routeCanvasMode('/specs'), 'ledger');
    state.canvasMode = 'ledgers';
    assert.equal(ledgerEndpointForTab('specs'), '/decision-os/ledgers-canvas');
    state.canvasMode = 'ledger';
    assert.equal(ledgerEndpointForTab('specs'), '/decision-os/specs');
  } finally {
    state.canvasMode = previousMode;
    state.ledgers = previousLedgers;
    state.ledgerTabs = previousTabs;
  }
});

test('overview ledger entry is resolved from the hovered card element', () => {
  const card = {
    dataset: { targetLedgerId: 'ux' }
  };
  const child = {
    closest: (selector: string) => selector === '.card[data-target-ledger-id]' ? card : null
  } as unknown as EventTarget;
  assert.equal(resolveHoveredOverviewTargetLedger(child), 'ux');
});

test('canonical ledger entry viewport uses min scale centered framing', () => {
  const viewport = minScaleCenteredLedgerViewport({
    ledger: { cards: [{ x: 100, y: 200, w: 300, h: 200 }], annotations: [] },
    canvasSize: { width: 1000, height: 800 },
    scale: 0.03
  });
  assert.equal(viewport.scale, 0.03);
  assert.equal(viewport.x, 500 - 250 * 0.03);
  assert.equal(viewport.y, 400 - 300 * 0.03);
});
