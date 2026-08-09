/**
 * WHAT: Defines the epoch-4 protocol constants, domain lanes, and wire model.
 * WHY: Every participant must compile against the same schema and limits.
 */
export const taskStateProtocol = 'decision-os-task-state/4' as const;
export const taskCurrentStateVersion = 4 as const;
export const taskCurrentBaselineEpoch = 4 as const;
export const taskCurrentBucketCount = 256 as const;
export const taskCurrentEntityByteLimit = 64 * 1024;

export const taskEntityTypes = ['ledger', 'card', 'annotation', 'relationship', 'resource', 'thread-note', 'execution'] as const;
export const taskExecutionPhases = ['preparing', 'queued', 'starting', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled', 'interrupted'] as const;
export const taskExecutionKinds = ['thread', 'continuation', 'voice', 'pipeline-skill'] as const;
export type TaskEntityType = typeof taskEntityTypes[number];
export type TaskExecutionPhase = typeof taskExecutionPhases[number];
export type TaskExecutionKind = typeof taskExecutionKinds[number];
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

export type TaskCurrentDotCollision = {
  entityType: TaskEntityType;
  entityId: string;
  path: string;
  dot: TaskDot;
};

export type TaskRepairCollisionRejection = {
  code: 'task_current_dot_collision';
  key: string;
  stateHash: string;
  receiverStateHash: string;
  collisions: TaskCurrentDotCollision[];
};

export type TaskRepairCollisionEvidence = TaskRepairCollisionRejection & {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  attemptId: string;
  deliveryId: string;
  recordedAt: string;
  localEntity: TaskCurrentEntity;
  remoteEntity: TaskCurrentEntity;
};

export type TaskRepairCollisionRecoveryReceipt = {
  version: typeof taskCurrentStateVersion;
  projectId: string;
  attemptId: string;
  evidenceHash: string;
  replicaId: string;
  batchId: string;
  resultingStateHashes: Record<string, string>;
};

export type TaskAssignment = {
  nodeId: string;
  changedAt: string;
  revision: number;
};

export type TaskExecutionError = {
  code: string;
  message: string;
};

export type TaskExecutionResult = {
  status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
  summary: string;
};

export type TaskExecutionMetadata = {
  executionId: string;
  requestId: string;
  sessionId: string;
  projectId: string;
  ledgerId: string;
  taskId: string;
  sourceCardId: string;
  ownerCardId: string;
  kind: TaskExecutionKind;
  requestedAt: string;
  model: string | null;
  effort: string | null;
  pipelineRunId: string | null;
  pipelineStepId: string | null;
  pipelineSkillRunId: string | null;
  predecessorExecutionId: string | null;
  restartOfExecutionId: string | null;
};

export type TaskExecutionLifecycle = {
  phase: TaskExecutionPhase;
  phaseSince: string;
  startedAt: string | null;
  finishedAt: string | null;
  executorNodeId: string;
  providerSessionId: string | null;
  result: TaskExecutionResult | null;
  error: TaskExecutionError | null;
  revision: number;
};

export type TaskExecutionArtifactHead = {
  hash: string;
  bytes: number;
  mediaType: string;
};

export type TaskExecutionArtifacts = {
  jsonl: TaskExecutionArtifactHead | null;
  stderr: TaskExecutionArtifactHead | null;
  telemetry: TaskExecutionArtifactHead | null;
  result: TaskExecutionArtifactHead | null;
  changedAt: string;
  revision: number;
};
