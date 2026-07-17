/**
 * WHAT: Integration test for spec f72a6d31: Thread header shows the active target title.
 * WHY: Each scoped master-ledger spec must have one executable suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFrontendSpec } from '../../../frontend/src/test/spec-assertions.js';

const root = new URL('../../../', import.meta.url);

test('Thread header shows the active target title.', async () => {
  await assertFrontendSpec('Thread header shows the active target title.', 'f72a6d31', 'thread');
  const index = readFileSync(new URL('frontend/index.html', root), 'utf8');
  const renderer = readFileSync(new URL('frontend/src/runtime/thread/effect/render-thread-panel.ts', root), 'utf8');
  const css = readFileSync(new URL('frontend/assets/shared/thread.css', root), 'utf8');
  assert.match(index, /<p class="thread-target" title="No thread selected">No thread selected<\/p>/);
  assert.doesNotMatch(index, /<p class="kicker">Thread<\/p>[\s\S]*<h2>Notes<\/h2>/);
  assert.match(renderer, /target\.title = title/);
  assert.match(css, /\.thread-target-title\s*{[\s\S]*text-overflow: ellipsis;[\s\S]*white-space: nowrap;/);
});
