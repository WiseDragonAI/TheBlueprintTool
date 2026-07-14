/**
 * WHAT: Applies synchronized skill files and creates one focused Git commit with rollback.
 * WHY: A skill package, ledger projection, and card mirrors must never settle at different revisions.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { OpenAiSkillPackage } from '../helper/read-openai-skill-package.js';
import type { SkillProjection } from '../helper/project-skill-ledger.js';

type Snapshot = { directories: Set<string>; files: Map<string, { content: Buffer; mode: number }> };

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function inside(root: string, file: string): boolean {
  const path = relative(root, file);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function snapshot(root: string, paths: string[]): Snapshot {
  const state: Snapshot = { directories: new Set(), files: new Map() };
  const visit = (absolute: string): void => {
    if (!existsSync(absolute)) return;
    const metadata = lstatSync(absolute);
    if (metadata.isDirectory()) {
      state.directories.add(relative(root, absolute));
      for (const entry of readdirSync(absolute)) visit(resolve(absolute, entry));
    } else if (metadata.isFile()) state.files.set(relative(root, absolute), { content: readFileSync(absolute), mode: metadata.mode & 0o777 });
  };
  for (const path of paths) visit(resolve(root, path));
  return state;
}

function restore(root: string, paths: string[], state: Snapshot): void {
  for (const path of paths.sort((a, b) => b.length - a.length)) rmSync(resolve(root, path), { recursive: true, force: true });
  for (const directory of Array.from(state.directories).sort((a, b) => a.length - b.length)) mkdirSync(resolve(root, directory), { recursive: true });
  for (const [file, snapshotFile] of state.files) {
    mkdirSync(dirname(resolve(root, file)), { recursive: true });
    writeFileSync(resolve(root, file), snapshotFile.content, { mode: snapshotFile.mode });
    chmodSync(resolve(root, file), snapshotFile.mode);
  }
}

function uniqueRoots(paths: string[]): string[] {
  const normalized = Array.from(new Set(paths.filter(Boolean).map((path) => path.split('\\').join('/')))).sort((a, b) => a.length - b.length);
  return normalized.filter((path, index) => !normalized.slice(0, index).some((parent) => path === parent || path.startsWith(`${parent}/`)));
}

function writeAtomicJson(file: string, value: unknown): void {
  const temporary = `${file}.skill-sync-${process.pid}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function commitSkillTransaction(input: {
  ledgerFile: string;
  operation: 'create' | 'update';
  projection: SkillProjection;
  root: string;
  skill: OpenAiSkillPackage;
  priorMappedFiles: string[];
  registryWrites: Array<{ file: string; value: Record<string, any> }>;
  afterWrites?: () => void;
}): string {
  const packagePath = `.skills/${input.skill.name}`;
  const ownedPaths = uniqueRoots([
    '.decision-os/skills.json', packagePath, ...input.priorMappedFiles,
    ...input.registryWrites.map((entry) => entry.file),
    ...input.projection.cardFiles.map((entry) => entry.file), ...input.projection.threadFiles.map((entry) => entry.file),
    ...input.projection.removedCardFiles, ...input.projection.removedThreadFiles,
  ]);
  for (const path of ownedPaths) if (!inside(input.root, resolve(input.root, path))) throw new Error(`Skill transaction path escapes the server root: ${path}`);
  const topLevel = resolve(git(input.root, ['rev-parse', '--show-toplevel']));
  if (topLevel !== input.root) throw new Error('Server launch root must be the Git worktree root.');
  git(input.root, ['rev-parse', '--verify', 'HEAD']);
  const dirty = git(input.root, ['status', '--porcelain', '--', ...ownedPaths]);
  if (dirty) throw new Error(`Skill-owned paths contain uncommitted changes:\n${dirty}`);
  const before = snapshot(input.root, ownedPaths);
  let committed = false;
  try {
    const destination = resolve(input.root, packagePath);
    rmSync(destination, { recursive: true, force: true });
    for (const file of input.skill.files) {
      const target = resolve(destination, file.relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content, { mode: file.mode });
      chmodSync(target, file.mode);
    }
    for (const removed of [...input.projection.removedCardFiles, ...input.projection.removedThreadFiles]) rmSync(resolve(input.root, removed), { force: true });
    for (const card of input.projection.cardFiles) {
      mkdirSync(dirname(resolve(input.root, card.file)), { recursive: true });
      writeFileSync(resolve(input.root, card.file), card.content, 'utf8');
    }
    for (const thread of input.projection.threadFiles) {
      const file = resolve(input.root, thread.file);
      if (!existsSync(file)) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, thread.content, 'utf8');
      }
    }
    for (const registry of input.registryWrites) writeAtomicJson(resolve(input.root, registry.file), registry.value);
    writeAtomicJson(input.ledgerFile, input.projection.ledger);
    input.afterWrites?.();
    git(input.root, ['add', '-A', '-f', '--', ...ownedPaths]);
    git(input.root, ['commit', '--only', '-m', `skills: ${input.operation} ${input.skill.name}`, '--', ...ownedPaths]);
    committed = true;
    return git(input.root, ['rev-parse', 'HEAD']);
  } catch (error) {
    if (committed) throw error;
    try { git(input.root, ['reset', '-q', 'HEAD', '--', ...ownedPaths]); } catch { /* restore still owns the filesystem rollback */ }
    restore(input.root, ownedPaths, before);
    throw error;
  }
}
