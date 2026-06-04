import test from 'node:test';
import assert from 'node:assert/strict';
import { isGestureControlTarget } from '../../../../../src/runtime/gesture/helper/is-gesture-control-target.js';

function targetWithClosest(matches: Record<string, boolean>): HTMLElement {
  return {
    closest(selector: string) {
      return matches[selector] ? this : null;
    }
  } as unknown as HTMLElement;
}

test('is-gesture-control-target treats rendered links as controls', () => {
  assert.equal(isGestureControlTarget(targetWithClosest({ 'a[href],button,input,textarea,select,[data-action],[data-wheel-capture],[contenteditable="true"]': true })), true);
  assert.equal(isGestureControlTarget(targetWithClosest({ 'a[href],button,input,textarea,select,[data-action],[data-wheel-capture],[contenteditable="true"]': false })), false);
  assert.equal(isGestureControlTarget(null), false);
});
