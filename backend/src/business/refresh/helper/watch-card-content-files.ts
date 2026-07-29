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

export function watchCardContentFiles(input: {
  decisionOsRoot: string;
  onChange: (event: CardContentChange) => unknown;
  onError?: (error: unknown, context: { operation: string; file: string }) => void;
  taskProjection?: () => Record<string, unknown> | null;
}): { close(timeoutMs?: number): Promise<void>; flush(timeoutMs?: number): Promise<void>; refreshOwnership(): void; watchedDirectories: number } {
  const roots = [
    { directory: resolve(input.decisionOsRoot, 'cards'), kind: 'card-content' as const },
    { directory: resolve(input.decisionOsRoot, 'threads'), kind: 'thread-content' as const },
  ];
  const watchers = new Map<string, FSWatcher>();
  const pendingEvents = new Map<string, { timer: NodeJS.Timeout; deliver: () => void }>();
  const pendingPublications = new Set<Promise<void>>();
  let ownership = buildContentOwnershipIndex(input.decisionOsRoot, input.taskProjection);
  let closed = false;

  const reportError = (error: unknown, operation: string, file: string): void => {
    try { input.onError?.(error, { operation, file }); } catch { /* Error reporting must not escape a watcher callback. */ }
  };

  const publish = async (change: CardContentChange, file: string): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await input.onChange(change);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    reportError(lastError, 'publish-card-content-change', file);
  };

  const trackPublication = (change: CardContentChange, file: string): void => {
    const publication = publish(change, file);
    pendingPublications.add(publication);
    void publication.finally(() => pendingPublications.delete(publication));
  };

  function emitFile(file: string, kind: CardContentChange['kind']): void {
    if (closed) return;
    // WHAT: Ignore non-Markdown watcher events at the transport boundary.
    // WHY: Only externalized card and thread content participates in scoped refresh.
    if (extname(file) !== '.md') return;
    const existingTimer = pendingEvents.get(file);
    // WHAT: Replace the pending debounce for the same file.
    // WHY: Editors often emit several filesystem notifications for one durable write.
    if (existingTimer) clearTimeout(existingTimer.timer);
    const deliver = (): void => {
      pendingEvents.delete(file);
      let change = ownership.get(resolve(file));
      if (!change) {
        // WHAT: Admit the first event for a task created after watcher startup.
        // WHY: Epoch 4 task mutations do not rewrite the retired aggregate tasks ledger.
        ownership = buildContentOwnershipIndex(input.decisionOsRoot, input.taskProjection);
        change = ownership.get(resolve(file));
      }
      // WHAT: Publish only an exactly owned content-file change.
      // WHY: Missing or ambiguous ownership must not refresh a guessed ledger.
      if (change) trackPublication(change, file);
    };
    pendingEvents.set(file, { timer: setTimeout(deliver, 50), deliver });
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
      try {
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
      } catch (error) {
        reportError(error, 'process-card-content-watch-event', directory);
      }
    });
    watcher.on('error', (error) => reportError(error, 'card-content-watcher-error', directory));
    watchers.set(directory, watcher);
  }

  for (const root of roots) {
    mkdirSync(root.directory, { recursive: true });
    watchDirectory(root.directory, root.kind);
  }

  const flush = async (timeoutMs = 1_000): Promise<void> => {
    for (const pending of [...pendingEvents.values()]) {
      clearTimeout(pending.timer);
      pending.deliver();
    }
    if (pendingPublications.size === 0) return;
    let timeout: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...pendingPublications]),
      new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
          reportError(new Error(`Card content watcher flush exceeded ${timeoutMs}ms.`), 'flush-card-content-changes', input.decisionOsRoot);
          resolve();
        }, timeoutMs);
      }),
    ]);
    if (timeout) clearTimeout(timeout);
  };

  return {
    async close(timeoutMs = 1_000): Promise<void> {
      if (closed) return flush(timeoutMs);
      closed = true;
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
      await flush(timeoutMs);
    },
    flush,
    refreshOwnership() {
      ownership = buildContentOwnershipIndex(input.decisionOsRoot, input.taskProjection);
    },
    get watchedDirectories() {
      return watchers.size;
    },
  };
}
