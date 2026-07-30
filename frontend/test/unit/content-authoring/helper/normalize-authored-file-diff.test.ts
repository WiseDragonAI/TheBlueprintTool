/**
 * WHAT: Proves complete Pierre metadata becomes exact addition ranges and deletion anchors.
 * WHY: Internal and end-of-file removals must remain visible without entering EditorState.doc.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAuthoredFileDiff } from '../../../../src/runtime/content-authoring/helper/normalize-authored-file-diff.js';

test('normalizes additions and an end-of-file deletion from complete metadata', () => {
  const document = 'one\nchanged\n';
  const diff = normalizeAuthoredFileDiff({
    identity: 'revision-a',
    document,
    metadata: {
      isPartial: false,
      additionLines: ['one\n', 'changed\n'],
      deletionLines: ['one\n', 'old\n', 'removed\n'],
      hunks: [{
        additionStart: 1,
        deletionStart: 1,
        hunkContent: [
          { type: 'context', lines: 1 },
          { type: 'change', deletions: 1, deletionLineIndex: 1, additions: 1, additionLineIndex: 1 },
          { type: 'change', deletions: 1, deletionLineIndex: 2, additions: 0, additionLineIndex: 2 },
        ],
      }],
    },
  });
  assert.deepEqual(diff.hunks[0].additions, [{ from: 4, to: 12 }]);
  assert.equal(diff.hunks[0].deletionAnchor, 4);
  assert.equal(diff.hunks[0].deletedText, 'old\nremoved\n');
  assert.equal(diff.document, document);
});
