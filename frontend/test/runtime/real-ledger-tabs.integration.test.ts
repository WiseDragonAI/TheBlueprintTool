import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('default ledgers are real decision-os ledgers and are not rendered as header tabs', () => {
  const html = source('frontend/index.html');
  assert.doesNotMatch(html, /data-tab="surface"/);
  assert.doesNotMatch(html, /data-tab="runtime"/);
  assert.doesNotMatch(html, /data-tab="specs"/);
  assert.doesNotMatch(html, /data-tab="data"/);
  assert.match(html, /data-action="open-ledgers-canvas"/);
  assert.match(html, /data-action="open-ledgers-canvas"[^>]*title="Ledgers"[\s\S]*<span>Ledgers<\/span>/);
  assert.doesNotMatch(html, /tab-ledgers/);
  assert.doesNotMatch(html, /tab-current/);
  assert.doesNotMatch(html, /tab-create/);

  const state = source('frontend/src/runtime/state.ts');
  assert.match(state, /ledgers:/);
  assert.match(state, /activeTab: 'specs'/);
  assert.doesNotMatch(state, /activeTab: 'surface'/);

  const renderTabs = source('frontend/src/runtime/navigation/effect/render-tab-registry.ts');
  assert.doesNotMatch(renderTabs, /id: 'surface'/);
  assert.doesNotMatch(renderTabs, /id: 'runtime'/);
  assert.match(renderTabs, /activeLedgers/);
  assert.doesNotMatch(renderTabs, /tab-ledgers/);
  assert.doesNotMatch(renderTabs, /tab-current/);
  assert.doesNotMatch(renderTabs, /tab-create/);

  const routeTab = source('frontend/src/runtime/navigation/helper/route-tab.ts');
  assert.doesNotMatch(routeTab, /'surface', 'specs', 'data', 'runtime'/);
  assert.match(routeTab, /activeLedgers/);
});
