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
  const previousProjectName = state.projectName;
  const previousCanvasMode = state.canvasMode;
  const titleAction = { textContent: '' };
  const kicker = { textContent: '' };

  (globalThis as unknown as { document: unknown }).document = {
    title: 'decision-os',
    querySelector: (selector: string) => {
      if (selector === '.topbar-title-action') return titleAction;
      if (selector === '.topbar .kicker') return kicker;
      return null;
    },
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
    { id: 'data', title: 'Data', ledgerFile: '.decision-os/data.json' },
    { id: 'game', title: 'Game Design', ledgerFile: '.decision-os/game.json' }
  ];
  state.activeTab = 'game';
  state.projectName = 'MOH';
  state.canvasMode = 'ledger';

  try {
    renderTabRegistry();
    assert.equal(globalThis.document.title, 'MOH | Game Design');
    assert.equal(titleAction.textContent, 'MOH | Game Design');
    assert.equal(kicker.textContent, 'Workspace');
    state.canvasMode = 'ledgers';
    renderTabRegistry();
    assert.equal(globalThis.document.title, 'MOH | Ledgers');
    assert.equal(titleAction.textContent, 'MOH | Ledgers');
  } finally {
    state.ledgerTabs = previousTabs;
    state.activeTab = previousActiveTab;
    state.projectName = previousProjectName;
    state.canvasMode = previousCanvasMode;
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    (globalThis as unknown as { window: unknown }).window = previousWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
  }
});
