import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('mobile thread composer defaults to a voice-first dock and expands text entry on demand', () => {
  const composer = source('frontend/src/runtime/voice/component/terminal-composer.ts');
  const controlDock = source('frontend/src/runtime/voice/component/control-dock.ts');
  const actionClick = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  const threadCss = source('frontend/assets/canvas/thread.css');
  const buttonCss = source('frontend/assets/canvas/terminal-button.css');

  assert.match(composer, /data-action="submit-thread-draft"/);
  assert.match(composer, /class="terminal-composer is-mobile-text-collapsed"/);
  assert.match(composer, /data-action="toggle-thread-text"/);
  assert.match(composer, /terminal-button__icon/);
  assert.match(composer, /viewBox="0 0 24 24"/);
  assert.match(controlDock, /data-action="voice-cancel"[\s\S]*terminal-button__key">Esc<[\s\S]*terminal-button__icon/);
  assert.match(controlDock, /data-action="voice-toggle"[\s\S]*terminal-button__key">X<[\s\S]*terminal-button__icon/);
  assert.match(buttonCss, /\.terminal-button__icon\s*\{[\s\S]*stroke:\s*currentColor/);
  assert.match(actionClick, /action === 'submit-thread-draft'/);
  assert.match(actionClick, /await submitThreadDraft\(\)/);
  assert.match(actionClick, /action === 'toggle-thread-text'/);
  assert.match(actionClick, /classList\.remove\('is-mobile-text-collapsed'\)/);
  assert.match(actionClick, /if \(draft && !draft\.value\)[\s\S]*classList\.add\('is-mobile-text-collapsed'\)/);
  assert.match(threadCss, /\.terminal-button--thread-send\s*\{\s*display:\s*none/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.thread-draft\s*\{[\s\S]*height:\s*75dvh;[\s\S]*min-height:\s*75dvh/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.voice-terminal-status,[\s\S]*\.terminal-command-hint\s*\{[\s\S]*display:\s*none/);
  assert.match(threadCss, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(threadCss, /\.terminal-command-actions \.terminal-button\s*\{[\s\S]*height:\s*66px/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.terminal-button__key\s*\{[\s\S]*display:\s*none/);
  assert.match(threadCss, /\.terminal-button--attach\s*\{[\s\S]*--terminal-button-color:\s*#69d7ff;[\s\S]*--terminal-button-gradient-shadow:\s*linear-gradient\(90deg, rgba\(105, 215, 255, 0\.5\), rgba\(67, 145, 214, 0\.32\)\)/);
  assert.doesNotMatch(threadCss.match(/\.terminal-button--attach\s*\{[^}]+\}/)?.[0] ?? '', /--thread-accent/);
  assert.match(threadCss, /\.terminal-button--thread-text\s*\{[\s\S]*--terminal-button-color:\s*#b58cff/);
  assert.match(threadCss, /\.terminal-button--record\s*\{[\s\S]*--terminal-button-color:\s*#ff6f91/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.terminal-button--stack\s*\{[\s\S]*grid-template-rows:\s*1fr 16px;[\s\S]*padding-block:\s*9px/);
  assert.match(threadCss, /\.terminal-composer\.is-mobile-text-collapsed \.thread-draft\s*\{[\s\S]*display:\s*none/);
  assert.match(threadCss, /\.terminal-composer:not\(\.is-mobile-text-collapsed\) \.terminal-button--thread-send\s*\{[\s\S]*display:\s*inline-flex/);
});
