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
  await mkdir(join(root, '.blueprinttool/cards/ui-research/assets'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/cards/removed'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/threads/ui-research'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/threads/removed'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/card-images/ui-research'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/thread-images/thread-a'), { recursive: true });
  await mkdir(join(root, '.blueprinttool/.scripts'), { recursive: true });
  await writeFile(join(root, '.blueprinttool/state.json'), JSON.stringify({
    tabs: [{ id: 'ui-research', title: 'UI Research', ledgerFile: '.blueprinttool/ui-research.json' }]
  }, null, 2), 'utf8');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/card-a.md'), [
    '![Keep card](/.blueprinttool/card-images/ui-research/keep.png)',
    '::html[Preview](.blueprinttool/cards/ui-research/assets/preview.html)',
    '<img src=".blueprinttool/thread-images/thread-a/keep.webp">',
    'See .blueprinttool/card-images/ui-research/soft.png in old notes.',
  ].join('\n'), 'utf8');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/assets/preview.html'), [
    '<!doctype html>',
    '<link rel="stylesheet" href="./preview.css">',
    '<script type="module" src="./preview.mjs"></script>',
    '<img src="./preview.png">',
  ].join('\n'), 'utf8');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/assets/preview.css'), 'body{}');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/assets/preview.mjs'), 'export default 1;');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/assets/preview.png'), 'preview-png');
  await writeFile(join(root, '.blueprinttool/cards/ui-research/assets/orphan.html'), '<!doctype html><title>Orphan</title>');
  await writeFile(join(root, '.blueprinttool/.scripts/tool.html'), '<!doctype html><title>Tool</title>');
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
  assert.match(referencedMessages.join('\n'), /preview\.html/);
  assert.match(referencedMessages.join('\n'), /preview\.mjs/);
  assert.match(referencedMessages.join('\n'), /preview\.css/);
  assert.match(referencedMessages.join('\n'), /preview\.png/);
  assert.doesNotMatch(referencedMessages.join('\n'), /json-key\.svg/);
  assert.match(referencedMessages.join('\n'), /thread-a\/keep\.webp/);
  assert.doesNotMatch(referencedMessages.join('\n'), /orphan\.png/);
  assert.doesNotMatch(referencedMessages.join('\n'), /orphan\.html/);
  assert.doesNotMatch(referencedMessages.join('\n'), /tool\.html/);
  assert.doesNotMatch(referencedMessages.join('\n'), /removed-ledger\.png/);
  assert.equal(orphan.ok, true);
  assert.match(orphanMessages.join('\n'), /orphan\.html/);
  assert.match(orphanMessages.join('\n'), /orphan\.png/);
  assert.match(orphanMessages.join('\n'), /json-key\.svg/);
  assert.doesNotMatch(orphanMessages.join('\n'), /tool\.html/);
  assert.match(orphanMessages.join('\n'), /removed-ledger\.png/);
  assert.match(orphanMessages.join('\n'), /removed-thread\.png/);
  assert.doesNotMatch(orphanMessages.join('\n'), /pinned-final\.png/);
});

test('assets gc writes a deletion plan without changing the workspace', async () => {
  const root = await createWorkspace();
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController([
    'assets',
    'gc',
    '--root',
    root,
    '--write-plan',
    '.blueprinttool/assets-gc-plan.json',
  ], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /Wrote asset GC plan/);
  assert.match(messages.join('\n'), /Files to delete: 8/);
  assert.equal(await readFile(join(root, '.blueprinttool/card-images/ui-research/orphan.png'), 'utf8'), 'orphan');
  assert.equal(await readFile(join(root, '.blueprinttool/cards/ui-research/assets/orphan.html'), 'utf8'), '<!doctype html><title>Orphan</title>');
  assert.equal(await readFile(join(root, '.blueprinttool/.scripts/tool.html'), 'utf8'), '<!doctype html><title>Tool</title>');
  assert.equal(await readFile(join(root, '.blueprinttool/card-images/ui-research/json-key.svg'), 'utf8'), 'svg');
  assert.equal(await readFile(join(root, '.blueprinttool/removed.json'), 'utf8').then((text) => JSON.parse(text).cards[0].id), 'removed');
  const plan = JSON.parse(await readFile(join(root, '.blueprinttool/assets-gc-plan.json'), 'utf8'));
  assert.equal(plan.kind, 'corev2.asset-gc-plan');
  assert.equal(plan.summary.orphanAssets, 5);
  assert.equal(plan.summary.unusedTextFiles, 3);
  assert.equal(plan.summary.deleteFiles, 8);
  assert.deepEqual(plan.deleteFiles.map((file: { path: string }) => file.path).sort(), [
    '.blueprinttool/card-images/ui-research/json-key.svg',
    '.blueprinttool/card-images/ui-research/orphan.png',
    '.blueprinttool/card-images/ui-research/removed-ledger.png',
    '.blueprinttool/card-images/ui-research/removed-thread.png',
    '.blueprinttool/cards/removed/card-removed.md',
    '.blueprinttool/cards/ui-research/assets/orphan.html',
    '.blueprinttool/removed.json',
    '.blueprinttool/threads/removed/thread-removed.md',
  ]);
});

test('assets gc excludes git ignored files from deletion plans', async () => {
  const root = await createWorkspace();
  await execFileAsync('git', ['-C', root, 'init']);
  await writeFile(join(root, '.gitignore'), [
    '.blueprinttool/card-images/ui-research/ignored-orphan.png',
    '.blueprinttool/cards/removed/ignored-card.md',
  ].join('\n'), 'utf8');
  await writeFile(join(root, '.blueprinttool/card-images/ui-research/ignored-orphan.png'), 'ignored');
  await writeFile(join(root, '.blueprinttool/cards/removed/ignored-card.md'), 'ignored');

  const result = await dispatchLedgerCliCommandController([
    'assets',
    'gc',
    '--root',
    root,
    '--write-plan',
    '.blueprinttool/assets-gc-plan.json',
  ], { emit: () => undefined });

  assert.equal(result.ok, true);
  const plan = JSON.parse(await readFile(join(root, '.blueprinttool/assets-gc-plan.json'), 'utf8'));
  const plannedPaths = plan.deleteFiles.map((file: { path: string }) => file.path);
  assert.equal(plan.summary.deleteFiles, 8);
  assert.ok(!plannedPaths.includes('.blueprinttool/card-images/ui-research/ignored-orphan.png'));
  assert.ok(!plannedPaths.includes('.blueprinttool/cards/removed/ignored-card.md'));
});

test('assets gc reports kept files split by tracked and untracked', async () => {
  const root = await createWorkspace();
  await execFileAsync('git', ['-C', root, 'init']);
  await execFileAsync('git', ['-C', root, 'add',
    '.blueprinttool/ui-research.json',
    '.blueprinttool/cards/ui-research/card-a.md',
    '.blueprinttool/card-images/ui-research/keep.png',
  ]);
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController([
    'assets',
    'gc',
    '--root',
    root,
    '--dry-run',
  ], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /KEEP files: 10 .*tracked 3 .*untracked 7/);

  const jsonResult = await dispatchLedgerCliCommandController([
    'assets',
    'gc',
    '--root',
    root,
    '--dry-run',
    '--json',
  ], { emit: () => undefined });

  assert.equal(jsonResult.ok, true);
  const report = JSON.parse(String(jsonResult.value));
  assert.equal(report.summary.keptFiles, 10);
  assert.equal(report.summary.keptTrackedFiles, 3);
  assert.equal(report.summary.keptUntrackedFiles, 7);
  assert.deepEqual(report.keptTrackedFiles.sort(), [
    '.blueprinttool/card-images/ui-research/keep.png',
    '.blueprinttool/cards/ui-research/card-a.md',
    '.blueprinttool/ui-research.json',
  ]);
});

test('assets apply-gc-plan deletes only files listed in the plan', async () => {
  const root = await createWorkspace();
  await dispatchLedgerCliCommandController([
    'assets',
    'gc',
    '--root',
    root,
    '--write-plan',
    '.blueprinttool/assets-gc-plan.json',
  ], { emit: () => undefined });
  const messages: string[] = [];

  const result = await dispatchLedgerCliCommandController([
    'assets',
    'apply-gc-plan',
    '--root',
    root,
    '--plan',
    '.blueprinttool/assets-gc-plan.json',
  ], { emit: (message) => messages.push(message) });

  assert.equal(result.ok, true);
  assert.match(messages.join('\n'), /Deleted files: 8/);
  await assert.rejects(readFile(join(root, '.blueprinttool/card-images/ui-research/orphan.png'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/cards/ui-research/assets/orphan.html'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/card-images/ui-research/json-key.svg'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/removed.json'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/cards/removed/card-removed.md'), 'utf8'));
  await assert.rejects(readFile(join(root, '.blueprinttool/threads/removed/thread-removed.md'), 'utf8'));
  assert.equal(await readFile(join(root, '.blueprinttool/card-images/ui-research/keep.png'), 'utf8'), 'png');
  assert.equal(await readFile(join(root, '.blueprinttool/cards/ui-research/assets/preview.html'), 'utf8').then((text) => /preview\.mjs/.test(text)), true);
  assert.equal(await readFile(join(root, '.blueprinttool/.scripts/tool.html'), 'utf8'), '<!doctype html><title>Tool</title>');
  assert.equal(await readFile(join(root, '.blueprinttool/card-images/ui-research/pinned-final.png'), 'utf8'), 'pinned');
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
  assert.ok(staged.includes('.blueprinttool/cards/ui-research/assets/preview.html'));
  assert.ok(staged.includes('.blueprinttool/cards/ui-research/assets/preview.css'));
  assert.ok(staged.includes('.blueprinttool/cards/ui-research/assets/preview.mjs'));
  assert.ok(staged.includes('.blueprinttool/cards/ui-research/assets/preview.png'));
  assert.ok(staged.includes('.blueprinttool/card-images/ui-research/keep.png'));
  assert.ok(staged.includes('.blueprinttool/thread-images/thread-a/keep.webp'));
  assert.ok(staged.includes('.blueprinttool/card-images/ui-research/pinned-final.png'));
  assert.ok(!staged.includes('.blueprinttool/cards/ui-research/assets/orphan.html'));
  assert.ok(!staged.includes('.blueprinttool/.scripts/tool.html'));
  assert.ok(!staged.includes('.blueprinttool/card-images/ui-research/orphan.png'));
  assert.ok(!staged.includes('.blueprinttool/card-images/ui-research/json-key.svg'));
});
