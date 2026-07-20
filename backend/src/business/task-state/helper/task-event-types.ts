/** Immutable structured mutations used to reconstruct the canonical task projection. */
export const taskEventReducerVersion = 2;

export type TaskEntityType = 'ledger' | 'card' | 'annotation' | 'relationship';
export type TaskFieldOperation = 'set' | 'add' | 'remove' | 'tombstone';

export type TaskFieldChange = {
  path: string;
  operation: TaskFieldOperation;
  value?: unknown;
};

export type TaskFieldEvent = {
  eventId: string;
  projectId: string;
  writerId: string;
  emittedAt: string;
  /** Project-scoped Lamport revision. Wall-clock time is diagnostic only. */
  revision?: number;
  entityType: TaskEntityType;
  entityId: string;
  changes: TaskFieldChange[];
  checksum: string;
};

export type TaskConflictCandidate = {
  eventId: string;
  writerId: string;
  operation: TaskFieldOperation;
  value?: unknown;
};

export type TaskProjectionConflict = {
  emittedAt: string;
  entityType: TaskEntityType;
  entityId: string;
  path: string;
  candidates: TaskConflictCandidate[];
};

export type TaskProjection = {
  version: 1;
  reducerVersion?: number;
  projectId: string;
  ledger: Record<string, unknown>;
  conflicts: TaskProjectionConflict[];
  appliedEventIds: string[];
  /** Highest causal revision materialized by this projection. */
  lastRevision?: number;
  /** Last causal revision applied to each entity field. */
  fieldRevisions?: Record<string, number>;
};

export type TaskBucketManifestEntry = {
  bucket: string;
  count: number;
  checksum: string;
};

export type TaskStateSnapshotManifest = {
  version: 1;
  snapshotId: string;
  projectId: string;
  reducerVersion: number;
  createdAt: string;
  throughBucket: string;
  projectionChecksum: string;
  snapshotChecksum: string;
  size: number;
  eventBuckets: TaskBucketManifestEntry[];
};

export type TaskStateSnapshot = {
  manifest: TaskStateSnapshotManifest;
  projection: TaskProjection;
};
