/**
 * WHAT: Replays the exact outer-repository GateTest byte sequence into the authoritative child Git repository.
 * WHY: The unified diff editor needs adjacent immutable child-repository revisions instead of an initialization-only baseline.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const EXPECTED_REVISION_COUNT = 17;
const BACKUP_REF = 'refs/decision-os/backups/gatetest-history-migration-20260731';

function git(cwd, args, options = {}) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    ...options,
  }).trim();
}

function gitExit(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  }).status ?? 1;
}

function sourceRevision(cwd, commit, path) {
  const metadata = git(cwd, [
    'show',
    '-s',
    '--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%s',
    commit,
  ]).split('\0');
  return {
    commit,
    blob: git(cwd, ['rev-parse', `${commit}:${path}`]),
    authorName: metadata[0],
    authorEmail: metadata[1],
    authorDate: metadata[2],
    committerName: metadata[3],
    committerEmail: metadata[4],
    committerDate: metadata[5],
    subject: metadata[6],
  };
}

function commitEnvironment(revision) {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: revision.authorName,
    GIT_AUTHOR_EMAIL: revision.authorEmail,
    GIT_AUTHOR_DATE: revision.authorDate,
    GIT_COMMITTER_NAME: revision.committerName,
    GIT_COMMITTER_EMAIL: revision.committerEmail,
    GIT_COMMITTER_DATE: revision.committerDate,
  };
}

function copyBlob(sourceRepo, targetRepo, blob) {
  const content = execFileSync('git', ['cat-file', 'blob', blob], {
    cwd: sourceRepo,
    encoding: 'buffer',
  });
  const copied = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: targetRepo,
    encoding: 'utf8',
    input: content,
  }).trim();

  // WHAT: Reject any object transfer whose target identity differs from the verified source blob.
  // WHY: The replay must preserve exact bytes rather than merely equivalent rendered text.
  if (copied !== blob) {
    throw new Error(`Copied GateTest blob identity differs: expected ${blob}, received ${copied}.`);
  }
}

function replayCommit(targetRepo, parent, targetPath, revision, indexFile) {
  const environment = { ...process.env, GIT_INDEX_FILE: indexFile };
  git(targetRepo, ['read-tree', parent], { env: environment });
  git(targetRepo, ['update-index', '--add', '--cacheinfo', `100644,${revision.blob},${targetPath}`], {
    env: environment,
  });
  const tree = git(targetRepo, ['write-tree'], { env: environment });
  const message = [
    revision.subject,
    '',
    'WHAT: Replay the exact GateTest Markdown bytes from the outer authored history.',
    '',
    'WHY: The child repository must expose the real adjacent baseline used by the unified diff editor.',
  ].join('\n');
  return git(targetRepo, ['commit-tree', tree, '-p', parent], {
    env: commitEnvironment(revision),
    input: message,
  });
}

function topPathBlobs(cwd, ref, path, count) {
  const commits = git(cwd, ['log', '--format=%H', `-${count}`, ref, '--', path]).split('\n').filter(Boolean);
  return commits.map((commit) => git(cwd, ['rev-parse', `${commit}:${path}`]));
}

const [
  sourceRepoArgument,
  targetRepoArgument,
  sourcePath = '.decision-os/pipeline-prompts/GateTest.md',
  targetPath = 'pipeline-prompts/GateTest.md',
  targetRef = 'refs/heads/main',
  applyFlag,
] = process.argv.slice(2);

// WHAT: Reject incomplete invocations before any Git object is created.
// WHY: A migration with an implicit repository target could update the wrong authored owner.
if (!sourceRepoArgument || !targetRepoArgument) {
  throw new Error(
    'Usage: migrate-gatetest-authored-history.mjs <source-repo> <target-repo> [source-path] [target-path] [target-ref] [--apply]',
  );
}

const sourceRepo = resolve(sourceRepoArgument);
const targetRepo = resolve(targetRepoArgument);
const sourceCommits = git(sourceRepo, ['log', '--follow', '--format=%H', '--', sourcePath])
  .split('\n')
  .filter(Boolean)
  .reverse();

// WHAT: Stop when the verified outer authored sequence is not exactly seventeen revisions.
// WHY: Replaying a partial or expanded corpus would manufacture a different GateTest history.
if (sourceCommits.length !== EXPECTED_REVISION_COUNT) {
  throw new Error(`Expected ${EXPECTED_REVISION_COUNT} GateTest source revisions; found ${sourceCommits.length}.`);
}

const revisions = sourceCommits.map((commit) => sourceRevision(sourceRepo, commit, sourcePath));
const targetHead = git(targetRepo, ['rev-parse', targetRef]);
const targetTree = git(targetRepo, ['rev-parse', `${targetHead}^{tree}`]);
const targetStatusBefore = git(targetRepo, ['status', '--short']);
const targetBlob = git(targetRepo, ['rev-parse', `${targetHead}:${targetPath}`]);

// WHAT: Reject migration when the authoritative file differs from the newest verified source bytes.
// WHY: The replay is safe only when its last revision returns the child worktree to its current exact bytes.
if (targetBlob !== revisions.at(-1)?.blob) {
  throw new Error('The authoritative GateTest bytes do not match the newest outer authored revision.');
}

// WHAT: Reject migration when the authoritative GateTest path has tracked worktree changes.
// WHY: Updating history while this owner path is dirty could conceal operator-authored bytes.
if (gitExit(targetRepo, ['diff', '--quiet', '--', targetPath]) !== 0) {
  throw new Error('The authoritative GateTest worktree path is modified.');
}

// WHAT: Reject migration when the authoritative GateTest path has protected staged changes.
// WHY: The migration must never overwrite or rebase an operator-approved index hunk.
if (gitExit(targetRepo, ['diff', '--cached', '--quiet', '--', targetPath]) !== 0) {
  throw new Error('The authoritative GateTest index path is staged.');
}

const expectedNewestFirst = revisions.map((revision) => revision.blob).reverse();
const currentNewest = topPathBlobs(targetRepo, targetRef, targetPath, EXPECTED_REVISION_COUNT);
const alreadyMigrated = currentNewest.length === EXPECTED_REVISION_COUNT
  && currentNewest.every((blob, index) => blob === expectedNewestFirst[index]);

// WHAT: Return an idempotent success when the newest child revisions already match the verified sequence.
// WHY: Re-running the operational migration must not duplicate authored history.
if (alreadyMigrated) {
  process.stdout.write(`${JSON.stringify({
    status: 'already_migrated',
    targetHead,
    revisionCount: EXPECTED_REVISION_COUNT,
    finalBlob: targetBlob,
  }, null, 2)}\n`);
  process.exit(0);
}

// WHAT: Require an explicit mutation flag after every source and target invariant has passed.
// WHY: The default invocation is an audit and must not advance the authoritative child branch.
if (applyFlag !== '--apply') {
  process.stdout.write(`${JSON.stringify({
    status: 'ready',
    targetHead,
    revisionCount: EXPECTED_REVISION_COUNT,
    oldestBlob: revisions[0].blob,
    finalBlob: revisions.at(-1)?.blob,
  }, null, 2)}\n`);
  process.exit(0);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), 'decision-os-gatetest-history-'));
const indexFile = join(temporaryRoot, 'index');
let nextHead = targetHead;
try {
  git(targetRepo, ['update-ref', BACKUP_REF, targetHead]);
  for (const revision of revisions) {
    copyBlob(sourceRepo, targetRepo, revision.blob);
    nextHead = replayCommit(targetRepo, nextHead, targetPath, revision, indexFile);
  }
  const nextTree = git(targetRepo, ['rev-parse', `${nextHead}^{tree}`]);

  // WHAT: Stop before branch movement when the replay changes the final repository tree.
  // WHY: Historical migration may add commits but must leave every current byte unchanged.
  if (nextTree !== targetTree) {
    throw new Error('The replayed tip tree differs from the original authoritative tree.');
  }
  git(targetRepo, ['update-ref', targetRef, nextHead, targetHead]);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const targetStatusAfter = git(targetRepo, ['status', '--short']);
const migratedNewest = topPathBlobs(targetRepo, targetRef, targetPath, EXPECTED_REVISION_COUNT);

// WHAT: Fail when branch movement changes any pre-existing child worktree status.
// WHY: Unrelated authored and runtime state belongs to the operator and must remain byte-for-byte scoped.
if (targetStatusAfter !== targetStatusBefore) {
  throw new Error('The child worktree status changed during the history-only migration.');
}

// WHAT: Fail when the newest child revisions do not exactly match the outer sequence.
// WHY: Commit count alone cannot prove historical byte order.
if (
  migratedNewest.length !== EXPECTED_REVISION_COUNT
  || !migratedNewest.every((blob, index) => blob === expectedNewestFirst[index])
) {
  throw new Error('The migrated GateTest blob sequence does not match the verified outer history.');
}

process.stdout.write(`${JSON.stringify({
  status: 'migrated',
  previousHead: targetHead,
  targetHead: nextHead,
  backupRef: BACKUP_REF,
  revisionCount: EXPECTED_REVISION_COUNT,
  finalBlob: targetBlob,
  worktreeStatusPreserved: true,
}, null, 2)}\n`);
