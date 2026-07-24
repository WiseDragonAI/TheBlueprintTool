/**
 * WHAT: Converts every legacy Codex lifecycle authority into epoch-4 execution entities without writing files.
 * WHY: Offline migration must validate and preserve execution history before it replaces any active state.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { CodexExecutionPhase, CodexExecutionRecord } from '../../../../../shared/schemas/codex-execution-types.js';
import type { CodexPipelineRun, CodexPipelineRunSkill, CodexPipelineRunStep } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type {
  TaskCurrentEntity,
  TaskExecutionArtifacts,
  TaskExecutionKind,
  TaskExecutionLifecycle,
  TaskExecutionMetadata,
  TaskExecutionPhase,
} from '../../../../../shared/task-current-state-core.js';
import { codexPipelineStoreWriteBlocker, readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import { finalizeTaskCurrentEntity } from './task-current-state-join.js';
import {
  legacyCodexExecutionStoreFile,
  readLegacyCodexExecutions,
  readLegacyCodexProcessQueue,
  type LegacyCodexProcessQueueItem,
} from './read-legacy-execution-migration-input.js';
import { taskCurrentStateVersion } from './task-current-state-types.js';

type AnyRecord = Record<string, unknown>;
type ArtifactKind = 'jsonl' | 'stderr' | 'telemetry';
type ArtifactObject = { hash: string; bytes: Buffer };
type Attempt = {
  priority: number;
  metadata: TaskExecutionMetadata;
  lifecycle: TaskExecutionLifecycle;
  files: Partial<Record<ArtifactKind, string>>;
};

export type Epoch4ExecutionMigration = {
  entities: TaskCurrentEntity[];
  objects: ArtifactObject[];
  pipelineStore: ReturnType<typeof readCodexPipelineStore>['store'];
  pipelineFile: string | null;
  legacyFiles: string[];
  report: {
    canonicalRecords: number;
    queueRecords: number;
    pipelineRecords: number;
    cardIntentRecords: number;
    cardThreadRecords: number;
    executionCount: number;
    interruptedCount: number;
    artifactCount: number;
    artifactBytes: number;
    missingArtifacts: string[];
    retainedDeletedTaskIds: string[];
    executionIndex: {
      valid: true;
      executionIds: number;
      taskIds: number;
      sessionIds: number;
      pipelineRunIds: number;
      executorNodeIds: number;
    };
  };
};

const epoch = new Date(0).toISOString();
const terminal = new Set<TaskExecutionPhase>(['succeeded', 'failed', 'cancelled', 'interrupted']);
type TerminalTaskExecutionPhase = 'succeeded' | 'failed' | 'cancelled' | 'interrupted';

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function timestamp(value: unknown, fallback = epoch): string {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : fallback;
}

function inside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function masterTaskId(ledger: AnyRecord, cardId: string): string {
  const parents = new Map<string, string>();
  for (const relationship of records(ledger.relationships).filter((entry) => entry.label === 'subtask')) {
    const child = text(relationship.to);
    const parent = text(relationship.from);
    if (child && parent) parents.set(child, parent);
  }
  let current = cardId;
  const visited = new Set<string>();
  while (parents.has(current)) {
    if (visited.has(current)) throw new Error(`task_migration_subtask_cycle:${cardId}`);
    visited.add(current);
    current = parents.get(current)!;
  }
  return current;
}

function terminalLifecycle(input: {
  phase: TaskExecutionPhase;
  requestedAt: string;
  phaseSince?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
  executorNodeId: string;
  resultSummary?: string;
  errorMessage?: string;
  revision?: number;
}): TaskExecutionLifecycle {
  const legacyPhase = input.phase;
  const phase = (terminal.has(legacyPhase) ? legacyPhase : 'interrupted') as TerminalTaskExecutionPhase;
  const phaseSince = timestamp(input.phaseSince, input.requestedAt);
  const finishedAt = timestamp(input.finishedAt, phaseSince);
  const summary = phase === 'interrupted' && !terminal.has(legacyPhase)
    ? 'Interrupted by epoch-4 offline migration.'
    : input.resultSummary ?? input.errorMessage ?? '';
  return {
    phase,
    phaseSince: finishedAt,
    startedAt: input.startedAt ? timestamp(input.startedAt, input.requestedAt) : null,
    finishedAt,
    executorNodeId: input.executorNodeId,
    providerSessionId: null,
    result: { status: phase, summary },
    error: phase === 'failed' ? { code: 'legacy_codex_execution_failed', message: input.errorMessage || 'Legacy Codex execution failed.' } : null,
    revision: Number.isSafeInteger(input.revision) && Number(input.revision) > 0 ? Number(input.revision) : 1,
  };
}

function taskPhase(phase: CodexExecutionPhase): TaskExecutionPhase {
  return phase;
}

function canonicalAttempt(input: { record: CodexExecutionRecord; ledger: AnyRecord; defaultAssignedNodeId: string }): Attempt {
  const record = input.record;
  const requestedAt = timestamp(record.requestedAt);
  const taskId = record.ledgerId === 'tasks' ? masterTaskId(input.ledger, record.taskId || record.ownerCardId) : '';
  return {
    priority: 40,
    metadata: {
      executionId: record.executionId,
      requestId: record.executionId,
      sessionId: record.sessionId,
      projectId: record.projectId,
      ledgerId: record.ledgerId,
      taskId,
      sourceCardId: record.taskId || record.ownerCardId,
      ownerCardId: record.ownerCardId,
      kind: record.kind,
      requestedAt,
      model: null,
      effort: null,
      pipelineRunId: record.pipelineRunId,
      pipelineStepId: record.pipelineStepId,
      pipelineSkillRunId: record.pipelineSkillRunId,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    lifecycle: terminalLifecycle({
      phase: taskPhase(record.phase),
      requestedAt,
      phaseSince: record.phaseSince,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      executorNodeId: record.executorNodeId || input.defaultAssignedNodeId,
      resultSummary: record.result?.summary,
      errorMessage: record.error?.message,
      revision: record.revision,
    }),
    files: {
      ...(record.stdoutFile ? { jsonl: record.stdoutFile, telemetry: `${record.stdoutFile}.telemetry.jsonl` } : {}),
      ...(record.stderrFile ? { stderr: record.stderrFile } : {}),
    },
  };
}

function pipelineAttempt(input: {
  run: CodexPipelineRun;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
  predecessorExecutionId: string | null;
  projectId: string;
  ledger: AnyRecord;
  defaultAssignedNodeId: string;
}): Attempt {
  const { run, step, skill } = input;
  const requestedAt = timestamp(run.createdAt);
  const phase: TaskExecutionPhase = skill.status === 'complete' ? 'succeeded'
    : skill.status === 'failed' ? 'failed'
      : skill.status === 'cancelled' ? 'cancelled'
        : skill.status === 'running' ? 'running'
          : 'queued';
  return {
    priority: 30,
    metadata: {
      executionId: skill.executionId,
      requestId: skill.executionId,
      sessionId: skill.runId,
      projectId: input.projectId,
      ledgerId: run.ledgerId,
      taskId: run.ledgerId === 'tasks' ? masterTaskId(input.ledger, run.sourceCardId) : '',
      sourceCardId: run.sourceCardId,
      ownerCardId: step.outputCardId || run.sourceCardId,
      kind: 'pipeline-skill',
      requestedAt,
      model: text(skill.codexModel) || null,
      effort: text(skill.codexEffort) || null,
      pipelineRunId: run.id,
      pipelineStepId: step.id,
      pipelineSkillRunId: skill.runId,
      predecessorExecutionId: input.predecessorExecutionId,
      restartOfExecutionId: null,
    },
    lifecycle: terminalLifecycle({
      phase,
      requestedAt,
      phaseSince: skill.finishedAt ?? skill.startedAt ?? run.updatedAt,
      startedAt: skill.startedAt,
      finishedAt: skill.finishedAt,
      executorNodeId: skill.executor?.nodeId || input.defaultAssignedNodeId,
      errorMessage: skill.error,
    }),
    files: {
      ...(skill.stdoutFile ? { jsonl: skill.stdoutFile, telemetry: `${skill.stdoutFile}.telemetry.jsonl` } : {}),
      ...(skill.stderrFile ? { stderr: skill.stderrFile } : {}),
    },
  };
}

function queueAttempt(input: { item: LegacyCodexProcessQueueItem; projectId: string; ledger: AnyRecord; defaultAssignedNodeId: string }): Attempt {
  const item = input.item;
  const executionId = text(item.payload.executionId);
  if (!executionId) throw new Error(`task_migration_queue_execution_id_missing:${item.id}`);
  const ledgerId = text(item.payload.ledgerId);
  const sourceCardId = text(item.payload.cardId);
  if (!ledgerId || !sourceCardId) throw new Error(`task_migration_queue_identity_missing:${item.id}`);
  const requestedAt = timestamp(item.createdAt);
  return {
    priority: 20,
    metadata: {
      executionId,
      requestId: executionId,
      sessionId: text(item.payload.runId) || item.id,
      projectId: input.projectId,
      ledgerId,
      taskId: ledgerId === 'tasks' ? masterTaskId(input.ledger, sourceCardId) : '',
      sourceCardId,
      ownerCardId: sourceCardId,
      kind: item.kind,
      requestedAt,
      model: text(item.payload.codexModel) || null,
      effort: text(item.payload.codexEffort) || null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
    lifecycle: terminalLifecycle({
      phase: item.status === 'interrupted' ? 'interrupted' : item.status === 'running' ? 'running' : 'queued',
      requestedAt,
      phaseSince: item.interruptedAt ?? item.startedAt ?? item.createdAt,
      startedAt: item.startedAt,
      finishedAt: item.interruptedAt,
      executorNodeId: input.defaultAssignedNodeId,
      errorMessage: item.interruptionReason,
    }),
    files: {
      ...(item.stdoutFile ? { jsonl: item.stdoutFile, telemetry: `${item.stdoutFile}.telemetry.jsonl` } : {}),
      ...(item.stderrFile ? { stderr: item.stderrFile } : {}),
    },
  };
}

function cardIntentAttempts(input: { ledger: AnyRecord; projectId: string; defaultAssignedNodeId: string }): Attempt[] {
  return records(input.ledger.cards).flatMap((card): Attempt[] => {
    const intent = card.executionIntent && typeof card.executionIntent === 'object' && !Array.isArray(card.executionIntent)
      ? card.executionIntent as AnyRecord
      : null;
    if (!intent) return [];
    const executionId = text(card.codexActiveExecutionId) || text(intent.executionId) || text(intent.id);
    const sourceCardId = text(card.id);
    if (!executionId || !sourceCardId) return [];
    const requestedAt = timestamp(intent.requestedAt ?? intent.changedAt ?? card.createdAt);
    const rawPhase = text(intent.phase);
    const state = text(intent.state);
    const phase: TaskExecutionPhase = rawPhase === 'succeeded' || state === 'terminal' ? 'succeeded'
      : rawPhase === 'failed' || state === 'failed' ? 'failed'
        : rawPhase === 'cancelled' ? 'cancelled'
          : rawPhase === 'interrupted' ? 'interrupted'
            : rawPhase === 'running' || state === 'running' ? 'running'
              : 'queued';
    const kind: TaskExecutionKind = text(card.codexPipelineRunId) ? 'pipeline-skill' : 'thread';
    const pipelineRunId = kind === 'pipeline-skill' ? text(card.codexPipelineRunId) || executionId : null;
    const pipelineStepId = kind === 'pipeline-skill' ? text(card.codexPipelineStepId) || sourceCardId : null;
    const pipelineSkillRunId = kind === 'pipeline-skill' ? text(card.codexActiveRunId) || executionId : null;
    return [{
      priority: 10,
      metadata: {
        executionId,
        requestId: executionId,
        sessionId: text(card.codexActiveRunId) || text(intent.id) || executionId,
        projectId: input.projectId,
        ledgerId: 'tasks',
        taskId: masterTaskId(input.ledger, sourceCardId),
        sourceCardId,
        ownerCardId: sourceCardId,
        kind,
        requestedAt,
        model: text(card.codexRunModel) || null,
        effort: text(card.codexRunEffort) || null,
        pipelineRunId,
        pipelineStepId,
        pipelineSkillRunId,
        predecessorExecutionId: null,
        restartOfExecutionId: null,
      },
      lifecycle: terminalLifecycle({
        phase,
        requestedAt,
        phaseSince: intent.changedAt ?? intent.phaseSince,
        startedAt: intent.startedAt,
        finishedAt: intent.settledAt,
        executorNodeId: text(intent.executorNodeId) || input.defaultAssignedNodeId,
        errorMessage: text(intent.error),
      }),
      files: {},
    }];
  });
}

function cardThreadAttempts(input: { ledger: AnyRecord; projectId: string; defaultAssignedNodeId: string }): Attempt[] {
  return records(input.ledger.cards).flatMap((card): Attempt[] => {
    const sourceCardId = text(card.id);
    if (!sourceCardId) return [];
    const retained = Array.isArray(card.codexThreadRunIds) ? card.codexThreadRunIds.map(text).filter(Boolean) : [];
    const runIds = [...new Set([...retained, text(card.codexThreadRunId), text(card.codexRunId)].filter(Boolean))];
    const outputFiles = card.codexThreadRunOutputFiles && typeof card.codexThreadRunOutputFiles === 'object' && !Array.isArray(card.codexThreadRunOutputFiles)
      ? card.codexThreadRunOutputFiles as Record<string, unknown>
      : {};
    return runIds.map((runId): Attempt => {
      const active = runId === text(card.codexActiveRunId);
      const executionId = active && text(card.codexActiveExecutionId) ? text(card.codexActiveExecutionId) : `${runId}:execution:0`;
      const outputFile = text(outputFiles[runId])
        || (runId === text(card.codexThreadRunId) ? text(card.codexThreadRunOutputFile) : '')
        || (runId === text(card.codexRunId) ? text(card.codexRunOutputFile) : '');
      const requestedAt = timestamp(card.createdAt);
      return {
        priority: 5,
        metadata: {
          executionId,
          requestId: executionId,
          sessionId: runId,
          projectId: input.projectId,
          ledgerId: 'tasks',
          taskId: masterTaskId(input.ledger, sourceCardId),
          sourceCardId,
          ownerCardId: sourceCardId,
          kind: 'thread',
          requestedAt,
          model: text(card.codexRunModel) || null,
          effort: text(card.codexRunEffort) || null,
          pipelineRunId: null,
          pipelineStepId: null,
          pipelineSkillRunId: null,
          predecessorExecutionId: null,
          restartOfExecutionId: null,
        },
        lifecycle: terminalLifecycle({
          phase: active ? 'running' : 'interrupted',
          requestedAt,
          phaseSince: card.createdAt,
          executorNodeId: input.defaultAssignedNodeId,
          resultSummary: active
            ? undefined
            : 'Legacy thread session retained without terminal lifecycle evidence.',
        }),
        files: outputFile ? { jsonl: outputFile, telemetry: `${outputFile}.telemetry.jsonl` } : {},
      };
    });
  });
}

function mergeAttempts(attempts: Attempt[]): Attempt[] {
  const selected = new Map<string, Attempt>();
  for (const attempt of attempts) {
    const current = selected.get(attempt.metadata.executionId);
    if (!current) {
      selected.set(attempt.metadata.executionId, attempt);
      continue;
    }
    const primary = attempt.priority > current.priority ? attempt : current;
    const secondary = primary === attempt ? current : attempt;
    const pipelineCandidates = [primary.metadata, secondary.metadata].filter((metadata) => metadata.kind === 'pipeline-skill');
    const pipeline = pipelineCandidates.find((metadata) => metadata.predecessorExecutionId !== null) ?? pipelineCandidates[0] ?? null;
    selected.set(primary.metadata.executionId, {
      ...primary,
      metadata: pipeline ? {
        ...primary.metadata,
        kind: 'pipeline-skill',
        pipelineRunId: primary.metadata.pipelineRunId ?? pipeline.pipelineRunId,
        pipelineStepId: primary.metadata.pipelineStepId ?? pipeline.pipelineStepId,
        pipelineSkillRunId: primary.metadata.pipelineSkillRunId ?? pipeline.pipelineSkillRunId,
        predecessorExecutionId: primary.metadata.predecessorExecutionId ?? pipeline.predecessorExecutionId,
        model: primary.metadata.model ?? pipeline.model,
        effort: primary.metadata.effort ?? pipeline.effort,
      } : primary.metadata,
      files: { ...secondary.files, ...primary.files },
    });
  }
  return [...selected.values()].sort((left, right) => left.metadata.requestedAt.localeCompare(right.metadata.requestedAt)
    || left.metadata.executionId.localeCompare(right.metadata.executionId));
}

function captureArtifacts(decisionOsRoot: string, attempts: Attempt[]): {
  manifests: Map<string, TaskExecutionArtifacts>;
  objects: ArtifactObject[];
  missing: string[];
} {
  const objects = new Map<string, Buffer>();
  const manifests = new Map<string, TaskExecutionArtifacts>();
  const missing: string[] = [];
  for (const attempt of attempts) {
    const heads: Partial<Record<ArtifactKind, TaskExecutionArtifacts[ArtifactKind]>> = {};
    for (const [kind, rawFile] of Object.entries(attempt.files) as Array<[ArtifactKind, string]>) {
      const file = isAbsolute(rawFile)
        ? resolve(rawFile)
        : /^\/?\.decision-os\//.test(rawFile)
          ? resolve(decisionOsRoot, rawFile.replace(/^\/?\.decision-os\//, ''))
          : resolve(decisionOsRoot, rawFile);
      if (!inside(decisionOsRoot, file)) {
        missing.push(`${attempt.metadata.executionId}:${kind}:outside-project:${rawFile}`);
        continue;
      }
      if (!existsSync(file)) {
        if (kind === 'telemetry') continue;
        missing.push(`${attempt.metadata.executionId}:${kind}:missing:${rawFile}`);
        continue;
      }
      const bytes = readFileSync(file);
      const hash = createHash('sha256').update(bytes).digest('hex');
      objects.set(hash, bytes);
      heads[kind] = { hash, bytes: bytes.byteLength, mediaType: kind === 'jsonl' || kind === 'telemetry' ? 'application/x-ndjson' : 'text/plain' };
    }
    manifests.set(attempt.metadata.executionId, {
      jsonl: heads.jsonl ?? null,
      stderr: heads.stderr ?? null,
      telemetry: heads.telemetry ?? null,
      result: null,
      changedAt: attempt.lifecycle.finishedAt ?? attempt.lifecycle.phaseSince,
      revision: 1,
    });
  }
  return {
    manifests,
    objects: [...objects.entries()].map(([hash, bytes]) => ({ hash, bytes })),
    missing: [...new Set(missing)].sort(),
  };
}

function executionEntity(input: { attempt: Attempt; artifacts?: TaskExecutionArtifacts; nodeId: string; projectId: string }): TaskCurrentEntity {
  const replicaId = `migration:${input.nodeId}:${input.projectId}:execution:${input.attempt.metadata.executionId}`;
  const register = (value: unknown) => ({
    clock: { [replicaId]: 1 },
    candidates: [{ dot: { replicaId, counter: 1 }, operation: 'set' as const, value }],
  });
  return finalizeTaskCurrentEntity({
    version: taskCurrentStateVersion,
    projectId: input.projectId,
    entityType: 'execution',
    entityId: input.attempt.metadata.executionId,
    fields: {
      metadata: register(input.attempt.metadata),
      lifecycle: register(input.attempt.lifecycle),
      ...(input.artifacts ? { artifacts: register(input.artifacts) } : {}),
    },
  });
}

export function prepareEpoch4ExecutionMigration(input: {
  decisionOsRoot: string;
  projectId: string;
  nodeId: string;
  defaultAssignedNodeId: string;
  ledger: AnyRecord;
}): Epoch4ExecutionMigration {
  const canonical = existsSync(legacyCodexExecutionStoreFile(input.decisionOsRoot))
    ? readLegacyCodexExecutions({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId })
    : [];
  const queue = readLegacyCodexProcessQueue(input.decisionOsRoot);
  const pipeline = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  const blocker = codexPipelineStoreWriteBlocker(pipeline);
  if (blocker) throw new Error(`task_migration_pipeline_store_invalid:${blocker.code}:${blocker.message}`);
  const pipelineAttempts = pipeline.store.runs.flatMap((run) => {
    let predecessorExecutionId: string | null = null;
    return run.steps.flatMap((step) => step.skills.map((skill) => {
      const attempt = pipelineAttempt({ run, step, skill, predecessorExecutionId, projectId: input.projectId, ledger: input.ledger, defaultAssignedNodeId: input.defaultAssignedNodeId });
      predecessorExecutionId = skill.executionId;
      return attempt;
    }));
  });
  const intents = cardIntentAttempts({ ledger: input.ledger, projectId: input.projectId, defaultAssignedNodeId: input.defaultAssignedNodeId });
  const threadSessions = cardThreadAttempts({ ledger: input.ledger, projectId: input.projectId, defaultAssignedNodeId: input.defaultAssignedNodeId });
  const attempts = mergeAttempts([
    ...threadSessions,
    ...intents,
    ...queue.map((item) => queueAttempt({ item, projectId: input.projectId, ledger: input.ledger, defaultAssignedNodeId: input.defaultAssignedNodeId })),
    ...pipelineAttempts,
    ...canonical.map((record) => canonicalAttempt({ record, ledger: input.ledger, defaultAssignedNodeId: input.defaultAssignedNodeId })),
  ]);
  const executionIds = new Set(attempts.map((attempt) => attempt.metadata.executionId));
  const taskIds = new Set(records(input.ledger.cards).map((card) => text(card.id)).filter(Boolean));
  const retainedDeletedTaskIds = [...new Set(attempts
    .map((attempt) => attempt.metadata.taskId)
    .filter((taskId) => taskId && !taskIds.has(taskId)))]
    .sort();
  for (const attempt of attempts) {
    if (attempt.metadata.predecessorExecutionId && !executionIds.has(attempt.metadata.predecessorExecutionId)) {
      throw new Error(`task_migration_execution_predecessor_missing:${attempt.metadata.executionId}:${attempt.metadata.predecessorExecutionId}`);
    }
  }
  const artifacts = captureArtifacts(input.decisionOsRoot, attempts);
  const legacyFiles = ['codex-executions.json', 'codex-process-queue.json']
    .map((name) => resolve(input.decisionOsRoot, name))
    .filter(existsSync);
  return {
    entities: attempts.map((attempt) => executionEntity({ attempt, artifacts: artifacts.manifests.get(attempt.metadata.executionId), nodeId: input.nodeId, projectId: input.projectId })),
    objects: artifacts.objects,
    pipelineStore: { ...pipeline.store, runs: [], activeWorkspaceRun: null },
    pipelineFile: existsSync(resolve(input.decisionOsRoot, 'codex-pipelines.json')) ? resolve(input.decisionOsRoot, 'codex-pipelines.json') : null,
    legacyFiles,
    report: {
      canonicalRecords: canonical.length,
      queueRecords: queue.length,
      pipelineRecords: pipelineAttempts.length,
      cardIntentRecords: intents.length,
      cardThreadRecords: threadSessions.length,
      executionCount: attempts.length,
      interruptedCount: attempts.filter((attempt) => attempt.lifecycle.phase === 'interrupted').length,
      artifactCount: artifacts.objects.length,
      artifactBytes: artifacts.objects.reduce((sum, object) => sum + object.bytes.byteLength, 0),
      missingArtifacts: artifacts.missing,
      // WHAT: Preserve immutable execution history after its source task has been deleted.
      // WHY: Execution entities are independently indexed, and deleting a task must not erase its terminal audit trail.
      retainedDeletedTaskIds,
      executionIndex: {
        valid: true,
        executionIds: executionIds.size,
        taskIds: new Set(attempts.map((attempt) => attempt.metadata.taskId).filter(Boolean)).size,
        sessionIds: new Set(attempts.map((attempt) => attempt.metadata.sessionId)).size,
        pipelineRunIds: new Set(attempts.map((attempt) => attempt.metadata.pipelineRunId).filter(Boolean)).size,
        executorNodeIds: new Set(attempts.map((attempt) => attempt.lifecycle.executorNodeId)).size,
      },
    },
  };
}
