/**
 * WHAT: Records and verifies the complete physical epoch-4 entity-shard inventory.
 * WHY: Missing current-state files must pause one project instead of becoming a valid partial task projection.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  hashTaskCurrentBucket,
  hashTaskCurrentRoot,
  taskCurrentBucketForEntityKey,
  type TaskCurrentBucket,
  type TaskCurrentEntity,
} from '../../../../../shared/task-current-state-core.js';
import type { HeldMarker } from './task-local-publication-state.js';

export const taskCurrentInventoryVersion = 1 as const;

export type TaskCurrentInventoryEntry = { key: string; stateHash: string };
export type TaskCurrentInventoryBucketDocument = {
  version: typeof taskCurrentInventoryVersion;
  projectId: string;
  bucket: string;
  entries: TaskCurrentInventoryEntry[];
  checksum: string;
};
export type TaskCurrentInventoryRootDocument = {
  version: typeof taskCurrentInventoryVersion;
  projectId: string;
  entityRoot: string;
  buckets: TaskCurrentBucket[];
  held: HeldMarker[];
};

type PhysicalBuckets = Map<string, Map<string, Pick<TaskCurrentEntity, 'stateHash'>>>;

export const taskCurrentInventoryRootFile = (root: string): string => resolve(root, 'inventory.json');
export const taskCurrentInventoryDirectory = (root: string): string => resolve(root, 'inventory');
export const taskCurrentInventoryBucketFile = (root: string, bucket: string): string => resolve(taskCurrentInventoryDirectory(root), `${bucket}.json`);

function inventoryError(code: string, detail = ''): Error {
  return new Error(detail ? `${code}:${detail}` : code);
}

function sortedHeld(markers: HeldMarker[]): HeldMarker[] {
  return markers.map((marker) => ({
    version: 1 as const,
    taskId: marker.taskId,
    entityKeys: marker.entityKeys.slice().sort(),
  })).sort((left, right) => left.taskId.localeCompare(right.taskId));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertBucketSummary(value: unknown): asserts value is TaskCurrentBucket {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw inventoryError('invalid_task_current_inventory_bucket_summary');
  const summary = value as Record<string, unknown>;
  if (!/^[0-9a-f]{2}$/.test(String(summary.bucket ?? ''))
    || !Number.isInteger(summary.count) || Number(summary.count) < 1
    || !/^[0-9a-f]{64}$/.test(String(summary.checksum ?? ''))) {
    throw inventoryError('invalid_task_current_inventory_bucket_summary');
  }
}

function parseBucketDocument(file: string, projectId: string, expectedBucket: string): TaskCurrentInventoryBucketDocument {
  const document = JSON.parse(readFileSync(file, 'utf8')) as TaskCurrentInventoryBucketDocument;
  if (document.version !== taskCurrentInventoryVersion
    || document.projectId !== projectId
    || document.bucket !== expectedBucket
    || !Array.isArray(document.entries)
    || !/^[0-9a-f]{2}$/.test(document.bucket)) {
    throw inventoryError('invalid_task_current_inventory_bucket', expectedBucket);
  }
  const seen = new Set<string>();
  for (const entry of document.entries) {
    if (!entry || typeof entry !== 'object'
      || typeof entry.key !== 'string' || !entry.key
      || !/^[0-9a-f]{64}$/.test(String(entry.stateHash ?? ''))
      || seen.has(entry.key)
      || taskCurrentBucketForEntityKey(entry.key) !== expectedBucket) {
      throw inventoryError('invalid_task_current_inventory_entry', expectedBucket);
    }
    seen.add(entry.key);
  }
  const canonical = buildTaskCurrentInventoryBucket(projectId, expectedBucket, new Map(document.entries.map((entry) => [entry.key, { stateHash: entry.stateHash }])));
  if (document.checksum !== canonical.checksum || !sameJson(document.entries, canonical.entries)) {
    throw inventoryError('invalid_task_current_inventory_bucket_checksum', expectedBucket);
  }
  return document;
}

function parseRootDocument(root: string, projectId: string): TaskCurrentInventoryRootDocument {
  const file = taskCurrentInventoryRootFile(root);
  if (!existsSync(file)) throw inventoryError('task_current_inventory_missing_root');
  const document = JSON.parse(readFileSync(file, 'utf8')) as TaskCurrentInventoryRootDocument;
  if (document.version !== taskCurrentInventoryVersion
    || document.projectId !== projectId
    || !Array.isArray(document.buckets)
    || !Array.isArray(document.held)) {
    throw inventoryError('invalid_task_current_inventory_root');
  }
  const buckets = new Set<string>();
  for (const summary of document.buckets) {
    assertBucketSummary(summary);
    if (buckets.has(summary.bucket)) throw inventoryError('duplicate_task_current_inventory_bucket', summary.bucket);
    buckets.add(summary.bucket);
  }
  if (!sameJson(document.buckets, document.buckets.slice().sort((left, right) => left.bucket.localeCompare(right.bucket)))
    || document.entityRoot !== hashTaskCurrentRoot(document.buckets)) {
    throw inventoryError('invalid_task_current_inventory_root_hash');
  }
  const held = sortedHeld(document.held);
  if (!sameJson(document.held, held) || held.some((marker) => marker.version !== 1 || !marker.taskId || !Array.isArray(marker.entityKeys))) {
    throw inventoryError('invalid_task_current_inventory_held');
  }
  return document;
}

export function buildTaskCurrentInventoryBucket(
  projectId: string,
  bucket: string,
  entries: Map<string, Pick<TaskCurrentEntity, 'stateHash'>>,
): TaskCurrentInventoryBucketDocument {
  const ordered = [...entries].sort(([left], [right]) => left.localeCompare(right));
  return {
    version: taskCurrentInventoryVersion,
    projectId,
    bucket,
    entries: ordered.map(([key, entity]) => ({ key, stateHash: entity.stateHash })),
    checksum: hashTaskCurrentBucket(ordered),
  };
}

export function buildTaskCurrentInventoryRoot(
  projectId: string,
  buckets: Iterable<TaskCurrentBucket>,
  held: HeldMarker[],
): TaskCurrentInventoryRootDocument {
  const summaries = [...buckets].sort((left, right) => left.bucket.localeCompare(right.bucket)).map((summary) => ({ ...summary }));
  return {
    version: taskCurrentInventoryVersion,
    projectId,
    entityRoot: hashTaskCurrentRoot(summaries),
    buckets: summaries,
    held: sortedHeld(held),
  };
}

export function validateTaskCurrentInventory(input: {
  root: string;
  projectId: string;
  physicalBuckets: PhysicalBuckets;
  held: HeldMarker[];
  journalEntityKeys: Set<string>;
  journalTaskIds: Set<string>;
}): void {
  const rootDocument = parseRootDocument(input.root, input.projectId);
  const rootSummaries = new Map(rootDocument.buckets.map((summary) => [summary.bucket, summary]));
  const touchedBuckets = new Set([...input.journalEntityKeys].map(taskCurrentBucketForEntityKey));
  const inventoryDirectory = taskCurrentInventoryDirectory(input.root);
  const bucketFiles = existsSync(inventoryDirectory)
    ? readdirSync(inventoryDirectory).filter((name) => name.endsWith('.json')).sort()
    : [];
  const storedBuckets = new Set(bucketFiles.map((name) => name.slice(0, -'.json'.length)));
  const allBuckets = new Set([...rootSummaries.keys(), ...storedBuckets, ...input.physicalBuckets.keys()]);

  for (const bucket of [...allBuckets].sort()) {
    if (!/^[0-9a-f]{2}$/.test(bucket)) throw inventoryError('invalid_task_current_inventory_bucket_file', bucket);
    const rootSummary = rootSummaries.get(bucket);
    const bucketFile = taskCurrentInventoryBucketFile(input.root, bucket);
    if (rootSummary && !existsSync(bucketFile)) throw inventoryError('task_current_inventory_missing_bucket', bucket);
    const document = existsSync(bucketFile) ? parseBucketDocument(bucketFile, input.projectId, bucket) : null;
    const actual = input.physicalBuckets.get(bucket) ?? new Map<string, Pick<TaskCurrentEntity, 'stateHash'>>();

    if (document) {
      const documentSummary = { bucket, count: document.entries.length, checksum: document.checksum };
      if (rootSummary && !sameJson(rootSummary, documentSummary) && !touchedBuckets.has(bucket)) {
        throw inventoryError('task_current_inventory_root_bucket_mismatch', bucket);
      }
      if (!rootSummary && !touchedBuckets.has(bucket)) throw inventoryError('task_current_inventory_untracked_bucket', bucket);
      const expected = new Map(document.entries.map((entry) => [entry.key, entry.stateHash]));
      for (const [key, stateHash] of expected) {
        const current = actual.get(key);
        // A retained journal can explain a newer shard, never the disappearance of a shard already inventoried.
        if (!current) throw inventoryError('task_current_inventory_missing_entity', key);
        if (current.stateHash !== stateHash && !input.journalEntityKeys.has(key)) {
          throw inventoryError('task_current_inventory_entity_hash_mismatch', key);
        }
      }
      for (const key of actual.keys()) {
        if (!expected.has(key) && !input.journalEntityKeys.has(key)) {
          throw inventoryError('task_current_inventory_untracked_entity', key);
        }
      }
    } else if (actual.size > 0 && [...actual.keys()].some((key) => !input.journalEntityKeys.has(key))) {
      throw inventoryError('task_current_inventory_missing_bucket', bucket);
    }
  }

  const expectedHeld = new Map(rootDocument.held.map((marker) => [marker.taskId, marker]));
  const actualHeld = new Map(sortedHeld(input.held).map((marker) => [marker.taskId, marker]));
  for (const taskId of new Set([...expectedHeld.keys(), ...actualHeld.keys()])) {
    if (!sameJson(expectedHeld.get(taskId), actualHeld.get(taskId)) && !input.journalTaskIds.has(taskId)) {
      throw inventoryError('task_current_inventory_held_mismatch', taskId);
    }
  }
  for (const marker of [...rootDocument.held, ...input.held]) {
    for (const key of marker.entityKeys) {
      const bucket = input.physicalBuckets.get(taskCurrentBucketForEntityKey(key));
      if (!bucket?.has(key)) throw inventoryError('task_current_inventory_missing_held_entity', key);
    }
  }
}
