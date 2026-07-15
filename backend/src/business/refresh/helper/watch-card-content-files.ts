/**
 * WHAT: Watches card Markdown content files and reports changes to the HTTP event stream.
 * WHY: Direct file patches must refresh browser card content without requiring a manual reload.
 */
import { existsSync, mkdirSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import {
  buildContentOwnershipIndex,
  type CardContentChange
} from './resolve-card-content-change.js';

export { resolveCardContentChange } from './resolve-card-content-change.js';
export type { CardContentChange } from './resolve-card-content-change.js';

export function watchCardContentFiles(input: { decisionOsRoot: string; onChange: (event: CardContentChange) => void }): { close(): void; refreshOwnership(): void; watchedDirectories: number } {
  const roots = [
    { directory: resolve(input.decisionOsRoot, 'cards'), kind: 'card-content' as const },
    { directory: resolve(input.decisionOsRoot, 'threads'), kind: 'thread-content' as const },
  ];
  const watchers = new Map<string, FSWatcher>();
  const pendingEvents = new Map<string, NodeJS.Timeout>();
  let ownership = buildContentOwnershipIndex(input.decisionOsRoot);

  function emitFile(file: string, kind: CardContentChange['kind']): void {
    // WHAT: Ignore non-Markdown watcher events at the transport boundary.
    // WHY: Only externalized card and thread content participates in scoped refresh.
    if (extname(file) !== '.md') return;
    const existingTimer = pendingEvents.get(file);
    // WHAT: Replace the pending debounce for the same file.
    // WHY: Editors often emit several filesystem notifications for one durable write.
    if (existingTimer) clearTimeout(existingTimer);
    pendingEvents.set(file, setTimeout(() => {
      pendingEvents.delete(file);
      const change = ownership.get(resolve(file));
      // WHAT: Publish only an exactly owned content-file change.
      // WHY: Missing or ambiguous ownership must not refresh a guessed ledger.
      if (change) input.onChange(change);
    }, 50));
  }

  function watchDirectory(directory: string, kind: CardContentChange['kind']): void {
    // WHAT: Skip absent and already watched directories.
    // WHY: Recursive discovery can revisit the same path after directory creation events.
    if (!existsSync(directory) || watchers.has(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      // WHAT: Recursively attach watchers to existing child directories.
      // WHY: Node's non-recursive watcher must cover nested ledger content folders explicitly.
      if (entry.isDirectory()) watchDirectory(join(directory, entry.name), kind);
    }
    const watcher = watch(directory, { persistent: false }, (_eventType, filename) => {
      // WHAT: Ignore watcher events that do not identify a changed entry.
      // WHY: Ownership resolution requires an exact filesystem path.
      if (!filename) return;
      const changed = resolve(directory, String(filename));
      // WHAT: Attach a watcher when a new content subdirectory appears.
      // WHY: Future files below it would otherwise be invisible to the non-recursive watcher.
      if (existsSync(changed) && statSync(changed).isDirectory()) {
        watchDirectory(changed, kind);
        return;
      }
      emitFile(changed, kind);
    });
    watchers.set(directory, watcher);
  }

  for (const root of roots) {
    mkdirSync(root.directory, { recursive: true });
    watchDirectory(root.directory, root.kind);
  }

  return {
    close() {
      for (const timer of pendingEvents.values()) clearTimeout(timer);
      pendingEvents.clear();
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    },
    refreshOwnership() {
      ownership = buildContentOwnershipIndex(input.decisionOsRoot);
    },
    get watchedDirectories() {
      return watchers.size;
    },
  };
}
