/**
 * WHAT: Derives entity keys, fixed buckets, bucket hashes, and project roots.
 * WHY: Closed-loop anti-entropy must compare the same canonical hierarchy everywhere.
 */
import type { TaskCurrentBucket, TaskCurrentEntity } from './model.js';
import { sha256 } from './sha256.js';

export function taskCurrentEntityKey(entity: Pick<TaskCurrentEntity, 'entityType' | 'entityId'>): string {
  return `${entity.entityType}\u0000${entity.entityId}`;
}

export function taskCurrentBucketForEntityKey(key: string): string {
  return sha256(key).slice(0, 2);
}

export function hashTaskCurrentBucket(entries: Iterable<readonly [string, Pick<TaskCurrentEntity, 'stateHash'>]>): string {
  return sha256([...entries].sort(([left], [right]) => left.localeCompare(right)).map(([key, entity]) => `${key}\u0000${entity.stateHash}`).join('\n'));
}

export function hashTaskCurrentRoot(buckets: Iterable<TaskCurrentBucket>): string {
  return sha256([...buckets].sort((left, right) => left.bucket.localeCompare(right.bucket)).map((bucket) => `${bucket.bucket}\u0000${bucket.count}\u0000${bucket.checksum}`).join('\n'));
}
