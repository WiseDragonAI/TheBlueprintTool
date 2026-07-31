/**
 * WHAT: Creates one local Git repository for durable Decision OS authored content.
 * WHY: Authored cards, threads, and pipeline prompts must advance their child repository without mutating the owning workspace repository.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

export const canonicalDecisionOsGitIgnore = [
  '/.settings.json',
  '/cache/',
  '/codex-pipeline-recovery/',
  '/codex-process-queue.json',
  '/frontend-telemetry.jsonl*',
  '/memories.sqlite3',
  '/migrations/',
  '/runs/',
  '/runtime/',
  '/runtime-incidents.json',
  '/task-state/',
  '/task-state-rollback/',
  '/tasks.json',
  '/voice-uploads/',
  '/**/*.png',
  '/**/*.jpg',
  '/**/*.jpeg',
  '/**/*.gif',
  '/**/*.webp',
  '/**/*.avif',
  '',
].join('\n');

function git(input: {
  decisionOsRoot: string;
  args: string[];
  operation: string;
}): string {
  const result = spawnSync('git', input.args, {
    cwd: input.decisionOsRoot,
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
  });
  if (result.status !== 0) {
    const detail = String(
      result.stderr
      || result.stdout
      || result.error?.message
      || (result.signal ? `terminated by ${result.signal}` : `exit ${result.status}`),
    ).trim();
    throw new Error(`Decision OS Git ${input.operation} failed: ${detail}.`);
  }
  return String(result.stdout).trim();
}

function assertExistingRepository(decisionOsRoot: string): void {
  let topLevel = '';
  let head = '';
  try {
    topLevel = git({
      decisionOsRoot,
      args: ['rev-parse', '--show-toplevel'],
      operation: 'validate-root',
    });
    head = git({
      decisionOsRoot,
      args: ['rev-parse', '--verify', 'HEAD'],
      operation: 'validate-head',
    });
  } catch (error) {
    throw new Error(
      `Incomplete Decision OS Git metadata at ${resolve(decisionOsRoot, '.git')}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    realpathSync(topLevel) !== realpathSync(decisionOsRoot)
    || !/^[a-f0-9]{40,64}$/.test(head)
  ) {
    throw new Error(`Incomplete Decision OS Git metadata at ${resolve(decisionOsRoot, '.git')}.`);
  }
}

export function ensureDecisionOsGitRepository(decisionOsRootInput: string): void {
  const decisionOsRoot = resolve(decisionOsRootInput);
  if (!existsSync(decisionOsRoot) || !statSync(decisionOsRoot).isDirectory()) {
    throw new Error(`Decision OS directory is unavailable: ${decisionOsRoot}`);
  }
  const gitMetadata = resolve(decisionOsRoot, '.git');
  if (existsSync(gitMetadata)) {
    assertExistingRepository(decisionOsRoot);
    return;
  }

  writeFileSync(resolve(decisionOsRoot, '.gitignore'), canonicalDecisionOsGitIgnore);
  git({
    decisionOsRoot,
    args: ['init', '--initial-branch=main'],
    operation: 'initialize',
  });
  git({
    decisionOsRoot,
    args: ['config', '--local', 'user.name', 'Decision OS'],
    operation: 'configure-author-name',
  });
  git({
    decisionOsRoot,
    args: ['config', '--local', 'user.email', 'decision-os@localhost'],
    operation: 'configure-author-email',
  });
  git({
    decisionOsRoot,
    args: ['add', '--all'],
    operation: 'stage-baseline',
  });
  git({
    decisionOsRoot,
    args: [
      'commit',
      '-m',
      'Initialize Decision OS repository',
      '-m',
      'WHAT: Capture the existing nonignored Decision OS files as the child repository baseline.',
      '-m',
      'WHY: Authored content revisions must remain independent from the parent workspace repository.',
    ],
    operation: 'commit-baseline',
  });
}
