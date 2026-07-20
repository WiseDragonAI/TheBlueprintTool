import test from 'node:test';
import assert from 'node:assert/strict';
import { createPierreDiffContainer } from '../../../../src/runtime/ledger/component/render-ledger-card-git-diff.js';

test('creates the Pierre web-component host that installs the renderer core styles', () => {
  let createdTag = '';
  const expected = { nodeName: 'DIFFS-CONTAINER' };
  const documentRef = {
    createElement(tag: string) {
      createdTag = tag;
      return expected;
    },
  };

  const actual = createPierreDiffContainer(
    { DIFFS_TAG_NAME: 'diffs-container' } as never,
    documentRef as never,
  );

  assert.equal(createdTag, 'diffs-container');
  assert.equal(actual, expected);
});
