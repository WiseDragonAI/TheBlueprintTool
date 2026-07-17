/**
 * WHAT: Resolves and lists server-visible project directories below the catalog root.
 * WHY: The browser cannot expose an absolute local path that the Decision OS server can reuse.
 */
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, posix, relative, resolve, sep } from 'node:path';

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
    isSymbolicLink: boolean;
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

export function resolveProjectDirectory(input: { masterRoot: string; path: string }): { root: string; path: string; absolutePath: string; configuredPath: string } {
  const root = realpathSync(input.masterRoot);
  const requestedPath = String(input.path ?? '').trim() || '.';
  if (isAbsolute(requestedPath)) throw new Error('Directory path must be relative to the catalog root.');
  const unresolved = resolve(root, requestedPath);
  const path = containedRelative(root, unresolved);
  if (!existsSync(unresolved)) throw new Error('Directory does not exist.');
  const absolutePath = realpathSync(unresolved);
  if (!lstatSync(absolutePath).isDirectory()) throw new Error('Project location must be a directory.');
  return { root, path, absolutePath, configuredPath: unresolved };
}

export function listProjectDirectories(input: { masterRoot: string; path: string }): ProjectDirectoryListing {
  const selected = resolveProjectDirectory(input);
  const ancestorTargets = new Set<string>();
  let ancestorPath = selected.root;
  ancestorTargets.add(realpathSync(ancestorPath));
  for (const segment of selected.path === '.' ? [] : selected.path.split('/')) {
    ancestorPath = resolve(ancestorPath, segment);
    ancestorTargets.add(realpathSync(ancestorPath));
  }
  const directories = readdirSync(selected.absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith('.') || hiddenProjectDirectories.has(entry.name)) return [];
    const unresolved = resolve(selected.configuredPath, entry.name);
    try {
      const absolutePath = realpathSync(unresolved);
      if (!lstatSync(absolutePath).isDirectory() || ancestorTargets.has(absolutePath)) return [];
      const path = selected.path === '.' ? entry.name : posix.join(selected.path, entry.name);
      return [{
        name: entry.name,
        path,
        absolutePath: unresolved,
        isSymbolicLink: entry.isSymbolicLink(),
        hasDecisionOs: existsSync(resolve(absolutePath, '.decision-os', 'state.json')),
        hasGit: existsSync(resolve(absolutePath, '.git')),
      }];
    } catch {
      return [];
    }
  }).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  return {
    path: selected.path,
    absolutePath: selected.configuredPath,
    name: basename(selected.configuredPath),
    parentPath: selected.path === '.' ? null : posix.dirname(selected.path),
    directories,
  };
}
