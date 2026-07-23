/**
 * WHAT: Routes every epoch-4 execution request to the task's assigned node and performs one local durable admission path.
 * WHY: UI location and relay availability must never choose the executor or create competing execution authorities.
 */
import { randomUUID } from 'node:crypto';
import type { TaskExecutionKind, TaskExecutionMetadata } from '../../task-state/helper/task-current-state-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { ReplicatedTaskExecutionRecord } from '../../task-state/helper/task-execution-repository.js';

type AnyRecord = Record<string, unknown>;
const executionKinds = new Set<TaskExecutionKind>(['thread', 'continuation', 'voice', 'pipeline-skill']);
const executionPhases = new Set(['preparing', 'queued', 'starting', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled', 'interrupted']);

export type TaskExecutionLaunchRequest = {
  requestId: string;
  executionId: string;
  projectId: string;
  ledgerId: string;
  sessionId: string;
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

export type TaskExecutionReceipt = {
  executionId: string;
  requestId: string;
  projectId: string;
  ledgerId: string;
  taskId: string;
  assignedNodeId: string;
  executorNodeId: string;
  phase: ReplicatedTaskExecutionRecord['lifecycle']['phase'];
  revision: number;
  requestedAt: string;
};

export function isTaskExecutionReceipt(value: unknown): value is TaskExecutionReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as AnyRecord;
  return [
    'executionId',
    'requestId',
    'projectId',
    'ledgerId',
    'taskId',
    'assignedNodeId',
    'executorNodeId',
    'phase',
    'requestedAt',
  ].every((field) => typeof receipt[field] === 'string')
    && executionPhases.has(String(receipt.phase))
    && Number.isInteger(receipt.revision)
    && Number(receipt.revision) > 0;
}

export class TaskExecutionAdmissionError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly context: Record<string, unknown> = {},
    message = code,
  ) {
    super(message);
    this.name = 'TaskExecutionAdmissionError';
  }
}

export function createTaskExecutionLaunchRequest(input: {
  requestId?: string;
  executionId?: string;
  projectId: string;
  ledgerId: string;
  sessionId?: string;
  sourceCardId: string;
  ownerCardId?: string;
  kind?: TaskExecutionKind;
  requestedAt?: string;
  model?: string | null;
  effort?: string | null;
  pipelineRunId?: string | null;
  pipelineStepId?: string | null;
  pipelineSkillRunId?: string | null;
  predecessorExecutionId?: string | null;
  restartOfExecutionId?: string | null;
}, now: () => Date = () => new Date()): TaskExecutionLaunchRequest {
  const requestId = String(input.requestId ?? '').trim() || randomUUID();
  const executionId = String(input.executionId ?? '').trim() || randomUUID();
  const requestedAt = String(input.requestedAt ?? '').trim() || now().toISOString();
  return {
    requestId,
    executionId,
    projectId: String(input.projectId ?? '').trim(),
    ledgerId: String(input.ledgerId ?? '').trim(),
    sessionId: String(input.sessionId ?? '').trim() || requestId,
    sourceCardId: String(input.sourceCardId ?? '').trim(),
    ownerCardId: String(input.ownerCardId ?? '').trim() || String(input.sourceCardId ?? '').trim(),
    kind: input.kind ?? 'thread',
    requestedAt,
    model: input.model ? String(input.model) : null,
    effort: input.effort ? String(input.effort) : null,
    pipelineRunId: input.pipelineRunId ? String(input.pipelineRunId) : null,
    pipelineStepId: input.pipelineStepId ? String(input.pipelineStepId) : null,
    pipelineSkillRunId: input.pipelineSkillRunId ? String(input.pipelineSkillRunId) : null,
    predecessorExecutionId: input.predecessorExecutionId ? String(input.predecessorExecutionId) : null,
    restartOfExecutionId: input.restartOfExecutionId ? String(input.restartOfExecutionId) : null,
  };
}

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)) : [];
}

function admissionError(error: unknown): TaskExecutionAdmissionError {
  if (error instanceof TaskExecutionAdmissionError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const [code] = message.split(':');
  const statusCode = code.endsWith('_not_found') ? 404 : code.includes('conflict') || code.includes('active') ? 409 : 400;
  return new TaskExecutionAdmissionError(code || 'task_execution_admission_failed', statusCode, {}, message);
}

function receipt(record: ReplicatedTaskExecutionRecord, assignedNodeId: string): TaskExecutionReceipt {
  return {
    executionId: record.metadata.executionId,
    requestId: record.metadata.requestId,
    projectId: record.metadata.projectId,
    ledgerId: record.metadata.ledgerId,
    taskId: record.metadata.taskId,
    assignedNodeId,
    executorNodeId: record.lifecycle.executorNodeId,
    phase: record.lifecycle.phase,
    revision: record.lifecycle.revision,
    requestedAt: record.metadata.requestedAt,
  };
}

function assertLaunchRequest(request: TaskExecutionLaunchRequest): void {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new TaskExecutionAdmissionError('invalid_task_execution_request', 400);
  }
  const requiredStrings = {
    requestId: request.requestId,
    executionId: request.executionId,
    projectId: request.projectId,
    ledgerId: request.ledgerId,
    sessionId: request.sessionId,
    sourceCardId: request.sourceCardId,
    ownerCardId: request.ownerCardId,
    requestedAt: request.requestedAt,
  };
  for (const [field, value] of Object.entries(requiredStrings)) {
    if (typeof value !== 'string' || !value.trim()) throw new TaskExecutionAdmissionError(`invalid_${field}`, 400);
  }
  for (const [field, value] of Object.entries({
    model: request.model,
    effort: request.effort,
    pipelineRunId: request.pipelineRunId,
    pipelineStepId: request.pipelineStepId,
    pipelineSkillRunId: request.pipelineSkillRunId,
    predecessorExecutionId: request.predecessorExecutionId,
    restartOfExecutionId: request.restartOfExecutionId,
  })) {
    if (value !== null && typeof value !== 'string') throw new TaskExecutionAdmissionError(`invalid_${field}`, 400);
  }
  if (!Number.isFinite(Date.parse(request.requestedAt))) throw new TaskExecutionAdmissionError('invalid_requestedAt', 400);
  if (!executionKinds.has(request.kind)) throw new TaskExecutionAdmissionError('invalid_task_execution_kind', 400);
  if (request.kind === 'pipeline-skill' && (!request.pipelineRunId || !request.pipelineStepId || !request.pipelineSkillRunId)) {
    throw new TaskExecutionAdmissionError('task_execution_pipeline_identity_invalid', 400);
  }
}

function resolveTask(input: {
  state: ProjectTaskState;
  request: TaskExecutionLaunchRequest;
  localNodeId: string;
}): { taskId: string; assignedNodeId: string; lineage: string[] } {
  if (input.request.ledgerId !== 'tasks') return { taskId: '', assignedNodeId: input.localNodeId, lineage: [] };
  const projection = input.state.projection();
  const cards = records(projection.ledger.cards);
  const relationships = records(projection.ledger.relationships);
  const cardIds = new Set(cards.map((card) => String(card.id ?? '')).filter(Boolean));
  if (!cardIds.has(input.request.sourceCardId)) {
    throw new TaskExecutionAdmissionError('task_card_not_found', 404, { cardId: input.request.sourceCardId });
  }
  const parents = new Map<string, string[]>();
  for (const relationship of relationships) {
    if (String(relationship.label ?? '') !== 'subtask') continue;
    const parent = String(relationship.from ?? '');
    const child = String(relationship.to ?? '');
    if (parent && child) parents.set(child, [...(parents.get(child) ?? []), parent]);
  }
  const lineage = [input.request.sourceCardId];
  const visited = new Set(lineage);
  let taskId = input.request.sourceCardId;
  while (parents.has(taskId)) {
    const candidates = [...new Set(parents.get(taskId)!)];
    if (candidates.length !== 1) {
      throw new TaskExecutionAdmissionError('task_parent_conflict', 409, { taskId, parentIds: candidates.sort() });
    }
    taskId = candidates[0];
    if (!cardIds.has(taskId)) throw new TaskExecutionAdmissionError('task_master_not_found', 409, { taskId });
    if (visited.has(taskId)) throw new TaskExecutionAdmissionError('task_relationship_cycle', 409, { taskId });
    visited.add(taskId);
    lineage.push(taskId);
  }
  if (projection.conflicts.some((conflict) => (
    conflict.kind === 'assignment-conflict'
    && conflict.entityType === 'card'
    && conflict.entityId === taskId
    && conflict.path === 'assignment'
  ))) {
    throw new TaskExecutionAdmissionError('task_assignment_conflict', 409, { taskId });
  }
  const master = cards.find((card) => String(card.id ?? '') === taskId)!;
  const assignment = master.assignment && typeof master.assignment === 'object' && !Array.isArray(master.assignment)
    ? master.assignment as AnyRecord
    : {};
  const assignedNodeId = String(assignment.nodeId ?? '').trim();
  if (!assignedNodeId) throw new TaskExecutionAdmissionError('task_assignment_missing', 409, { taskId });
  return { taskId, assignedNodeId, lineage };
}

const activePhases = new Set(['preparing', 'queued', 'starting', 'running', 'cancelling']);

export function createTaskExecutionRouter(input: {
  projectId: string;
  state: () => ProjectTaskState;
  localNodeId: () => string;
  peer: (nodeId: string) => { online: boolean } | null;
  dispatchRemote: (nodeId: string, request: TaskExecutionLaunchRequest) => Promise<TaskExecutionReceipt>;
  localCapacity?: () => number;
  validateLocal?: (context: {
    request: TaskExecutionLaunchRequest;
    taskId: string;
    assignedNodeId: string;
    lineage: string[];
    state: ProjectTaskState;
  }) => void | Promise<void>;
  onCommitted?: (record: ReplicatedTaskExecutionRecord) => void | Promise<void>;
  onFailure?: (error: unknown, context: Record<string, unknown>) => void;
}) {
  let localAdmissionTail = Promise.resolve();
  const notifyFailure = (error: unknown, context: Record<string, unknown>): void => {
    try {
      input.onFailure?.(error, context);
    } catch {
      // Diagnostics must never replace or escape the failure being contained.
    }
  };
  const admitLocalNow = async (request: TaskExecutionLaunchRequest): Promise<TaskExecutionReceipt> => {
    assertLaunchRequest(request);
    if (request.projectId !== input.projectId) throw new TaskExecutionAdmissionError('task_execution_project_mismatch', 400);
    const state = input.state();
    const localNodeId = input.localNodeId();
    const resolved = resolveTask({ state, request, localNodeId });
    if (resolved.assignedNodeId !== localNodeId) {
      throw new TaskExecutionAdmissionError('task_execution_wrong_executor', 409, {
        assignedNodeId: resolved.assignedNodeId,
        executorNodeId: localNodeId,
      });
    }
    const existing = state.executions.findByRequest(resolved.taskId, request.requestId);
    if (existing) return receipt(existing, resolved.assignedNodeId);
    const metadata: TaskExecutionMetadata = {
      executionId: request.executionId,
      requestId: request.requestId,
      sessionId: request.sessionId,
      projectId: request.projectId,
      ledgerId: request.ledgerId,
      taskId: resolved.taskId,
      sourceCardId: request.sourceCardId,
      ownerCardId: request.ownerCardId,
      kind: request.kind,
      requestedAt: new Date(request.requestedAt).toISOString(),
      model: request.model,
      effort: request.effort,
      pipelineRunId: request.pipelineRunId,
      pipelineStepId: request.pipelineStepId,
      pipelineSkillRunId: request.pipelineSkillRunId,
      predecessorExecutionId: request.predecessorExecutionId,
      restartOfExecutionId: request.restartOfExecutionId,
    };
    let admitted: ReplicatedTaskExecutionRecord | null = null;
    try {
      admitted = await state.executions.admit({ metadata, executorNodeId: localNodeId });
      const conflicts = state.projection().conflicts.filter((conflict) => (
        conflict.kind === 'task-conflict'
        && conflict.entityType === 'card'
        && resolved.lineage.includes(conflict.entityId)
        && conflict.path === 'lifecycle'
      ));
      if (conflicts.length > 0) {
        throw new TaskExecutionAdmissionError('task_lifecycle_conflict', 409, {
          taskIds: [...new Set(conflicts.map((conflict) => conflict.entityId))].sort(),
        });
      }
      const concurrent = resolved.taskId
        ? state.executions.byTaskId(resolved.taskId).filter((record) => (
          record.metadata.executionId !== request.executionId
          && activePhases.has(record.lifecycle.phase)
          && !(request.kind === 'pipeline-skill'
            && record.metadata.kind === 'pipeline-skill'
            && record.metadata.pipelineRunId === request.pipelineRunId)
        ))
        : [];
      if (concurrent.length > 0) {
        throw new TaskExecutionAdmissionError('task_execution_active', 409, {
          taskId: resolved.taskId,
          executionIds: concurrent.map((record) => record.metadata.executionId),
        });
      }
      const sessionExecutions = state.executions.bySessionId(request.sessionId).filter((record) => (
        record.metadata.executionId !== request.executionId
        && activePhases.has(record.lifecycle.phase)
        && !(request.kind === 'pipeline-skill'
          && record.metadata.kind === 'pipeline-skill'
          && record.metadata.pipelineRunId === request.pipelineRunId)
      ));
      if (sessionExecutions.length > 0) {
        throw new TaskExecutionAdmissionError('task_execution_session_active', 409, {
          sessionId: request.sessionId,
          executionIds: sessionExecutions.map((record) => record.metadata.executionId),
        });
      }
      if (request.predecessorExecutionId && !state.executions.find(request.predecessorExecutionId)) {
        throw new TaskExecutionAdmissionError('task_execution_predecessor_not_found', 409, {
          predecessorExecutionId: request.predecessorExecutionId,
        });
      }
      const capacity = input.localCapacity?.() ?? Number.POSITIVE_INFINITY;
      if ((!Number.isFinite(capacity) && capacity !== Number.POSITIVE_INFINITY) || capacity < 1) {
        throw new TaskExecutionAdmissionError('task_execution_capacity_unavailable', 503, { capacity });
      }
      await input.validateLocal?.({ request, ...resolved, state });
      const queued = await state.executions.transition(request.executionId, { phase: 'queued' });
      try {
        await input.onCommitted?.(queued);
      } catch (error) {
        notifyFailure(error, { operation: 'notify-task-execution-committed', executionId: request.executionId });
      }
      return receipt(queued, resolved.assignedNodeId);
    } catch (error) {
      const failure = admissionError(error);
      if (admitted) {
        try {
          await state.executions.transition(request.executionId, {
            phase: 'failed',
            error: { code: failure.code, message: failure.message },
          });
        } catch (settlementError) {
          notifyFailure(settlementError, {
            operation: 'settle-rejected-task-execution',
            executionId: request.executionId,
            admissionError: failure.message,
          });
        }
      }
      throw failure;
    }
  };
  const localAdmission = (request: TaskExecutionLaunchRequest): Promise<TaskExecutionReceipt> => {
    const result = localAdmissionTail.then(() => admitLocalNow(request));
    localAdmissionTail = result.then(() => undefined, () => undefined);
    return result;
  };

  const route = async (request: TaskExecutionLaunchRequest): Promise<TaskExecutionReceipt> => {
    assertLaunchRequest(request);
    if (request.projectId !== input.projectId) throw new TaskExecutionAdmissionError('task_execution_project_mismatch', 400);
    const state = input.state();
    const localNodeId = input.localNodeId();
    const resolved = resolveTask({ state, request, localNodeId });
    if (resolved.assignedNodeId === localNodeId) return localAdmission(request);
    if (!input.peer(resolved.assignedNodeId)?.online) {
      throw new TaskExecutionAdmissionError(
        'assigned_node_unreachable',
        503,
        { assignedNodeId: resolved.assignedNodeId },
        `Assigned node ${resolved.assignedNodeId} is unreachable.`,
      );
    }
    return input.dispatchRemote(resolved.assignedNodeId, request);
  };

  return { route, admitLocal: localAdmission };
}

export type TaskExecutionRouter = ReturnType<typeof createTaskExecutionRouter>;
