/**
 * WHAT: Pins the canonical worktree command's bounded filesystem and publication contracts.
 * WHY: Integration safety depends on stable rejection and receipt boundaries before repository mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  assertFeatureName,
  assertReviewedFeatureChild,
  admitPublishedParentDev,
  installRealDependencies,
  publishFeatureChild,
  repairKnownGeneratedSearchIgnore,
  worktreeFailureReceipt,
} from '../../../bin/decision-os-worktree.mjs';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function isCliError(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code: string }).code === code;
}

type ChildPublicationFixture = {
  root: string;
  source: string;
  featureRoot: string;
  childRoot: string;
  baseChildSha: string;
  feature: {
    featureRoot: string;
    featureSha: string;
    reviewedGitlink: string;
    childHead: string;
  };
  parentAdmission: {
    devSha: string;
    publishedDevSha: string;
    decisionOsGitlink: string;
  };
};

function configureGitIdentity(root: string): void {
  git(root, ['config', 'user.name', 'Decision OS Test']);
  git(root, ['config', 'user.email', 'decision-os-test@localhost']);
}

function commitFixtureFile(root: string, fileName: string, content: string): string {
  writeFileSync(join(root, fileName), content);
  git(root, ['add', fileName]);
  git(root, ['commit', '-m', `Update ${fileName}`, '-m', `WHAT: Update ${fileName} in the publication fixture.\n\nWHY: Exercise one exact child transaction boundary.`]);
  return git(root, ['rev-parse', 'HEAD^{commit}']);
}

function createChildPublicationFixture(): ChildPublicationFixture {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-child-publication-'));
  const seedRoot = join(root, 'seed');
  const source = join(root, 'decision-os-data.git');
  const featureRoot = join(root, 'feature');
  const childRoot = join(featureRoot, '.decision-os');
  mkdirSync(seedRoot);
  git(seedRoot, ['init', '-b', 'dev']);
  configureGitIdentity(seedRoot);
  const baseChildSha = commitFixtureFile(seedRoot, 'base.md', 'base\n');
  git(root, ['clone', '--bare', seedRoot, source]);
  mkdirSync(featureRoot);
  git(featureRoot, ['init', '-b', 'feature']);
  configureGitIdentity(featureRoot);
  writeFileSync(join(featureRoot, '.gitmodules'), `[submodule ".decision-os"]\n\tpath = .decision-os\n\turl = ${source}\n`);
  git(featureRoot, ['clone', source, childRoot]);
  configureGitIdentity(childRoot);
  const childHead = commitFixtureFile(childRoot, 'feature.md', 'feature\n');
  git(featureRoot, ['add', '.gitmodules', '.decision-os']);
  git(featureRoot, ['commit', '-m', 'Add reviewed child', '-m', 'WHAT: Record the feature child gitlink and source.\n\nWHY: Exercise exact child publication admission.']);
  const featureSha = git(featureRoot, ['rev-parse', 'HEAD^{commit}']);
  return {
    root,
    source,
    featureRoot,
    childRoot,
    baseChildSha,
    feature: { featureRoot, featureSha, reviewedGitlink: childHead, childHead },
    parentAdmission: { devSha: featureSha, publishedDevSha: featureSha, decisionOsGitlink: baseChildSha },
  };
}

function withChildPublicationFixture(runFixture: (fixture: ChildPublicationFixture) => void): void {
  const fixture = createChildPublicationFixture();
  // WHAT: Remove only the uniquely created publication fixture after its assertion settles.
  // WHY: CLI transaction tests must not leave repositories, hooks, or child remotes in shared temporary state.
  try {
    runFixture(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function advanceChildSource(fixture: ChildPublicationFixture, label: string): string {
  const publisherRoot = join(fixture.root, `publisher-${label}`);
  git(fixture.root, ['clone', fixture.source, publisherRoot]);
  configureGitIdentity(publisherRoot);
  const advancedSourceSha = commitFixtureFile(publisherRoot, `${label}.md`, `${label}\n`);
  git(publisherRoot, ['push', 'origin', `${advancedSourceSha}:refs/heads/dev`]);
  return advancedSourceSha;
}

function gitCommitTree(root: string, basedOn: string): string {
  const tree = git(root, ['rev-parse', `${basedOn}^{tree}`]);
  return execFileSync('git', ['commit-tree', tree], {
    cwd: root,
    encoding: 'utf8',
    input: 'Create unrelated canonical child fixture.\n',
  }).trim();
}

test('integration cleanup admits the verified worktree and feature branch after exact push', () => {
  const source = readFileSync(new URL('../../../bin/decision-os-worktree.mjs', import.meta.url), 'utf8');
  assert.match(source, /\['worktree', 'remove', '--force', feature\.featureRoot\]/);
  assert.match(source, /\['branch', '-D', feature\.branch\]/);
  assert.match(source, /assertPublishedParentDev\(\);\s*initDev\(\{ deferLegacyRelay: true \}\);\s*const parentAdmission = assertPublishedParentDev\(\);\s*const childPublication = publishFeatureChild\(feature, parentAdmission\);/);
  assert.match(source, /parentAdmission,\s*childPublication,/);
});

test('parent publication admission rejects divergence and preserves the exact canonical receipt', () => {
  assert.throws(
    () => admitPublishedParentDev({ devSha: 'a'.repeat(40), publishedDevSha: 'b'.repeat(40), decisionOsGitlink: 'c'.repeat(40) }),
    (error: unknown) => isCliError(error, 'worktree_dev_unpublished'),
  );
  assert.deepEqual(admitPublishedParentDev({
    devSha: 'a'.repeat(40),
    publishedDevSha: 'a'.repeat(40),
    decisionOsGitlink: 'c'.repeat(40),
  }), {
    devSha: 'a'.repeat(40),
    publishedDevSha: 'a'.repeat(40),
    decisionOsGitlink: 'c'.repeat(40),
  });
});

test('child publication advances only the canonical reviewed source and returns the exact lease receipt', () => {
  withChildPublicationFixture((fixture) => {
    const receipt = publishFeatureChild(fixture.feature, fixture.parentAdmission);
    assert.equal(git(fixture.source, ['rev-parse', 'refs/heads/dev']), fixture.feature.childHead);
    assert.equal(receipt.source, fixture.source);
    assert.equal(receipt.reviewedParentSha, fixture.feature.featureSha);
    assert.equal(receipt.reviewedGitlink, fixture.feature.reviewedGitlink);
    assert.equal(receipt.childHead, fixture.feature.childHead);
    assert.equal(receipt.canonicalDevGitlink, fixture.parentAdmission.decisionOsGitlink);
    assert.equal(receipt.observedSourceDevSha, fixture.baseChildSha);
    assert.equal(receipt.refetchedSourceDevSha, fixture.feature.childHead);
    assert.equal(receipt.lease, `refs/heads/dev:${fixture.baseChildSha}`);
  });
});

test('reviewed child binding rejects a clean child HEAD that differs from the parent gitlink', () => {
  withChildPublicationFixture((fixture) => {
    commitFixtureFile(fixture.childRoot, 'mismatch.md', 'mismatch\n');
    assert.throws(
      () => assertReviewedFeatureChild(fixture.featureRoot, fixture.feature.featureSha),
      (error: unknown) => isCliError(error, 'worktree_feature_child_mismatch'),
    );
  });
});

test('child publication rejects a checkout origin override before source mutation', () => {
  withChildPublicationFixture((fixture) => {
    git(fixture.childRoot, ['remote', 'set-url', 'origin', join(fixture.root, 'overridden-source.git')]);
    assert.throws(
      () => publishFeatureChild(fixture.feature, fixture.parentAdmission),
      (error: unknown) => isCliError(error, 'worktree_feature_child_source_override'),
    );
    assert.equal(git(fixture.source, ['rev-parse', 'refs/heads/dev']), fixture.baseChildSha);
  });
});

test('child publication reports exact canonical ancestry failure and rebase recovery', () => {
  withChildPublicationFixture((fixture) => {
    const unrelatedChildSha = gitCommitTree(fixture.childRoot, fixture.feature.childHead);
    assert.throws(
      () => publishFeatureChild(fixture.feature, { ...fixture.parentAdmission, decisionOsGitlink: unrelatedChildSha }),
      (error: unknown) => {
        assert.equal(isCliError(error, 'worktree_feature_child_canonical_ancestry_invalid'), true);
        assert.equal((error as Error).message, `Feature child ${fixture.feature.childHead} does not descend from canonical child ${unrelatedChildSha}.`);
        const instruction = `Rebase the feature worktree onto the latest dev with "git rebase dev" from ${fixture.feature.featureRoot}, resolve any conflicts, then run integration again.`;
        assert.equal((error as Error & { instruction?: string }).instruction, instruction);
        assert.deepEqual(worktreeFailureReceipt(error), {
          ok: false,
          code: 'worktree_feature_child_canonical_ancestry_invalid',
          message: `Feature child ${fixture.feature.childHead} does not descend from canonical child ${unrelatedChildSha}.`,
          instruction,
        });
        return true;
      },
    );
    assert.equal(git(fixture.source, ['rev-parse', 'refs/heads/dev']), fixture.baseChildSha);
  });
});

test('child publication rejects a feature that omits newer source dev history', () => {
  withChildPublicationFixture((fixture) => {
    const advancedSourceSha = advanceChildSource(fixture, 'stale-source');
    assert.throws(
      () => publishFeatureChild(fixture.feature, fixture.parentAdmission),
      (error: unknown) => isCliError(error, 'worktree_feature_child_stale_feature'),
    );
    assert.equal(git(fixture.source, ['rev-parse', 'refs/heads/dev']), advancedSourceSha);
  });
});

test('child publication reports a remote advance when the lease loses its observed source tip', () => {
  withChildPublicationFixture((fixture) => {
    const racerRoot = join(fixture.root, 'lease-racer');
    git(fixture.root, ['clone', fixture.source, racerRoot]);
    configureGitIdentity(racerRoot);
    const advancedSourceSha = commitFixtureFile(racerRoot, 'lease-race.md', 'race\n');
    git(racerRoot, ['push', 'origin', `${advancedSourceSha}:refs/heads/lease-race`]);
    const hook = join(fixture.childRoot, '.git', 'hooks', 'pre-push');
    writeFileSync(hook, `#!/bin/sh\nset -eu\ngit --git-dir='${fixture.source}' update-ref refs/heads/dev '${advancedSourceSha}' '${fixture.baseChildSha}'\n`);
    chmodSync(hook, 0o755);
    assert.throws(
      () => publishFeatureChild(fixture.feature, fixture.parentAdmission),
      (error: unknown) => isCliError(error, 'worktree_feature_child_remote_advanced'),
    );
    assert.equal(git(fixture.source, ['rev-parse', 'refs/heads/dev']), advancedSourceSha);
  });
});

test('child publication preserves a distinct failure code when the observed source tip does not advance', () => {
  withChildPublicationFixture((fixture) => {
    const hook = join(fixture.childRoot, '.git', 'hooks', 'pre-push');
    writeFileSync(hook, '#!/bin/sh\nexit 1\n');
    chmodSync(hook, 0o755);
    assert.throws(
      () => publishFeatureChild(fixture.feature, fixture.parentAdmission),
      (error: unknown) => isCliError(error, 'worktree_feature_child_publication_failed'),
    );
    assert.equal(git(fixture.source, ['rev-parse', 'refs/heads/dev']), fixture.baseChildSha);
  });
});

test('worktree feature names own one portable branch and directory identity', () => {
  assert.equal(assertFeatureName('canonical-worktree-cli'), 'canonical-worktree-cli');
  assert.throws(
    () => assertFeatureName('../dev'),
    (error: unknown) => isCliError(error, 'worktree_name_invalid'),
  );
});

test('canonical dependency installation replaces only the known symlink and preserves its target', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-worktree-dependencies-'));
  const packageRoot = join(root, 'backend');
  const sharedRoot = join(root, 'shared-node-modules');
  const fakeBin = join(root, 'bin');
  const previousPath = process.env.PATH;
  try {
    mkdirSync(packageRoot);
    mkdirSync(sharedRoot);
    mkdirSync(fakeBin);
    writeFileSync(join(packageRoot, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
    writeFileSync(join(packageRoot, 'package-lock.json'), '{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{}}\n');
    writeFileSync(join(sharedRoot, 'preserved.txt'), 'preserved');
    symlinkSync(sharedRoot, join(packageRoot, 'node_modules'), 'dir');
    const fakeNpm = join(fakeBin, 'npm');
    writeFileSync(fakeNpm, `#!/bin/sh
set -eu
prefix=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--prefix' ]; then shift; prefix="$1"; fi
  shift
done
mkdir -p "$prefix/node_modules/tsx/dist"
printf 'fixture' > "$prefix/node_modules/tsx/dist/loader.mjs"
`);
    chmodSync(fakeNpm, 0o755);
    process.env.PATH = `${fakeBin}:${previousPath}`;

    const receipt = installRealDependencies(packageRoot, 'tsx/dist/loader.mjs');

    assert.equal(receipt.action, 'installed');
    assert.equal(lstatSync(join(packageRoot, 'node_modules')).isSymbolicLink(), false);
    assert.equal(readFileSync(join(packageRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs'), 'utf8'), 'fixture');
    assert.equal(readFileSync(join(sharedRoot, 'preserved.txt'), 'utf8'), 'preserved');
  } finally {
    process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
});

test('dev initialization repairs only the reproduced generated Search ignore mutation', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-worktree-generated-ignore-'));
  const ignoreRoot = join(root, 'Search', '.decision-os');
  const ignoreFile = join(ignoreRoot, '.gitignore');
  try {
    mkdirSync(ignoreRoot, { recursive: true });
    git(root, ['init', '-b', 'dev']);
    git(root, ['config', 'user.name', 'Decision OS Test']);
    git(root, ['config', 'user.email', 'decision-os-test@localhost']);
    writeFileSync(ignoreFile, '/cache/\n/executor-analysis/\n/runs/\n');
    git(root, ['add', 'Search/.decision-os/.gitignore']);
    git(root, ['commit', '-m', 'Add fixture', '-m', 'WHAT: Add the generated-ignore fixture.\n\nWHY: Exercise exact repair admission.']);
    writeFileSync(ignoreFile, '/cache/\n/frontend-telemetry.jsonl*\n/runs/\n');

    assert.deepEqual(repairKnownGeneratedSearchIgnore(root), ['Search/.decision-os/.gitignore']);
    assert.equal(readFileSync(ignoreFile, 'utf8'), '/cache/\n/executor-analysis/\n/runs/\n');
    assert.equal(git(root, ['status', '--porcelain=v1']), '');

    writeFileSync(ignoreFile, '/cache/\n/operator-change/\n/runs/\n');
    assert.throws(
      () => repairKnownGeneratedSearchIgnore(root),
      (error: unknown) => isCliError(error, 'worktree_dev_tracked_dirty'),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
