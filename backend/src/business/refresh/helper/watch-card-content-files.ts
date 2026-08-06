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

export type ContentFileFlushResult = { observed: boolean; settled: boolean };

export function watchCardContentFiles(input: {
  decisionOsRoot: string;
  onChange: (event: CardContentChange) => unknown;
  onError?: (error: unknown, context: { operation: string; file: string }) => void;
  reconcileOnStart?: (event: CardContentChange) => boolean;
  taskProjection?: () => Record<string, unknown> | null;
  auditIntervalMs?: number;
}): {
  close(timeoutMs?: number): Promise<void>;
  flush(timeoutMs?: number): Promise<void>;
  flushFile(file: string, timeoutMs?: number): Promise<ContentFileFlushResult>;
  ready: Promise<boolean>;
  refreshOwnership(): void;
  watchedDirectories: number;
} {
  const roots = [
    { directory: resolve(input.decisionOsRoot, 'cards'), kind: 'card-content' as const },
    { directory: resolve(input.decisionOsRoot, 'threads'), kind: 'thread-content' as const },
  ];
  const watchers = new Map<string, FSWatcher>();
  const pendingEvents = new Map<string, { timer: NodeJS.Timeout; deliver: () => void }>();
  const pendingPublications = new Map<string, Set<Promise<boolean>>>();
  let ownership = buildContentOwnershipIndex(input.decisionOsRoot, input.taskProjection);
  let signatures = new Map<string, string>();
  let closed = false;

  const signature = (file: string): string => {
    try {
      const state = statSync(file);
      return `${state.dev}:${state.ino}:${state.size}:${state.mtimeMs}`;
    } catch {
      return 'missing';
    }
  };

  const refreshSignatures = (): void => {
    signatures = new Map([...ownership.keys()].map((file) => [file, signature(file)]));
  };

  const reportError = (error: unknown, operation: string, file: string): void => {
    try { input.onError?.(error, { operation, file }); } catch { /* Error reporting must not escape a watcher callback. */ }
  };

  const publish = async (change: CardContentChange, file: string): Promise<boolean> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await input.onChange(change);
        return true;
      } catch (error) {
        lastError = error;
      }
    }
    reportError(lastError, 'publish-card-content-change', file);
    return false;
  };

  const trackPublication = (change: CardContentChange, file: string): void => {
    const publication = publish(change, file);
    const key = resolve(file);
    const owned = pendingPublications.get(key) ?? new Set<Promise<boolean>>();
    owned.add(publication);
    pendingPublications.set(key, owned);
    void publication.finally(() => {
      owned.delete(publication);
      // WHAT: Remove a settled path only after its final tracked publication completes.
      // WHY: Exact-path flush must not confuse an empty retained set with in-flight work.
      if (owned.size === 0) pendingPublications.delete(key);
    });
  };

  function emitFile(file: string, kind: CardContentChange['kind']): void {
    if (closed) return;
    // WHAT: Ignore non-Markdown watcher events at the transport boundary.
    // WHY: Only externalized card and thread content participates in scoped refresh.
    if (extname(file) !== '.md') return;
    signatures.set(resolve(file), signature(file));
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
    // WHAT: Skip only absent directories before scanning descendants.
    // WHY: Refreshing an already watched parent must still discover newly created child directories.
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      // WHAT: Recursively attach watchers to existing child directories.
      // WHY: Node's non-recursive watcher must cover nested ledger content folders explicitly.
      if (entry.isDirectory()) watchDirectory(join(directory, entry.name), kind);
    }
    // WHAT: Retain the existing watcher after scanning its current descendants.
    // WHY: Ownership refresh must add missing child watchers without duplicating parent handles.
    if (watchers.has(directory)) return;
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
  refreshSignatures();

  const audit = setInterval(() => {
    try {
      ownership = buildContentOwnershipIndex(input.decisionOsRoot, input.taskProjection);
      for (const root of roots) watchDirectory(root.directory, root.kind);
      for (const file of signatures.keys()) {
        // WHAT: Drop signatures whose exact ownership disappeared from the current projection.
        // WHY: A later reintroduction must be treated as a fresh owned resource observation.
        if (!ownership.has(file)) signatures.delete(file);
      }
      for (const [file, change] of ownership) {
        const next = signature(file);
        // WHAT: Ignore owned Markdown whose stable bounded signature has not changed.
        // WHY: The audit exists only to recover a native watcher notification that was lost.
        if (signatures.get(file) === next) continue;
        signatures.set(file, next);
        // WHAT: Publish a missed owned change directly from the already delayed audit boundary.
        // WHY: Re-entering the native debounce can indefinitely postpone recovery under repeated platform notifications.
        trackPublication(change, file);
      }
    } catch (error) {
      reportError(error, 'audit-card-content-files', input.decisionOsRoot);
    }
  }, input.auditIntervalMs ?? 500);

  const ready = Promise.all([...ownership.values()]
    .filter((change) => input.reconcileOnStart?.(change) === true)
    .map((change) => publish(change, change.file)))
    .then((outcomes) => outcomes.every(Boolean));

  const settle = async (publications: Promise<boolean>[], timeoutMs: number, operation: string, file: string): Promise<boolean> => {
    // WHAT: Treat an empty publication set as already settled.
    // WHY: Global close and exact-path recovery share one bounded settlement primitive.
    if (publications.length === 0) return true;
    let timeout: NodeJS.Timeout | undefined;
    const result = await Promise.race([
      Promise.all(publications).then((outcomes) => outcomes.every(Boolean)),
      new Promise<false>((resolveTimeout) => {
        timeout = setTimeout(() => {
          reportError(new Error(`Card content watcher flush exceeded ${timeoutMs}ms.`), operation, file);
          resolveTimeout(false);
        }, timeoutMs);
      }),
    ]);
    // WHAT: Clear the deadline after publication settlement wins the race.
    // WHY: A stale timer must not report a false watcher failure later.
    if (timeout) clearTimeout(timeout);
    return result;
  };

  const flushFile = async (file: string, timeoutMs = 1_000): Promise<ContentFileFlushResult> => {
    const key = resolve(file);
    let observed = false;
    const pending = pendingEvents.get(key);
    // WHAT: Deliver only the exact pending Markdown path requested by recovery.
    // WHY: A mismatch in one thread must not flush unrelated editor work.
    if (pending) {
      observed = true;
      clearTimeout(pending.timer);
      pending.deliver();
    }
    const publications = [...(pendingPublications.get(key) ?? [])];
    // WHAT: Report no settlement when the path had neither a debounced event nor an in-flight publication.
    // WHY: Materialization may retry only an edit actually observed by this watcher.
    if (!observed && publications.length === 0) return { observed: false, settled: false };
    return {
      observed: true,
      settled: await settle(publications, timeoutMs, 'flush-card-content-file', key),
    };
  };

  const flush = async (timeoutMs = 1_000): Promise<void> => {
    for (const pending of [...pendingEvents.values()]) {
      clearTimeout(pending.timer);
      pending.deliver();
    }
    const publications = [...pendingPublications.values()].flatMap((entries) => [...entries]);
    await settle(publications, timeoutMs, 'flush-card-content-changes', input.decisionOsRoot);
  };

  return {
    async close(timeoutMs = 1_000): Promise<void> {
      if (closed) return flush(timeoutMs);
      closed = true;
      clearInterval(audit);
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
      await flush(timeoutMs);
    },
    flush,
    flushFile,
    ready,
    refreshOwnership() {
      ownership = buildContentOwnershipIndex(input.decisionOsRoot, input.taskProjection);
      // WHAT: Attach watchers to content directories created by the committed ledger mutation.
      // WHY: A new task directory can be created before its parent watcher receives the native rename event.
      for (const root of roots) watchDirectory(root.directory, root.kind);
      refreshSignatures();
    },
    get watchedDirectories() {
      return watchers.size;
    },
  };
}
