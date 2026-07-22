import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCardZoneColors } from '../../../../src/runtime/card/effect/render-card-zone-colors.js';

function style(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    setProperty(name: string, value: string) { values.set(name, value); },
    removeProperty(name: string) { values.delete(name); },
    getPropertyValue(name: string) { return values.get(name) ?? ''; },
  };
}

test('project task accent survives the post-render zone-color reconciliation pass', () => {
  const previousDocument = globalThis.document;
  const previousGetComputedStyle = globalThis.getComputedStyle;
  const zone = { dataset: { zoneId: 'zone-a' }, style: style({ '--zone-color': '#eab308' }) } as unknown as HTMLElement;
  const card = {
    dataset: { cardId: 'master', cardZoneId: 'zone-a', cardZoneColor: '#a855f7', cardAccentSource: 'project' },
    style: style({ '--card-zone-color': '#a855f7' }),
  } as unknown as HTMLElement;
  try {
    (globalThis as unknown as { document: unknown }).document = {
      querySelectorAll(selector: string) {
        if (selector === '.regular-zone[data-zone-id]') return [zone];
        if (selector === '[data-card-id]') return [card];
        return [];
      },
    };
    globalThis.getComputedStyle = ((element: HTMLElement) => ({
      getPropertyValue: (name: string) => element.style.getPropertyValue(name),
    })) as typeof getComputedStyle;

    renderCardZoneColors();

    assert.equal(card.style.getPropertyValue('--card-zone-color'), '#a855f7');
    assert.equal(card.dataset.cardZoneColor, '#a855f7');
    assert.match(card.style.getPropertyValue('--card-readable-color'), /^#[0-9a-f]{6}$/);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
    globalThis.getComputedStyle = previousGetComputedStyle;
  }
});
