/**
 * WHAT: Generated effect function create-git-worktree.
 * WHY: each apply run must start from a nuked worktree path before generated files are written.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { telemetry } from '../../../telemetry/harness.js';

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function worktreePathFrom(input: unknown): string {
  const record = objectRecord(input);
  const nested = objectRecord(record.value);
  const original = objectRecord(record.input);
  const candidate = record.worktreePath ?? record.output ?? record.path ?? nested.worktreePath ?? nested.output ?? original.worktreePath ?? original.output;

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : '.worktrees/generated';
}

function rootBlockPathFrom(input: unknown): string {
  const record = objectRecord(input);
  const nested = objectRecord(record.value);
  const original = objectRecord(record.input);
  const candidate = record.rootBlockPath ?? record.root_block ?? nested.rootBlockPath ?? nested.root_block ?? original.rootBlockPath ?? original.root_block;

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'generator-cli';
}

function runGit(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

export function createGitWorktree(input: unknown = {}, ...args: unknown[]): any {
  const worktreePath = worktreePathFrom(input);
  const rootBlockPath = rootBlockPathFrom(input);
  const absolutePath = resolve(process.cwd(), worktreePath);
  const generatedRootPath = resolve(absolutePath, rootBlockPath);
  telemetry('effect:create-git-worktree -> create worktree then remove generated root block', { functionName: 'create-git-worktree', arguments: { worktreePath, absolutePath, rootBlockPath, generatedRootPath }, phase: 'event' });
  void args;
  const record = objectRecord(input);

  try {
    try {
      runGit(['worktree', 'remove', '--force', absolutePath], process.cwd());
    } catch {
      // The path may not be registered as a git worktree yet.
    }

    try {
      runGit(['worktree', 'prune'], process.cwd());
    } catch {
      // Prune is best-effort cleanup after forced removal.
    }

    rmSync(absolutePath, { recursive: true, force: true });
    mkdirSync(dirname(absolutePath), { recursive: true });
    runGit(['worktree', 'add', '--detach', absolutePath, 'HEAD'], process.cwd());
    rmSync(generatedRootPath, { recursive: true, force: true });
    return { ok: true, value: input, ...record, worktreePath, absolutePath, rootBlockPath, generatedRootPath, mode: record.mode ?? 'dry-run', ledger_command: record.ledger_command ?? 'mutate', functionName: 'create-git-worktree', input };
  } catch (error) {
    return { ok: false, value: input, ...record, worktreePath, absolutePath, rootBlockPath, generatedRootPath, error: error instanceof Error ? error.message : String(error), functionName: 'create-git-worktree', input };
  }
}
