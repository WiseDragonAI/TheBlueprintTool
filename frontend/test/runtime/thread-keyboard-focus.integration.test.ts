/**
 * WHAT: Guards the thread keyboard shortcut against focusing the draft textarea.
 * WHY: Focusing the draft while opening a thread raises the mobile keyboard and shifts the canvas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

test('the A shortcut opens the thread without focusing its draft', () => {
  const keyboard = readFileSync(new URL('frontend/src/runtime/input/controller/handle-keyboard.ts', root), 'utf8');

  assert.match(keyboard, /if \(!state\.threadPanelOpen\) openThreadPanel\(\);/);
  assert.doesNotMatch(keyboard, /focusThreadDraft/);
});
