/**
 * WHAT: Defines the canonical Codex execution contract shared by persistence, replication, runtime, and clients.
 * WHY: Every projection must describe one revisioned attempt instead of reconstructing lifecycle from queue and log aliases.
 */

export const codexExecutionStoreVersion = 1 as const;

export const codexExecutionPhases = [
  'preparing',
  'queued',
  'starting',
  'running',
  'cancelling',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
] as const;

export type CodexExecutionPhase = typeof codexExecutionPhases[number];
export type CodexExecutionStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled';
export type CodexExecutionKind = 'thread' | 'continuation' | 'voice' | 'pipeline-skill';

export type CodexExecutionError = {
  readonly code: string;
  readonly message: string;
};

export type CodexExecutionResult = {
  readonly status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
  readonly summary: string;
};

export type CodexExecutionRecord = {
  readonly executionId: string;
  readonly sessionId: string;
  readonly projectId: string;
  readonly ledgerId: string;
  readonly taskId: string;
  readonly ownerCardId: string;
  readonly kind: CodexExecutionKind;
  readonly pipelineRunId: string | null;
  readonly pipelineStepId: string | null;
  readonly pipelineSkillRunId: string | null;
  readonly phase: CodexExecutionPhase;
  readonly requestedAt: string;
  readonly phaseSince: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly executorNodeId: string | null;
  readonly processId: number | null;
  readonly processStartTime: string | null;
  readonly stdoutFile: string | null;
  readonly stderrFile: string | null;
  readonly result: CodexExecutionResult | null;
  readonly error: CodexExecutionError | null;
  readonly revision: number;
};

export type CodexExecutionStoreDocument = {
  readonly version: typeof codexExecutionStoreVersion;
  readonly projectId: string;
  readonly updatedAt: string;
  readonly executions: readonly CodexExecutionRecord[];
};

export type CodexExecutionIntent = {
  readonly executionId: string;
  readonly phase: CodexExecutionPhase;
  readonly requestedAt: string;
  readonly phaseSince: string;
  readonly executorNodeId: string | null;
  readonly changedAt: string;
  readonly settledAt: string | null;
  readonly error: CodexExecutionError | null;
  readonly revision: number;
};

export type CodexExecutionObservation = {
  readonly executionId: string;
  readonly executorNodeId: string;
  readonly phase: 'starting' | 'running' | 'cancelling';
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly revision: number;
};

export type CodexExecutionDto = CodexExecutionRecord & {
  readonly live: boolean;
  readonly observation: CodexExecutionObservation | null;
  readonly validActions: readonly ('cancel' | 'restart' | 'open-log')[];
};

export type CodexExecutionLease = {
  readonly runId: string;
  readonly executionId: string;
};

export type CodexProcessQueuePayload = CodexExecutionLease & {
  readonly ledgerId: string;
  readonly cardId: string;
  readonly threadId?: string;
  readonly newSession?: boolean;
  readonly codexModel?: string;
  readonly codexEffort?: string;
  readonly traceId?: string;
  readonly disallowSkills?: boolean;
  readonly [key: string]: unknown;
};

export type CodexRuntimeRun = CodexExecutionLease & {
  readonly id: string;
  readonly ledgerId: string;
  readonly outputCardId: string;
  status: CodexExecutionStatus;
  readonly [key: string]: unknown;
};

export type CodexLifecycleEvent = CodexExecutionLease & {
  readonly ledgerId: string;
  readonly cardId: string;
  readonly threadId: string;
  readonly status: CodexExecutionStatus;
  readonly outputCardId?: string;
  readonly pipelineRunId?: string;
  readonly [key: string]: unknown;
};
