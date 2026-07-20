/**
 * WHAT: Defines the identity and status vocabulary shared by durable Codex execution owners.
 * WHY: Card leases, queue entries, runtime processes, events, and clients must carry one exact contract.
 */

export type CodexExecutionStatus = 'pending' | 'running' | 'complete' | 'failed' | 'cancelled';

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
