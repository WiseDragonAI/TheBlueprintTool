/**
 * WHAT: Runtime tests for multi-tab card geometry and wheel ownership.
 * WHY: Card geometry is fixed by ledger height while only scrollable fields should steal wheel from canvas zoom.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldCaptureWheelTarget } from '../../src/runtime/gesture/helper/should-capture-wheel-target.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('multi-tab cards use fixed ledger height while wheel capture is scroll-gated', () => {
  const specs = source('documentation/specs.json');
  const css = source('frontend/assets/canvas/objects.css');
  const patchCard = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const helper = source('frontend/src/runtime/gesture/helper/should-capture-wheel-target.ts');
  assert.match(specs, /f0c2d8a9/);
  assert.match(css, /\.ledger-card-tab-frame\[data-active-card-tab="description"\]\s*{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.ledger-card-tab-frame\[data-active-card-tab="description"\] \.ledger-card-description-panel\.is-active\s*{[^}]*position:\s*relative;[^}]*inset:\s*auto;/s);
  assert.match(patchCard, /const fixedHeight = Math\.max\(132, Number\.isFinite\(cardHeight\) \? cardHeight : 132\);/);
  assert.match(patchCard, /element\.style\.height = `\$\{fixedHeight\}px`;/);
  assert.match(patchCard, /element\.style\.removeProperty\('min-height'\);/);
  assert.doesNotMatch(patchCard, /Number\.isFinite\(cardHeight\) && hasFieldTabs/);
  assert.match(wheel, /shouldCaptureWheelTarget\(event\)/);
  assert.match(helper, /scrollHeight > node\.clientHeight/);
  assert.match(helper, /ledger-card-fields-panel\.is-active/);
});

test('wheel capture helper returns false for non-scrollable tab frames', () => {
  const frame = fakeElement({
    scrollHeight: 120,
    clientHeight: 120,
    scrollWidth: 200,
    clientWidth: 200
  });
  const target = fakeElement({ wheelCapture: frame });
  const event = { target, deltaX: 0, deltaY: 80 } as unknown as WheelEvent;
  assert.equal(shouldCaptureWheelTarget(event), false);
});

test('wheel capture helper returns true for scrollable active fields', () => {
  const fields = fakeElement({
    matchesFields: true,
    scrollHeight: 400,
    clientHeight: 120,
    scrollTop: 10
  });
  const frame = fakeElement({ fields });
  const target = fakeElement({ wheelCapture: frame });
  const event = { target, deltaX: 0, deltaY: 80 } as unknown as WheelEvent;
  assert.equal(shouldCaptureWheelTarget(event), true);
});

function fakeElement(input: Record<string, unknown>): HTMLElement {
  return {
    scrollHeight: Number(input.scrollHeight ?? 0),
    clientHeight: Number(input.clientHeight ?? 0),
    scrollWidth: Number(input.scrollWidth ?? 0),
    clientWidth: Number(input.clientWidth ?? 0),
    scrollTop: Number(input.scrollTop ?? 0),
    scrollLeft: Number(input.scrollLeft ?? 0),
    closest(selector: string) {
      if (selector.includes('button') && input.control) return this;
      if (selector.includes('[data-wheel-capture]')) return input.wheelCapture ?? null;
      return null;
    },
    matches(selector: string) {
      return Boolean(input.matchesFields && selector === '.ledger-card-fields-panel.is-active');
    },
    querySelector(selector: string) {
      if (selector === '.ledger-card-fields-panel.is-active') return input.fields ?? null;
      return null;
    }
  } as unknown as HTMLElement;
}
