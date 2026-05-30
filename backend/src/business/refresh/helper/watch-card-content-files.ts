/**
 * WHAT: Watches card Markdown sidecar files and reports changes to the HTTP event stream.
 * WHY: direct file patches must refresh browser card content without requiring a manual reload.
 */
import { existsSync, mkdirSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

export type CardContentChange = {
  contentFile: string;
  file: string;
  kind: 'card-content';
};

export function watchCardContentFiles(input: { blueprinttoolRoot: string; onChange: (event: CardContentChange) => void }): { close(): void; watchedDirectories: number } {
  const cardsRoot = resolve(input.blueprinttoolRoot, 'cards');
  const watchers = new Map<string, FSWatcher>();
  const pendingEvents = new Map<string, NodeJS.Timeout>();

  function emitFile(file: string): void {
    if (extname(file) !== '.md') return;
    const existingTimer = pendingEvents.get(file);
    if (existingTimer) clearTimeout(existingTimer);
    pendingEvents.set(file, setTimeout(() => {
      pendingEvents.delete(file);
      const contentFile = `.blueprinttool/${relative(input.blueprinttoolRoot, file)}`;
      input.onChange({ contentFile, file, kind: 'card-content' });
    }, 50));
  }

  function watchDirectory(directory: string): void {
    if (!existsSync(directory) || watchers.has(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) watchDirectory(join(directory, entry.name));
    }
    const watcher = watch(directory, { persistent: false }, (_eventType, filename) => {
      if (!filename) return;
      const changed = resolve(directory, String(filename));
      if (existsSync(changed) && statSync(changed).isDirectory()) {
        watchDirectory(changed);
        return;
      }
      emitFile(changed);
    });
    watchers.set(directory, watcher);
  }

  mkdirSync(cardsRoot, { recursive: true });
  watchDirectory(cardsRoot);

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
