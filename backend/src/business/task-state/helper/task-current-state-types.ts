/**
 * WHAT: Exposes the shared epoch-4 wire model plus node-local mutation and projection types.
 * WHY: Node state must compile against the exact schema used by the relay and offline migration.
 */
export {
  taskCurrentBaselineEpoch,
  taskCurrentBucketCount,
  taskCurrentEntityByteLimit,
  taskCurrentStateVersion,
  taskEntityTypes,
  taskStateProtocol,
} from '../../../../../shared/task-current-state-core.js';
export type {
  TaskCausalClock,
  TaskCurrentBucket,
  TaskCurrentEntity,
  TaskCurrentRegister,
  TaskDot,
  TaskEntityType,
  TaskExecutionArtifacts,
  TaskExecutionArtifactHead,
  TaskExecutionError,
  TaskExecutionKind,
  TaskExecutionLifecycle,
  TaskExecutionMetadata,
  TaskExecutionPhase,
  TaskExecutionResult,
  TaskFieldOperation,
  TaskRegisterCandidate,
} from '../../../../../shared/task-current-state-core.js';

import type {
  TaskCausalClock,
  TaskCurrentEntity,
  TaskDot,
  TaskEntityType,
  TaskFieldOperation,
} from '../../../../../shared/task-current-state-core.js';
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../../../../shared/task-current-state-core.js';

export type TaskFieldChange = { path: string; operation: TaskFieldOperation; value?: unknown };
export type TaskEntityChange = { entityType: TaskEntityType; entityId: string; changes: TaskFieldChange[] };

/** Node-local journal command. Publication metadata never enters TaskCurrentEntity. */
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
  kind: 'state-conflict' | 'task-conflict' | 'assignment-conflict' | 'execution-conflict';
  emittedAt: string;
  entityType: TaskEntityType;
  entityId: string;
  path: string;
  candidates: Array<{ dot: TaskDot; replicaId: string; operation: TaskFieldOperation; value?: unknown }>;
};

export type TaskCurrentProjection = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  ledger: Record<string, unknown>;
  conflicts: TaskProjectionConflict[];
  clock: TaskCausalClock;
};

export type TaskCurrentFormat = {
  stateProtocol: typeof taskStateProtocol;
  stateSchema: typeof taskCurrentStateVersion;
  baselineEpoch: typeof taskCurrentBaselineEpoch;
  projectId: string;
  baselineRoot: string;
  inventoryVersion?: 1;
};
