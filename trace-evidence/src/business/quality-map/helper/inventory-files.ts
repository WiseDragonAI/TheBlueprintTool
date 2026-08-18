/**
 * WHAT: Inventories the current codebase filesystem without requiring Git metadata.
 * WHY: Static quality analysis targets the codebase as it exists, including uncommitted and non-Git files.
 */
import { lstatSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export type InventoryPath = { path: string; exclusion: string | null };

const DEFAULT_EXCLUDED_DIRECTORIES = new Set(['.git', '.worktrees', 'node_modules', '.trace', 'coverage', 'dist', 'build', 'runtime', 'cache']);

export function inventoryFiles(root: string, additionalExclusions: string[] = []): { files: InventoryPath[]; excludedDirectories: string[] } {
  const canonicalRoot = resolve(root);
  const excludedNames = new Set([...DEFAULT_EXCLUDED_DIRECTORIES, ...additionalExclusions]);
  const files: InventoryPath[] = [];
  const excludedDirectories: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = resolve(directory, entry.name);
      const path = relative(canonicalRoot, absolute).replaceAll('\\', '/');
      // WHAT: Record excluded directory boundaries without traversing dependency, build, and runtime trees.
      // WHY: These trees are not authored codebase source and can contain millions of irrelevant files.
      if (entry.isDirectory() && excludedNames.has(entry.name)) {
        excludedDirectories.push(path);
        continue;
      }
      // WHAT: Recurse only through real directories contained by the selected root.
      // WHY: Symbolic directory traversal can escape the codebase and create cycles.
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      const stat = lstatSync(absolute);
      // WHAT: Inventory symbolic links without following their external targets.
      // WHY: A filesystem scan must preserve boundaries and terminate deterministically.
      if (stat.isSymbolicLink()) {
        files.push({ path, exclusion: 'symlink' });
        continue;
      }
      // WHAT: Retain every regular filesystem file for later language and applicability classification.
      // WHY: Non-Git and uncommitted files are first-class codebase inputs.
      if (stat.isFile()) files.push({ path, exclusion: null });
    }
  };
  visit(canonicalRoot);
  return { files, excludedDirectories: excludedDirectories.sort() };
}
