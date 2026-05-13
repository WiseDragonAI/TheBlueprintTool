import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('default tabs come only from real Blueprinttool ledgers', () => {
  const html = source('frontend/index.html');
  assert.doesNotMatch(html, /data-tab="surface"/);
  assert.doesNotMatch(html, /data-tab="runtime"/);
  assert.match(html, /data-tab="specs"/);
  assert.match(html, /data-tab="data"/);

  const state = source('frontend/src/runtime/state.ts');
  assert.match(state, /activeTab: 'specs'/);
  assert.doesNotMatch(state, /activeTab: 'surface'/);

  const renderTabs = source('frontend/src/runtime/navigation/effect/render-tab-registry.ts');
  assert.doesNotMatch(renderTabs, /id: 'surface'/);
  assert.doesNotMatch(renderTabs, /id: 'runtime'/);
  assert.match(renderTabs, /state\.ledgerTabs/);

  const routeTab = source('frontend/src/runtime/navigation/helper/route-tab.ts');
  assert.doesNotMatch(routeTab, /'surface', 'specs', 'data', 'runtime'/);
  assert.match(routeTab, /state\.ledgerTabs/);
});
