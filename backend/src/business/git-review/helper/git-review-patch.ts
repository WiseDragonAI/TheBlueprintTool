/**
 * WHAT: Reads and mutates reviewable Git patches for a repository nested in a Decision OS workspace.
 * WHY: Markdown widgets need one path-safe, hash-guarded Git boundary for root repositories and subrepositories.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type GitReviewHunk = { id: string; header: string; patch: string };
export type GitReviewFile = { path: string; patch: string; hunks: GitReviewHunk[] };

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function resolveGitReviewRepository(workspaceRoot: string, repository: string): string {
  const normalized = String(repository || '.').trim() || '.';
  const candidate = resolve(workspaceRoot, normalized);
  if (!inside(workspaceRoot, candidate)) throw new Error('Repository path must remain inside the project workspace.');
  const topLevel = execFileSync('git', ['-C', candidate, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  if (resolve(topLevel) !== candidate) throw new Error('Repository path must identify a Git worktree root.');
  return candidate;
}

function safeTarget(repositoryRoot: string, target: string): string {
  const normalized = String(target || '.').trim() || '.';
  const candidate = resolve(repositoryRoot, normalized);
  if (!inside(repositoryRoot, candidate)) throw new Error('Review target must remain inside the selected repository.');
  return relative(repositoryRoot, candidate) || '.';
}

function git(repositoryRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

export function gitReviewPatchHash(patch: string): string {
  return createHash('sha256').update(patch).digest('hex');
}

export function splitGitReviewPatch(patch: string): GitReviewFile[] {
  if (!patch.trim()) return [];
  const starts = [...patch.matchAll(/^diff --git /gm)].map((match) => match.index ?? 0);
  return starts.map((start, fileIndex) => {
    const filePatch = patch.slice(start, starts[fileIndex + 1] ?? patch.length);
    const pathMatch = filePatch.match(/^diff --git a\/(.+) b\/(.+)$/m);
    const path = pathMatch?.[2] ?? pathMatch?.[1] ?? 'unknown';
    const firstHunk = filePatch.search(/^@@ /m);
    const prefix = firstHunk < 0 ? filePatch : filePatch.slice(0, firstHunk);
    const hunkStarts = [...filePatch.matchAll(/^@@ /gm)].map((match) => match.index ?? 0);
    const hunks = hunkStarts.map((hunkStart, hunkIndex) => {
      const body = filePatch.slice(hunkStart, hunkStarts[hunkIndex + 1] ?? filePatch.length);
      const header = body.split('\n', 1)[0];
      return { id: `${fileIndex + 1}:${hunkIndex + 1}`, header, patch: `${prefix}${body}` };
    });
    return { path, patch: filePatch, hunks };
  });
}

export function readGitReview(input: { workspaceRoot: string; repository: string; target: string }) {
  const repositoryRoot = resolveGitReviewRepository(input.workspaceRoot, input.repository);
  const target = safeTarget(repositoryRoot, input.target);
  const patch = git(repositoryRoot, ['diff', 'HEAD', '--no-ext-diff', '--no-color', '--unified=3', '--', target]);
  const stagedPatch = git(repositoryRoot, ['diff', '--cached', '--no-ext-diff', '--no-color', '--unified=3', '--', target]);
  return {
    repository: relative(input.workspaceRoot, repositoryRoot) || '.',
    target,
    patch,
    patchHash: gitReviewPatchHash(patch),
    stagedPatchHash: gitReviewPatchHash(stagedPatch),
    files: splitGitReviewPatch(patch),
    stagedFiles: splitGitReviewPatch(stagedPatch),
  };
}

export function applyGitReviewPatch(input: { workspaceRoot: string; repository: string; target: string; expectedPatchHash: string; patch: string; operation: 'stage' | 'unstage' }) {
  const current = readGitReview(input);
  if (current.patchHash !== input.expectedPatchHash) throw new Error('The displayed patch is stale. Refresh the review before staging.');
  if (!input.patch.trim() || !current.patch.includes(input.patch)) throw new Error('The submitted patch is not part of the current review.');
  const args = ['-C', resolveGitReviewRepository(input.workspaceRoot, input.repository), 'apply', '--cached', '--unidiff-zero', '--whitespace=nowarn'];
  if (input.operation === 'unstage') args.push('--reverse');
  args.push('-');
  const result = spawnSync('git', args, { input: input.patch, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || 'Git could not apply the selected hunk.').trim());
  return readGitReview(input);
}

export function readProtectedGitPatch(workspaceRoot: string): string {
  try {
    return git(resolveGitReviewRepository(workspaceRoot, '.'), ['diff', '--cached', '--no-ext-diff', '--no-color', '--unified=0']);
  } catch {
    return '';
  }
}
