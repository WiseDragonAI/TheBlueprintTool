/**
 * WHAT: Coordinates one global Codex capacity and queue across project runtimes.
 * WHY: Process admission must not be recreated inside HTTP server composition.
 */
import { normalizedConcurrentCodexProcesses } from '../../server/helper/save-codex-process-settings.js';
import {
  nextPendingCodexProcessCreatedAt,
  pendingCodexProcessEntries,
  scheduleCodexProcesses,
} from '../helper/codex-process-scheduler.js';
import { createCodexCapacitySlots } from '../helper/codex-capacity-slots.js';
import {
  scheduleCodexRuntime,
  scheduleCodexRuntimeTimer,
} from '../helper/codex-runtime-run-store.js';
import { RuntimeScopePausedError } from '../../server/helper/runtime-incident-ledger.js';
import type { IncidentSupervisor } from '../../server/runtime/incident-supervisor.js';

type AnyRecord = Record<string, unknown>;
type SchedulerContext = { root: string; runtime: AnyRecord };
type DeferredPipelineStoreInspection = { scope: string; retryAt: number };

const pipelineStoreStabilityDelayMs = 1_000;

export function createCodexProcessCoordinator(input: {
  contexts: () => SchedulerContext[];
  incidentSupervisor: IncidentSupervisor;
  runtime: AnyRecord;
}) {
  const capacity = (): number => {
    const settings = input.runtime.decisionOsSettings
      && typeof input.runtime.decisionOsSettings === 'object'
      ? input.runtime.decisionOsSettings as AnyRecord
      : {};
    return normalizedConcurrentCodexProcesses(
      process.env.CODEX_MAX_CONCURRENT_PROCESSES
        ?? settings.maxConcurrentCodexProcesses
        ?? 1,
    ) ?? 1;
  };
  const scheduledRunningCount = (): number => {
    const registries = new Set<Map<string, unknown>>();
    for (const context of input.contexts()) {
      if (context.runtime.taskExecutionProcesses instanceof Map) {
        registries.add(context.runtime.taskExecutionProcesses as Map<string, unknown>);
      }
    }
    return [...registries].reduce((count, registry) => count + registry.size, 0);
  };
  const sharedCapacitySlots = createCodexCapacitySlots({
    capacity,
    externalRunningCount: scheduledRunningCount,
  });
  const runningCount = (): number => (
    scheduledRunningCount() + sharedCapacitySlots.reservedCount()
  );
  const deferredPipelineStoreInspections = new Map<string, DeferredPipelineStoreInspection>();
  const deferPipelineStorePause = (
    candidate: SchedulerContext,
    error: unknown,
  ): boolean => {
    // WHAT: Defer only a pipeline-store pause raised while the scheduler is reading one project queue.
    // WHY: Other runtime-scope failures have no atomic external-writer recovery contract and must remain immediately contained.
    if (!(error instanceof RuntimeScopePausedError) || !error.scope.startsWith('codex-pipeline-store:')) {
      return false;
    }
    const current = deferredPipelineStoreInspections.get(candidate.root);
    // WHAT: Start one bounded stability window for a newly observed upstream store incident.
    // WHY: Git checkout and another non-atomic external writer can expose incomplete JSON briefly despite canonical app writes being atomic.
    if (!current || current.scope !== error.scope) {
      const retryAt = Date.now() + pipelineStoreStabilityDelayMs;
      deferredPipelineStoreInspections.set(candidate.root, { scope: error.scope, retryAt });
      scheduleCodexRuntimeTimer(
        candidate.runtime,
        'pipeline-store-stability-reinspection',
        pipelineStoreStabilityDelayMs,
        'reinspect-project-codex-pipeline-store',
        () => scheduleCodexRuntime(
          candidate.runtime,
          'reinspect-project-codex-pipeline-store',
          { projectId: String(candidate.runtime.projectId ?? ''), decisionOsRoot: candidate.root },
        ),
        { projectId: String(candidate.runtime.projectId ?? ''), decisionOsRoot: candidate.root },
      );
      return true;
    }
    // WHAT: Keep the queue closed without promoting the upstream incident before its bounded re-read is due.
    // WHY: Concurrent queue-position reads must not shorten the stability window and recreate the false durable pause.
    if (Date.now() < current.retryAt) return true;
    deferredPipelineStoreInspections.delete(candidate.root);
    return false;
  };
  const inspect = <Value>(
    candidate: SchedulerContext,
    operation: string,
    read: () => Value,
  ): Value | null => {
    if (candidate.runtime.codexRuntimePaused === true) return null;
    try {
      const result = read();
      deferredPipelineStoreInspections.delete(candidate.root);
      return result;
    } catch (error) {
      // WHAT: Suppress the downstream runtime pause only during the single pipeline-store stability window.
      // WHY: The upstream incident already blocks execution and preserves evidence while the scheduler performs its bounded re-read.
      if (deferPipelineStorePause(candidate, error)) return null;
      const report = candidate.runtime.onCodexBackgroundError;
      if (typeof report === 'function') {
        try {
          report({
            operation,
            error,
            context: {
              projectId: String(candidate.runtime.projectId ?? ''),
              decisionOsRoot: candidate.root,
              ...(error instanceof RuntimeScopePausedError
                ? { upstreamScope: error.scope }
                : {}),
            },
          });
        } catch {
          // Diagnostics cannot turn a contained inspection failure into a global failure.
        }
      }
      return null;
    }
  };
  const queuePosition = (id: string): number => {
    const pending = input.contexts().flatMap((candidate, rootOrder) => (
      inspect(
        candidate,
        'inspect-project-codex-queue-position',
        () => pendingCodexProcessEntries(candidate.root, candidate.runtime),
      ) ?? []
    ).map((entry) => ({
      ...entry,
      order: rootOrder * 2_000_000 + entry.order,
    }))).sort((left, right) => (
      left.createdAt.localeCompare(right.createdAt) || left.order - right.order
    ));
    const index = pending.findIndex((entry) => entry.id === id);
    return index < 0 ? 1 : index + 1;
  };

  let scheduleRequested = false;
  const schedule = (): Promise<AnyRecord> => {
    scheduleRequested = true;
    const active = input.runtime.globalCodexSchedulePromise;
    if (active instanceof Promise) return active as Promise<AnyRecord>;
    const operation = (async (): Promise<AnyRecord> => {
      const launched: AnyRecord[] = [];
      let available = capacity();
      do {
        scheduleRequested = false;
        await Promise.resolve();
        available = capacity();
        while (runningCount() < available) {
          const candidate = input.contexts().map((context) => ({
            ...context,
            createdAt: inspect(
              context,
              'inspect-project-codex-queue',
              () => nextPendingCodexProcessCreatedAt(context.root, context.runtime),
            ),
          })).filter(
            (entry): entry is SchedulerContext & { createdAt: string } => Boolean(entry.createdAt),
          ).sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
          if (!candidate) break;
          const result = await scheduleCodexProcesses({
            decisionOsRoot: candidate.root,
            runtime: candidate.runtime,
            launchLimit: 1,
          });
          const localLaunches = Array.isArray(result.launched)
            ? result.launched as AnyRecord[]
            : [];
          launched.push(...localLaunches);
          if (localLaunches.length === 0 || result.ok === false) break;
        }
      } while (scheduleRequested);
      return {
        ok: launched.every((entry) => entry.ok !== false),
        launched,
        capacity: available,
      };
    })().finally(() => {
      if (input.runtime.globalCodexSchedulePromise === operation) {
        delete input.runtime.globalCodexSchedulePromise;
      }
      if (scheduleRequested
        && !input.incidentSupervisor.pausedBackgroundComponents.has(
          'codex-process-scheduler',
        )) {
        void schedule().catch((error: unknown) => {
          input.incidentSupervisor.recordBackgroundFailure(
            'codex-process-scheduler',
            'reschedule-global-processes',
            error,
          );
        });
      }
    });
    Object.defineProperty(input.runtime, 'globalCodexSchedulePromise', {
      value: operation,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return operation;
  };

  return {
    capacity,
    queuePosition,
    runningCount,
    schedule,
    sharedCapacitySlots,
  };
}
