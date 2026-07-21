/**
 * WHAT: Defines the causal current-state model exchanged by task replicas.
 * WHY: Replication correctness depends on bounded joinable state instead of permanent operation history.
 */
export const taskCurrentStateVersion = 2 as const;
export const taskEntityTypes = ['ledger', 'card', 'annotation', 'relationship', 'resource', 'thread-note'] as const;

export type TaskEntityType = typeof taskEntityTypes[number];
export type TaskFieldOperation = 'set' | 'add' | 'remove' | 'tombstone';
export type TaskCausalClock = Record<string, number>;

export type TaskDot = {
  replicaId: string;
  counter: number;
};

export type TaskFieldChange = {
  path: string;
  operation: TaskFieldOperation;
  value?: unknown;
};

export type TaskEntityChange = {
  entityType: TaskEntityType;
  entityId: string;
  changes: TaskFieldChange[];
};

export type TaskRegisterCandidate = {
  dot: TaskDot;
  operation: TaskFieldOperation;
  value?: unknown;
};

export type TaskCurrentRegister = {
  clock: TaskCausalClock;
  candidates: TaskRegisterCandidate[];
};

export type TaskCurrentEntity = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  entityType: TaskEntityType;
  entityId: string;
  fields: Record<string, TaskCurrentRegister>;
  activationTaskId?: string;
  replication: 'active' | 'held';
  stateHash: string;
};

export type TaskMutationBatch = {
  version: typeof taskCurrentStateVersion;
  batchId: string;
  projectId: string;
  replicaId: string;
  emittedAt: string;
  dot: TaskDot;
  context: TaskCausalClock;
  changes: TaskEntityChange[];
  activationTaskId: string;
  replication: 'active' | 'held';
};

export type TaskStateDelta = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  entities: TaskCurrentEntity[];
};

export type TaskProjectionConflict = {
  emittedAt: string;
  entityType: TaskEntityType;
  entityId: string;
  path: string;
  candidates: Array<{
    dot: TaskDot;
    replicaId: string;
    operation: TaskFieldOperation;
    value?: unknown;
  }>;
};

export type TaskCurrentProjection = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  ledger: Record<string, unknown>;
  conflicts: TaskProjectionConflict[];
  clock: TaskCausalClock;
};

export type TaskCurrentBucket = {
  bucket: string;
  count: number;
  checksum: string;
};

export type TaskCurrentFormat = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  baselineRoot: string;
};
