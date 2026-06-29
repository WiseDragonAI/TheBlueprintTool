import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteCardMarkdownImage, removeMarkdownImage, writeCardDescriptionFile } from '@backend/business/ledger/helper/card-content-file.js';

test('removeMarkdownImage removes one standalone markdown image token by source', () => {
  const markdown = [
    'Before',
    '![First](.decision-os/ui/one.png)',
    '![Second](.decision-os/ui/two.png)',
    'After',
  ].join('\n');

  const result = removeMarkdownImage(markdown, '.decision-os/ui/two.png');

  assert.equal(result.removed, true);
  assert.match(result.markdown, /one\.png/);
  assert.doesNotMatch(result.markdown, /two\.png/);
  assert.match(result.markdown, /Before/);
  assert.match(result.markdown, /After/);
});

test('removeMarkdownImage matches workspace image sources across leading slash and URL encoding', () => {
  const markdown = [
    '![First](.decision-os/ui/one%20image.png)',
    '![Second](/.decision-os/ui/two.png)',
  ].join('\n');

  const first = removeMarkdownImage(markdown, '/.decision-os/ui/one image.png');
  const second = removeMarkdownImage(markdown, '.decision-os/ui/two.png');

  assert.equal(first.removed, true);
  assert.doesNotMatch(first.markdown, /one%20image\.png/);
  assert.match(first.markdown, /two\.png/);
  assert.equal(second.removed, true);
  assert.doesNotMatch(second.markdown, /two\.png/);
  assert.match(second.markdown, /one%20image\.png/);
});

test('deleteCardMarkdownImage updates the card content file and deletes the workspace image asset', () => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-card-image-'));
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const card = { id: 'card-1', comment: {} };
  const imageSource = '.decision-os/ui/card-image.png';
  const imageFile = join(decisionOsRoot, 'ui', 'card-image.png');
  mkdirSync(join(decisionOsRoot, 'ui'), { recursive: true });
  writeFileSync(imageFile, 'png');
  writeCardDescriptionFile({
    decisionOsRoot,
    ledgerPath,
    card,
    description: `Keep\n![Delete me](${imageSource})\n![Keep me](.decision-os/ui/other.png)`,
  });

  const result = deleteCardMarkdownImage({ decisionOsRoot, ledgerPath, card, imageSrc: `/${imageSource}` });
  const contentFile = join(decisionOsRoot, 'cards', 'specs', 'card-1.md');
  const markdown = readFileSync(contentFile, 'utf8');

  assert.deepEqual(result, { removedMarkdown: true, deletedFile: true });
  assert.equal(existsSync(imageFile), false);
  assert.doesNotMatch(markdown, /card-image\.png/);
  assert.match(markdown, /other\.png/);
});

test('deleteCardMarkdownImage does not delete the image asset when the markdown token is not found', () => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-card-image-'));
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const card = { id: 'card-1', comment: {} };
  const imageSource = '.decision-os/ui/card-image.png';
  const imageFile = join(decisionOsRoot, 'ui', 'card-image.png');
  mkdirSync(join(decisionOsRoot, 'ui'), { recursive: true });
  writeFileSync(imageFile, 'png');
  writeCardDescriptionFile({
    decisionOsRoot,
    ledgerPath,
    card,
    description: 'Keep\n![Other](.decision-os/ui/other.png)',
  });

  const result = deleteCardMarkdownImage({ decisionOsRoot, ledgerPath, card, imageSrc: imageSource });
  const contentFile = join(decisionOsRoot, 'cards', 'specs', 'card-1.md');
  const markdown = readFileSync(contentFile, 'utf8');

  assert.deepEqual(result, { removedMarkdown: false, deletedFile: false });
  assert.equal(existsSync(imageFile), true);
  assert.match(markdown, /other\.png/);
});
