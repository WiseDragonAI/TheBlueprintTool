import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { dispatchLedgerCliCommandController } from '../../src/index.js';
import { tempDir } from '../fixture/scenario.js';

const execFileAsync = promisify(execFile);

async function createWorkspace(): Promise<string> {
  const root = await tempDir('ledger-cli-assets-');
  await mkdir(join(root, '.blueprinttool/cards/ui-research'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/cards/removed'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/threads/ui-research'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/threads/removed'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/card-images/ui-research'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/thread-images/thread-a'), { recursive: true });
  await writeFile(join(root, '.blueprinttool/state.json'), JSON.stringify({
    tabs: [{ id: 'ui-research', title: 'UI Research', ledgerFile: '.blueprinttool/ui-research.json' }]
  }, null, 2), 'utf8');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/card-a.md'), [
    '![Keep card](/.blueprinttool/card-images/ui-research/keep.png)',
    '<img src=".blueprinttool/thread-images/thread-a/keep.webp">',
    'See .blueprinttool/card-images/ui-research/soft.png in old notes.',
  ].join('\n'), 'utf8');
  await writeFile(join(root, '.blueprinttool/threads/ui-research/thread-a.md'), 'Thread body.', 'utf8');
  await writeFile(join(root, '.blueprinttool/ui-research.json'), JSON.stringify({
    cards: [{
      id: 'card-a',
      comment: { contentFile: '.blueprinttool/cards/ui-research/card-a.md' },
      imageSizes: {
        '/.blueprinttool/card-images/ui-research/json-key.svg': { width: 10, height: 10 },
      },
    }],
    threadFiles: {
      'thread-card-a': '.blueprinttool/threads/ui-research/thread-a.md'
    }
  }, null, 2), 'utf8');
  await writeFile(join(root, '.blueprinttool/cards/removed/card-removed.md'), '![Removed](.blueprinttool/card-images/ui-research/removed-ledger.png)', 'utf8');
  await writeFile(join(root, '.blueprinttool/threads/removed/thread-removed.md'), '![Removed thread](.blueprinttool/card-images/ui-research/removed-thread.png)', 'utf8');
  await writeFile(join(root, '.blueprinttool/removed.json'), JSON.stringify({
    cards: [{ id: 'removed', comment: { contentFile: '.blueprinttool/cards/removed/card-removed.md' } }],
    threadFiles: { 'thread-removed': '.blueprinttool/threads/removed/thread-removed.md' },
  }, null, 2), 'utf8');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/keep.png'), 'png');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/json-key.svg'), 'svg');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/orphan.png'), 'orphan');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/pinned-final.png'), 'pinned');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/removed-ledger.png'), 'removed');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/removed-thread.png'), 'removed-thread');
  await writeFile(join(root, '.blueprinttool/thread-images/thread-a/keep.webp'), 'webp');
  await writeFile(join(root, '.blueprinttool/assets.keep'), '.blueprinttool/card-images/ui-research/*final.png\n');
  return root;
}

test('assets commands list referenced and orphan assets', async () => {
  const root = await createWorkspace();
  const referencedMessages: string[] = [];
  const orphanMessages: string[] = [];

  const referenced = await dispatchLedgerCliCommandController([
    'assets',
    'list-referenced',
    '--root',
    root,
  ], { emit: (message) => referencedMessages.push(message) });
  const orphan = await dispatchLedgerCliCommandController([
    'assets',
    'list-orphans',
    '--root',
    root,
  ], { emit: (message) => orphanMessages.push(message) });

  assert.equal(referenced.ok, true);
  assert.match(referencedMessages.join('\n'), /keep\.png/);
  assert.doesNotMatch(referencedMessages.join('\n'), /json-key\.svg/);
  assert.match(referencedMessages.join('\n'), /thread-a\/keep\.webp/);
  assert.doesNotMatch(referencedMessages.join('\n'), /orphan\.png/);
  assert.doesNotMatch(referencedMessages.join('\n'), /removed-ledger\.png/);
  assert.equal(orphan.ok, true);
  assert.match(orphanMessages.join('\n'), /orphan\.png/);
  assert.match(orphanMessages.join('\n'), /json-key\.svg/);
  assert.match(orphanMessages.join('\n'), /removed-ledger\.png/);
  assert.match(orphanMessages.join('\n'), /removed-thread\.png/);
  assert.doesNotMatch(orphanMessages.join('\n'), /pinned-final\.png/);
});

test('assets gc writes a manifest and moves orphan assets plus unused text files', async () => {
  const root = await createWorkspace();
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController([
    'assets',
    'gc',
    '--root',
    root,
    '--move-to',
    '.blueprinttool/.trash/assets-test',
    '--manifest',
    '.blueprinttool/.trash/assets-test-manifest.json',
  ], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /MOVED orphan assets: 4/);
  assert.match(messages.join('\n'), /MOVED unused text files: 3/);
  await assert.rejects(readFile(join(root, '.blueprinttool/card-images/ui-research/orphan.png'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/card-images/ui-research/json-key.svg'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/removed.json'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/cards/removed/card-removed.md'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/threads/removed/thread-removed.md'), 'utf8'));
  assert.equal(await readFile(join(root, '.blueprinttool/card-images/ui-research/keep.png'), 'utf8'), 'png');
  assert.equal(await readFile(join(root, '.blueprinttool/card-images/ui-research/pinned-final.png'), 'utf8'), 'pinned');
  assert.equal(await readFile(join(root, '.blueprinttool/.trash/assets-test/.blueprinttool/card-images/ui-research/orphan.png'), 'utf8'), 'orphan');
  assert.equal(await readFile(join(root, '.blueprinttool/.trash/assets-test/.blueprinttool/card-images/ui-research/json-key.svg'), 'utf8'), 'svg');
  assert.equal(await readFile(join(root, '.blueprinttool/.trash/assets-test/.blueprinttool/removed.json'), 'utf8').then((text) => JSON.parse(text).cards[0].id), 'removed');
  const manifest = JSON.parse(await readFile(join(root, '.blueprinttool/.trash/assets-test-manifest.json'), 'utf8'));
  assert.equal(manifest.summary.orphanAssets, 4);
  assert.equal(manifest.summary.pinnedAssets, 1);
  assert.equal(manifest.summary.staleJsonReferences, 1);
  assert.equal(manifest.summary.unusedTextFiles, 3);
});

test('assets prune-json removes stale imageSizes keys without using json as asset truth', async () => {
  const root = await createWorkspace();
  const dryRun = await dispatchLedgerCliCommandController([
    'assets',
    'prune-json',
    '--root',
    root,
    '--dry-run',
    '--json',
  ], { emit: () => undefined });

  assert.equal(dryRun.ok, true);
  const dryRunReport = JSON.parse(String(dryRun.value));
  assert.equal(dryRunReport.summary.prunedJsonReferences, 1);
  assert.match(await readFile(join(root, '.blueprinttool/ui-research.json'), 'utf8'), /json-key\.svg/);

  const write = await dispatchLedgerCliCommandController([
    'assets',
    'prune-json',
    '--root',
    root,
    '--write',
    '--json',
  ], { emit: () => undefined });

  assert.equal(write.ok, true);
  const prunedLedger = await readFile(join(root, '.blueprinttool/ui-research.json'), 'utf8');
  assert.doesNotMatch(prunedLedger, /json-key\.svg/);
  assert.doesNotMatch(prunedLedger, /imageSizes/);
});

test('assets stage-referenced stages domain text and referenced assets only', async () => {
  const root = await createWorkspace();
  await execFileAsync('git', ['-C', root, 'init']);
  await execFileAsync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  await execFileAsync('git', ['-C', root, 'config', 'user.name', 'Test User']);

  const result = await dispatchLedgerCliCommandController([
    'assets',
    'stage-referenced',
    '--root',
    root,
    '--domain',
    'ui-research',
  ], { emit: () => undefined });

  assert.equal(result.ok, true);
  const status = await execFileAsync('git', ['-C', root, 'diff', '--cached', '--name-only']);
  const staged = status.stdout.split('\n').filter(Boolean).sort();
  assert.ok(staged.includes('.blueprinttool/cards/ui-research/card-a.md'));
  assert.ok(staged.includes('.blueprinttool/threads/ui-research/thread-a.md'));
  assert.ok(staged.includes('.blueprinttool/ui-research.json'));
  assert.ok(staged.includes('.blueprinttool/card-images/ui-research/keep.png'));
  assert.ok(staged.includes('.blueprinttool/thread-images/thread-a/keep.webp'));
  assert.ok(staged.includes('.blueprinttool/card-images/ui-research/pinned-final.png'));
  assert.ok(!staged.includes('.blueprinttool/card-images/ui-research/orphan.png'));
  assert.ok(!staged.includes('.blueprinttool/card-images/ui-research/json-key.svg'));
});
