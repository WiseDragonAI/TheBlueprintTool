/**
 * WHAT: Exercises dev-owned child retention and cleanup admission against real parent and child Git repositories.
 * WHY: Gitlink preservation, publication, and checkout installation cannot be proven with mocked Git output.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  checkDevIntegration,
  DevIntegrationCheckError,
  runDevIntegrationCheckCli,
} from '../../src/cli/decision-os-dev-integration-check.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
}

function configureIdentity(root: string): void {
  git(root, ['config', 'user.name', 'Decision OS Test']);
  git(root, ['config', 'user.email', 'decision-os-test@example.invalid']);
}

function commitFile(root: string, path: string, content: string, message: string): string {
  writeFileSync(join(root, path), content);
  git(root, ['add', '--', path]);
  git(root, ['commit', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

type Fixture = {
  childRoot: string;
  childSource: string;
  featureSha: string;
  parentRoot: string;
  previousDevSha: string;
};

function createFixture(): Fixture {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'decision-os-dev-integration-check-'));
  const childSource = join(fixtureRoot, 'child-source');
  const childBare = join(fixtureRoot, 'child.git');
  const parentRoot = join(fixtureRoot, 'parent');
  git(fixtureRoot, ['init', '--initial-branch=main', childSource]);
  configureIdentity(childSource);
  commitFile(childSource, 'prompts.md', 'mandatory prompts\n', 'Create child baseline');
  git(fixtureRoot, ['clone', '--bare', childSource, childBare]);
  git(fixtureRoot, ['init', '--initial-branch=dev', parentRoot]);
  configureIdentity(parentRoot);
  commitFile(parentRoot, 'README.md', 'parent baseline\n', 'Create parent baseline');
  git(parentRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'add', `file://${childBare}`, '.decision-os']);
  git(parentRoot, ['add', '.gitmodules', '.decision-os']);
  git(parentRoot, ['commit', '-m', 'Add Decision OS child']);
  const previousDevSha = git(parentRoot, ['rev-parse', 'HEAD']);
  git(parentRoot, ['switch', '-c', 'feature/integration']);
  configureIdentity(join(parentRoot, '.decision-os'));
  const childSha = commitFile(join(parentRoot, '.decision-os'), 'iteration.md', 'iteration docs\n', 'Record disposable iteration docs');
  commitFile(parentRoot, 'feature.txt', 'feature\n', 'Add feature source');
  git(parentRoot, ['add', '.decision-os']);
  git(parentRoot, ['commit', '-m', 'Record feature Decision OS state']);
  const featureSha = git(parentRoot, ['rev-parse', 'HEAD']);
  git(parentRoot, ['switch', 'dev']);
  git(parentRoot, ['merge', '--no-commit', '--no-ff', 'feature/integration']);
  git(parentRoot, ['checkout', 'HEAD', '--', '.decision-os']);
  git(parentRoot, ['commit', '-m', 'Merge feature into dev', '-m', 'WHAT: Integrate feature source while retaining dev Decision OS state.\n\nWHY: Feature child pointers are disposable.']);
  git(parentRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'update', '--checkout', '--', '.decision-os']);
  return { childRoot: join(parentRoot, '.decision-os'), childSource, featureSha, parentRoot, previousDevSha };
}

test('accepts the reviewed merge only after dev child state is retained and installed', () => {
  const fixture = createFixture();
  const parentBefore = git(fixture.parentRoot, ['status', '--porcelain=v2', '--branch']);
  const childBefore = git(fixture.childRoot, ['status', '--porcelain=v2', '--branch']);
  const refsBefore = git(fixture.parentRoot, ['show-ref']);

  const receipt = checkDevIntegration(fixture.parentRoot, fixture.featureSha);

  assert.equal(receipt.ok, true);
  assert.equal(receipt.featureSha, fixture.featureSha);
  assert.equal(receipt.previousDecisionOsGitlink, git(fixture.parentRoot, ['rev-parse', `${fixture.previousDevSha}:.decision-os`]));
  assert.equal(receipt.decisionOsGitlink, git(fixture.parentRoot, ['rev-parse', 'HEAD:.decision-os']));
  assert.deepEqual(receipt.verification, {
    childCheckoutInitialized: true,
    childCheckoutMatchesGitlink: true,
    childStatusClean: true,
    childHistoryContinuous: true,
    gitlinkPublished: true,
    parentStatusClean: true,
  });
  assert.equal(git(fixture.parentRoot, ['status', '--porcelain=v2', '--branch']), parentBefore);
  assert.equal(git(fixture.childRoot, ['status', '--porcelain=v2', '--branch']), childBefore);
  assert.equal(git(fixture.parentRoot, ['show-ref']), refsBefore);
});

test('rejects a merge commit that replaces canonical dev Decision OS gitlink', () => {
  const fixture = createFixture();
  const incomingGitlink = git(fixture.parentRoot, ['rev-parse', `${fixture.featureSha}:.decision-os`]);
  git(fixture.parentRoot, ['update-index', '--cacheinfo', '160000', incomingGitlink, '.decision-os']);
  git(fixture.parentRoot, ['commit', '--amend', '--no-edit']);

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_child_replaced',
  );
});

test('rejects an uninitialized persistent dev child checkout', () => {
  const fixture = createFixture();
  git(fixture.parentRoot, ['submodule', 'deinit', '--force', '--', '.decision-os']);

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_child_uninitialized',
  );
});

test('rejects a persistent child checkout at a different commit', () => {
  const fixture = createFixture();
  git(fixture.childRoot, ['checkout', 'main']);

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_child_mismatch',
  );
});

test('rejects modified authored bytes in the persistent child checkout', () => {
  const fixture = createFixture();
  writeFileSync(join(fixture.childRoot, 'prompts.md'), 'modified mandatory prompts\n');

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_child_dirty',
  );
});

test('reports a missing parent-authored child source', () => {
  const fixture = createFixture();
  git(fixture.parentRoot, ['config', '-f', '.gitmodules', '--unset', 'submodule..decision-os.url']);
  git(fixture.parentRoot, ['add', '.gitmodules']);
  git(fixture.parentRoot, ['commit', '--amend', '--no-edit']);

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_child_source_missing',
  );
});

test('rejects a non-merge dev head', () => {
  const fixture = createFixture();
  commitFile(fixture.parentRoot, 'after-merge.txt', 'direct dev change\n', 'Direct dev change');

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_merge_required',
  );
});

test('rejects cleanup when the supplied feature is not the merge second parent', () => {
  const fixture = createFixture();

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.previousDevSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_feature_mismatch',
  );
});

test('rejects symbolic feature revisions that make merge-parent proof tautological', () => {
  const fixture = createFixture();

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, 'HEAD^2'),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_feature_invalid',
  );
});

test('rejects CLI forms that do not bind the receipt to one feature commit', () => {
  assert.equal(runDevIntegrationCheckCli([], '/tmp'), 2);
});
