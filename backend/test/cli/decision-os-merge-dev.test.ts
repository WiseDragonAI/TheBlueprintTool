/**
 * WHAT: Exercises dev-to-main promotion against real temporary parent and submodule repositories.
 * WHY: Gitlink preservation, dirty-state rejection, and merge ancestry cannot be proven with mocked Git output.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  MergeDevError,
  formatDoctorReport,
  inspectMergeDev,
  mergeDevIntoMain,
} from '../../src/cli/decision-os-merge-dev.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
}

function commitFile(root: string, path: string, content: string, message: string): string {
  writeFileSync(join(root, path), content);
  git(root, ['add', '--', path]);
  git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function configureIdentity(root: string): void {
  git(root, ['config', 'user.name', 'Decision OS Test']);
  git(root, ['config', 'user.email', 'decision-os-test@example.invalid']);
}

type Fixture = { childRoot: string; fixtureRoot: string; parentBare: string; parentRoot: string; initialChildSha: string };

function createFixture(): Fixture {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'decision-os-merge-dev-'));
  const childSource = join(fixtureRoot, 'child-source');
  const childBare = join(fixtureRoot, 'child.git');
  const parentBare = join(fixtureRoot, 'parent.git');
  const parentRoot = join(fixtureRoot, 'parent');
  git(fixtureRoot, ['init', '--initial-branch=main', childSource]);
  configureIdentity(childSource);
  const initialChildSha = commitFile(childSource, 'cards.md', 'main baseline\n', 'Child baseline');
  git(fixtureRoot, ['clone', '--bare', childSource, childBare]);
  git(fixtureRoot, ['init', '--initial-branch=main', parentRoot]);
  configureIdentity(parentRoot);
  commitFile(parentRoot, '.gitignore', '/.decision-os-merge-dev-logs/\n', 'Ignore merge logs');
  commitFile(parentRoot, 'README.md', 'parent baseline\n', 'Parent baseline');
  git(parentRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'add', childBare, '.decision-os']);
  configureIdentity(join(parentRoot, '.decision-os'));
  git(parentRoot, ['add', '.gitmodules', '.decision-os']);
  git(parentRoot, ['commit', '-m', 'Add Decision OS submodule']);
  git(parentRoot, ['tag', 'rel-0.1.0']);
  git(fixtureRoot, ['init', '--bare', parentBare]);
  git(parentRoot, ['remote', 'add', 'origin', parentBare]);
  git(parentRoot, ['push', '-u', 'origin', 'main']);
  return { childRoot: join(parentRoot, '.decision-os'), fixtureRoot, parentBare, parentRoot, initialChildSha };
}

test('commits main child state and merges dev without adopting the dev gitlink', async () => {
  const fixture = createFixture();
  const devRoot = join(fixture.fixtureRoot, 'dev-worktree');
  git(fixture.parentRoot, ['branch', 'dev']);
  git(fixture.parentRoot, ['worktree', 'add', devRoot, 'dev']);
  git(devRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--init', '.decision-os']);
  configureIdentity(join(devRoot, '.decision-os'));
  const devSourceSha = commitFile(devRoot, 'dev.txt', 'dev source\n', 'Add dev source');
  const devChildSha = commitFile(join(devRoot, '.decision-os'), 'dev-card.md', 'dev child\n', 'Advance dev child');
  git(devRoot, ['add', '.decision-os']);
  git(devRoot, ['commit', '-m', 'Advance dev child pointer']);
  const devSha = git(devRoot, ['rev-parse', 'HEAD']);
  const devChildStatus = git(join(devRoot, '.decision-os'), ['status', '--porcelain=v2', '--branch']);
  const devChildFile = readFileSync(join(devRoot, '.decision-os', 'dev-card.md'), 'utf8');
  writeFileSync(join(fixture.childRoot, 'main-card.md'), 'main child state\n');
  const mainBeforeDoctor = git(fixture.parentRoot, ['rev-parse', 'HEAD']);
  const childBeforeDoctor = git(fixture.childRoot, ['rev-parse', 'HEAD']);
  const parentStatusBeforeDoctor = git(fixture.parentRoot, ['status', '--porcelain=v2', '--branch']);
  const childStatusBeforeDoctor = git(fixture.childRoot, ['status', '--porcelain=v2', '--branch']);

  const doctor = inspectMergeDev(fixture.parentRoot);

  assert.equal(doctor.result, 'READY');
  assert.equal(doctor.expectedMerge.createDecisionOsCommit, true);
  assert.equal(doctor.expectedMerge.preservedGitlink, 'new main Decision OS snapshot commit');
  assert.deepEqual(doctor.expectedMerge.release, { version: '0.1.1', tags: ['rel-0.1.1', 'devrel-0.1.1'] });
  assert.deepEqual(doctor.expectedMerge.commits, [
    { hash: devSourceSha, message: 'Add dev source\n' },
    { hash: devSha, message: 'Advance dev child pointer\n' },
  ]);
  assert.match(formatDoctorReport(doctor), new RegExp(`---\\n${devSourceSha}\\nAdd dev source`));
  assert.equal(git(fixture.parentRoot, ['rev-parse', 'HEAD']), mainBeforeDoctor);
  assert.equal(git(fixture.childRoot, ['rev-parse', 'HEAD']), childBeforeDoctor);
  assert.equal(git(fixture.parentRoot, ['status', '--porcelain=v2', '--branch']), parentStatusBeforeDoctor);
  assert.equal(git(fixture.childRoot, ['status', '--porcelain=v2', '--branch']), childStatusBeforeDoctor);
  assert.equal(readdirSync(fixture.parentRoot).includes('.decision-os-merge-dev-logs'), false);

  const receipt = await mergeDevIntoMain(fixture.parentRoot);

  assert.equal(receipt.devSha, devSha);
  assert.equal(receipt.decisionOsCommitCreated, true);
  assert.equal(receipt.gitlinkCommitCreated, true);
  assert.notEqual(receipt.decisionOsSha, devChildSha);
  assert.deepEqual(receipt.release.tags, [
    { name: 'rel-0.1.1', repository: 'parent', target: receipt.mainSha },
    { name: 'devrel-0.1.1', repository: 'parent', target: devSha },
    { name: 'rel-0.1.1', repository: 'child', target: receipt.decisionOsSha },
    { name: 'devrel-0.1.1', repository: 'child', target: receipt.decisionOsSha },
  ]);
  assert.deepEqual(receipt.publication, { branch: 'main', remote: 'origin', tags: ['rel-0.1.1', 'devrel-0.1.1'] });
  assert.equal(git(fixture.parentBare, ['rev-parse', 'refs/heads/main']), receipt.mainSha);
  assert.equal(git(fixture.parentBare, ['rev-list', '-n', '1', 'refs/tags/rel-0.1.1']), receipt.mainSha);
  assert.equal(git(fixture.parentBare, ['rev-list', '-n', '1', 'refs/tags/devrel-0.1.1']), devSha);
  assert.equal(git(fixture.parentRoot, ['rev-parse', 'HEAD:.decision-os']), receipt.decisionOsSha);
  assert.equal(git(fixture.parentRoot, ['show', '-s', '--format=%P', 'HEAD']).split(' ')[1], devSha);
  assert.deepEqual(receipt.verification, {
    childStatus: [],
    decisionOsGitlink: receipt.decisionOsSha,
    mergeParents: git(fixture.parentRoot, ['show', '-s', '--format=%P', 'HEAD']).split(' '),
    parentStatus: [],
  });
  assert.equal(readFileSync(join(fixture.parentRoot, 'dev.txt'), 'utf8'), 'dev source\n');
  assert.equal(git(fixture.parentRoot, ['status', '--porcelain']), '');
  assert.equal(git(fixture.childRoot, ['status', '--porcelain']), '');
  assert.equal(git(join(devRoot, '.decision-os'), ['rev-parse', 'HEAD']), devChildSha);
  assert.equal(git(join(devRoot, '.decision-os'), ['status', '--porcelain=v2', '--branch']), devChildStatus);
  assert.equal(readFileSync(join(devRoot, '.decision-os', 'dev-card.md'), 'utf8'), devChildFile);
  assert.match(readFileSync(receipt.logFile, 'utf8'), /"event":"promotion-completed"/);
  assert.equal(dirname(receipt.logFile), join(fixture.parentRoot, '.decision-os-merge-dev-logs'));
});

test('rejects unrelated parent dirt before committing child state', async () => {
  const fixture = createFixture();
  git(fixture.parentRoot, ['branch', 'dev']);
  const childBefore = git(fixture.childRoot, ['rev-parse', 'HEAD']);
  writeFileSync(join(fixture.childRoot, 'main-card.md'), 'must remain uncommitted\n');
  writeFileSync(join(fixture.parentRoot, 'unrelated.txt'), 'operator work\n');

  await assert.rejects(
    () => mergeDevIntoMain(fixture.parentRoot),
    (error: unknown) => error instanceof MergeDevError && error.code === 'merge_dev_parent_dirty',
  );

  assert.equal(git(fixture.childRoot, ['rev-parse', 'HEAD']), childBefore);
  assert.match(git(fixture.childRoot, ['status', '--porcelain']), /main-card\.md/);
  const rejectionLogs = readdirSync(join(fixture.parentRoot, '.decision-os-merge-dev-logs'));
  assert.equal(rejectionLogs.length, 1);
  assert.match(
    readFileSync(join(fixture.parentRoot, '.decision-os-merge-dev-logs', rejectionLogs[0]!), 'utf8'),
    /"event":"promotion-failed".*"code":"merge_dev_parent_dirty"/,
  );
});

test('rejects a concurrent remote main advance without publishing either release tag', async () => {
  const fixture = createFixture();
  git(fixture.parentRoot, ['branch', 'dev']);
  commitFile(fixture.parentRoot, 'main.txt', 'local promotion\n', 'Advance local main');
  const concurrentRoot = join(fixture.fixtureRoot, 'concurrent-main');
  git(fixture.fixtureRoot, ['clone', '--branch', 'main', fixture.parentBare, concurrentRoot]);
  configureIdentity(concurrentRoot);
  const remoteSha = commitFile(concurrentRoot, 'remote.txt', 'concurrent remote\n', 'Advance remote main');
  git(concurrentRoot, ['push', 'origin', 'main']);

  await assert.rejects(
    () => mergeDevIntoMain(fixture.parentRoot),
    (error: unknown) => error instanceof MergeDevError && error.code === 'merge_dev_git_failed',
  );

  assert.equal(git(fixture.parentBare, ['rev-parse', 'refs/heads/main']), remoteSha);
  assert.equal(git(fixture.parentBare, ['tag', '--list', 'rel-0.1.1']), '');
  assert.equal(git(fixture.parentBare, ['tag', '--list', 'devrel-0.1.1']), '');
});

test('rejects source conflicts during simulation before committing child state', async () => {
  const fixture = createFixture();
  commitFile(fixture.parentRoot, 'shared.txt', 'base\n', 'Add shared source');
  git(fixture.parentRoot, ['switch', '-c', 'dev']);
  commitFile(fixture.parentRoot, 'shared.txt', 'dev\n', 'Change shared source on dev');
  git(fixture.parentRoot, ['switch', 'main']);
  commitFile(fixture.parentRoot, 'shared.txt', 'main\n', 'Change shared source on main');
  const parentBefore = git(fixture.parentRoot, ['rev-parse', 'HEAD']);
  const childBefore = git(fixture.childRoot, ['rev-parse', 'HEAD']);
  writeFileSync(join(fixture.childRoot, 'main-card.md'), 'must remain uncommitted\n');

  const doctor = inspectMergeDev(fixture.parentRoot);

  assert.equal(doctor.result, 'NO-GO');
  assert.ok(doctor.blockers.some((blocker) => blocker.code === 'merge_dev_source_conflict'));
  assert.ok(doctor.expectedMerge.conflicts.some((conflict) => conflict.includes('shared.txt')));

  await assert.rejects(
    () => mergeDevIntoMain(fixture.parentRoot),
    (error: unknown) => error instanceof MergeDevError && error.code === 'merge_dev_source_conflict',
  );

  assert.equal(git(fixture.parentRoot, ['rev-parse', 'HEAD']), parentBefore);
  assert.equal(git(fixture.childRoot, ['rev-parse', 'HEAD']), childBefore);
  assert.equal(git(fixture.parentRoot, ['status', '--porcelain']), 'M .decision-os');
});
