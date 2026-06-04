import test from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../src/runtime/state.js';
import { renderTabRegistry } from '../../src/runtime/navigation/effect/render-tab-registry.js';

test('browser title follows the selected ledger title', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  const previousTabs = state.ledgerTabs;
  const previousActiveTab = state.activeTab;

  (globalThis as unknown as { document: unknown }).document = {
    title: 'Core Canvas',
    querySelector: () => null,
    querySelectorAll: () => []
  };
  (globalThis as unknown as { window: unknown }).window = { __coreTelemetry: [], dispatchEvent: () => undefined };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    detail: unknown;
    constructor(_name: string, init?: { detail?: unknown }) {
      this.detail = init?.detail;
    }
  };

  state.ledgerTabs = [
    { id: 'data', title: 'Ardaria Data Model', ledgerFile: '.blueprinttool/data.json' },
    { id: 'game', title: 'Ardaria Game Design', ledgerFile: '.blueprinttool/game.json' }
  ];
  state.activeTab = 'game';

  try {
    renderTabRegistry();
    assert.equal(globalThis.document.title, 'Ardaria Game Design');
  } finally {
    state.ledgerTabs = previousTabs;
    state.activeTab = previousActiveTab;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});
