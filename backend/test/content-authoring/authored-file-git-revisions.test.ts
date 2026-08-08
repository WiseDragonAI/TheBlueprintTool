import test from 'node:test';
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
import { join, resolve } from 'node:path';
import { runBoundedProcess } from '../../src/business/process/helper/run-bounded-process.js';
import {
  commitAuthoredFileRevision,
  readAuthoredFileRevisionContent,
  readAuthoredFileRevisionHistory,
  readCurrentAuthoredFileRevisionContent,
  retryAuthoredFileRevision,
  sha256AuthoredBytes,
  type AuthoredGitFailurePoint,
} from '../../src/business/content-authoring/helper/authored-file-git-revisions.js';
import {
  acquireRepositoryMutationLock,
  resolveRepositoryContext,
} from '../../src/business/content-authoring/helper/repository-mutation-lock.js';

function git(root: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  }).trim();
}

function repository(): { root: string; authored: string; coupled: string; operator: string } {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-authored-git-'));
  const authored = join(root, '.decision-os', 'pipeline-prompts', 'review.md');
  const coupled = join(root, '.decision-os', 'codex-pipelines.json');
  const operator = join(root, 'operator.txt');
  mkdirSync(resolve(authored, '..'), { recursive: true });
  writeFileSync(operator, 'base\n');
  git(root, ['init', '-q']);
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'Initial']);
  return { root, authored, coupled, operator };
}

function confirmed(file: string): { file: string; contentRevision: string } {
  return { file, contentRevision: sha256AuthoredBytes(readFileSync(file)) };
}

test('bounded process terminates a non-settling child, remains event-loop responsive, and bounds output', async () => {
  let eventLoopTurn = false;
  setImmediate(() => { eventLoopTurn = true; });
  const timedOut = await runBoundedProcess({
    command: process.execPath,
    args: ['-e', 'process.on("SIGTERM",()=>{}); process.stdout.write("x".repeat(100000)); setInterval(()=>{},1000)'],
    cwd: process.cwd(),
    deadlineMs: 60,
    killGraceMs: 20,
    maximumOutputBytes: 1024,
    context: { scope: 'test-timeout' },
  });
  assert.equal(timedOut.termination, 'timeout');
  assert.equal(timedOut.ok, false);
  assert.ok(timedOut.durationMs < 1_000);
  assert.equal(eventLoopTurn, true);

  const boundedOutput = await runBoundedProcess({
    command: process.execPath,
    args: ['-e', 'process.stdout.write("x".repeat(100000))'],
    cwd: process.cwd(),
    deadlineMs: 5_000,
    maximumOutputBytes: 1024,
    context: { scope: 'test-bounded-output' },
  });
  assert.equal(boundedOutput.ok, true);
  assert.equal(boundedOutput.stdout.length, 1024);
  assert.ok(boundedOutput.stdoutTruncatedBytes > 0);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  const cancelled = await runBoundedProcess({
    command: process.execPath,
    args: ['-e', 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1000)'],
    cwd: process.cwd(),
    deadlineMs: 5_000,
    killGraceMs: 20,
    signal: controller.signal,
    context: { scope: 'test-cancellation' },
  });
  assert.equal(cancelled.termination, 'cancelled');
  assert.ok(cancelled.durationMs < 1_000);
});

test('every Git creation boundary preserves bytes and index, persists an incident, and retries explicitly', async (t) => {
  const failurePoints: AuthoredGitFailurePoint[] = [
    'read-tree',
    'add',
    'write-tree',
    'commit-tree',
    'update-ref',
    'index-reconciliation',
  ];
  for (const failureAt of failurePoints) {
    await t.test(failureAt, async () => {
      const fixture = repository();
      try {
        writeFileSync(fixture.operator, 'operator staged\n');
        git(fixture.root, ['add', 'operator.txt']);
        writeFileSync(fixture.authored, '# Confirmed\n');
        writeFileSync(fixture.coupled, '{"version":2}\n');
        const context = await resolveRepositoryContext(fixture.root);
        const indexBefore = readFileSync(context.indexFile);
        const headBefore = git(fixture.root, ['rev-parse', 'HEAD']);
        let recoveryToken = '';

        await assert.rejects(
          commitAuthoredFileRevision({
            repositoryRoot: fixture.root,
            ownerId: 'prompt:review',
            subject: 'Create prompt review',
            confirmedFiles: [confirmed(fixture.authored), confirmed(fixture.coupled)],
            failureAt,
          }),
          (error: unknown) => {
            assert.equal((error as { code?: string }).code, 'git_revision_pending_recovery');
            recoveryToken = String((error as { recoveryToken?: string }).recoveryToken ?? '');
            assert.match(recoveryToken, /^[a-f0-9-]{36}$/);
            return true;
          },
        );
        assert.equal(git(fixture.root, ['rev-parse', 'HEAD']), headBefore);
        assert.deepEqual(readFileSync(context.indexFile), indexBefore);
        assert.equal(readFileSync(fixture.authored, 'utf8'), '# Confirmed\n');
        assert.equal(readFileSync(fixture.coupled, 'utf8'), '{"version":2}\n');
        const incidentFile = resolve(context.commonDirectory, 'decision-os', 'runtime-incidents.json');
        const incidentDocument = JSON.parse(readFileSync(incidentFile, 'utf8')) as { incidents: Array<{ code: string; context: { recoveryToken?: string } }> };
        assert.equal(incidentDocument.incidents.at(-1)?.code, 'git_revision_pending_recovery');
        assert.equal(incidentDocument.incidents.at(-1)?.context.recoveryToken, recoveryToken);

        const recovered = await retryAuthoredFileRevision({
          repositoryRoot: fixture.root,
          ownerId: 'prompt:review',
          recoveryToken,
        });
        assert.equal(git(fixture.root, ['rev-parse', 'HEAD']), recovered.commit);
        assert.equal(git(fixture.root, ['show', '-s', '--format=%B', 'HEAD']), [
          'Create prompt review',
          '',
          'WHAT: Version the confirmed authored files as one focused revision.',
          '',
          'WHY: Decision OS authored content requires exact-byte Git evidence without staging unrelated work.',
        ].join('\n'));
        assert.deepEqual(git(fixture.root, ['diff', '--cached', '--name-only']).split('\n'), ['operator.txt']);
        assert.equal(git(fixture.root, ['status', '--short', '--', '.decision-os']), '');
        assert.equal(existsSync(resolve(context.commonDirectory, 'decision-os', 'authored-revision-recovery', `${recoveryToken}.json`)), false);
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  }
});

test('retry rejects changed authoritative bytes without repeating the owner mutation', async () => {
  const fixture = repository();
  try {
    writeFileSync(fixture.authored, '# Confirmed\n');
    let recoveryToken = '';
    await assert.rejects(
      commitAuthoredFileRevision({
        repositoryRoot: fixture.root,
        ownerId: 'prompt:review',
        subject: 'Create prompt review',
        confirmedFiles: [confirmed(fixture.authored)],
        failureAt: 'commit-tree',
      }),
      (error: unknown) => {
        recoveryToken = String((error as { recoveryToken?: string }).recoveryToken ?? '');
        return true;
      },
    );
    writeFileSync(fixture.authored, '# Changed after confirmation\n');
    await assert.rejects(
      retryAuthoredFileRevision({
        repositoryRoot: fixture.root,
        ownerId: 'prompt:review',
        recoveryToken,
      }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'content_revision_conflict');
        return true;
      },
    );
    assert.equal(git(fixture.root, ['log', '--format=%s', '-1']), 'Initial');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('live locks reject and dead unchanged owners are reconciled', async () => {
  const fixture = repository();
  try {
    writeFileSync(fixture.authored, '# Confirmed\n');
    const lock = await acquireRepositoryMutationLock({ repositoryRoot: fixture.root, purpose: 'live-test' });
    await assert.rejects(
      commitAuthoredFileRevision({
        repositoryRoot: fixture.root,
        ownerId: 'prompt:review',
        subject: 'Create prompt review',
        confirmedFiles: [confirmed(fixture.authored)],
      }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, 'repository_mutation_locked');
        assert.equal((error as { statusCode?: number }).statusCode, 423);
        return true;
      },
    );

    const ownerFile = resolve(lock.lockDirectory, 'owner.json');
    const staleOwner = JSON.parse(readFileSync(ownerFile, 'utf8')) as { pid: number; processIdentity: string };
    staleOwner.pid = 2_000_000_000;
    staleOwner.processIdentity = 'linux:2000000000:missing';
    writeFileSync(ownerFile, `${JSON.stringify(staleOwner, null, 2)}\n`);
    const reconciled = await acquireRepositoryMutationLock({ repositoryRoot: fixture.root, purpose: 'stale-test' });
    assert.notEqual(reconciled.owner.token, lock.owner.token);
    reconciled.release();
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('history cursor traverses more than 500 affecting commits, follows rename, and reads immutable blobs', { timeout: 120_000 }, async () => {
  const fixture = repository();
  try {
    const oldFile = join(fixture.root, 'history-old.md');
    const newFile = join(fixture.root, 'history-new.md');
    writeFileSync(oldFile, 'revision 0\n');
    git(fixture.root, ['add', 'history-old.md']);
    git(fixture.root, ['commit', '-q', '-m', 'History 0'], {
      GIT_AUTHOR_NAME: 'History Author',
      GIT_AUTHOR_EMAIL: 'history@example.test',
      GIT_COMMITTER_NAME: 'History Committer',
      GIT_COMMITTER_EMAIL: 'committer@example.test',
    });
    let currentFile = oldFile;
    for (let index = 1; index <= 501; index += 1) {
      if (index === 251) {
        git(fixture.root, ['mv', 'history-old.md', 'history-new.md']);
        currentFile = newFile;
        git(fixture.root, ['commit', '-q', '-m', 'History rename'], {
          GIT_AUTHOR_NAME: 'History Author',
          GIT_AUTHOR_EMAIL: 'history@example.test',
          GIT_COMMITTER_NAME: 'History Committer',
          GIT_COMMITTER_EMAIL: 'committer@example.test',
        });
      }
      writeFileSync(currentFile, `revision ${index}\n`);
      git(fixture.root, ['add', '--', currentFile]);
      git(fixture.root, ['commit', '-q', '-m', `History ${index}`], {
        GIT_AUTHOR_NAME: 'History Author',
        GIT_AUTHOR_EMAIL: 'history@example.test',
        GIT_COMMITTER_NAME: 'History Committer',
        GIT_COMMITTER_EMAIL: 'committer@example.test',
      });
    }

    const revisions = [];
    let cursor: string | null = null;
    do {
      const page = await readAuthoredFileRevisionHistory({ file: newFile, cursor, limit: 37 });
      revisions.push(...page.revisions);
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(revisions.length, 503);
    assert.equal(new Set(revisions.map((entry) => entry.commit)).size, 503);
    assert.equal(revisions[0].subject, 'History 501');
    assert.equal(revisions.at(-1)?.subject, 'History 0');
    assert.equal(revisions.at(-1)?.authorName, 'History Author');
    assert.equal(revisions.at(-1)?.authorEmail, 'history@example.test');
    assert.equal(revisions.at(-1)?.committerName, 'History Committer');

    writeFileSync(newFile, 'uncommitted bytes\n');
    const oldest = await readAuthoredFileRevisionContent({
      file: newFile,
      commit: revisions.at(-1)!.commit,
    });
    assert.equal(oldest.markdown, 'revision 0\n');
    assert.equal(oldest.baseMarkdown, '');
    assert.equal(oldest.baselineAvailability, 'no_prior_revision');
    assert.equal(oldest.contentRevision, sha256AuthoredBytes('revision 0\n'));
    assert.equal(oldest.olderCommit, null);
    assert.match(oldest.patch, /^\+revision 0$/m);
    assert.doesNotMatch(oldest.patch, /uncommitted bytes/);

    const selected = await readAuthoredFileRevisionContent({
      file: newFile,
      commit: revisions.at(-2)!.commit,
    });
    assert.equal(selected.markdown, 'revision 1\n');
    assert.equal(selected.baseMarkdown, 'revision 0\n');
    assert.equal(selected.baselineAvailability, 'available');
    assert.match(selected.patch, /^-revision 0$/m);
    assert.match(selected.patch, /^\+revision 1$/m);

    const current = await readCurrentAuthoredFileRevisionContent({ file: newFile });
    assert.equal(current.markdown, 'uncommitted bytes\n');
    assert.equal(current.contentRevision, sha256AuthoredBytes('uncommitted bytes\n'));
    assert.equal(current.commit, revisions[0].commit);
    assert.equal(current.olderCommit, revisions[1].commit);
    assert.equal(current.baseMarkdown, 'revision 500\n');
    assert.equal(current.baselineAvailability, 'available');
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
