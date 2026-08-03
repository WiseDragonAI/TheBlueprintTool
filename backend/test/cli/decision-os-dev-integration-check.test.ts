/**
 * WHAT: Exercises the dev integration cleanup gate against real parent and child Git repositories.
 * WHY: Child publication, ancestry, and checkout installation cannot be proven with mocked Git output.
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

function createFixture(options: { parallelChild?: boolean; publishChild?: boolean } = {}): Fixture {
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
  // WHAT: Create a published but parallel child history only for the ancestry regression.
  // WHY: A source can provide both histories while the new gitlink still discards prior dev state.
  if (options.parallelChild === true) {
    git(join(parentRoot, '.decision-os'), ['switch', '--orphan', 'parallel']);
    git(join(parentRoot, '.decision-os'), ['rm', '-r', '--ignore-unmatch', '.']);
  }
  const childSha = commitFile(join(parentRoot, '.decision-os'), 'iteration.md', 'iteration docs\n', 'Record iteration docs');
  // WHAT: Publish the child commit for the admitted fixture unless the test requests the incident state.
  // WHY: The unpublished regression must differ only at the configured child-source boundary.
  if (options.publishChild !== false) {
    // WHAT: Select the advertised ref that owns the fixture's chosen child history.
    // WHY: The ancestry regression must publish its parallel object without moving the baseline main ref.
    const childBranch = options.parallelChild === true ? 'parallel' : 'dev';
    git(join(parentRoot, '.decision-os'), ['push', 'origin', `${childSha}:refs/heads/${childBranch}`]);
  }
  commitFile(parentRoot, 'feature.txt', 'feature\n', 'Add feature source');
  git(parentRoot, ['add', '.decision-os']);
  git(parentRoot, ['commit', '-m', 'Record feature Decision OS state']);
  const featureSha = git(parentRoot, ['rev-parse', 'HEAD']);
  git(parentRoot, ['switch', 'dev']);
  git(parentRoot, ['merge', '--no-ff', 'feature/integration', '-m', 'Merge feature into dev', '-m', 'WHAT: Integrate the tested feature.\n\nWHY: The iteration passed its verification gates.']);
  return { childRoot: join(parentRoot, '.decision-os'), childSource, featureSha, parentRoot, previousDevSha };
}

test('accepts the reviewed merge only after its child history is published and installed', () => {
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

test('rejects a merged gitlink absent from the configured child source', () => {
  const fixture = createFixture({ publishChild: false });

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_gitlink_unpublished',
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

test('rejects a published child commit from parallel history', () => {
  const fixture = createFixture({ parallelChild: true });

  assert.throws(
    () => checkDevIntegration(fixture.parentRoot, fixture.featureSha),
    (error: unknown) => error instanceof DevIntegrationCheckError && error.code === 'dev_integration_child_history_diverged',
  );
});

test('rejects a persistent child checkout at a different commit', () => {
  const fixture = createFixture();
  git(fixture.childRoot, ['checkout', 'HEAD^']);

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
