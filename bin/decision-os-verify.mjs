#!/usr/bin/env node
/**
 * WHAT: Runs one verification command under a repository-wide exclusive lease.
 * WHY: A read-only admission check has a race in which several agents can all observe GO.
 */
import { mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const scriptRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decisionOsRoot = basename(dirname(scriptRepoRoot)) === '.worktrees'
  ? dirname(dirname(scriptRepoRoot))
  : scriptRepoRoot;
const forbiddenShells = new Set(['bash', 'dash', 'fish', 'sh', 'zsh']);

export function verificationLockFile(env = process.env) {
  return resolve(env.DECISION_OS_VERIFICATION_LOCK || resolve(decisionOsRoot, '.decision-os', 'runtime', 'verification.lock'));
}

export function verificationCommand(argv) {
  const separator = argv[0] === '--' ? 1 : 0;
  const command = argv.slice(separator);
  if (command.length === 0) throw new Error('Usage: decision-os-verify -- <test-or-typecheck-command> [args...]');
  if (forbiddenShells.has(basename(command[0]))) {
    throw new Error('Verification lease accepts one direct command; shell wrappers are not allowed.');
  }
  return command;
}

export async function runVerification(argv = process.argv.slice(2), env = process.env) {
  let command;
  try {
    command = verificationCommand(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 64;
  }
  const lockFile = verificationLockFile(env);
  mkdirSync(dirname(lockFile), { recursive: true });
  const probe = spawnSync('flock', ['--exclusive', '--nonblock', lockFile, 'true'], { stdio: 'ignore' });
  if (probe.status !== 0) process.stdout.write(`WAIT verification=${lockFile}\n`);

  const lockedCommand = 'printf "GO verification=%s\\n" "$DECISION_OS_VERIFICATION_LOCK_FILE"; exec "$@"';
  const child = spawn('flock', [
    '--exclusive', lockFile,
    'sh', '-c', lockedCommand, 'decision-os-verify',
    command[0], ...command.slice(1),
  ], {
    env: { ...env, DECISION_OS_VERIFICATION_LOCK_FILE: lockFile },
    stdio: 'inherit',
  });
  const forward = (signal) => { if (child.exitCode === null) child.kill(signal); };
  process.once('SIGINT', () => forward('SIGINT'));
  process.once('SIGTERM', () => forward('SIGTERM'));
  return await new Promise((resolveExit) => {
    child.once('error', (error) => {
      process.stderr.write(`Could not start verification lease: ${error.message}\n`);
      resolveExit(1);
    });
    child.once('close', (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runVerification();
}
