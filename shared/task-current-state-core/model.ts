/**
 * WHAT: Defines the epoch-3 protocol constants and wire model.
 * WHY: Every participant must compile against the same schema and limits.
 */
export const taskStateProtocol = 'decision-os-task-state/3' as const;
export const taskCurrentStateVersion = 3 as const;
export const taskCurrentBaselineEpoch = 3 as const;
export const taskCurrentBucketCount = 256 as const;
export const taskCurrentEntityByteLimit = 64 * 1024;

export const taskEntityTypes = ['ledger', 'card', 'annotation', 'relationship', 'resource', 'thread-note'] as const;
export type TaskEntityType = typeof taskEntityTypes[number];
export type TaskFieldOperation = 'set' | 'add' | 'remove' | 'tombstone';
export type TaskCausalClock = Record<string, number>;
export type TaskDot = { replicaId: string; counter: number };
export type TaskRegisterCandidate = { dot: TaskDot; operation: TaskFieldOperation; value?: unknown };
export type TaskCurrentRegister = { clock: TaskCausalClock; candidates: TaskRegisterCandidate[] };
export type TaskCurrentEntity = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  entityType: TaskEntityType;
  entityId: string;
  fields: Record<string, TaskCurrentRegister>;
  stateHash: string;
};
export type TaskCurrentBucket = { bucket: string; count: number; checksum: string };
