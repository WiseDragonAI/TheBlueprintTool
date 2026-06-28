import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHardAssetReferences, extractSoftAssetReferences, normalizeAssetReference } from '../../../../src/index.js';

const workspaceRoot = '/workspace';
const sourceFile = '/workspace/.blueprinttool/cards/specs/card-a.md';

test('normalizeAssetReference normalizes workspace asset references', () => {
  assert.equal(
    normalizeAssetReference({ rawReference: '/.blueprinttool/card-images/a%20b.png?size=1#hash', workspaceRoot }),
    '.blueprinttool/card-images/a b.png',
  );
  assert.equal(
    normalizeAssetReference({ rawReference: '../card-images/one.png', sourceFile, workspaceRoot }),
    '.blueprinttool/cards/card-images/one.png',
  );
  assert.equal(
    normalizeAssetReference({ rawReference: 'https://example.com/image.png', sourceFile, workspaceRoot }),
    null,
  );
});

test('extractHardAssetReferences reads markdown, html, and json media references', () => {
  const markdown = [
    '![A](/.blueprinttool/card-images/a.png "Title")',
    '<img src=".blueprinttool/thread-images/t/b.webp">',
    '```',
    '![Ignored](.blueprinttool/card-images/code.png)',
    '```',
  ].join('\n');

  const markdownRefs = extractHardAssetReferences({ content: markdown, sourceFile, workspaceRoot });
  assert.deepEqual(markdownRefs.map((reference) => reference.path), [
    '.blueprinttool/card-images/a.png',
    '.blueprinttool/thread-images/t/b.webp',
  ]);

  const jsonRefs = extractHardAssetReferences({
    content: JSON.stringify({ imageSizes: { '/.blueprinttool/card-images/json.png': { width: 10 } }, src: '.blueprinttool/card-images/value.svg' }),
    sourceFile: '/workspace/.blueprinttool/specs.json',
    workspaceRoot,
  });

  assert.deepEqual(jsonRefs.map((reference) => reference.path).sort(), [
    '.blueprinttool/card-images/json.png',
    '.blueprinttool/card-images/value.svg',
  ]);
});

test('extractSoftAssetReferences records raw prose mentions separately', () => {
  const refs = extractSoftAssetReferences({
    content: 'See .blueprinttool/card-images/prose.png for the old run.',
    sourceFile,
    workspaceRoot,
  });

  assert.deepEqual(refs, [{ kind: 'raw-media-mention', path: '.blueprinttool/card-images/prose.png' }]);
});
