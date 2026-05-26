/**
 * WHAT: Unit tests for runtime card-edit keyboard target detection.
 * WHY: Global shortcuts must stay disabled while title or body editors own key events.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCardEditingKeyboardTarget } from '../../../../../src/runtime/input/helper/is-card-editing-keyboard-target.js';

function targetWithClosest(matches: Record<string, boolean>): HTMLElement {
  return {
    closest(selector: string) {
      return matches[selector] ? this : null;
    }
  } as unknown as HTMLElement;
}

test('is-card-editing-keyboard-target matches card editing and contenteditable targets', () => {
  assert.equal(isCardEditingKeyboardTarget(targetWithClosest({ '.card .editing,.card [contenteditable],.ledger-card-description-editor': true })), true);
  assert.equal(isCardEditingKeyboardTarget(targetWithClosest({ '.card .editing,.card [contenteditable],.ledger-card-description-editor': false })), false);
  assert.equal(isCardEditingKeyboardTarget(null), false);
});
