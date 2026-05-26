/**
 * WHAT: Runtime tests for thread terminal accent inheritance.
 * WHY: The side terminal must preserve card and zone color identity, including the voice widget graph.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorToRgbChannels } from '../../src/runtime/thread/helper/color-to-rgb-channels.js';
import { resolveThreadTargetAccent } from '../../src/runtime/thread/helper/resolve-thread-target-accent.js';

const root = new URL('../../../', import.meta.url);

test('thread accent resolves card zone color before selected border color', () => {
  const previousGetComputedStyle = globalThis.getComputedStyle;
  try {
    globalThis.getComputedStyle = ((() => ({
      getPropertyValue: (property: string) => property === '--card-zone-color' ? '#3344ff' : '',
      borderTopColor: 'rgb(255, 255, 255)'
    })) as unknown) as typeof getComputedStyle;
    const target = { dataset: { cardZoneColor: '#1122ee' } } as unknown as HTMLElement;
    assert.equal(resolveThreadTargetAccent(target), '#1122ee');
  } finally {
    globalThis.getComputedStyle = previousGetComputedStyle;
  }
});

test('thread accent colors feed the voice widget graph and frame', () => {
  assert.equal(colorToRgbChannels('#123abc'), '18, 58, 188');
  const shellCss = readFileSync(new URL('frontend/assets/canvas/shell.css', root), 'utf8');
  const threadCss = readFileSync(new URL('frontend/assets/canvas/thread.css', root), 'utf8');
  const controlsCss = readFileSync(new URL('frontend/assets/canvas/terminal-chat-controls.css', root), 'utf8');
  const accentEffect = readFileSync(new URL('frontend/src/runtime/thread/effect/apply-thread-accent.ts', root), 'utf8');
  assert.match(shellCss, /-34px 0 68px rgba\(0, 0, 0, 0\.86\)/);
  assert.match(threadCss, /voice-panel[\s\S]*--thread-accent/);
  assert.match(threadCss, /thread-feed[\s\S]*padding-bottom: 36px/);
  assert.match(threadCss, /thread-note\.is-operator[\s\S]*var\(--thread-accent\)/);
  assert.match(threadCss, /thread-note\.is-agent[\s\S]*background: transparent/);
  assert.match(threadCss, /thread-note-delete\.terminal-button[\s\S]*width: 24px/);
  assert.match(threadCss, /thread-draft[\s\S]*border: 0/);
  assert.match(threadCss, /thread-draft[\s\S]*background: #111315/);
  assert.doesNotMatch(threadCss, /thread-draft[\s\S]*border: 1px solid color-mix\(in srgb, var\(--thread-accent\)/);
  assert.match(controlsCss, /meter-fill[\s\S]*--thread-accent/);
  assert.match(controlsCss, /wave-panel[\s\S]*--thread-accent/);
  assert.match(accentEffect, /--voice-graph-secondary/);
  assert.match(accentEffect, /inspector\?\.style\.setProperty\('--thread-accent'/);
});
