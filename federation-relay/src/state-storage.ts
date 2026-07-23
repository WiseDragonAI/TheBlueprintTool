/**
 * WHAT: Owns epoch-4 relay storage keys, wire-envelope admission, and bucket derivation.
 * WHY: The relay controller should coordinate durable transactions without duplicating state encoding rules.
 */
import {
  hashTaskCurrentBucket,
  taskCurrentBucketForEntityKey,
  taskCurrentEntityKey,
} from '../../shared/task-current-state-core';
import { assertRelayEntity, type RelayEntity } from './current-state';

export const stateEntityBatchSize = 128;
export type StateBucket = { bucket: string; count: number; checksum: string; entries?: Record<string, string> };
export type StateEntry = { key: string; stateHash: string; entity: RelayEntity };
export type StoredStateEntry = { key: string; entityKey: string; bucket: string; entity: RelayEntity };

export function stateEntityPrefix(projectId: string, bucket = ''): string {
  return `state:v4:entity:${encodeURIComponent(projectId)}:${bucket ? `${encodeURIComponent(bucket)}:` : ''}`;
}

export function stateEntityStorageKey(projectId: string, bucket: string, entityKey: string): string {
  return `${stateEntityPrefix(projectId, bucket)}${encodeURIComponent(entityKey)}`;
}

export function stateBucketPrefix(projectId: string): string {
  return `state:v4:bucket:${encodeURIComponent(projectId)}:`;
}

export function stateBucketKey(projectId: string, bucket: string): string {
  return `${stateBucketPrefix(projectId)}${encodeURIComponent(bucket)}`;
}

export function summarizeBucket(bucket: string, entries: Record<string, string>): StateBucket {
  const checksum = hashTaskCurrentBucket(Object.entries(entries).map(([key, stateHash]) => [key, { stateHash }] as const));
  return { bucket, count: Object.keys(entries).length, checksum, entries };
}

export function mismatchedBuckets(local: StateBucket[], remote: StateBucket[]): string[] {
  const left = new Map(local.map((entry) => [entry.bucket, entry]));
  const right = new Map(remote.map((entry) => [entry.bucket, entry]));
  return [...new Set([...left.keys(), ...right.keys()])]
    .filter((bucket) => left.get(bucket)?.count !== right.get(bucket)?.count || left.get(bucket)?.checksum !== right.get(bucket)?.checksum)
    .sort();
}

export function admitStateEntries(projectId: string, wireEntries: StateEntry[]): StoredStateEntry[] {
  return wireEntries.map((entry) => {
    assertRelayEntity(entry.entity, projectId);
    const entityKey = taskCurrentEntityKey(entry.entity);
    // WHAT: Verify the independently declared envelope against the canonical entity.
    // WHY: An acknowledgement must identify the exact key and hash accepted durably.
    if (entry.key !== entityKey || entry.stateHash !== entry.entity.stateHash) throw new Error('invalid_state_entity_envelope');
    const bucket = taskCurrentBucketForEntityKey(entityKey);
    return { key: stateEntityStorageKey(projectId, bucket, entityKey), entityKey, bucket, entity: entry.entity };
  });
}
