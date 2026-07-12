import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('mobile thread composer is compact and exposes a send action', () => {
  const composer = source('frontend/src/runtime/voice/component/terminal-composer.ts');
  const actionClick = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  const threadCss = source('frontend/assets/canvas/thread.css');

  assert.match(composer, /data-action="submit-thread-draft"/);
  assert.match(actionClick, /action === 'submit-thread-draft'/);
  assert.match(actionClick, /await submitThreadDraft\(\)/);
  assert.match(threadCss, /\.terminal-button--thread-send\s*\{\s*display:\s*none/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.thread-draft\s*\{[\s\S]*min-height:\s*72px/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.terminal-command-hint\s*\{[\s\S]*display:\s*none/);
  assert.match(threadCss, /@media \(max-width: 760px\)[\s\S]*\.terminal-button--thread-send\s*\{[\s\S]*display:\s*inline-flex/);
});
