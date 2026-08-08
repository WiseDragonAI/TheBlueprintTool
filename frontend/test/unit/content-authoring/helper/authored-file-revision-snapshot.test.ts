/**
 * WHAT: Proves strict admission of complete authored-file snapshot identities.
 * WHY: Malformed or partial transport data must never seed editor diff state.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { authoredFileRevisionSnapshot } from '../../../../src/runtime/content-authoring/helper/authored-file-revision-snapshot.js';

const valid = {
  contentRevision: 'a'.repeat(64),
  commit: 'b'.repeat(40),
  olderCommit: 'c'.repeat(40),
  baselineAvailability: 'available' as const,
  baseMarkdown: '# Base\n',
  markdown: '# Current\n',
};

test('authored snapshot admits the complete identity and rejects partial data', () => {
  assert.deepEqual(authoredFileRevisionSnapshot(valid), valid);
  assert.equal(authoredFileRevisionSnapshot({ ...valid, baseMarkdown: undefined }), null);
  assert.equal(authoredFileRevisionSnapshot({ ...valid, contentRevision: 'short' }), null);
  assert.equal(authoredFileRevisionSnapshot({ ...valid, olderCommit: 'short' }), null);
  assert.equal(authoredFileRevisionSnapshot({ ...valid, baselineAvailability: 'no_prior_revision' }), null);
  assert.deepEqual(authoredFileRevisionSnapshot({
    ...valid,
    olderCommit: null,
    baselineAvailability: 'no_prior_revision',
    baseMarkdown: '',
  }), {
    ...valid,
    olderCommit: null,
    baselineAvailability: 'no_prior_revision',
    baseMarkdown: '',
  });
});
