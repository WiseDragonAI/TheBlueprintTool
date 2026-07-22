import test from 'node:test';
import assert from 'node:assert/strict';
import { reportCodexBackgroundFailure } from '@backend/business/codex/helper/codex-runtime-run-store.js';

test('Codex background failure reporting cannot throw through a failed diagnostic transport', () => {
  const original = console.error;
  console.error = () => { throw new Error('diagnostic transport unavailable'); };
  try {
    assert.doesNotThrow(() => reportCodexBackgroundFailure({}, 'without-callback', new Error('work failed')));
    assert.doesNotThrow(() => reportCodexBackgroundFailure({
      onCodexBackgroundError: () => { throw new Error('incident callback unavailable'); },
    }, 'failed-callback', new Error('work failed')));
  } finally {
    console.error = original;
  }
});
