/**
 * WHAT: Archives immutable task-state artifacts on writer-owned Git refs and restores them on demand.
 * WHY: Maintenance must never stage operator files, move the shared branch, or block a request.
 */
import { execFile } from 'node:child_process';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

function gitAsync(repositoryRoot: string, args: string[], input?: string | Buffer): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = execFile('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error);
      else resolvePromise(String(stdout).trim());
    });
    if (input !== undefined) child.stdin?.end(input);
  });
}

function atomicWrite(file: string, bytes: Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  const descriptor = openSync(temporary, 'wx');
  try { writeSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  renameSync(temporary, file);
}

function safeRefPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function treeEntries(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of text.split('\n').filter(Boolean)) {
    const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\t(.+)$/);
    if (match) result.set(match[4], `${match[1]} ${match[2]} ${match[3]}\t${match[4]}\n`);
  }
  return result;
}

async function archiveTaskStateArtifactsAsync(input: { repositoryRoot: string; writerId: string; projectId: string; files: string[]; createdAt?: string }): Promise<{ ref: string; commit: string; files: string[] }> {
  const ref = `refs/decision-os/archive/${safeRefPart(input.writerId)}/${safeRefPart(input.projectId)}`;
  let parent = '';
  try { parent = await gitAsync(input.repositoryRoot, ['rev-parse', '--verify', ref]); } catch { parent = ''; }
  const entries = [] as Array<{ file: string; name: string; object: string }>;
  for (const file of input.files) {
    entries.push({ file, name: basename(file).replaceAll('\t', '-').replaceAll('\n', '-'), object: await gitAsync(input.repositoryRoot, ['hash-object', '-w', '--stdin'], readFileSync(file)) });
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const accumulated = parent ? treeEntries(await gitAsync(input.repositoryRoot, ['ls-tree', parent])) : new Map<string, string>();
  for (const entry of entries) accumulated.set(entry.name, `100644 blob ${entry.object}\t${entry.name}\n`);
  const tree = await gitAsync(input.repositoryRoot, ['mktree'], [...accumulated].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value).join(''));
  const commit = await gitAsync(input.repositoryRoot, ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Archive task state ${input.projectId} at ${input.createdAt ?? new Date().toISOString()}`]);
  await gitAsync(input.repositoryRoot, ['update-ref', ref, commit, parent || '0000000000000000000000000000000000000000']);
  return { ref, commit, files: entries.map((entry) => entry.file) };
}

export function createTaskStateArchiver(input: { repositoryRoot: string; writerId: string; projectId: string; remote?: string }) {
  let queue = Promise.resolve<{ ref: string; commit: string; files: string[] } | null>(null);
  return {
    enqueue(files: string[]): Promise<{ ref: string; commit: string; files: string[] } | null> {
      queue = queue.catch(() => null).then(() => {
        if (files.length === 0) return null;
        return archiveTaskStateArtifactsAsync({ ...input, files });
      }).then(async (archived) => {
        if (!archived) return null;
        if (input.remote) await gitAsync(input.repositoryRoot, ['push', input.remote, `${archived.ref}:${archived.ref}`]);
        return archived;
      });
      return queue;
    },
    async restore(targetDirectory: string, commit = ''): Promise<string[]> {
      const ref = `refs/decision-os/archive/${safeRefPart(input.writerId)}/${safeRefPart(input.projectId)}`;
      const revision = commit || await gitAsync(input.repositoryRoot, ['rev-parse', '--verify', ref]);
      const names = (await gitAsync(input.repositoryRoot, ['ls-tree', '--name-only', revision])).split('\n').filter(Boolean);
      for (const name of names) {
        if (basename(name) !== name) throw new Error('invalid_task_archive_entry');
        const bytes = Buffer.from(await new Promise<string>((resolvePromise, reject) => {
          execFile('git', ['-C', input.repositoryRoot, 'show', `${revision}:${name}`], { encoding: 'buffer' }, (error, stdout) => {
            if (error) reject(error);
            else resolvePromise(Buffer.from(stdout).toString('base64'));
          });
        }), 'base64');
        atomicWrite(resolve(targetDirectory, name), bytes);
      }
      return names;
    },
  };
}
