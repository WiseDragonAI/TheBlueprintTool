import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHardAssetReferences, extractJsonAssetReferences, extractSoftAssetReferences, normalizeAssetReference } from '../../../../src/index.js';

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

test('extractHardAssetReferences reads markdown and html media references', () => {
  const markdown = [
    '![A](/.blueprinttool/card-images/a.png "Title")',
    '::html[Preview](.blueprinttool/cards/specs/assets/preview.html)',
    '<img src=".blueprinttool/thread-images/t/b.webp">',
    '<script type="module" src="./assets/app.mjs"></script>',
    '<link rel="stylesheet" href="./assets/app.css">',
    '```',
    '::html[Ignored](.blueprinttool/cards/specs/assets/code.html)',
    '![Ignored](.blueprinttool/card-images/code.png)',
    '```',
  ].join('\n');

  const markdownRefs = extractHardAssetReferences({ content: markdown, sourceFile, workspaceRoot });
  assert.deepEqual(markdownRefs.map((reference) => reference.path), [
    '.blueprinttool/card-images/a.png',
    '.blueprinttool/cards/specs/assets/preview.html',
    '.blueprinttool/thread-images/t/b.webp',
    '.blueprinttool/cards/specs/assets/app.mjs',
    '.blueprinttool/cards/specs/assets/app.css',
  ]);

  const jsonRefs = extractHardAssetReferences({
    content: JSON.stringify({ imageSizes: { '/.blueprinttool/card-images/json.png': { width: 10 } }, src: '.blueprinttool/card-images/value.svg' }),
    sourceFile: '/workspace/.blueprinttool/specs.json',
    workspaceRoot,
  });

  assert.deepEqual(jsonRefs, []);
});

test('extractJsonAssetReferences reports json media references separately', () => {
  const jsonRefs = extractJsonAssetReferences({
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
    content: 'See .blueprinttool/card-images/prose.png and .blueprinttool/cards/specs/assets/prose.html for the old run.',
    sourceFile,
    workspaceRoot,
  });

  assert.deepEqual(refs, [
    { kind: 'raw-media-mention', path: '.blueprinttool/card-images/prose.png' },
    { kind: 'raw-media-mention', path: '.blueprinttool/cards/specs/assets/prose.html' }
  ]);
});
