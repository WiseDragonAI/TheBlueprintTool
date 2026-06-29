import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerEndpointForTab } from '../../src/runtime/ledger/helper/ledger-endpoint-for-tab.js';
import { minScaleCenteredLedgerViewport } from '../../src/runtime/ledger/helper/min-scale-centered-ledger-viewport.js';
import { resolveOverviewTargetLedger } from '../../src/runtime/ledger/helper/resolve-overview-target-ledger.js';
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

test('overview target resolution uses full card geometry and viewport center', () => {
  const ledger = {
    cards: [
      { id: 'ledger-card:specs', targetLedgerId: 'specs', x: 0, y: 0, w: 300, h: 200 },
      { id: 'ledger-card:data', targetLedgerId: 'data', x: 600, y: 0, w: 300, h: 200 }
    ]
  };
  assert.equal(resolveOverviewTargetLedger({ ledger, viewportCenter: { x: 250, y: 150 } }), 'specs');
  assert.equal(resolveOverviewTargetLedger({ ledger, viewportCenter: { x: 520, y: 100 } }), 'data');
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
