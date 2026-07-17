/**
 * WHAT: Guards the shared thread Markdown typography and marker accent contract.
 * WHY: Mobile loads thread.css without the desktop object stylesheet, so thread rules must be self-contained.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

test('thread markdown keeps inline code in the note font and accents list markers', () => {
  const css = readFileSync(new URL('frontend/assets/shared/thread.css', root), 'utf8');
  const sharedCardCss = readFileSync(new URL('frontend/assets/canvas/objects.css', root), 'utf8');

  assert.match(sharedCardCss, /\.ledger-card-body code\s*\{/);
  assert.match(css, /\.thread-note \.thread-note-message code\s*\{[^}]*color:\s*var\(--card-code-color\);[^}]*font-family:\s*inherit;/s);
  assert.match(css, /\.thread-note-message li::marker\s*\{[^}]*color:\s*var\(--card-code-color\);/s);
  assert.match(css, /\.thread-note-message \.ledger-card-code-block code\s*\{[^}]*font-family:\s*var\(--mono\);/s);
});
