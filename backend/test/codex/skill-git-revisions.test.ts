import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  commitSkillFileRevision,
  readSkillGitHistory,
  readSkillGitHistoryPage,
  readSkillGitRevision,
} from '../../src/business/codex/helper/skill-git-revisions.js';
import { sha256AuthoredBytes } from '../../src/business/content-authoring/helper/authored-file-git-revisions.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function repository(): { root: string; prompt: string; metadata: string } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-git-revisions-'));
  const prompt = join(root, '.decision-os', 'pipeline-prompts', 'review.md');
  const metadata = join(root, '.decision-os', 'codex-pipelines.json');
  mkdirSync(join(root, '.decision-os', 'pipeline-prompts'), { recursive: true });
  writeFileSync(join(root, 'operator.txt'), 'base\n');
  git(root, ['init', '-q']);
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'Initial']);
  return { root, prompt, metadata };
}

test('skill adapter commits exact owner and coupled-store bytes while preserving unrelated staged state', async () => {
  const fixture = repository();
  try {
    writeFileSync(join(fixture.root, 'operator.txt'), 'operator staged\n');
    git(fixture.root, ['add', 'operator.txt']);
    writeFileSync(fixture.prompt, '# First\n');
    writeFileSync(fixture.metadata, '{"version":2}\n');

    const revision = await commitSkillFileRevision({
      file: fixture.prompt,
      contentRevision: sha256AuthoredBytes(readFileSync(fixture.prompt)),
      additionalFiles: [{
        file: fixture.metadata,
        contentRevision: sha256AuthoredBytes(readFileSync(fixture.metadata)),
      }],
      subject: 'Create pipeline-prompt review',
    });
    assert.equal(git(fixture.root, ['rev-parse', 'HEAD']), revision.commit);
    assert.deepEqual(
      git(fixture.root, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').sort(),
      ['.decision-os/codex-pipelines.json', '.decision-os/pipeline-prompts/review.md'],
    );
    assert.deepEqual(git(fixture.root, ['diff', '--cached', '--name-only']).split('\n'), ['operator.txt']);
    assert.equal(git(fixture.root, ['show', ':operator.txt']), 'operator staged');
    assert.equal(git(fixture.root, ['status', '--short', '--', '.decision-os']), '');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('skill adapter history pages and immutable content keep older-to-selected diff direction', async () => {
  const fixture = repository();
  try {
    writeFileSync(fixture.prompt, 'alpha\n');
    const first = await commitSkillFileRevision({
      file: fixture.prompt,
      contentRevision: sha256AuthoredBytes('alpha\n'),
      subject: 'First prompt',
    });
    writeFileSync(fixture.prompt, 'alpha\nblue\n');
    const second = await commitSkillFileRevision({
      file: fixture.prompt,
      contentRevision: sha256AuthoredBytes('alpha\nblue\n'),
      subject: 'Second prompt',
    });
    writeFileSync(fixture.prompt, 'red\nblue\n');
    const third = await commitSkillFileRevision({
      file: fixture.prompt,
      contentRevision: sha256AuthoredBytes('red\nblue\n'),
      subject: 'Third prompt',
    });

    assert.deepEqual((await readSkillGitHistory(fixture.prompt)).map((entry) => entry.commit), [third.commit, second.commit, first.commit]);
    const firstPage = await readSkillGitHistoryPage({ file: fixture.prompt, limit: 2 });
    assert.deepEqual(firstPage.revisions.map((entry) => entry.commit), [third.commit, second.commit]);
    assert.ok(firstPage.nextCursor);
    const secondPage = await readSkillGitHistoryPage({ file: fixture.prompt, limit: 2, cursor: firstPage.nextCursor });
    assert.deepEqual(secondPage.revisions.map((entry) => entry.commit), [first.commit]);
    assert.equal(secondPage.nextCursor, null);

    writeFileSync(fixture.prompt, 'uncommitted replacement\n');
    const selected = await readSkillGitRevision(fixture.prompt, first.commit);
    assert.equal(selected.markdown, 'alpha\n');
    assert.equal(selected.parentCommit, null);
    assert.equal(selected.successorCommit, second.commit);
    assert.match(selected.patch, /^\+alpha$/m);
    assert.equal(selected.authorName, 'Decision OS');
    assert.equal(selected.authorEmail, 'decision-os@localhost');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('skill adapter detects a coupled-store byte change at under-lock revalidation', async () => {
  const fixture = repository();
  try {
    writeFileSync(fixture.prompt, '# First\n');
    writeFileSync(fixture.metadata, '{"version":2}\n');
    await assert.rejects(
      commitSkillFileRevision({
        file: fixture.prompt,
        contentRevision: sha256AuthoredBytes(readFileSync(fixture.prompt)),
        additionalFiles: [{
          file: fixture.metadata,
          contentRevision: sha256AuthoredBytes(readFileSync(fixture.metadata)),
        }],
        subject: 'Create prompt',
        beforeRevalidation: () => writeFileSync(fixture.metadata, '{"version":2,"changed":true}\n'),
      }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'content_revision_conflict');
        return true;
      },
    );
    assert.equal(readFileSync(fixture.prompt, 'utf8'), '# First\n');
    assert.equal(git(fixture.root, ['log', '--format=%s', '-1']), 'Initial');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
