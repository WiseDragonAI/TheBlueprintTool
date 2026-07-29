/**
 * WHAT: Binds Codex lifecycle callbacks to one project's runtime and durable task state.
 * WHY: Controller compatibility events belong to Codex coordination, not project watcher construction.
 */
import type { TaskExecutionPresentationEvent } from '../../../../../shared/schemas/task-execution-presentation-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import { committedTaskExecutionSettlement } from '../helper/commit-task-execution-settlement.js';
import type { createTaskExecutionPresentationRegistry } from './task-execution-presentation-registry.js';

type AnyRecord = Record<string, unknown>;

export function configureProjectCodexEvents(input: {
  activeTaskState: ProjectTaskState | null;
  invalidateProject: (changes: readonly { entityType: string; entityId: string }[]) => void;
  presentations: ReturnType<typeof createTaskExecutionPresentationRegistry>;
  projectId: string;
  publishLedger: (event: AnyRecord) => void;
  runtime: AnyRecord;
  schedule: () => Promise<unknown>;
}): void {
  input.runtime.onPipelineLedgerChange = input.publishLedger;
  input.runtime.scheduleCodexProcesses = input.schedule;
  input.runtime.publishTaskExecutionPresentationEvents = (event: AnyRecord): void => {
    input.presentations.publishEvents({
      projectId: String(event.projectId ?? ''),
      executionId: String(event.executionId ?? ''),
      events: Array.isArray(event.events) ? event.events as TaskExecutionPresentationEvent[] : [],
    });
  };
  input.runtime.onCodexRunAccepted = (event: AnyRecord): void => {
    input.publishLedger({
      reason: 'codex-run-accepted',
      ledgerId: String(event.ledgerId ?? ''),
      runId: String(event.runId ?? ''),
      executionId: String(event.executionId ?? ''),
      status: String(event.status ?? 'pending'),
      cardId: String(event.cardId ?? ''),
      outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
      threadId: String(event.threadId ?? ''),
    });
  };
  input.runtime.onCodexTurnStarted = (event: AnyRecord): void => {
    input.publishLedger({
      reason: 'codex-turn-started',
      ledgerId: String(event.ledgerId ?? ''),
      runId: String(event.runId ?? ''),
      executionId: String(event.executionId ?? ''),
      status: String(event.status ?? 'running'),
      cardId: String(event.cardId ?? ''),
      outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
      threadId: String(event.threadId ?? ''),
      startedAt: String(event.startedAt ?? ''),
    });
  };
  input.runtime.onCodexRunSettled = async (event: AnyRecord): Promise<void> => {
    const ledgerId = String(event.ledgerId ?? '');
    const cardId = String(event.cardId ?? event.outputCardId ?? '');
    const executionId = String(event.executionId ?? '');
    let status = String(event.status ?? '');
    let finishedAt = String(event.finishedAt ?? '');
    let durablePipelineExecution = false;
    if (ledgerId === 'tasks') {
      if (!input.activeTaskState) throw new Error(`task_execution_state_unavailable:${input.projectId}`);
      const execution = input.activeTaskState.executions.find(executionId);
      if (!execution) throw new Error(`task_execution_not_found:${executionId}`);
      if (execution.metadata.ledgerId !== 'tasks') {
        throw new Error(`task_execution_ledger_mismatch:${executionId}`);
      }
      const committedExecution = committedTaskExecutionSettlement(execution);
      status = committedExecution.status;
      finishedAt = committedExecution.finishedAt;
      const taskId = String(execution.metadata.taskId ?? '');
      if (!taskId) throw new Error(`task_execution_task_missing:${executionId}`);
      durablePipelineExecution = execution.metadata.kind === 'pipeline-skill';
      if (!durablePipelineExecution || event.pipelineTerminal === true) {
        const committedTask = await input.activeTaskState.transitionCardLifecycle(taskId, 'todo', finishedAt);
        if (committedTask.changed) input.invalidateProject(committedTask.localChanges);
      }
    }
    if (!event.pipelineRunId && !durablePipelineExecution) {
      input.publishLedger({
        reason: 'codex-thread-settled',
        ledgerId,
        status,
        finishedAt,
        runId: String(event.runId ?? ''),
        executionId,
        cardId,
        outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
        threadId: String(event.threadId ?? ''),
      });
    }
    if (event.pipelineRunId && event.pipelineTerminal === true) {
      const reportedStatus = String(event.pipelineStatus ?? status);
      const pipelineStatus = status === 'cancelled' || status === 'failed' ? status : reportedStatus;
      input.publishLedger({
        reason: pipelineStatus === 'complete'
          ? 'pipeline-completed'
          : pipelineStatus === 'cancelled'
            ? 'pipeline-cancelled'
            : 'pipeline-failed',
        ledgerId,
        pipelineRunId: String(event.pipelineRunId),
        pipelineStatus,
        status,
        finishedAt,
        runId: String(event.runId ?? ''),
        executionId,
        cardId,
        outputCardId: String(event.outputCardId ?? event.cardId ?? ''),
        threadId: String(event.threadId ?? ''),
      });
    }
  };
}
