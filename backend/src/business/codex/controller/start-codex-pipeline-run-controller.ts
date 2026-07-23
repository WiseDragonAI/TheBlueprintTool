/**
 * WHAT: Orchestrates validation, durable setup, event publication, and first-skill launch for one Codex pipeline.
 * WHY: The full pending pipeline must be visible and durable before asynchronous execution begins.
 */
import { existsSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type {
  CodexEffort,
  CodexModel,
  CodexPipeline,
  CodexPipelineRun,
  CodexPipelineRunSkill,
  CodexPipelineStep,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { createCodexPipelineStepCards } from '../effect/create-codex-pipeline-step-cards.js';
import {
  createCodexPipelineRunManifest,
  type PipelineDefinition,
} from '../helper/create-codex-pipeline-run-manifest.js';
import { codexPipelineStoreWriteBlocker, readCodexPipelineStore, writeCodexPipelineStore } from '../helper/codex-pipeline-store.js';
import { scanCodexSkills } from '../helper/scan-codex-skills.js';
import { runtimeServerRoot } from '../helper/server-skill-context.js';
import { readScopedCodexPipelineStores } from '../helper/server-pipeline-catalog.js';
import {
  maxConcurrentCodexProcesses,
  reassessPipelineAfterSkill,
  resolvePipelineLedgerContext,
  type PipelineLedgerContext,
} from '../helper/codex-pipeline-runner.js';
import { scheduleCodexProcesses, unifiedCodexQueuePosition } from '../helper/codex-process-scheduler.js';
import { withCardCodexAdmission } from '../helper/card-codex-admission-lock.js';
import { cardCodexExecutionOwnership } from '../helper/card-codex-execution-ownership.js';
import { persistLedgerProjection } from '@backend/business/task-state/helper/persist-ledger-projection.js';
import { codexExecutionCoordinator } from '../helper/codex-execution-runtime.js';
import {
  createTaskExecutionLaunchRequest,
  TaskExecutionAdmissionError,
} from '../helper/task-execution-router.js';
import { taskExecutionNodeId, taskExecutionRouter, taskExecutionState } from '../helper/task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function sourceCard(context: PipelineLedgerContext, sourceCardId: string): AnyRecord | null {
  return (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === sourceCardId) ?? null;
}

async function rollbackPipelineCards(input: { decisionOsRoot: string; context: PipelineLedgerContext; ledgerBefore: string; sourceCardId: string; outputCardIds: string[] }): Promise<void> {
  const currentRelationshipIds = (input.context.ledger.relationships ?? [])
    .filter((relationship) => input.outputCardIds.includes(String(relationship.to ?? '')))
    .map((relationship) => String(relationship.id ?? ''))
    .filter(Boolean);
  for (const cardId of input.outputCardIds) {
    const card = (input.context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
    const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
    const contentRef = text(comment.contentFile).replace(/^\.decision-os\//, '');
    const contentFile = resolve(input.decisionOsRoot, contentRef);
    const inner = relative(input.decisionOsRoot, contentFile);
    if (contentRef && inner && !inner.startsWith('..') && !isAbsolute(inner) && existsSync(contentFile)) rmSync(contentFile, { force: true });
  }
  const previousLedger = JSON.parse(input.ledgerBefore) as PipelineLedgerContext['ledger'];
  input.context.ledger = previousLedger;
  await persistLedgerProjection({
    decisionOsRoot: input.decisionOsRoot,
    ledgerId: input.context.ledgerId,
    ledgerPath: input.context.ledgerPath,
    ledger: previousLedger,
    runtime: input.context.runtime,
    command: {
      kind: 'rollback-codex-pipeline-admission',
      cardIds: [input.sourceCardId, ...input.outputCardIds],
      relationshipIds: currentRelationshipIds,
    },
  });
}

export async function startPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  definition: PipelineDefinition;
  onLedgerChange?: unknown;
  admissionLocked?: boolean;
  restartOfRun?: CodexPipelineRun | null;
  reservedRunId?: string;
  reservedFirstExecutionId?: string;
  requestIdPrefix?: string;
  plannedExecutors?: readonly NonNullable<CodexPipelineRunSkill['executor']>[];
}): Promise<AnyRecord> {
  if (!input.admissionLocked) {
    return withCardCodexAdmission(
      { decisionOsRoot: input.decisionOsRoot, ledgerId: input.ledgerId, cardId: input.sourceCardId },
      () => startPipelineRun({ ...input, admissionLocked: true }),
    );
  }
  const workspaceRoot = dirname(input.decisionOsRoot);
  const availableSkills = scanCodexSkills({ workspaceRoot, serverRoot: runtimeServerRoot(input.runtime) });
  const availableSkillNames = availableSkills.map((skill) => skill.name);
  const normalized = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
  const unavailableSkill = input.definition.steps
    .flatMap((step) => step.skills)
    .find((skill) => !availableSkillNames.includes(skill.skillName));
  // WHAT: Reject definitions containing a skill that discovery cannot resolve.
  // WHY: Persisting pending work that cannot launch would strand the pipeline.
  if (unavailableSkill) return { ok: false, statusCode: 400, error: 'Pipeline references an unavailable skill.', skillName: unavailableSkill.skillName };
  const invalidDefault = normalized.issues.find((issue) =>
    (issue.code === 'unsupported-default-model' || issue.code === 'unsupported-default-effort')
    && input.definition.steps.some((step) => step.skills.some((skill) => skill.skillName === issue.skillName))
  );
  // WHAT: Stop before snapshotting an invalid library default.
  // WHY: Every persisted skill run must contain executable model and effort values.
  if (invalidDefault) return { ok: false, statusCode: 400, error: invalidDefault.message, skillName: invalidDefault.skillName };
  const corruption = codexPipelineStoreWriteBlocker(normalized);
  if (corruption) return { ok: false, statusCode: 503, error: 'The Codex pipeline store contains data that cannot be rewritten safely and has been preserved for recovery.', detail: corruption.message };

  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.ledgerId,
  });
  // WHAT: Require the requested ledger and source card before creating output cards.
  // WHY: Generated cards and relationships must be anchored to an existing source.
  if (!context) return { ok: false, statusCode: 404, error: 'Ledger not found.', ledgerId: input.ledgerId };
  const source = sourceCard(context, input.sourceCardId);
  if (!source) return { ok: false, statusCode: 404, error: 'Source card not found.', cardId: input.sourceCardId };
  const replicatedState = taskExecutionState(input.runtime);
  const router = taskExecutionRouter(input.runtime);
  if (!input.restartOfRun && replicatedState) {
    const requestedSkillName = input.definition.steps[0]?.skills[0]?.skillName ?? '';
    const existing = normalized.store.runs.find((candidate) => (
      candidate.temporary === input.definition.temporary
      && candidate.pipelineId === input.definition.pipelineId
      && candidate.ledgerId === input.ledgerId
      && candidate.sourceCardId === input.sourceCardId
      && (!candidate.temporary || candidate.steps[0]?.skills[0]?.skillName === requestedSkillName)
      && replicatedState.executions.byPipelineRunId(candidate.id).some((execution) => (
        execution.lifecycle.phase === 'preparing'
        || execution.lifecycle.phase === 'queued'
        || execution.lifecycle.phase === 'starting'
        || execution.lifecycle.phase === 'running'
        || execution.lifecycle.phase === 'cancelling'
      ))
    ));
    if (existing) {
      const projected = reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: existing.id,
      }) ?? existing;
      const first = replicatedState.executions.byPipelineRunId(existing.id)
        .find((execution) => execution.lifecycle.phase === 'queued');
      return {
        ok: true,
        statusCode: 202,
        run: projected,
        skillRun: null,
        queuePosition: first
          ? unifiedCodexQueuePosition({
            decisionOsRoot: input.decisionOsRoot,
            id: first.metadata.executionId,
            createdAt: first.metadata.requestedAt,
            runtime: input.runtime,
          })
          : null,
        maxConcurrentCodexProcesses: maxConcurrentCodexProcesses(input.runtime),
      };
    }
  }
  const ownership = cardCodexExecutionOwnership(source);
  if (ownership.state === 'contradictory') return { ok: false, statusCode: 409, error: 'Source card has contradictory Codex execution ownership.', ...ownership };
  const activeRunId = ownership.state === 'active' ? ownership.lease.runId : '';
  const activeExecutionId = ownership.state === 'active' ? ownership.lease.executionId : '';
  if (ownership.state === 'active') {
    const existing = normalized.store.runs.find((candidate) => candidate.ledgerId === input.ledgerId
      && candidate.sourceCardId === input.sourceCardId
      && (candidate.status === 'pending' || candidate.status === 'running')
      && candidate.steps.some((step) => step.skills.some((skill) => skill.runId === activeRunId && skill.executionId === activeExecutionId)));
    if (existing) return {
      ok: true,
      statusCode: 202,
      run: existing,
      skillRun: null,
      queuePosition: existing.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot: input.decisionOsRoot, id: existing.id, createdAt: existing.createdAt, runtime: input.runtime }) : null,
      maxConcurrentCodexProcesses: 0,
    };
    return { ok: false, statusCode: 409, error: 'Source card already owns an active Codex execution.', runId: activeRunId, executionId: activeExecutionId };
  }
  // WHAT: Reject empty pipeline shapes at the runtime boundary.
  // WHY: A run with no executable stage cannot make progress or settle correctly.
  if (input.definition.steps.length === 0) return { ok: false, statusCode: 400, error: 'A pipeline run requires at least one step.' };
  // WHAT: Require at least one executable skill in every stage.
  // WHY: An empty stage would leave the sequential runner without a next transition.
  if (input.definition.steps.some((step) => step.skills.length === 0)) {
    return { ok: false, statusCode: 400, error: 'Every pipeline step must contain at least one skill.' };
  }

  let run: CodexPipelineRun;
  try {
    run = createCodexPipelineRunManifest({
      decisionOsRoot: input.decisionOsRoot,
      definition: input.definition,
      store: normalized.store,
      workspaceRoot,
      runtime: input.runtime,
      ledgerId: input.ledgerId,
      sourceCardId: input.sourceCardId,
      sourceCardTitle: String(source.title ?? input.sourceCardId),
      ledgerPath: context.ledgerPath,
      restartOfPipelineRunId: input.restartOfRun?.id ?? null,
      reservedRunId: input.reservedRunId,
      reservedFirstExecutionId: input.reservedFirstExecutionId,
    });
    if (run.executionMode === 'federated') {
      const topology = run.steps.flatMap((step) => step.skills);
      if (!input.plannedExecutors || input.plannedExecutors.length !== topology.length) {
        throw new Error('A federated pipeline requires one planned executor for every skill.');
      }
      for (const executor of input.plannedExecutors) {
        if (!/^[a-zA-Z0-9_-]+$/.test(executor.nodeId) || !executor.projectId || !executor.role) {
          throw new Error('A federated pipeline executor is invalid.');
        }
      }
      let executorIndex = 0;
      run = {
        ...run,
        steps: run.steps.map((step) => ({
          ...step,
          skills: step.skills.map((skill) => ({
            ...skill,
            executor: input.plannedExecutors![executorIndex++],
          })),
        })),
      };
    }
  } catch (error) {
    // WHAT: Surface option-resolution errors as request failures.
    // WHY: Invalid model and effort inputs are operator-correctable, not server faults.
    return { ok: false, statusCode: 400, error: error instanceof Error ? error.message : String(error) };
  }
  const ledgerBefore = JSON.stringify(context.ledger);
  const cardError = await createCodexPipelineStepCards({
    decisionOsRoot: input.decisionOsRoot,
    context,
    source,
    run,
    projectLegacyLifecycle: !router,
  });
  // WHAT: Stop when the ledger rejects a generated card or relationship.
  // WHY: The manifest must not start unless its complete visual chain exists.
  if (cardError) {
    await rollbackPipelineCards({ decisionOsRoot: input.decisionOsRoot, context, ledgerBefore, sourceCardId: input.sourceCardId, outputCardIds: run.steps.map((step) => step.outputCardId) });
    return { ok: false, statusCode: 400, error: String(cardError.error ?? 'Could not create pipeline step cards.') };
  }
  try {
    writeCodexPipelineStore({
      decisionOsRoot: input.decisionOsRoot,
      availableSkillNames,
      store: { ...normalized.store, runs: [...normalized.store.runs, run] },
    });
  } catch {
    await rollbackPipelineCards({ decisionOsRoot: input.decisionOsRoot, context, ledgerBefore, sourceCardId: input.sourceCardId, outputCardIds: run.steps.map((step) => step.outputCardId) });
    // WHAT: Report manifest persistence failure before launching Codex.
    // WHY: An untracked child process could not be resumed or cancelled safely.
    return { ok: false, statusCode: 500, error: 'Could not persist the pipeline run manifest.' };
  }
  if (run.executionMode !== 'federated' && router) {
    if (typeof input.onLedgerChange === 'function') input.runtime.onPipelineLedgerChange = input.onLedgerChange;
    const previousExecutions = input.restartOfRun
      ? input.restartOfRun.steps.flatMap((step) => step.skills)
      : [];
    const topology = run.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })));
    const requests = topology.map(({ step, skill }, index) => createTaskExecutionLaunchRequest({
      requestId: input.requestIdPrefix
        ? `${input.requestIdPrefix}:${index + 1}`
        : `pipeline:${run.id}:${skill.executionId}`,
      executionId: skill.executionId,
      projectId: String(input.runtime.projectId ?? ''),
      ledgerId: run.ledgerId,
      sessionId: skill.runId,
      sourceCardId: run.sourceCardId,
      ownerCardId: step.outputCardId,
      kind: 'pipeline-skill',
      requestedAt: run.createdAt,
      model: skill.codexModel,
      effort: skill.codexEffort,
      pipelineRunId: run.id,
      pipelineStepId: step.id,
      pipelineSkillRunId: skill.runId,
      predecessorExecutionId: index === 0 ? null : topology[index - 1].skill.executionId,
      restartOfExecutionId: previousExecutions[index]?.executionId ?? null,
    }));
    try {
      const receipts = await router.routeBatch(requests, { pipelineRun: run });
      const projected = reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: run.id,
      }) ?? run;
      if (typeof input.onLedgerChange === 'function') {
        (input.onLedgerChange as (event: AnyRecord) => void)({
          reason: 'pipeline-enqueued',
          ledgerId: input.ledgerId,
          pipelineRunId: run.id,
          runId: topology[0]?.skill.runId ?? '',
          executionId: topology[0]?.skill.executionId ?? '',
          status: 'pending',
          cardId: input.sourceCardId,
          cardIds: run.steps.map((step) => step.outputCardId),
        });
      }
      return {
        ok: true,
        statusCode: 202,
        run: projected,
        receipts,
        skillRun: null,
        queuePosition: receipts[0]?.executorNodeId === taskExecutionNodeId(input.runtime)
          ? unifiedCodexQueuePosition({
            decisionOsRoot: input.decisionOsRoot,
            id: receipts[0].executionId,
            createdAt: receipts[0].requestedAt,
            runtime: input.runtime,
          })
          : null,
        maxConcurrentCodexProcesses: maxConcurrentCodexProcesses(input.runtime),
      };
    } catch (error) {
      const current = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
      writeCodexPipelineStore({
        decisionOsRoot: input.decisionOsRoot,
        availableSkillNames,
        store: { ...current.store, runs: current.store.runs.filter((entry) => entry.id !== run.id) },
      });
      await rollbackPipelineCards({
        decisionOsRoot: input.decisionOsRoot,
        context,
        ledgerBefore,
        sourceCardId: input.sourceCardId,
        outputCardIds: run.steps.map((step) => step.outputCardId),
      });
      if (error instanceof TaskExecutionAdmissionError) {
        return {
          ok: false,
          statusCode: error.statusCode,
          code: error.code,
          retryable: error.statusCode >= 500,
          error: error.message,
          context: error.context,
        };
      }
      throw error;
    }
  }
  if (run.executionMode === 'federated' && replicatedState) {
    const topology = run.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })));
    const admittedExecutionIds: string[] = [];
    try {
      for (let index = 0; index < topology.length; index += 1) {
        const { step, skill } = topology[index];
        const executorNodeId = skill.executor?.nodeId ?? '';
        const existing = replicatedState.executions.find(skill.executionId);
        const execution = existing ?? await replicatedState.executions.admit({
          metadata: {
            executionId: skill.executionId,
            requestId: `pipeline:${run.id}:${skill.executionId}`,
            sessionId: skill.runId,
            projectId: String(input.runtime.projectId ?? ''),
            ledgerId: run.ledgerId,
            taskId: run.sourceCardId,
            sourceCardId: run.sourceCardId,
            ownerCardId: step.outputCardId,
            kind: 'pipeline-skill',
            requestedAt: run.createdAt,
            model: skill.codexModel,
            effort: skill.codexEffort,
            pipelineRunId: run.id,
            pipelineStepId: step.id,
            pipelineSkillRunId: skill.runId,
            predecessorExecutionId: index === 0 ? null : topology[index - 1].skill.executionId,
            restartOfExecutionId: input.restartOfRun
              ? input.restartOfRun.steps.flatMap((entry) => entry.skills)[index]?.executionId ?? null
              : null,
          },
          executorNodeId,
        });
        if (!existing) admittedExecutionIds.push(execution.metadata.executionId);
      }
      for (const executionId of admittedExecutionIds) {
        await replicatedState.executions.transition(executionId, { phase: 'queued' });
      }
    } catch (error) {
      for (const executionId of admittedExecutionIds) {
        const execution = replicatedState.executions.find(executionId);
        if (execution?.lifecycle.phase === 'preparing') {
          await replicatedState.executions.transition(executionId, {
            phase: 'failed',
            error: {
              code: 'federated_pipeline_admission_failed',
              message: error instanceof Error ? error.message : String(error),
            },
          }).catch(() => undefined);
        } else if (execution?.lifecycle.phase === 'queued') {
          await replicatedState.executions.transition(executionId, {
            phase: 'cancelled',
            result: { status: 'cancelled', summary: 'federated_pipeline_admission_failed' },
          }).catch(() => undefined);
        }
      }
      const current = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
      writeCodexPipelineStore({
        decisionOsRoot: input.decisionOsRoot,
        availableSkillNames,
        store: { ...current.store, runs: current.store.runs.filter((entry) => entry.id !== run.id) },
      });
      await rollbackPipelineCards({
        decisionOsRoot: input.decisionOsRoot,
        context,
        ledgerBefore,
        sourceCardId: input.sourceCardId,
        outputCardIds: run.steps.map((step) => step.outputCardId),
      });
      return {
        ok: false,
        statusCode: 503,
        code: 'federated_pipeline_admission_failed',
        retryable: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    if (typeof input.onLedgerChange === 'function') {
      (input.onLedgerChange as (event: AnyRecord) => void)({
        reason: 'federated-pipeline-prepared',
        ledgerId: input.ledgerId,
        pipelineRunId: run.id,
        status: 'pending',
        cardId: input.sourceCardId,
        cardIds: run.steps.map((step) => step.outputCardId),
      });
    }
    return {
      ok: true,
      statusCode: 202,
      run,
      receipts: replicatedState.executions.byPipelineRunId(run.id).map((execution) => ({
        executionId: execution.metadata.executionId,
        requestId: execution.metadata.requestId,
        projectId: execution.metadata.projectId,
        ledgerId: execution.metadata.ledgerId,
        taskId: execution.metadata.taskId,
        assignedNodeId: execution.lifecycle.executorNodeId,
        executorNodeId: execution.lifecycle.executorNodeId,
        phase: execution.lifecycle.phase,
        revision: execution.lifecycle.revision,
        requestedAt: execution.metadata.requestedAt,
      })),
      skillRun: null,
      queuePosition: null,
      maxConcurrentCodexProcesses: maxConcurrentCodexProcesses(input.runtime),
    };
  }
  const executionCoordinator = codexExecutionCoordinator(input.runtime);
  const firstStep = run.steps[0];
  const firstSkill = firstStep?.skills[0];
  if (executionCoordinator && firstStep && firstSkill) {
    try {
      let execution = executionCoordinator.store.find(firstSkill.executionId);
      if (!execution) execution = await executionCoordinator.admit({
        executionId: firstSkill.executionId,
        sessionId: firstSkill.runId,
        projectId: String(input.runtime.projectId ?? ''),
        ledgerId: run.ledgerId,
        taskId: run.sourceCardId,
        ownerCardId: firstStep.outputCardId,
        kind: 'pipeline-skill',
        pipelineRunId: run.id,
        pipelineStepId: firstStep.id,
        pipelineSkillRunId: firstSkill.runId,
        requestedAt: run.createdAt,
      });
      if (execution.phase === 'preparing') await executionCoordinator.enqueue(firstSkill.executionId);
    } catch (error) {
      const current = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot, availableSkillNames });
      writeCodexPipelineStore({
        decisionOsRoot: input.decisionOsRoot,
        availableSkillNames,
        store: { ...current.store, runs: current.store.runs.filter((entry) => entry.id !== run.id) },
      });
      const execution = executionCoordinator.store.find(firstSkill.executionId);
      if (execution && !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(execution.phase)) {
        await executionCoordinator.cancel(firstSkill.executionId, 'Pipeline admission did not complete.').catch(() => undefined);
      }
      await rollbackPipelineCards({ decisionOsRoot: input.decisionOsRoot, context, ledgerBefore, sourceCardId: input.sourceCardId, outputCardIds: run.steps.map((step) => step.outputCardId) });
      return { ok: false, statusCode: 503, code: String((error as { code?: unknown })?.code ?? ''), retryable: true, error: error instanceof Error ? error.message : String(error) };
    }
  }
  // WHAT: Retain and invoke the request-scoped ledger callback when one is supplied.
  // WHY: Pipeline runner transitions must publish through the same server event boundary as startup.
  if (typeof input.onLedgerChange === 'function') input.runtime.onPipelineLedgerChange = input.onLedgerChange;
  if (typeof input.onLedgerChange === 'function') {
    (input.onLedgerChange as (event: AnyRecord) => void)({
      reason: 'pipeline-enqueued',
      ledgerId: input.ledgerId,
      pipelineRunId: run.id,
      runId: firstSkill?.runId ?? '',
      executionId: firstSkill?.executionId ?? '',
      status: 'pending',
      cardId: input.sourceCardId,
      cardIds: run.steps.map((step) => step.outputCardId),
    });
  }
  const sharedSchedule = input.runtime.scheduleCodexProcesses;
  if (run.executionMode === 'federated') {
    return { ok: true, statusCode: 202, run, skillRun: null, queuePosition: null, maxConcurrentCodexProcesses: 0 };
  }
  const schedule = typeof sharedSchedule === 'function'
    ? await sharedSchedule()
    : await scheduleCodexProcesses({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime });
  const launches = Array.isArray(schedule.launched) ? schedule.launched as AnyRecord[] : [];
  const launch = launches.find((entry) => entry.run && typeof entry.run === 'object' && String((entry.run as AnyRecord).id ?? '') === run.id);
  if (launch?.ok === false) return launch;
  const persisted = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store;
  const scheduledRun = persisted.runs.find((entry) => entry.id === run.id) ?? run;
  return {
    ok: true,
    statusCode: 202,
    run: scheduledRun,
    skillRun: launch?.skillRun ?? null,
    queuePosition: scheduledRun.status === 'pending' ? unifiedCodexQueuePosition({ decisionOsRoot: input.decisionOsRoot, id: run.id, createdAt: run.createdAt, runtime: input.runtime }) : null,
    maxConcurrentCodexProcesses: schedule.capacity,
  };
}

export async function startTemporaryPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  skillName: string;
  codexModel?: CodexModel | null;
  codexEffort?: CodexEffort | null;
  onLedgerChange?: unknown;
  reservedRunId?: string;
  reservedFirstExecutionId?: string;
  requestIdPrefix?: string;
}): Promise<AnyRecord> {
  const now = new Date().toISOString();
  return startPipelineRun({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.ledgerId,
    sourceCardId: input.sourceCardId,
    onLedgerChange: input.onLedgerChange,
    definition: {
      pipelineId: null,
      pipelineName: `${input.skillName} run`,
      temporary: true,
      steps: [{
        id: `temporary-step-${safeSegment(input.skillName)}`,
        name: input.skillName,
        purpose: `Run ${input.skillName} once.`,
        skills: [{
          id: `temporary-skill-${safeSegment(input.skillName)}`,
          skillName: input.skillName,
          codexModel: input.codexModel ?? null,
          codexEffort: input.codexEffort ?? null,
        }],
        createdAt: now,
        updatedAt: now,
      }],
    },
    reservedRunId: input.reservedRunId,
    reservedFirstExecutionId: input.reservedFirstExecutionId,
    requestIdPrefix: input.requestIdPrefix,
  });
}

export async function startFederatedPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
  sourceCardId: string;
  definition: PipelineDefinition;
  onLedgerChange?: unknown;
  plannedExecutors: readonly NonNullable<CodexPipelineRunSkill['executor']>[];
}): Promise<AnyRecord> {
  return startPipelineRun({
    ...input,
    definition: { ...input.definition, executionMode: 'federated' },
  });
}

function pipelineDefinition(input: {
  pipeline: CodexPipeline;
  steps: readonly CodexPipelineStep[];
}): PipelineDefinition | null {
  const stepsById = new Map(input.steps.map((step) => [step.id, step]));
  const ordered = input.pipeline.stepIds.map((stepId) => stepsById.get(stepId));
  // WHAT: Reject a saved pipeline whose ordered step reference is missing.
  // WHY: Runtime order must come entirely from the persisted pipeline definition.
  if (ordered.some((step) => !step)) return null;
  return {
    pipelineId: input.pipeline.id,
    pipelineName: input.pipeline.name,
    temporary: false,
    steps: ordered as CodexPipelineStep[],
  };
}

export async function startCodexPipelineRunController(
  input: { action_payload?: AnyRecord; runtime_state?: AnyRecord; data_model?: AnyRecord } | AnyRecord = {},
): Promise<AnyRecord> {
  const envelope = input as { action_payload?: AnyRecord; runtime_state?: AnyRecord };
  const payload = (envelope.action_payload ?? input) as AnyRecord;
  const runtime = (envelope.runtime_state ?? {}) as AnyRecord;
  const decisionOsRoot = resolve(String(runtime.decisionOsRoot ?? resolve(process.cwd(), '.decision-os')));
  const ledgerId = text(payload.ledgerId);
  const sourceCardId = text(payload.sourceCardId ?? payload.cardId);
  const pipelineId = text(payload.pipelineId);
  // WHAT: Require all identifiers needed to resolve and anchor the saved pipeline.
  // WHY: The controller cannot infer a workspace ledger, source card, or definition.
  if (!ledgerId || !sourceCardId || !pipelineId) {
    return { ok: false, statusCode: 400, error: 'Missing ledgerId, sourceCardId, or pipelineId.' };
  }
  const availableSkillNames = scanCodexSkills({ workspaceRoot: dirname(decisionOsRoot), serverRoot: runtimeServerRoot(runtime) }).map((skill) => skill.name);
  const scoped = readScopedCodexPipelineStores({ decisionOsRoot, runtime, availableSkillNames });
  const serverPipeline = scoped.server.store.pipelines.find((entry) => entry.id === pipelineId);
  const normalized = serverPipeline ? scoped.server : scoped.project;
  const pipeline = serverPipeline ?? normalized?.store.pipelines.find((entry) => entry.id === pipelineId);
  // WHAT: Return a distinct missing-definition response.
  // WHY: Operators can repair a deleted pipeline separately from invalid references.
  if (!pipeline) return { ok: false, statusCode: 404, error: 'Pipeline not found.', pipelineId };
  const invalidReferences = normalized?.invalidReferences.filter((entry) => entry.pipelineId === pipelineId) ?? [];
  // WHAT: Return every invalid saved reference before constructing the runtime definition.
  // WHY: The editor needs the complete repair set and the runner cannot resolve partial definitions.
  if (invalidReferences.length > 0) {
    return { ok: false, statusCode: 400, error: 'Pipeline contains invalid references.', pipelineId, invalidReferences };
  }
  const definition = pipelineDefinition({ pipeline, steps: normalized?.store.steps ?? [] });
  // WHAT: Reject an incomplete ordered definition before the shared start lifecycle.
  // WHY: The runner requires every saved step to be present and ordered.
  if (!definition) return { ok: false, statusCode: 400, error: 'Pipeline contains a missing saved step.', pipelineId };
  return startPipelineRun({
    decisionOsRoot,
    runtime,
    ledgerId,
    sourceCardId,
    definition,
    onLedgerChange: payload.onLedgerChange,
    reservedRunId: text(payload.reservedPipelineRunId),
    reservedFirstExecutionId: text(payload.executionId),
    requestIdPrefix: text(payload.requestId),
  });
}
