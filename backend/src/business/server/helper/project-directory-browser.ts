/**
 * WHAT: Resolves and lists server-visible project directories below the catalog root.
 * WHY: The browser cannot expose an absolute local path that the Decision OS server can reuse.
 */
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';

const hiddenProjectDirectories = new Set(['node_modules', '.worktrees']);

export type ProjectDirectoryListing = {
  path: string;
  absolutePath: string;
  name: string;
  parentPath: string | null;
  directories: Array<{
    name: string;
    path: string;
    absolutePath: string;
    hasDecisionOs: boolean;
    hasGit: boolean;
  }>;
};

function normalizedRelative(root: string, candidate: string): string {
  return relative(root, candidate).split(sep).join('/') || '.';
}

function containedRelative(root: string, candidate: string): string {
  const path = normalizedRelative(root, candidate);
  if (path === '..' || path.startsWith('../')) throw new Error('Directory must remain below the catalog root.');
  return path;
}

export function resolveProjectDirectory(input: { masterRoot: string; path: string }): { root: string; path: string; absolutePath: string } {
  const root = realpathSync(input.masterRoot);
  const requestedPath = String(input.path ?? '').trim() || '.';
  if (isAbsolute(requestedPath)) throw new Error('Directory path must be relative to the catalog root.');
  const unresolved = resolve(root, requestedPath);
  containedRelative(root, unresolved);
  if (!existsSync(unresolved)) throw new Error('Directory does not exist.');
  if (lstatSync(unresolved).isSymbolicLink()) throw new Error('Symbolic-link directories cannot be selected.');
  const absolutePath = realpathSync(unresolved);
  if (!lstatSync(absolutePath).isDirectory()) throw new Error('Project location must be a directory.');
  return { root, path: containedRelative(root, absolutePath), absolutePath };
}

export function listProjectDirectories(input: { masterRoot: string; path: string }): ProjectDirectoryListing {
  const selected = resolveProjectDirectory(input);
  const directories = readdirSync(selected.absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith('.') || hiddenProjectDirectories.has(entry.name)) return [];
    const unresolved = resolve(selected.absolutePath, entry.name);
    try {
      const absolutePath = realpathSync(unresolved);
      const path = containedRelative(selected.root, absolutePath);
      return [{
        name: entry.name,
        path,
        absolutePath,
        hasDecisionOs: existsSync(resolve(absolutePath, '.decision-os', 'state.json')),
        hasGit: existsSync(resolve(absolutePath, '.git')),
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  const parentAbsolutePath = resolve(selected.absolutePath, '..');
  return {
    path: selected.path,
    absolutePath: selected.absolutePath,
    name: basename(selected.absolutePath),
    parentPath: selected.path === '.' ? null : containedRelative(selected.root, parentAbsolutePath),
    directories,
  };
}
