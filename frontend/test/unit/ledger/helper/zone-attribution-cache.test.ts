import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZoneAttributionCache, applyZoneAttributionToCardElement } from '../../../../src/runtime/ledger/helper/zone-attribution-cache.js';

test('zone attribution cache resolves largest regular-zone overlap and ignores groups', () => {
  const cache = buildZoneAttributionCache({
    annotations: [
      { id: 'small', x: 0, y: 0, width: 140, height: 90, color: '#38d9e8' },
      { id: 'owner', x: 100, y: 60, width: 260, height: 180, color: '#eab308' },
      { id: 'group', variant: 'group', x: 100, y: 60, width: 260, height: 180, color: '#ff0000' }
    ],
    cards: [
      { id: 'card-a', x: 120, y: 80, w: 120, h: 80 },
      { id: 'card-b', x: 900, y: 900, w: 120, h: 80 }
    ]
  }, 'specs');

  assert.equal(cache.cardById['card-a']?.zoneId, 'owner');
  assert.equal(cache.cardById['card-a']?.zoneColor, '#eab308');
  assert.equal(cache.cardById['card-b'], null);
  assert.deepEqual(cache.cardIdsByZoneId.owner, ['card-a']);
  assert.equal(cache.zoneById.group, undefined);
});

test('cached zone attribution applies and clears card DOM color state', () => {
  const element = {
    dataset: {},
    style: new Map<string, string>(),
  } as unknown as HTMLElement;
  (element as any).style = {
    values: new Map<string, string>(),
    setProperty(name: string, value: string) {
      this.values.set(name, value);
    },
    removeProperty(name: string) {
      this.values.delete(name);
    },
    getPropertyValue(name: string) {
      return this.values.get(name) ?? '';
    }
  };

  applyZoneAttributionToCardElement(element, { zoneId: 'zone-a', zoneColor: '#38d9e8', readableColor: '#62cddd', colorSource: 'project' });
  assert.equal(element.dataset.cardZoneId, 'zone-a');
  assert.equal(element.dataset.cardZoneColor, '#38d9e8');
  assert.equal(element.style.getPropertyValue('--card-zone-color'), '#38d9e8');
  assert.equal(element.style.getPropertyValue('--card-code-color'), '#62cddd');
  assert.equal(element.dataset.cardAccentSource, 'project');

  applyZoneAttributionToCardElement(element, null);
  assert.equal(element.dataset.cardZoneId, undefined);
  assert.equal(element.dataset.cardZoneColor, undefined);
  assert.equal(element.dataset.cardAccentSource, undefined);
  assert.equal(element.style.getPropertyValue('--card-zone-color'), '');
  assert.equal(element.style.getPropertyValue('--card-code-color'), '');
});

test('project color overrides zone color for masters and canonical linked subtasks', () => {
  const cache = buildZoneAttributionCache({
    annotations: [{ id: 'zone-a', x: 0, y: 0, width: 800, height: 600, color: '#eab308' }],
    cards: [
      { id: 'master', labels: ['master-task'], x: 20, y: 20, w: 200, h: 120 },
      { id: 'child', x: 240, y: 20, w: 200, h: 120 },
      { id: 'ordinary', x: 460, y: 20, w: 200, h: 120 },
    ],
    relationships: [{ id: 'rel-child', from: 'master', to: 'child', label: 'subtask', position: 0 }],
  }, 'tasks', '#a855f7');

  assert.equal(cache.projectColor, '#a855f7');
  assert.equal(cache.cardById.master?.zoneColor, '#a855f7');
  assert.equal(cache.cardById.master?.colorSource, 'project');
  assert.equal(cache.cardById.child?.zoneColor, '#a855f7');
  assert.equal(cache.cardById.child?.colorSource, 'project');
  assert.equal(cache.cardById.ordinary?.zoneColor, '#eab308');
  assert.equal(cache.cardById.ordinary?.colorSource, 'zone');
  assert.deepEqual(cache.cardIdsByZoneId['zone-a'], ['ordinary']);
});
