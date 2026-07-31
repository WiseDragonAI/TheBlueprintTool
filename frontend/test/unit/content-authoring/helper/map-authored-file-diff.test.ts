/**
 * WHAT: Proves untouched hunks map while touched hunks withdraw in the editing transaction.
 * WHY: Stale Git presentation must not survive an edit to the change it describes.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mapAuthoredFileDiff } from '../../../../src/runtime/content-authoring/helper/map-authored-file-diff.js';

const diff = {
  identity: 'revision-a',
  document: 'before\nadded\n',
  hunks: [{
    id: 'hunk-a',
    from: 7,
    to: 13,
    additions: [{ from: 7, to: 13 }],
    deletions: [{ anchor: 7, order: 0, text: 'removed' }],
  }],
};

test('maps an untouched hunk through an edit before it', () => {
  const mapped = mapAuthoredFileDiff(diff, {
    touchesRange: () => false,
    mapPos: (position) => position + 2,
  }, 'xxbefore\nadded\n');
  assert.equal(mapped.hunks[0].from, 9);
  assert.equal(mapped.hunks[0].deletions[0].anchor, 9);
});

test('withdraws a hunk touched by the same transaction', () => {
  const mapped = mapAuthoredFileDiff(diff, {
    touchesRange: (from, to) => from <= 8 && (to ?? from) >= 8,
    mapPos: (position) => position,
  }, 'before\nedited\n');
  assert.deepEqual(mapped.hunks, []);
});
