#!/usr/bin/env node
/**
 * WHAT: Runs one verification command under a repository-wide exclusive lease.
 * WHY: A read-only admission check has a race in which several agents can all observe GO.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const scriptRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const isIsolatedWorktree = basename(dirname(scriptRepoRoot)) === '.worktrees';
const decisionOsRoot = isIsolatedWorktree
  ? dirname(dirname(scriptRepoRoot))
  : scriptRepoRoot;
const forbiddenShells = new Set(['bash', 'dash', 'fish', 'sh', 'zsh']);
const maxNodeTestConcurrency = 3;
const dependencyPackages = [
  { name: 'frontend', loader: 'tsx/dist/esm/index.mjs' },
  { name: 'backend', loader: 'tsx/dist/loader.mjs' },
];

function realPathOrNull(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function pathEntryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function provisionWorktreeDependencies(repoRoot = scriptRepoRoot, sharedDevRoot = resolve(decisionOsRoot, '.worktrees', 'dev')) {
  // WHAT: Keep the dependency-owning dev checkout unchanged when it verifies itself.
  // WHY: The shared source must remain a real installation instead of becoming a self-referential link.
  if (resolve(repoRoot) === resolve(sharedDevRoot)) return [];

  const provisioned = [];
  for (const dependencyPackage of dependencyPackages) {
    const packageRoot = resolve(repoRoot, dependencyPackage.name);
    const sharedPackageRoot = resolve(sharedDevRoot, dependencyPackage.name);
    const dependencyPath = resolve(packageRoot, 'node_modules');
    const sharedDependencyPath = resolve(sharedPackageRoot, 'node_modules');
    const sharedLoaderPath = resolve(sharedDependencyPath, dependencyPackage.loader);
    const lockFile = resolve(packageRoot, 'package-lock.json');
    const sharedLockFile = resolve(sharedPackageRoot, 'package-lock.json');
    const dependencyEntryExists = pathEntryExists(dependencyPath);
    const dependencyEntry = realPathOrNull(dependencyPath);

    // WHAT: Preserve a real package installation already owned by the current worktree.
    // WHY: A feature that intentionally installed changed dependencies must not be overwritten or compared with dev.
    if (dependencyEntryExists && !lstatSync(dependencyPath).isSymbolicLink()) continue;
    // WHAT: Refuse shared dependencies when the feature worktree changes the package lock.
    // WHY: A dependency link is valid only while the feature and dev dependency contracts are byte-identical.
    if (readFileSync(lockFile, 'utf8') !== readFileSync(sharedLockFile, 'utf8')) {
      throw new Error(`${dependencyPackage.name}/package-lock.json differs from dev; run npm --prefix ${dependencyPackage.name} ci --ignore-scripts in this worktree.`);
    }
    // WHAT: Require the package-specific tsx entrypoint before creating a shared dependency link.
    // WHY: A partial dev installation would defer the same environment failure until after test admission.
    if (!existsSync(sharedLoaderPath)) {
      throw new Error(`Shared ${dependencyPackage.name} dependencies are unavailable at ${sharedDependencyPath}; install them in .worktrees/dev.`);
    }
    // WHAT: Accept only an existing link that resolves to the canonical dev dependency tree.
    // WHY: Reusing an arbitrary or stale worktree link makes verification depend on unrelated checkout lifetime.
    if (dependencyEntry === realpathSync(sharedDependencyPath)) continue;
    // WHAT: Reject an existing noncanonical dependency link instead of replacing it.
    // WHY: The verifier must not destroy agent-owned filesystem state to repair admission.
    if (dependencyEntryExists) {
      throw new Error(`${dependencyPath} does not point to ${sharedDependencyPath}; remove it explicitly before verification.`);
    }

    try {
      symlinkSync(sharedDependencyPath, dependencyPath, 'dir');
    } catch (error) {
      // WHAT: Accept a canonical link created concurrently by another verifier in the same worktree.
      // WHY: Dependency admission occurs before the repository lease and must remain idempotent under simultaneous starts.
      if (error?.code === 'EEXIST' && realpathSync(dependencyPath) === realpathSync(sharedDependencyPath)) continue;
      throw error;
    }
    provisioned.push(dependencyPath);
  }
  return provisioned;
}

function ownsNodeTestRunner(command) {
  return ['node', 'nodejs'].includes(basename(command[0])) && command.slice(1).includes('--test');
}

function boundedNodeTestCommand(command) {
  if (!ownsNodeTestRunner(command)) return command;
  const bounded = [command[0]];
  let concurrencyFound = false;
  for (let index = 1; index < command.length; index += 1) {
    const argument = command[index];
    if (argument === '--test-concurrency') {
      const requested = Number.parseInt(command[index + 1] ?? '', 10);
      bounded.push(argument, String(Number.isInteger(requested) && requested > 0
        ? Math.min(requested, maxNodeTestConcurrency)
        : maxNodeTestConcurrency));
      index += 1;
      concurrencyFound = true;
      continue;
    }
    if (argument.startsWith('--test-concurrency=')) {
      const requested = Number.parseInt(argument.slice('--test-concurrency='.length), 10);
      bounded.push(`--test-concurrency=${Number.isInteger(requested) && requested > 0
        ? Math.min(requested, maxNodeTestConcurrency)
        : maxNodeTestConcurrency}`);
      concurrencyFound = true;
      continue;
    }
    bounded.push(argument);
  }
  if (!concurrencyFound) bounded.splice(1, 0, `--test-concurrency=${maxNodeTestConcurrency}`);
  return bounded;
}

function canonicalTsconfigPath(value, cwd, repoRoot) {
  const candidate = resolve(cwd, value);
  const repositoryRelative = relative(repoRoot, candidate);
  // WHAT: Reject a tsx configuration outside the checkout that owns the verification command.
  // WHY: An inherited absolute path into dev or main makes an isolated feature test load the wrong source aliases.
  if (repositoryRelative === '..' || repositoryRelative.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(repositoryRelative)) {
    throw new Error(`TSX_TSCONFIG_PATH must belong to the current checkout: ${candidate}`);
  }
  // WHAT: Reject a nonexistent tsx configuration before acquiring the repository verification lease.
  // WHY: A child launched from a temporary cwd otherwise fails late and can retain the lease through an open handle.
  if (!existsSync(candidate)) throw new Error(`TSX_TSCONFIG_PATH does not exist: ${candidate}`);
  return candidate;
}

export function normalizeVerificationTsconfigCommand(command, cwd = process.cwd(), repoRoot = scriptRepoRoot) {
  const normalized = [...command];
  // WHAT: Leave commands without the env executable unchanged at the argument level.
  // WHY: Their inherited environment is normalized separately without guessing a package configuration.
  if (basename(normalized[0] ?? '') !== 'env') return normalized;
  let effectiveCwd = cwd;
  for (let index = 1; index < normalized.length; index += 1) {
    const argument = normalized[index];
    // WHAT: Resolve GNU env's inline chdir option before interpreting relative environment assignments.
    // WHY: TSX_TSCONFIG_PATH is relative to the directory in which env starts its child command.
    if (argument.startsWith('--chdir=')) {
      effectiveCwd = resolve(cwd, argument.slice('--chdir='.length));
      continue;
    }
    // WHAT: Resolve GNU env's split chdir option before interpreting relative environment assignments.
    // WHY: Both supported spellings must produce the same absolute tsx configuration authority.
    if (argument === '--chdir' || argument === '-C') {
      effectiveCwd = resolve(cwd, normalized[index + 1] ?? '');
      index += 1;
      continue;
    }
    // WHAT: Canonicalize the explicit tsx configuration assignment passed through env.
    // WHY: Descendant processes can change cwd, so they must inherit one absolute checkout-owned path.
    if (argument.startsWith('TSX_TSCONFIG_PATH=')) {
      const value = argument.slice('TSX_TSCONFIG_PATH='.length);
      normalized[index] = `TSX_TSCONFIG_PATH=${canonicalTsconfigPath(value, effectiveCwd, repoRoot)}`;
    }
  }
  return normalized;
}

export function normalizeVerificationEnvironment(env, cwd = process.cwd(), repoRoot = scriptRepoRoot) {
  const normalized = { ...env };
  // WHAT: Preserve an environment that does not select a tsx configuration.
  // WHY: Non-tsx checks must not acquire an unrelated backend or frontend configuration.
  if (!normalized.TSX_TSCONFIG_PATH) return normalized;
  normalized.TSX_TSCONFIG_PATH = canonicalTsconfigPath(normalized.TSX_TSCONFIG_PATH, cwd, repoRoot);
  return normalized;
}

export function verificationLockFile(env = process.env) {
  return resolve(env.DECISION_OS_VERIFICATION_LOCK || resolve(decisionOsRoot, '.decision-os', 'runtime', 'verification.lock'));
}

export function verificationCommand(argv, cwd = process.cwd(), repoRoot = scriptRepoRoot) {
  const separator = argv[0] === '--' ? 1 : 0;
  const command = argv.slice(separator);
  if (command.length === 0) throw new Error('Usage: decision-os-verify -- <test-or-typecheck-command> [args...]');
  if (forbiddenShells.has(basename(command[0]))) {
    throw new Error('Verification lease accepts one direct command; shell wrappers are not allowed.');
  }
  return boundedNodeTestCommand(normalizeVerificationTsconfigCommand(command, cwd, repoRoot));
}

export function verificationOwner(lockFile) {
  try {
    const owner = JSON.parse(readFileSync(lockFile, 'utf8'));
    // WHAT: Return only a complete lease-owner record written by the active holder.
    // WHY: A stale, empty, or partially written lock file must not produce misleading ownership diagnostics.
    if (!Number.isInteger(owner.pid) || owner.pid <= 0 || typeof owner.cwd !== 'string' || typeof owner.command !== 'string') return null;
    return owner;
  } catch {
    return null;
  }
}

export function formatVerificationWait(lockFile, owner) {
  const prefix = `WAIT verification=${lockFile}`;
  // WHAT: Include the active holder identity when the lock file contains a valid owner record.
  // WHY: A waiting agent needs the owning PID, worktree, and command without repeatedly polling the process table.
  if (owner) return `${prefix} owner_pid=${owner.pid} owner_cwd=${owner.cwd} owner_command=${owner.command}`;
  return prefix;
}

export async function runVerification(argv = process.argv.slice(2), env = process.env) {
  let command;
  let childEnvironment;
  try {
    command = verificationCommand(argv);
    childEnvironment = normalizeVerificationEnvironment(env);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 64;
  }
  try {
    // WHAT: Provision shared dependencies only for linked iteration worktrees.
    // WHY: The primary checkout is not an iteration target and must never be mutated as a verifier side effect.
    if (isIsolatedWorktree) provisionWorktreeDependencies();
  } catch (error) {
    process.stderr.write(`Could not provision worktree dependencies: ${error instanceof Error ? error.message : String(error)}\n`);
    return 66;
  }
  const lockFile = verificationLockFile(env);
  mkdirSync(dirname(lockFile), { recursive: true });
  const probe = spawnSync('flock', ['--exclusive', '--nonblock', lockFile, 'true'], { stdio: 'ignore' });
  // WHAT: Report the current lease holder before joining the blocking flock queue.
  // WHY: The prior path exposed only the lock path and forced repeated workload-status and ps calls to identify active verification.
  if (probe.status !== 0) process.stdout.write(`${formatVerificationWait(lockFile, verificationOwner(lockFile))}\n`);

  const lockedCommand = 'printf \'{"pid":%s,"cwd":%s,"command":%s}\' "$$" "$DECISION_OS_VERIFICATION_OWNER_CWD" "$DECISION_OS_VERIFICATION_OWNER_COMMAND" > "$DECISION_OS_VERIFICATION_LOCK_FILE"; printf "GO verification=%s\\n" "$DECISION_OS_VERIFICATION_LOCK_FILE"; exec "$@"';
  const child = spawn('flock', [
    '--exclusive', lockFile,
    'sh', '-c', lockedCommand, 'decision-os-verify',
    command[0], ...command.slice(1),
  ], {
    env: {
      ...childEnvironment,
      DECISION_OS_VERIFICATION_LOCK_FILE: lockFile,
      DECISION_OS_VERIFICATION_OWNER_CWD: JSON.stringify(process.cwd()),
      DECISION_OS_VERIFICATION_OWNER_COMMAND: JSON.stringify(command.join(' ')),
    },
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
