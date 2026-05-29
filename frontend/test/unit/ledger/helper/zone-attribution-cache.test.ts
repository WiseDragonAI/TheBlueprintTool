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

  applyZoneAttributionToCardElement(element, { zoneId: 'zone-a', zoneColor: '#38d9e8', readableColor: '#62cddd' });
  assert.equal(element.dataset.cardZoneId, 'zone-a');
  assert.equal(element.dataset.cardZoneColor, '#38d9e8');
  assert.equal(element.style.getPropertyValue('--card-zone-color'), '#38d9e8');
  assert.equal(element.style.getPropertyValue('--card-code-color'), '#62cddd');

  applyZoneAttributionToCardElement(element, null);
  assert.equal(element.dataset.cardZoneId, undefined);
  assert.equal(element.dataset.cardZoneColor, undefined);
  assert.equal(element.style.getPropertyValue('--card-zone-color'), '');
  assert.equal(element.style.getPropertyValue('--card-code-color'), '');
});
