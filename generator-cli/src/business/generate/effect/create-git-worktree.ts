/**
 * WHAT: Git worktree creation effect.
 * WHY: apply mode must materialize each run in a fresh worktree under ./.worktrees.
 */
import { dirname, resolve } from 'node:path';
import type { FileSystemPort, ProcessPort, Result } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { nodeProcess } from '../../../lib/node-test/node-process.js';

export async function createGitWorktree(
  worktreePath: string,
  ports: { fs?: FileSystemPort; process?: ProcessPort; cwd?: string } = {},
): Promise<Result<string>> {
  const fs = ports.fs ?? nodeFileSystem;
  const processPort = ports.process ?? nodeProcess;
  const cwd = ports.cwd ?? process.cwd();
  const absolutePath = resolve(cwd, worktreePath);
  await processPort.exec(`git worktree remove --force "${absolutePath}"`, cwd);
  await processPort.exec('git worktree prune', cwd);
  await fs.rm(absolutePath);
  await fs.mkdir(dirname(absolutePath));
  const head = await processPort.exec('git rev-parse --verify HEAD', cwd);

  // WHY: git cannot create a worktree before the repository has a HEAD commit.
  // WHAT: return a clear failure instead of silently creating a non-worktree directory.
  if (head.exitCode !== 0) {
    return { ok: false, error: 'Cannot create git worktree because this repository has no HEAD commit.' };
  }

  const result = await processPort.exec(`git worktree add --detach "${absolutePath}" HEAD`, cwd);

  // WHY: worktree creation is an external IO boundary that can fail.
  // WHAT: surface stderr as the effect result.
  if (result.exitCode !== 0) {
    return { ok: false, error: result.stderr || result.stdout };
  }

  return { ok: true, value: absolutePath };
}
