/**
 * WHAT: Runs one bounded child process and returns normalized settlement evidence.
 * WHY: Git, npm, checks, and pushes must reject partial or unadmitted command state.
 */
import { spawnSync } from 'node:child_process';
import { primaryRoot } from '../config.mjs';
import { WorktreeCliError } from '../worktree-cli-error.mjs';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? primaryRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    maxBuffer: 16 * 1024 * 1024,
    stdio: options.inherit ? 'inherit' : 'pipe',
    timeout: options.timeout ?? 120_000,
  });
  const accepted = options.accepted ?? [0];
  // WHAT: Reject every unadmitted command settlement.
  // WHY: Worktree lifecycle mutation cannot continue from partial Git, npm, verification, or push state.
  if (result.error || !accepted.includes(result.status ?? 3)) {
    const detail = String(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`).trim();
    throw new WorktreeCliError(options.code ?? 'worktree_command_failed', `${command} ${args[0] ?? ''} failed: ${detail}`, 3);
  }
  return {
    status: result.status ?? 0,
    stdout: options.raw ? String(result.stdout ?? '') : String(result.stdout ?? '').trim(),
    stderr: options.raw ? String(result.stderr ?? '') : String(result.stderr ?? '').trim(),
  };
}
