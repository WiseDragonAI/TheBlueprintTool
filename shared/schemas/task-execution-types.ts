/**
 * WHAT: Defines replicated task-execution projections and ephemeral liveness observations shared with clients.
 * WHY: Runtime projections must not depend on the retired Codex store migration schema.
 */
export const taskExecutionPhases = [
  'preparing', 'queued', 'starting', 'running', 'cancelling',
  'succeeded', 'failed', 'cancelled', 'interrupted',
] as const;

export type TaskExecutionPhase = typeof taskExecutionPhases[number];

export type TaskExecutionObservation = {
  readonly executionId: string;
  readonly executorNodeId: string;
  readonly phase: 'starting' | 'running' | 'cancelling';
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly revision: number;
};

export type TaskExecutionDto = {
  readonly executionId: string;
  readonly sessionId: string;
  readonly projectId: string;
  readonly ledgerId: string;
  readonly taskId: string;
  readonly ownerCardId: string;
  readonly kind: 'thread' | 'continuation' | 'voice' | 'pipeline-skill';
  readonly pipelineRunId: string | null;
  readonly pipelineStepId: string | null;
  readonly pipelineSkillRunId: string | null;
  readonly phase: TaskExecutionPhase;
  readonly requestedAt: string;
  readonly phaseSince: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly executorNodeId: string | null;
  readonly processId: number | null;
  readonly processStartTime: string | null;
  readonly stdoutFile: string | null;
  readonly stderrFile: string | null;
  readonly result: { readonly status: 'succeeded' | 'failed' | 'cancelled' | 'interrupted'; readonly summary: string } | null;
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly revision: number;
  readonly live: boolean;
  readonly observation: TaskExecutionObservation | null;
  readonly validActions: readonly ('cancel' | 'restart' | 'open-log')[];
};
