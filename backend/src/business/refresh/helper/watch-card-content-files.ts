/**
 * WHAT: Watches card Markdown sidecar files and reports changes to the HTTP event stream.
 * WHY: direct file patches must refresh browser card content without requiring a manual reload.
 */
import { existsSync, mkdirSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

export type CardContentChange = {
  contentFile: string;
  file: string;
  kind: 'card-content' | 'thread-content';
};

export function watchCardContentFiles(input: { blueprinttoolRoot: string; onChange: (event: CardContentChange) => void }): { close(): void; watchedDirectories: number } {
  const roots = [
    { directory: resolve(input.blueprinttoolRoot, 'cards'), kind: 'card-content' as const },
    { directory: resolve(input.blueprinttoolRoot, 'threads'), kind: 'thread-content' as const },
  ];
  const watchers = new Map<string, FSWatcher>();
  const pendingEvents = new Map<string, NodeJS.Timeout>();

  function emitFile(file: string, kind: CardContentChange['kind']): void {
    if (extname(file) !== '.md') return;
    const existingTimer = pendingEvents.get(file);
    if (existingTimer) clearTimeout(existingTimer);
    pendingEvents.set(file, setTimeout(() => {
      pendingEvents.delete(file);
      const contentFile = `.blueprinttool/${relative(input.blueprinttoolRoot, file)}`;
      input.onChange({ contentFile, file, kind });
    }, 50));
  }

  function watchDirectory(directory: string, kind: CardContentChange['kind']): void {
    if (!existsSync(directory) || watchers.has(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) watchDirectory(join(directory, entry.name), kind);
    }
    const watcher = watch(directory, { persistent: false }, (_eventType, filename) => {
      if (!filename) return;
      const changed = resolve(directory, String(filename));
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
    get watchedDirectories() {
      return watchers.size;
    },
  };
}
