import test from 'node:test';
import assert from 'node:assert/strict';
import { extractHardAssetReferences, extractJsonAssetReferences, extractSoftAssetReferences, normalizeAssetReference } from '../../../../src/index.js';

const workspaceRoot = '/workspace';
const sourceFile = '/workspace/.decision-os/cards/specs/card-a.md';

test('normalizeAssetReference normalizes workspace asset references', () => {
  assert.equal(
    normalizeAssetReference({ rawReference: '/.decision-os/card-images/a%20b.png?size=1#hash', workspaceRoot }),
    '.decision-os/card-images/a b.png',
  );
  assert.equal(
    normalizeAssetReference({ rawReference: '../card-images/one.png', sourceFile, workspaceRoot }),
    '.decision-os/cards/card-images/one.png',
  );
  assert.equal(
    normalizeAssetReference({ rawReference: 'https://example.com/image.png', sourceFile, workspaceRoot }),
    null,
  );
});

test('extractHardAssetReferences reads markdown and html media references', () => {
  const markdown = [
    '![A](/.decision-os/card-images/a.png "Title")',
    '::html[Preview](.decision-os/cards/specs/assets/preview.html)',
    '<img src=".decision-os/thread-images/t/b.webp">',
    '<script type="module" src="./assets/app.mjs"></script>',
    '<link rel="stylesheet" href="./assets/app.css">',
    '```',
    '::html[Ignored](.decision-os/cards/specs/assets/code.html)',
    '![Ignored](.decision-os/card-images/code.png)',
    '```',
  ].join('\n');

  const markdownRefs = extractHardAssetReferences({ content: markdown, sourceFile, workspaceRoot });
  assert.deepEqual(markdownRefs.map((reference) => reference.path), [
    '.decision-os/card-images/a.png',
    '.decision-os/cards/specs/assets/preview.html',
    '.decision-os/thread-images/t/b.webp',
    '.decision-os/cards/specs/assets/app.mjs',
    '.decision-os/cards/specs/assets/app.css',
  ]);

  const jsonRefs = extractHardAssetReferences({
    content: JSON.stringify({ imageSizes: { '/.decision-os/card-images/json.png': { width: 10 } }, src: '.decision-os/card-images/value.svg' }),
    sourceFile: '/workspace/.decision-os/specs.json',
    workspaceRoot,
  });

  assert.deepEqual(jsonRefs, []);
});

test('extractJsonAssetReferences reports json media references separately', () => {
  const jsonRefs = extractJsonAssetReferences({
    content: JSON.stringify({ imageSizes: { '/.decision-os/card-images/json.png': { width: 10 } }, src: '.decision-os/card-images/value.svg' }),
    sourceFile: '/workspace/.decision-os/specs.json',
    workspaceRoot,
  });

  assert.deepEqual(jsonRefs.map((reference) => reference.path).sort(), [
    '.decision-os/card-images/json.png',
    '.decision-os/card-images/value.svg',
  ]);
});

test('extractSoftAssetReferences records raw prose mentions separately', () => {
  const refs = extractSoftAssetReferences({
    content: 'See .decision-os/card-images/prose.png and .decision-os/cards/specs/assets/prose.html for the old run.',
    sourceFile,
    workspaceRoot,
  });

  assert.deepEqual(refs, [
    { kind: 'raw-media-mention', path: '.decision-os/card-images/prose.png' },
    { kind: 'raw-media-mention', path: '.decision-os/cards/specs/assets/prose.html' }
  ]);
});
