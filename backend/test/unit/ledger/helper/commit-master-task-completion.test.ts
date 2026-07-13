import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { commitMasterTaskCompletion } from '@backend/business/ledger/helper/commit-master-task-completion.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function fixture(): { workspace: string; decisionOsRoot: string; ledgerPath: string; ledger: Record<string, unknown> & { cards: Array<Record<string, unknown>>; threadFiles: Record<string, string> } } {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-completion-commit-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards', 'specs'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads', 'specs'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'ui-mockups'), { recursive: true });
  const ledgerPath = join(decisionOsRoot, 'specs.json');
  const ledger = {
    cards: [
      { id: 'master-a', title: 'Ship completion', status: 'todo', domainId: 'specs', comment: { contentFile: '.decision-os/cards/specs/master-a.md' } },
      { id: 'subtask-a', title: 'Child', status: 'todo', domainId: 'specs', comment: { contentFile: '.decision-os/cards/specs/subtask-a.md' } },
    ],
    threadFiles: { 'thread-master-a': '.decision-os/threads/specs/thread-master-a.md' },
  };
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  writeFileSync(join(decisionOsRoot, 'cards', 'specs', 'master-a.md'), '#master-task #task-active\n\n## A. Subtasks\n\n1. [Child](card:subtask-a) — Status: active\n');
  writeFileSync(join(decisionOsRoot, 'cards', 'specs', 'subtask-a.md'), '## A. Scope\n\n1. **Objective:** Child.\n');
  writeFileSync(join(decisionOsRoot, 'threads', 'specs', 'thread-master-a.md'), '# OPERATOR\n\nComplete it.\n');
  writeFileSync(join(decisionOsRoot, 'ui-mockups', 'ignored.png'), 'image');
  writeFileSync(join(workspace, '.gitignore'), '.decision-os/**/*.png\n.decision-os/runs/\n');
  writeFileSync(join(workspace, 'unrelated.txt'), 'base\n');
  writeFileSync(join(workspace, 'staged.txt'), 'base\n');
  git(workspace, ['init']);
  git(workspace, ['config', 'user.name', 'Decision OS Test']);
  git(workspace, ['config', 'user.email', 'decision-os@example.test']);
  git(workspace, ['add', '.gitignore', 'unrelated.txt', 'staged.txt']);
  git(workspace, ['commit', '-m', 'base']);
  writeFileSync(join(workspace, 'unrelated.txt'), 'dirty\n');
  writeFileSync(join(workspace, 'staged.txt'), 'staged\n');
  git(workspace, ['add', 'staged.txt']);
  return { workspace, decisionOsRoot, ledgerPath, ledger };
}

test('commits only the completed ledger, canonical cards, and master thread', (t) => {
  const context = fixture();
  t.after(() => rmSync(context.workspace, { recursive: true, force: true }));
  const result = commitMasterTaskCompletion({
    decisionOsRoot: context.decisionOsRoot,
    ledgerPath: context.ledgerPath,
    ledger: context.ledger,
    mutation: { action: 'complete-master-task', masterTaskId: 'master-a' },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    git(context.workspace, ['show', '--pretty=', '--name-only', 'HEAD']).split('\n').filter(Boolean).sort(),
    [
      '.decision-os/cards/specs/master-a.md',
      '.decision-os/cards/specs/subtask-a.md',
      '.decision-os/specs.json',
      '.decision-os/threads/specs/thread-master-a.md',
    ],
  );
  assert.match(readFileSync(join(context.decisionOsRoot, 'cards', 'specs', 'master-a.md'), 'utf8'), /^#master-task #task-complete$/m);
  assert.deepEqual(context.ledger.cards.map((card) => card.status), ['done', 'done']);
  assert.deepEqual(git(context.workspace, ['status', '--short']).split('\n').sort(), [' M unrelated.txt', 'M  staged.txt']);
  assert.equal(git(context.workspace, ['check-ignore', '.decision-os/ui-mockups/ignored.png']), '.decision-os/ui-mockups/ignored.png');
});

test('restores files, ledger state, and the index when the commit is rejected', (t) => {
  const context = fixture();
  t.after(() => rmSync(context.workspace, { recursive: true, force: true }));
  mkdirSync(join(context.workspace, '.git', 'hooks'), { recursive: true });
  const hook = join(context.workspace, '.git', 'hooks', 'pre-commit');
  writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const ledgerBefore = readFileSync(context.ledgerPath, 'utf8');
  const masterPath = join(context.decisionOsRoot, 'cards', 'specs', 'master-a.md');
  const masterBefore = readFileSync(masterPath, 'utf8');
  const result = commitMasterTaskCompletion({
    decisionOsRoot: context.decisionOsRoot,
    ledgerPath: context.ledgerPath,
    ledger: context.ledger,
    mutation: { action: 'complete-master-task', masterTaskId: 'master-a' },
  });
  assert.equal(result.ok, false);
  assert.equal(readFileSync(context.ledgerPath, 'utf8'), ledgerBefore);
  assert.equal(readFileSync(masterPath, 'utf8'), masterBefore);
  assert.deepEqual(context.ledger.cards.map((card) => card.status), ['todo', 'todo']);
  assert.equal(git(context.workspace, ['diff', '--cached', '--name-only']), 'staged.txt');
});
