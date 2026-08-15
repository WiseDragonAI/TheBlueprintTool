/**
 * WHAT: Tracks held entity keys in node-local per-task markers.
 * WHY: Activation state must survive crashes without entering replicated entities or their hashes.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

type HeldMarker = { version: 1; taskId: string; entityKeys: string[] };
type PendingMarkers = { writes: string[]; deletes: string[] };

export function createTaskLocalPublicationState(heldDirectory: string) {
  const heldByTask = new Map<string, Set<string>>();
  const heldEntityKeys = new Set<string>();
  const pendingWrites = new Set<string>();
  const pendingDeletes = new Set<string>();
  const markerFile = (taskId: string): string => resolve(heldDirectory, `${encodeURIComponent(taskId)}.json`);

  const load = (): void => {
    if (!existsSync(heldDirectory)) return;
    for (const name of readdirSync(heldDirectory).filter((value) => value.endsWith('.json')).sort()) {
      const marker = JSON.parse(readFileSync(resolve(heldDirectory, name), 'utf8')) as HeldMarker;
      if (marker.version !== 1 || !marker.taskId || !Array.isArray(marker.entityKeys)) throw new Error('invalid_local_publication_marker');
      const keys = new Set(marker.entityKeys.map(String));
      heldByTask.set(marker.taskId, keys);
      for (const key of keys) heldEntityKeys.add(key);
    }
  };

  const snapshot = (): HeldMarker[] => [...heldByTask]
    .map(([taskId, keys]) => ({ version: 1 as const, taskId, entityKeys: [...keys].sort() }))
    .sort((left, right) => left.taskId.localeCompare(right.taskId));

  const installSnapshot = (markers: Array<{ taskId: string; entityKeys: string[] }>): void => {
    heldByTask.clear();
    heldEntityKeys.clear();
    pendingWrites.clear();
    pendingDeletes.clear();
    for (const marker of markers) {
      // WHAT: Reject duplicate held-task identities in one admitted checkpoint.
      // WHY: Direct warm installation must preserve one marker authority per activation task.
      if (heldByTask.has(marker.taskId)) throw new Error('invalid_local_publication_snapshot');
      const keys = new Set(marker.entityKeys);
      heldByTask.set(marker.taskId, keys);
      for (const key of keys) heldEntityKeys.add(key);
    }
  };

  const hold = (taskId: string, key: string): void => {
    if (!taskId) throw new Error('held_task_requires_activation_identity');
    const keys = heldByTask.get(taskId) ?? new Set<string>();
    keys.add(key);
    heldByTask.set(taskId, keys);
    heldEntityKeys.add(key);
    pendingWrites.add(taskId);
    pendingDeletes.delete(taskId);
  };

  const activate = (taskId: string): string[] => {
    const keys = [...(heldByTask.get(taskId) ?? [])];
    heldByTask.delete(taskId);
    pendingWrites.delete(taskId);
    pendingDeletes.add(taskId);
    for (const key of keys) heldEntityKeys.delete(key);
    return keys;
  };

  const drain = (): PendingMarkers => {
    const pending = { writes: [...pendingWrites], deletes: [...pendingDeletes] };
    pendingWrites.clear();
    pendingDeletes.clear();
    return pending;
  };

  const restore = (pending: PendingMarkers): void => {
    for (const taskId of pending.writes) pendingWrites.add(taskId);
    for (const taskId of pending.deletes) pendingDeletes.add(taskId);
  };

  return {
    load,
    snapshot,
    installSnapshot,
    hold,
    activate,
    drain,
    restore,
    hasPending: (): boolean => pendingWrites.size > 0 || pendingDeletes.size > 0,
    isHeld: (key: string): boolean => heldEntityKeys.has(key),
    keysForTask: (taskId: string): string[] => [...(heldByTask.get(taskId) ?? [])],
    markerFile,
    marker: (taskId: string): HeldMarker => ({ version: 1, taskId, entityKeys: [...(heldByTask.get(taskId) ?? [])].sort() }),
  };
}
