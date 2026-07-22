/**
 * WHAT: Owns ordered persistence, task projection, observation, and publication for canonical Codex executions.
 * WHY: Callers must not publish or spawn from a lifecycle transition whose replicated task intent is still pending.
 */
import type {
  CodexExecutionDto,
  CodexExecutionError,
  CodexExecutionIntent,
  CodexExecutionObservation,
  CodexExecutionPhase,
  CodexExecutionRecord,
  CodexExecutionResult,
} from '../../../../../shared/schemas/codex-execution-types.js';
import { createCodexExecutionStore, type CodexExecutionStore } from './codex-execution-store.js';
import { isTerminalCodexExecutionPhase } from './codex-execution-transition.js';

export type CodexExecutionProjection = (input: {
  record: CodexExecutionRecord;
  intent: CodexExecutionIntent;
}) => Promise<void>;

export type CodexExecutionPublication = (input: {
  record: CodexExecutionRecord;
  intent: CodexExecutionIntent;
  observation: CodexExecutionObservation | null;
  execution: CodexExecutionDto;
}) => void | Promise<void>;

export class CodexExecutionProjectionPendingError extends Error {
  readonly code = 'codex_execution_projection_pending';
  constructor(readonly record: CodexExecutionRecord, readonly cause: unknown) {
    super(`Execution ${record.executionId} is durable at revision ${record.revision}, but its task projection is pending: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export function codexExecutionIntent(record: CodexExecutionRecord): CodexExecutionIntent {
  return {
    executionId: record.executionId,
    phase: record.phase,
    requestedAt: record.requestedAt,
    phaseSince: record.phaseSince,
    executorNodeId: record.executorNodeId,
    changedAt: record.phaseSince,
    settledAt: record.finishedAt,
    error: record.error,
    revision: record.revision,
  };
}

export function legacyCodexExecutionStatus(phase: CodexExecutionPhase): 'pending' | 'running' | 'complete' | 'failed' | 'cancelled' {
  if (phase === 'preparing' || phase === 'queued') return 'pending';
  if (phase === 'starting' || phase === 'running') return 'running';
  if (phase === 'succeeded') return 'complete';
  if (phase === 'cancelled') return 'cancelled';
  return 'failed';
}

function activeObservationPhase(phase: CodexExecutionPhase): phase is CodexExecutionObservation['phase'] {
  return phase === 'starting' || phase === 'running';
}

export function createCodexExecutionCoordinator(input: {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  project: CodexExecutionProjection;
  publish: CodexExecutionPublication;
  observationTtlMs?: number;
  now?: () => Date;
  store?: CodexExecutionStore;
  onBackgroundError?: (error: unknown, context: { operation: string; executionId: string }) => void;
  assertAvailable?: () => void;
}) {
  const store = input.store ?? createCodexExecutionStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId });
  const now = input.now ?? (() => new Date());
  const observationTtlMs = input.observationTtlMs ?? 15_000;
  const observations = new Map<string, CodexExecutionObservation>();
  const heartbeatTimers = new Map<string, NodeJS.Timeout>();
  let commandQueue = Promise.resolve();

  const serial = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = commandQueue.then(operation);
    commandQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const observationFor = (record: CodexExecutionRecord): CodexExecutionObservation | null => {
    const observation = observations.get(record.executionId) ?? null;
    if (!observation || observation.revision !== record.revision || Date.parse(observation.expiresAt) <= now().getTime()) return null;
    return observation;
  };

  const dtoForRecord = (record: CodexExecutionRecord): CodexExecutionDto => {
    const observation = observationFor(record);
    const validActions: CodexExecutionDto['validActions'] = isTerminalCodexExecutionPhase(record.phase)
      ? ['restart', 'open-log']
      : ['cancel', 'open-log'];
    return { ...record, live: Boolean(observation), observation, validActions };
  };

  const publishProjected = async (record: CodexExecutionRecord): Promise<CodexExecutionRecord> => {
    const intent = codexExecutionIntent(record);
    try {
      await input.project({ record, intent });
    } catch (error) {
      throw new CodexExecutionProjectionPendingError(record, error);
    }
    await input.publish({ record, intent, observation: observationFor(record), execution: dtoForRecord(record) });
    return record;
  };

  const transition = async (transitionInput: Parameters<CodexExecutionStore['transition']>[0]): Promise<CodexExecutionRecord> => {
    const record = store.transition({ ...transitionInput, changedAt: transitionInput.changedAt ?? now().toISOString() });
    return publishProjected(record);
  };

  const observeNow = async (executionId: string): Promise<CodexExecutionObservation> => {
    const record = store.find(executionId);
    if (!record) throw new Error('codex_execution_not_found');
    if (record.executorNodeId !== input.nodeId) throw new Error('codex_execution_observer_not_executor');
    if (!activeObservationPhase(record.phase)) throw new Error('codex_execution_observation_phase_invalid');
    const observedAt = now();
    const observation: CodexExecutionObservation = {
      executionId,
      executorNodeId: input.nodeId,
      phase: record.phase,
      observedAt: observedAt.toISOString(),
      expiresAt: new Date(observedAt.getTime() + observationTtlMs).toISOString(),
      revision: record.revision,
    };
    observations.set(executionId, observation);
    await input.publish({ record, intent: codexExecutionIntent(record), observation, execution: dtoForRecord(record) });
    return observation;
  };

  const stopHeartbeat = (executionId: string): void => {
    const timer = heartbeatTimers.get(executionId);
    if (timer) clearInterval(timer);
    heartbeatTimers.delete(executionId);
  };

  const startHeartbeat = (executionId: string): void => {
    stopHeartbeat(executionId);
    const timer = setInterval(() => {
      void serial(() => observeNow(executionId)).catch((error: unknown) => {
        stopHeartbeat(executionId);
        input.onBackgroundError?.(error, { operation: 'publish-codex-execution-heartbeat', executionId });
      });
    }, Math.max(250, Math.floor(observationTtlMs / 3)));
    timer.unref?.();
    heartbeatTimers.set(executionId, timer);
  };

  const dto = (executionId: string): CodexExecutionDto | null => {
    const record = store.find(executionId);
    return record ? dtoForRecord(record) : null;
  };

  const dtoForSession = (sessionId: string, ownerCardId = ''): CodexExecutionDto | null => {
    const record = store.read().executions
      .filter((candidate) => candidate.sessionId === sessionId && (!ownerCardId || candidate.ownerCardId === ownerCardId || candidate.taskId === ownerCardId))
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.revision - left.revision)[0];
    return record ? dto(record.executionId) : null;
  };

  return {
    store,
    intent: codexExecutionIntent,
    dto,
    dtoForSession,
    observe: (executionId: string): Promise<CodexExecutionObservation> => serial(() => observeNow(executionId)),
    reproject: (executionId: string): Promise<CodexExecutionRecord> => serial(async () => {
      const record = store.find(executionId);
      if (!record) throw new Error('codex_execution_not_found');
      return publishProjected(record);
    }),
    admit: (recordInput: Parameters<CodexExecutionStore['create']>[0]): Promise<CodexExecutionRecord> => serial(() => {
      input.assertAvailable?.();
      return publishProjected(store.create({
        ...recordInput,
        requestedAt: recordInput.requestedAt ?? now().toISOString(),
      }));
    }),
    enqueue: (executionId: string): Promise<CodexExecutionRecord> => serial(() => transition({ expectedExecutionId: executionId, phase: 'queued' })),
    claim: (executionId: string, executorNodeId = input.nodeId): Promise<CodexExecutionRecord> => serial(() => {
      input.assertAvailable?.();
      return transition({ expectedExecutionId: executionId, phase: 'starting', executorNodeId });
    }),
    spawned: (executionId: string, process: { processId: number | null; processStartTime: string | null; stdoutFile: string | null; stderrFile: string | null }): Promise<CodexExecutionRecord> => serial(async () => {
      const record = await transition({ expectedExecutionId: executionId, phase: 'running', ...process });
      await observeNow(executionId);
      startHeartbeat(executionId);
      return record;
    }),
    heartbeat: (executionId: string): Promise<CodexExecutionObservation> => serial(() => observeNow(executionId)),
    adoptRunning: (executionId: string): Promise<CodexExecutionObservation> => serial(async () => {
      input.assertAvailable?.();
      const record = store.find(executionId);
      if (!record || record.phase !== 'running' || record.executorNodeId !== input.nodeId) throw new Error('codex_execution_adoption_invalid');
      const observation = await observeNow(executionId);
      startHeartbeat(executionId);
      return observation;
    }),
    settle: (executionId: string, settlement: {
      phase: 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
      result?: CodexExecutionResult | null;
      error?: CodexExecutionError | null;
    }): Promise<CodexExecutionRecord> => serial(() => {
      stopHeartbeat(executionId);
      observations.delete(executionId);
      return transition({ expectedExecutionId: executionId, ...settlement });
    }),
    cancel: (executionId: string, summary = 'Cancelled by operator.'): Promise<CodexExecutionRecord> => serial(() => {
      stopHeartbeat(executionId);
      observations.delete(executionId);
      return transition({ expectedExecutionId: executionId, phase: 'cancelled', result: { status: 'cancelled', summary } });
    }),
    requeueInterrupted: (executionId: string): Promise<CodexExecutionRecord> => serial(() => transition({ expectedExecutionId: executionId, phase: 'queued' })),
    deleteSession: (sessionId: string): Promise<readonly CodexExecutionRecord[]> => serial(async () => store.deleteSession(sessionId)),
    dispose: (): void => {
      for (const executionId of heartbeatTimers.keys()) stopHeartbeat(executionId);
      observations.clear();
    },
  };
}

export type CodexExecutionCoordinator = ReturnType<typeof createCodexExecutionCoordinator>;
