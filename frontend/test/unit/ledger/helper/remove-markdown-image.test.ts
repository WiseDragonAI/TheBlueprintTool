import assert from 'node:assert/strict';
import test from 'node:test';
import { removeMarkdownImage, sameMarkdownImageSource } from '../../../../src/runtime/ledger/helper/remove-markdown-image.js';

test('removes the selected markdown image without changing adjacent narrative', () => {
  const result = removeMarkdownImage('Before\n\n![One](.decision-os/images/one.png)\n\nAfter', '/.decision-os/images/one.png');
  assert.equal(result.removed, true);
  assert.equal(result.markdown, 'Before\n\nAfter');
});

test('matches encoded workspace image sources while ignoring query and fragment suffixes', () => {
  assert.equal(sameMarkdownImageSource('.decision-os/images/My%20Image.png?revision=2', '/.decision-os/images/My Image.png#slide'), true);
});
