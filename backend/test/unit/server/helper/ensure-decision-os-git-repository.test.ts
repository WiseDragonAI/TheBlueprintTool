/**
 * WHAT: Proves deterministic child repository initialization for Decision OS authored content.
 * WHY: The cutover must preserve runtime bytes and every parent repository boundary.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  canonicalDecisionOsGitIgnore,
  ensureDecisionOsGitRepository,
} from '@backend/business/server/helper/ensure-decision-os-git-repository.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function initializeParent(root: string): void {
  git(root, ['init', '-q']);
  writeFileSync(join(root, 'README.md'), '# Parent\n');
  git(root, ['add', 'README.md']);
  git(root, [
    '-c', 'user.name=Parent',
    '-c', 'user.email=parent@example.invalid',
    'commit', '-qm', 'Initialize parent',
  ]);
}

test('initializes one focused child baseline without changing parent Git state or ignored runtime bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-child-git-'));
  const decisionOsRoot = join(root, '.decision-os');
  const runtimeBytes = Buffer.from([0, 255, 12, 13, 10, 42]);
  try {
    mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
    mkdirSync(join(decisionOsRoot, 'task-state', 'project-a'), { recursive: true });
    mkdirSync(join(decisionOsRoot, 'runtime'), { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), '{"ledgers":[]}\n');
    writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'card-a.md'), '# Authored\n');
    writeFileSync(join(decisionOsRoot, 'tasks.json'), runtimeBytes);
    writeFileSync(join(decisionOsRoot, 'task-state', 'project-a', 'entity.json'), runtimeBytes);
    writeFileSync(join(decisionOsRoot, 'runtime', 'scheduler.json'), runtimeBytes);
    writeFileSync(join(decisionOsRoot, '.settings.json'), runtimeBytes);
    writeFileSync(join(decisionOsRoot, 'runtime-incidents.json'), runtimeBytes);
    writeFileSync(join(decisionOsRoot, 'image.png'), runtimeBytes);
    initializeParent(root);
    writeFileSync(join(root, 'operator.txt'), 'approved staged bytes\n');
    git(root, ['add', 'operator.txt']);
    const parentHead = git(root, ['rev-parse', 'HEAD']);
    const parentIndex = git(root, ['diff', '--cached', '--binary']);

    ensureDecisionOsGitRepository(decisionOsRoot);

    assert.equal(readFileSync(join(decisionOsRoot, '.gitignore'), 'utf8'), canonicalDecisionOsGitIgnore);
    assert.equal(git(decisionOsRoot, ['symbolic-ref', '--short', 'HEAD']), 'main');
    assert.equal(git(decisionOsRoot, ['rev-list', '--count', 'HEAD']), '1');
    assert.deepEqual(
      git(decisionOsRoot, ['ls-files']).split('\n'),
      ['.gitignore', 'cards/tasks/card-a.md', 'state.json'],
    );
    assert.equal(git(decisionOsRoot, ['config', '--local', 'user.name']), 'Decision OS');
    assert.equal(git(decisionOsRoot, ['config', '--local', 'user.email']), 'decision-os@localhost');
    assert.match(git(decisionOsRoot, ['show', '-s', '--format=%B', 'HEAD']), /WHAT: Capture the existing nonignored Decision OS files/);
    for (const file of [
      'tasks.json',
      'task-state/project-a/entity.json',
      'runtime/scheduler.json',
      '.settings.json',
      'runtime-incidents.json',
      'image.png',
    ]) {
      assert.deepEqual(readFileSync(join(decisionOsRoot, file)), runtimeBytes, file);
    }
    assert.equal(git(root, ['rev-parse', 'HEAD']), parentHead);
    assert.equal(git(root, ['diff', '--cached', '--binary']), parentIndex);

    const childHead = git(decisionOsRoot, ['rev-parse', 'HEAD']);
    ensureDecisionOsGitRepository(decisionOsRoot);
    assert.equal(git(decisionOsRoot, ['rev-parse', 'HEAD']), childHead);
    assert.equal(git(decisionOsRoot, ['rev-list', '--count', 'HEAD']), '1');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('initializes beneath a non-Git catalog root', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-non-git-catalog-'));
  const decisionOsRoot = join(root, '.decision-os');
  try {
    mkdirSync(decisionOsRoot);
    writeFileSync(join(decisionOsRoot, 'projects.json'), '{"version":2,"projects":{}}\n');

    ensureDecisionOsGitRepository(decisionOsRoot);

    assert.equal(git(decisionOsRoot, ['rev-parse', '--show-toplevel']), decisionOsRoot);
    assert.equal(git(decisionOsRoot, ['show', '--format=', '--name-only', 'HEAD']).split('\n').sort().join('\n'), '.gitignore\nprojects.json');
    assert.equal(existsSync(join(root, '.git')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('leaves an existing valid child repository byte-identical', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-existing-child-git-'));
  const decisionOsRoot = join(root, '.decision-os');
  try {
    mkdirSync(decisionOsRoot);
    git(decisionOsRoot, ['init', '-q', '--initial-branch=legacy']);
    writeFileSync(join(decisionOsRoot, '.gitignore'), 'custom-ignore\n');
    writeFileSync(join(decisionOsRoot, 'state.json'), '{"ledgers":[]}\n');
    git(decisionOsRoot, ['add', '.']);
    git(decisionOsRoot, [
      '-c', 'user.name=Existing',
      '-c', 'user.email=existing@example.invalid',
      'commit', '-qm', 'Existing baseline',
    ]);
    const head = git(decisionOsRoot, ['rev-parse', 'HEAD']);
    const ignoreBytes = readFileSync(join(decisionOsRoot, '.gitignore'));

    ensureDecisionOsGitRepository(decisionOsRoot);

    assert.equal(git(decisionOsRoot, ['rev-parse', 'HEAD']), head);
    assert.equal(git(decisionOsRoot, ['symbolic-ref', '--short', 'HEAD']), 'legacy');
    assert.deepEqual(readFileSync(join(decisionOsRoot, '.gitignore')), ignoreBytes);
    assert.equal(readFileSync(join(decisionOsRoot, '.git', 'config'), 'utf8').includes('[user]'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects incomplete child Git metadata without rewriting it', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-incomplete-child-git-'));
  const decisionOsRoot = join(root, '.decision-os');
  const sentinel = Buffer.from([10, 20, 30, 40]);
  try {
    mkdirSync(join(decisionOsRoot, '.git'), { recursive: true });
    writeFileSync(join(decisionOsRoot, '.git', 'sentinel'), sentinel);
    writeFileSync(join(decisionOsRoot, 'state.json'), '{"ledgers":[]}\n');

    assert.throws(
      () => ensureDecisionOsGitRepository(decisionOsRoot),
      /Incomplete Decision OS Git metadata/,
    );
    assert.deepEqual(readFileSync(join(decisionOsRoot, '.git', 'sentinel')), sentinel);
    assert.equal(existsSync(join(decisionOsRoot, '.gitignore')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
