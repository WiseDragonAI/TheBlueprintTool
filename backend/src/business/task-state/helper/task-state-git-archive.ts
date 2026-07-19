import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

function git(repositoryRoot: string, args: string[], input?: string | Buffer): string {
  return execFileSync('git', ['-C', repositoryRoot, ...args], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function safeRefPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

/** Archives immutable state artifacts to a writer-owned ref without touching the code worktree or index. */
export function archiveTaskStateArtifacts(input: { repositoryRoot: string; writerId: string; projectId: string; files: string[]; createdAt?: string }): { ref: string; commit: string; files: string[] } {
  const ref = `refs/decision-os/archive/${safeRefPart(input.writerId)}/${safeRefPart(input.projectId)}`;
  const entries = input.files.map((file) => {
    const object = git(input.repositoryRoot, ['hash-object', '-w', '--stdin'], readFileSync(file));
    return { file, name: basename(file).replaceAll('\t', '-').replaceAll('\n', '-'), object };
  }).sort((left, right) => left.name.localeCompare(right.name));
  const tree = git(input.repositoryRoot, ['mktree'], entries.map((entry) => `100644 blob ${entry.object}\t${entry.name}\n`).join(''));
  let parent = '';
  try { parent = git(input.repositoryRoot, ['rev-parse', '--verify', ref]); } catch { parent = ''; }
  const commit = git(input.repositoryRoot, ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Archive task state ${input.projectId} at ${input.createdAt ?? new Date().toISOString()}`]);
  git(input.repositoryRoot, ['update-ref', ref, commit, parent || '0000000000000000000000000000000000000000']);
  return { ref, commit, files: entries.map((entry) => entry.file) };
}

export function createTaskStateArchiver(input: { repositoryRoot: string; writerId: string; projectId: string; remote?: string }) {
  let queue = Promise.resolve<{ ref: string; commit: string; files: string[] } | null>(null);
  return {
    enqueue(files: string[]): Promise<{ ref: string; commit: string; files: string[] } | null> {
      queue = queue.catch(() => null).then(() => {
        if (files.length === 0) return null;
        const archived = archiveTaskStateArtifacts({ ...input, files });
        if (input.remote) git(input.repositoryRoot, ['push', input.remote, `${archived.ref}:${archived.ref}`]);
        return archived;
      });
      return queue;
    },
  };
}
