import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteCardMarkdownImage, removeMarkdownImage, writeCardDescriptionFile } from '@backend/business/ledger/helper/card-content-file.js';

test('removeMarkdownImage removes one standalone markdown image token by source', () => {
  const markdown = [
    'Before',
    '![First](.blueprinttool/ui/one.png)',
    '![Second](.blueprinttool/ui/two.png)',
    'After',
  ].join('\n');

  const result = removeMarkdownImage(markdown, '.blueprinttool/ui/two.png');

  assert.equal(result.removed, true);
  assert.match(result.markdown, /one\.png/);
  assert.doesNotMatch(result.markdown, /two\.png/);
  assert.match(result.markdown, /Before/);
  assert.match(result.markdown, /After/);
});

test('removeMarkdownImage matches workspace image sources across leading slash and URL encoding', () => {
  const markdown = [
    '![First](.blueprinttool/ui/one%20image.png)',
    '![Second](/.blueprinttool/ui/two.png)',
  ].join('\n');

  const first = removeMarkdownImage(markdown, '/.blueprinttool/ui/one image.png');
  const second = removeMarkdownImage(markdown, '.blueprinttool/ui/two.png');

  assert.equal(first.removed, true);
  assert.doesNotMatch(first.markdown, /one%20image\.png/);
  assert.match(first.markdown, /two\.png/);
  assert.equal(second.removed, true);
  assert.doesNotMatch(second.markdown, /two\.png/);
  assert.match(second.markdown, /one%20image\.png/);
});

test('deleteCardMarkdownImage updates the card content file and deletes the workspace image asset', () => {
  const blueprinttoolRoot = mkdtempSync(join(tmpdir(), 'corev2-card-image-'));
  const ledgerPath = join(blueprinttoolRoot, 'specs.json');
  const card = { id: 'card-1', comment: {} };
  const imageSource = '.blueprinttool/ui/card-image.png';
  const imageFile = join(blueprinttoolRoot, 'ui', 'card-image.png');
  mkdirSync(join(blueprinttoolRoot, 'ui'), { recursive: true });
  writeFileSync(imageFile, 'png');
  writeCardDescriptionFile({
    blueprinttoolRoot,
    ledgerPath,
    card,
    description: `Keep\n![Delete me](${imageSource})\n![Keep me](.blueprinttool/ui/other.png)`,
  });

  const result = deleteCardMarkdownImage({ blueprinttoolRoot, ledgerPath, card, imageSrc: `/${imageSource}` });
  const contentFile = join(blueprinttoolRoot, 'cards', 'specs', 'card-1.md');
  const markdown = readFileSync(contentFile, 'utf8');

  assert.deepEqual(result, { removedMarkdown: true, deletedFile: true });
  assert.equal(existsSync(imageFile), false);
  assert.doesNotMatch(markdown, /card-image\.png/);
  assert.match(markdown, /other\.png/);
});

test('deleteCardMarkdownImage does not delete the image asset when the markdown token is not found', () => {
  const blueprinttoolRoot = mkdtempSync(join(tmpdir(), 'corev2-card-image-'));
  const ledgerPath = join(blueprinttoolRoot, 'specs.json');
  const card = { id: 'card-1', comment: {} };
  const imageSource = '.blueprinttool/ui/card-image.png';
  const imageFile = join(blueprinttoolRoot, 'ui', 'card-image.png');
  mkdirSync(join(blueprinttoolRoot, 'ui'), { recursive: true });
  writeFileSync(imageFile, 'png');
  writeCardDescriptionFile({
    blueprinttoolRoot,
    ledgerPath,
    card,
    description: 'Keep\n![Other](.blueprinttool/ui/other.png)',
  });

  const result = deleteCardMarkdownImage({ blueprinttoolRoot, ledgerPath, card, imageSrc: imageSource });
  const contentFile = join(blueprinttoolRoot, 'cards', 'specs', 'card-1.md');
  const markdown = readFileSync(contentFile, 'utf8');

  assert.deepEqual(result, { removedMarkdown: false, deletedFile: false });
  assert.equal(existsSync(imageFile), true);
  assert.match(markdown, /other\.png/);
});
