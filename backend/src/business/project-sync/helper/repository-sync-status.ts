/**
 * WHAT: Reads a repository through a fixed, non-arbitrary Git command contract.
 * WHY: Federation preflight needs reproducible evidence without exposing checkout paths.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type RepositoryWorktreeStatus = {
  branch: string;
  headSha: string;
  porcelain: string;
  clean: boolean;
};

export type RepositorySyncStatus = {
  originFingerprint: string;
  originUrl: string;
  branch: string;
  upstream: string;
  headSha: string;
  originSha: string;
  ahead: number;
  behind: number;
  porcelain: string;
  ignoredPaths: string[];
  worktrees: RepositoryWorktreeStatus[];
  operationInProgress: boolean;
};

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  }).trim();
}

function optionalGit(root: string, args: string[]): string {
  try { return git(root, args); } catch { return ''; }
}

export function canonicalGitOrigin(originInput: string): string {
  const origin = originInput.trim();
  if (!origin) throw new Error('Repository origin is required.');
  const scp = origin.match(/^([^@\s]+@)?([^:/\s]+):(.+)$/);
  if (scp && !origin.includes('://')) return `${scp[2].toLowerCase()}/${scp[3].replace(/^\/+|\.git\/?$/g, '')}`;
  try {
    const parsed = new URL(origin);
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '');
    if (['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol)) return `${parsed.host}${parsed.pathname}`;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return origin.replace(/\.git\/?$/, '').replace(/\/$/, '');
  }
}

export function originFingerprint(originInput: string): string {
  return createHash('sha256').update(canonicalGitOrigin(originInput)).digest('hex');
}

export function readRepositoryOriginIdentity(projectRoot: string): { originFingerprint: string; originUrl: string } {
  const rawOriginUrl = git(projectRoot, ['remote', 'get-url', 'origin']);
  return { originFingerprint: originFingerprint(rawOriginUrl), originUrl: credentialFreeCloneOrigin(rawOriginUrl) };
}

export function isNetworkGitOrigin(value: string): boolean {
  if (/^[^@\s]+@[^:/\s]+:.+/.test(value)) return true;
  try { return ['https:', 'http:', 'ssh:', 'git:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function credentialFreeCloneOrigin(originInput: string): string {
  const origin = originInput.trim();
  const scp = origin.match(/^([^@\s]+@)?([^:/\s]+):(.+)$/);
  if (scp && !origin.includes('://')) return `${scp[1] ?? ''}${scp[2]}:${scp[3].replace(/\.git\/?$/, '')}`;
  try {
    const parsed = new URL(origin);
    parsed.password = '';
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') parsed.username = '';
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '');
    return parsed.toString().replace(/\/$/, '');
  } catch { return origin.replace(/\.git\/?$/, ''); }
}

function parseWorktrees(root: string, value: string): RepositoryWorktreeStatus[] {
  return value.split(/\n\n+/).flatMap((block) => {
    const lines = block.split('\n');
    const worktreeLine = lines.find((line) => line.startsWith('worktree '));
    if (!worktreeLine) return [];
    const path = worktreeLine.slice('worktree '.length);
    const headSha = lines.find((line) => line.startsWith('HEAD '))?.slice(5) ?? '';
    const branch = lines.find((line) => line.startsWith('branch '))?.slice('branch refs/heads/'.length) ?? '';
    const porcelain = optionalGit(path, ['status', '--porcelain=v1', '--untracked-files=all']);
    return [{ branch, headSha, porcelain, clean: porcelain.length === 0 }];
  });
}

export function readRepositorySyncStatus(projectRoot: string): RepositorySyncStatus {
  const repositoryRoot = git(projectRoot, ['rev-parse', '--show-toplevel']);
  const branch = git(repositoryRoot, ['branch', '--show-current']);
  const upstream = optionalGit(repositoryRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (!branch) throw new Error('Repository must be on a named branch.');
  if (!upstream) throw new Error('Repository branch must have an upstream.');
  const rawOriginUrl = git(repositoryRoot, ['remote', 'get-url', 'origin']);
  const originUrl = credentialFreeCloneOrigin(rawOriginUrl);
  const headSha = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const originSha = optionalGit(repositoryRoot, ['rev-parse', upstream]);
  const counts = optionalGit(repositoryRoot, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]).split(/\s+/).map(Number);
  const porcelain = git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  const ignoredPaths = optionalGit(repositoryRoot, ['ls-files', '--others', '--ignored', '--exclude-standard']).split('\n').filter(Boolean);
  const gitDirValue = git(repositoryRoot, ['rev-parse', '--git-dir']);
  const gitDir = resolve(repositoryRoot, gitDirValue);
  const operationInProgress = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'rebase-merge', 'rebase-apply']
    .some((entry) => existsSync(resolve(gitDir, entry)));
  return {
    originFingerprint: originFingerprint(rawOriginUrl),
    originUrl,
    branch,
    upstream,
    headSha,
    originSha,
    ahead: Number.isFinite(counts[0]) ? counts[0] : 0,
    behind: Number.isFinite(counts[1]) ? counts[1] : 0,
    porcelain,
    ignoredPaths,
    worktrees: parseWorktrees(repositoryRoot, git(repositoryRoot, ['worktree', 'list', '--porcelain'])),
    operationInProgress,
  };
}
