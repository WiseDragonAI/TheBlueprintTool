/**
 * WHAT: Projects immutable pipeline topology through replicated execution lifecycle and launches the selected skill.
 * WHY: Pipeline ordering must survive process-local state loss without letting manifest compatibility fields become runtime authority.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type {
  CodexPipelineRun,
  CodexPipelineRunSkill,
  CodexPipelineRunStep,
  CodexPipelineStatus,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { readCanonicalDecisionOsState } from '@backend/business/ledger/helper/read-canonical-decision-os-state.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '@backend/business/ledger/helper/card-content-file.js';
import { codexRunExecutionFinishedMarker } from './codex-run-segment-marker.js';
import { readCodexPipelineStore } from './codex-pipeline-store.js';
import { buildPipelineSkillPrompt } from './build-pipeline-skill-prompt.js';
import { resolveCodexCommand } from './resolve-codex-command.js';
import { decisionOsCodexEnvironment } from './decision-os-codex-runtime.js';
import { resolveServerSkillContext } from './server-skill-context.js';
import { readLedgerProjection } from '@backend/business/task-state/helper/read-ledger-projection.js';
import { codexProcessIdentity } from './codex-process-identity.js';
import { launchCodexExecutionProcess } from './launch-codex-execution-process.js';
import { signalCodexProcessTree } from './reconcile-terminal-codex-process.js';
import {
  attachCodexRuntimeChild as attachRuntimeChild,
  codexRuntimeRun,
  codexExecutionTimeoutMs,
  notifyCodexLifecycle as notify,
  publicCodexRuntimeRun,
  scheduleCodexRuntime,
  updateCodexRuntimeRun as updateRuntimeRun,
} from './codex-runtime-run-store.js';
import {
  finalizeTaskExecutionArtifacts,
  registerTaskExecutionProcess,
  removeTaskExecutionProcess,
  taskExecutionState,
} from './task-execution-runtime.js';

type AnyRecord = Record<string, unknown>;
type TerminalStatus = 'complete' | 'failed' | 'cancelled';
type FederatedPipelineExecutor = {
  executor: NonNullable<CodexPipelineRunSkill['executor']>;
  execute: (skill: CodexPipelineRunSkill) => Promise<Record<string, unknown>>;
};

function federatedPipelineExecutors(runtime: AnyRecord): Map<string, FederatedPipelineExecutor> {
  const current = runtime.federatedPipelineExecutors;
  if (current instanceof Map) return current as Map<string, FederatedPipelineExecutor>;
  const executors = new Map<string, FederatedPipelineExecutor>();
  Object.defineProperty(runtime, 'federatedPipelineExecutors', {
    value: executors,
    configurable: true,
    enumerable: false,
  });
  return executors;
}

export function federatedPipelineExecutionReady(runtime: AnyRecord, executionId: string): boolean {
  return federatedPipelineExecutors(runtime).has(executionId);
}

export function publicPipelineSkillRuntimeRun(run: AnyRecord): AnyRecord {
  return publicCodexRuntimeRun(run);
}

export function maxConcurrentCodexProcesses(runtime: AnyRecord): number {
  const sharedCapacity = runtime.globalCodexProcessCapacity;
  if (typeof sharedCapacity === 'function') {
    const configured = Number(sharedCapacity());
    if (Number.isFinite(configured)) return Math.min(32, Math.max(1, Math.floor(configured)));
  }
  const settings = runtime.decisionOsSettings && typeof runtime.decisionOsSettings === 'object'
    ? runtime.decisionOsSettings as AnyRecord
    : {};
  const configured = Number(
    process.env.CODEX_MAX_CONCURRENT_PROCESSES
      ?? settings.maxConcurrentCodexProcesses
      ?? settings.CODEX_MAX_CONCURRENT_PROCESSES
      ?? 1,
  );
  if (!Number.isFinite(configured)) return 1;
  return Math.min(32, Math.max(1, Math.floor(configured)));
}

export type PipelineLedgerContext = {
  ledgerId: string;
  ledgerPath: string;
  ledger: AnyRecord & { cards?: AnyRecord[]; relationships?: AnyRecord[] };
  runtime?: AnyRecord;
};

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function appendRunStatus(filePath: string, status: TerminalStatus, detail: string): void {
  const markdown = ['', '---', '', `Codex run ${status === 'complete' ? 'completed' : status}: ${detail}`].join('\n');
  try {
    const current = existsSync(filePath) ? readFileSync(filePath, 'utf8').replace(/\s+$/g, '') : '';
    writeFileSync(filePath, `${current}${markdown}\n`, 'utf8');
  } catch {
    // The durable manifest and process logs remain authoritative when card output cannot be patched.
  }
}

export function resolvePipelineLedgerContext(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  ledgerId: string;
}): PipelineLedgerContext | null {
  const state = readCanonicalDecisionOsState({
    action_payload: { decisionOsFile: resolve(input.decisionOsRoot, 'state.json') },
    runtime_state: input.runtime,
  });
  const tab = state.ledgers.find((entry) => entry.id === input.ledgerId);
  if (!tab) return null;
  const ledgerFile = String(tab.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(input.decisionOsRoot, ledgerFile);
  if (!isInside(input.decisionOsRoot, ledgerPath) || !existsSync(ledgerPath)) return null;
  return {
    ledgerId: input.ledgerId,
    ledgerPath,
    ledger: readLedgerProjection({ ledgerId: input.ledgerId, ledgerPath, runtime: input.runtime }) as PipelineLedgerContext['ledger'],
    runtime: input.runtime,
  };
}

function cardContent(input: { context: PipelineLedgerContext; decisionOsRoot: string; cardId: string }): string {
  const hydrated = hydrateLedgerCardContent(
    JSON.parse(JSON.stringify(input.context.ledger)),
    input.decisionOsRoot,
  ) as { cards?: AnyRecord[] };
  const card = (hydrated.cards ?? []).find((entry) => String(entry.id ?? '') === input.cardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return String(comment.what ?? comment.body ?? comment.description ?? '');
}

export function outputFileForPipelineCard(context: PipelineLedgerContext, decisionOsRoot: string, cardId: string): string {
  const card = (context.ledger.cards ?? []).find((entry) => String(entry.id ?? '') === cardId);
  const comment = card?.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
  return resolveCardContentFile(decisionOsRoot, comment.contentFile) ?? '';
}

export function derivePipelineSkillStatus(input: {
  skill: CodexPipelineRunSkill;
  runtime?: AnyRecord;
}): CodexPipelineStatus {
  const replicated = input.runtime
    ? taskExecutionState(input.runtime)?.executions.find(input.skill.executionId)
    : null;
  if (!replicated) throw new Error(`task_execution_not_found:${input.skill.executionId}`);
  if (replicated.lifecycle.phase === 'preparing' || replicated.lifecycle.phase === 'queued') return 'pending';
  if (replicated.lifecycle.phase === 'starting' || replicated.lifecycle.phase === 'running' || replicated.lifecycle.phase === 'cancelling') return 'running';
  if (replicated.lifecycle.phase === 'succeeded') return 'complete';
  if (replicated.lifecycle.phase === 'cancelled') return 'cancelled';
  return 'failed';
}

function stepStatus(skills: readonly CodexPipelineRunSkill[]): CodexPipelineStatus {
  if (skills.some((skill) => skill.status === 'failed')) return 'failed';
  if (skills.some((skill) => skill.status === 'cancelled')) return 'cancelled';
  if (skills.length > 0 && skills.every((skill) => skill.status === 'complete')) return 'complete';
  if (skills.some((skill) => skill.status === 'running' || skill.status === 'complete')) return 'running';
  return 'pending';
}

function runStatus(steps: readonly CodexPipelineRunStep[], previous: CodexPipelineStatus): CodexPipelineStatus {
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (previous === 'cancelled' || steps.some((step) => step.status === 'cancelled')) return 'cancelled';
  if (steps.length > 0 && steps.every((step) => step.status === 'complete')) return 'complete';
  if (steps.some((step) => step.status === 'running' || step.status === 'complete')) return 'running';
  return 'pending';
}

function isTerminal(status: CodexPipelineStatus): status is TerminalStatus {
  return status === 'complete' || status === 'failed' || status === 'cancelled';
}

export function replicatedPipelineRun(run: CodexPipelineRun, runtime: AnyRecord): CodexPipelineRun | null {
  const state = taskExecutionState(runtime);
  const executions = state?.executions.byPipelineRunId(run.id) ?? [];
  if (executions.length === 0) return null;
  const byId = new Map(executions.map((record) => [record.metadata.executionId, record]));
  const steps = run.steps.map((step) => {
    const skills = step.skills.map((skill) => {
      const execution = byId.get(skill.executionId);
      if (!execution) throw new Error(`task_execution_not_found:${skill.executionId}`);
      const status = derivePipelineSkillStatus({ skill, runtime });
      return {
        ...skill,
        status,
        processId: undefined,
        processStartTime: undefined,
        startedAt: execution.lifecycle.startedAt,
        finishedAt: execution.lifecycle.finishedAt,
        error: execution.lifecycle.error?.message ?? '',
      };
    });
    const status = stepStatus(skills);
    const timestamps = skills.map((skill) => skill.startedAt).filter((value): value is string => Boolean(value)).sort();
    const finished = skills.map((skill) => skill.finishedAt).filter((value): value is string => Boolean(value)).sort();
    return {
      ...step,
      skills,
      status,
      startedAt: timestamps[0] ?? null,
      finishedAt: isTerminal(status) ? finished.at(-1) ?? null : null,
      error: skills.find((skill) => skill.status === 'failed')?.error
        ?? skills.find((skill) => skill.status === 'cancelled')?.error
        ?? '',
    };
  });
  const status = runStatus(steps, 'pending');
  const started = executions.map((record) => record.lifecycle.startedAt).filter((value): value is string => Boolean(value)).sort();
  const finished = executions.map((record) => record.lifecycle.finishedAt).filter((value): value is string => Boolean(value)).sort();
  const changed = executions.map((record) => record.lifecycle.phaseSince).sort();
  return {
    ...run,
    steps,
    status,
    updatedAt: changed.at(-1) ?? run.updatedAt,
    startedAt: started[0] ?? null,
    finishedAt: isTerminal(status) ? finished.at(-1) ?? null : null,
    error: steps.find((step) => step.status === 'failed')?.error
      ?? steps.find((step) => step.status === 'cancelled')?.error
      ?? '',
  };
}

export function reassessPipelineAfterSkill(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRunId: string;
  skillRunId?: string;
  settledStatus?: TerminalStatus;
  error?: string;
  exitCode?: number | null;
  finishedAt?: string;
}): CodexPipelineRun | null {
  const before = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  const prior = before.store.runs.find((run) => run.id === input.pipelineRunId);
  if (!prior) return null;
  const replicated = replicatedPipelineRun(prior, input.runtime);
  if (!replicated) return null;
  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: replicated.ledgerId,
  });
  if (context) hydrateLedgerCardContent(context.ledger, input.decisionOsRoot);
  return replicated;
}

function findNextSkill(run: CodexPipelineRun): { step: CodexPipelineRunStep; skill: CodexPipelineRunSkill } | null {
  for (const step of run.steps) {
    for (const skill of step.skills) {
      if (skill.status === 'running') return null;
      if (skill.status === 'failed' || skill.status === 'cancelled') return null;
      if (skill.status === 'pending') return { step, skill };
    }
  }
  return null;
}

function priorInput(input: {
  run: CodexPipelineRun;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
  context: PipelineLedgerContext;
  decisionOsRoot: string;
}): { cardId: string; content: string } {
  const flattened = input.run.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })));
  const index = flattened.findIndex((entry) => entry.skill.runId === input.skill.runId);
  if (index <= 0) {
    return {
      cardId: input.run.sourceCardId,
      content: cardContent({ context: input.context, decisionOsRoot: input.decisionOsRoot, cardId: input.run.sourceCardId }),
    };
  }
  const prior = flattened[index - 1];
  return {
    cardId: prior.step.outputCardId,
    content: cardContent({ context: input.context, decisionOsRoot: input.decisionOsRoot, cardId: prior.step.outputCardId }),
  };
}

export async function cancelPipelineDependents(input: {
  runtime: AnyRecord;
  pipelineRunId: string;
  executionId: string;
}): Promise<void> {
  const state = taskExecutionState(input.runtime);
  if (!state) return;
  const records = state.executions.byPipelineRunId(input.pipelineRunId);
  const dependentIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records) {
      const predecessor = record.metadata.predecessorExecutionId;
      if (!predecessor || (!dependentIds.has(predecessor) && predecessor !== input.executionId)) continue;
      if (!dependentIds.has(record.metadata.executionId)) {
        dependentIds.add(record.metadata.executionId);
        changed = true;
      }
    }
  }
  for (const executionId of dependentIds) {
    const current = state.executions.find(executionId);
    if (current?.lifecycle.phase !== 'preparing' && current?.lifecycle.phase !== 'queued') continue;
    await state.executions.transition(executionId, {
      phase: 'cancelled',
      result: {
        status: 'cancelled',
        summary: 'pipeline_dependency_failed',
      },
    });
  }
}

export async function spawnPipelineSkillProcess(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRun: CodexPipelineRun;
  step: CodexPipelineRunStep;
  skill: CodexPipelineRunSkill;
}): Promise<AnyRecord> {
  const workspaceRoot = dirname(input.decisionOsRoot);
  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.pipelineRun.ledgerId,
  });
  if (!context) throw new Error(`Ledger ${input.pipelineRun.ledgerId} could not be loaded for pipeline run ${input.pipelineRun.id}.`);
  const outputFile = outputFileForPipelineCard(context, input.decisionOsRoot, input.step.outputCardId);
  if (!outputFile) throw new Error(`Output card ${input.step.outputCardId} has no Markdown file.`);
  const replicatedState = taskExecutionState(input.runtime);
  const replicatedExecution = replicatedState?.executions.find(input.skill.executionId) ?? null;
  if (!replicatedState || !replicatedExecution) throw new Error(`task_execution_not_found:${input.skill.executionId}`);
  if (replicatedExecution.lifecycle.phase !== 'starting') throw new Error(`task_execution_spawn_phase_invalid:${replicatedExecution.lifecycle.phase}`);
  const stageInput = priorInput({
    run: input.pipelineRun,
    step: input.step,
    skill: input.skill,
    context,
    decisionOsRoot: input.decisionOsRoot,
  });
  const command = resolveCodexCommand({
    workspaceRoot,
    runtime: input.runtime,
    codexModel: input.skill.codexModel,
    codexEffort: input.skill.codexEffort,
  });
  const prompt = buildPipelineSkillPrompt({
    skillName: input.skill.skillName,
    ledgerFile: context.ledgerPath,
    pipelineRunId: input.pipelineRun.id,
    pipelineName: input.pipelineRun.pipelineName,
    sourceCardId: input.pipelineRun.sourceCardId,
    sourceCardTitle: input.pipelineRun.sourceCardTitle,
    stepId: input.step.stepId,
    stepTitle: input.step.name,
    stepInputCardId: stageInput.cardId,
    stepInputCardContent: stageInput.content,
    outputCardId: input.step.outputCardId,
    outputMarkdownFile: outputFile,
    serverSkill: resolveServerSkillContext({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, skillName: input.skill.skillName }),
  });

  mkdirSync(dirname(input.skill.stdoutFile), { recursive: true });
  const startedAt = replicatedExecution.lifecycle.startedAt ?? new Date().toISOString();
  let runtimeRun: AnyRecord = {};
  await launchCodexExecutionProcess({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    workspaceRoot,
    ledgerId: input.pipelineRun.ledgerId,
    ledgerPath: context.ledgerPath,
    cardId: input.step.outputCardId,
    runId: input.skill.runId,
    executionId: input.skill.executionId,
    command,
    env: decisionOsCodexEnvironment({ runtime: input.runtime, decisionOsRoot: input.decisionOsRoot, ledgerFile: context.ledgerPath }),
    prompt,
    stdoutFile: input.skill.stdoutFile,
    stderrFile: input.skill.stderrFile,
    segment: 'start',
    startLine: 0,
    startedAt,
    metadata: { sourceCardTitle: input.pipelineRun.sourceCardTitle, codexModel: command.model, codexEffort: command.effort },
    onSpawn: async (child, launchedAt) => {
      runtimeRun = updateRuntimeRun(input.runtime, input.skill.runId, {
        id: input.skill.runId,
        executionId: input.skill.executionId,
        pipelineRunId: input.pipelineRun.id,
        pipelineId: input.pipelineRun.pipelineId,
        pipelineName: input.pipelineRun.pipelineName,
        pipelineStepId: input.step.stepId,
        pipelineStepName: input.step.name,
        skillName: input.skill.skillName,
        ledgerId: input.pipelineRun.ledgerId,
        sourceCardId: input.pipelineRun.sourceCardId,
        sourceCardTitle: input.pipelineRun.sourceCardTitle,
        outputCardId: input.step.outputCardId,
        outputFile,
        stdoutFile: input.skill.stdoutFile,
        stderrFile: input.skill.stderrFile,
        codexModel: input.skill.codexModel,
        codexEffort: input.skill.codexEffort,
        pid: child.pid ?? 0,
        status: 'running',
        startedAt: launchedAt,
      });
      attachRuntimeChild(input.runtime, input.skill.runId, child);
      const processId = child.pid ?? 0;
      const processStartTime = codexProcessIdentity(processId);
      registerTaskExecutionProcess(input.runtime, {
        executionId: input.skill.executionId,
        sessionId: input.skill.runId,
        child,
        processId,
        processStartTime,
        startedAt: launchedAt,
        stdoutFile: input.skill.stdoutFile,
        stderrFile: input.skill.stderrFile,
      });
      try {
        await replicatedState.executions.transition(input.skill.executionId, { phase: 'running' });
      } catch (error) {
        removeTaskExecutionProcess(input.runtime, input.skill.executionId);
        throw error;
      }
      notify(input.runtime.onPipelineLedgerChange, { reason: 'pipeline-skill-started', ledgerId: input.pipelineRun.ledgerId, pipelineRunId: input.pipelineRun.id, runId: input.skill.runId, executionId: input.skill.executionId, status: 'running', cardId: input.step.outputCardId });
    },
    onTurnStarted: (_event, observedAt) => {
      notify(input.runtime.onCodexTurnStarted, { ledgerId: input.pipelineRun.ledgerId, cardId: input.pipelineRun.sourceCardId, outputCardId: input.step.outputCardId, threadId: `thread-${input.pipelineRun.sourceCardId}`, runId: input.skill.runId, executionId: input.skill.executionId, status: 'running', startedAt: observedAt });
    },
    onSettled: async (settlement) => {
      const cancelled = replicatedState.executions.find(input.skill.executionId)?.lifecycle.phase === 'cancelling';
      const status: TerminalStatus = cancelled
        ? 'cancelled'
        : settlement.kind === 'error'
          ? 'failed'
          : settlement.terminalStatus ?? (settlement.exitCode === 0 ? 'complete' : 'failed');
      const exitCode = settlement.exitCode;
      const detail = status === 'cancelled' ? 'terminated by operator' : settlement.kind === 'error' ? settlement.error.message : `exit code ${exitCode ?? 'unknown'}`;
      const error = status === 'failed' ? detail : '';
      appendRunStatus(outputFile, status, detail);
      updateRuntimeRun(input.runtime, input.skill.runId, { status, exitCode, error, finishedAt: settlement.finishedAt });
      if (status === 'cancelled') appendFileSync(input.skill.stderrFile, `Codex run cancelled: ${detail}\n`, 'utf8');
      if (status === 'failed') appendFileSync(input.skill.stderrFile, `Codex run failed: ${detail}\n`, 'utf8');
      appendFileSync(input.skill.stderrFile, codexRunExecutionFinishedMarker({ runId: input.skill.runId, executionId: input.skill.executionId, finishedAt: settlement.finishedAt, status }), 'utf8');
      const current = replicatedState.executions.find(input.skill.executionId);
      if (current && (current.lifecycle.phase === 'starting' || current.lifecycle.phase === 'running' || current.lifecycle.phase === 'cancelling')) {
        await replicatedState.executions.transition(input.skill.executionId, {
          phase: status === 'complete' ? 'succeeded' : status,
          result: { status: status === 'complete' ? 'succeeded' : status, summary: detail },
          error: status === 'failed' ? { code: 'codex_pipeline_skill_failed', message: detail } : null,
        });
      }
      if (status === 'failed' || status === 'cancelled') {
        await cancelPipelineDependents({
          runtime: input.runtime,
          pipelineRunId: input.pipelineRun.id,
          executionId: input.skill.executionId,
        });
      }
      await finalizeTaskExecutionArtifacts({
        runtime: input.runtime,
        executionId: input.skill.executionId,
        jsonl: input.skill.stdoutFile,
        stderr: input.skill.stderrFile,
        telemetry: `${input.skill.stdoutFile}.telemetry.jsonl`,
      });
      // Keep the settled process paths readable until immutable artifact heads exist.
      // Removing them earlier creates a terminal-status window with no live log source.
      removeTaskExecutionProcess(input.runtime, input.skill.executionId);
      const reassessed = reassessPipelineAfterSkill({ decisionOsRoot: input.decisionOsRoot, runtime: input.runtime, pipelineRunId: input.pipelineRun.id, skillRunId: input.skill.runId, settledStatus: status, error, exitCode, finishedAt: settlement.finishedAt });
      updateRuntimeRun(input.runtime, input.skill.runId, { settledAt: new Date().toISOString() });
      notify(input.runtime.onPipelineLedgerChange, { reason: 'pipeline-skill-settled', ledgerId: input.pipelineRun.ledgerId, pipelineRunId: input.pipelineRun.id, runId: input.skill.runId, executionId: input.skill.executionId, cardId: input.step.outputCardId, status, pipelineStatus: reassessed?.status ?? status });
      scheduleCodexRuntime(input.runtime, 'schedule-after-pipeline-settlement', { pipelineRunId: input.pipelineRun.id, runId: input.skill.runId, executionId: input.skill.executionId });
      notify(input.runtime.onCodexRunSettled, { ledgerId: input.pipelineRun.ledgerId, cardId: input.step.outputCardId, outputCardId: input.step.outputCardId, threadId: `thread-${input.step.outputCardId}`, runId: input.skill.runId, executionId: input.skill.executionId, pipelineRunId: input.pipelineRun.id, status, pipelineStatus: reassessed?.status ?? status, pipelineTerminal: Boolean(reassessed && isTerminal(reassessed.status)), exitCode });
    },
  });
  return publicPipelineSkillRuntimeRun(runtimeRun);
}

export async function runPipelineExecution(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  executionId: string;
}): Promise<AnyRecord> {
  const state = taskExecutionState(input.runtime);
  const execution = state?.executions.find(input.executionId) ?? null;
  if (!state || !execution) return { ok: false, statusCode: 404, error: 'Pipeline execution not found.', executionId: input.executionId };
  if (execution.metadata.kind !== 'pipeline-skill' || !execution.metadata.pipelineRunId) {
    return { ok: false, statusCode: 409, error: 'Execution is not a pipeline skill.', executionId: input.executionId };
  }
  if (execution.lifecycle.phase !== 'starting') {
    return { ok: false, statusCode: 409, error: 'Pipeline execution was not claimed.', executionId: input.executionId };
  }
  const manifest = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot }).store.runs
    .find((run) => run.id === execution.metadata.pipelineRunId);
  const located = manifest?.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })))
    .find((entry) => entry.skill.executionId === input.executionId);
  if (!manifest || !located) {
    const message = `Pipeline manifest ${execution.metadata.pipelineRunId} does not contain execution ${input.executionId}.`;
    await state.executions.transition(input.executionId, {
      phase: 'failed',
      error: { code: 'pipeline_execution_manifest_missing', message },
      result: { status: 'failed', summary: message },
    });
    await cancelPipelineDependents({
      runtime: input.runtime,
      pipelineRunId: execution.metadata.pipelineRunId,
      executionId: input.executionId,
    });
    return { ok: false, statusCode: 409, error: message, executionId: input.executionId };
  }
  if (manifest.executionMode === 'federated') {
    const planned = located.skill.executor;
    const registered = federatedPipelineExecutors(input.runtime).get(input.executionId);
    if (!planned || !registered
      || planned.nodeId !== registered.executor.nodeId
      || planned.projectId !== registered.executor.projectId
      || planned.role !== registered.executor.role) {
      const message = `Federated execution ${input.executionId} has no matching runtime executor.`;
      await state.executions.transition(input.executionId, {
        phase: 'failed',
        error: { code: 'federated_pipeline_executor_unavailable', message },
        result: { status: 'failed', summary: message },
      });
      await cancelPipelineDependents({
        runtime: input.runtime,
        pipelineRunId: execution.metadata.pipelineRunId,
        executionId: input.executionId,
      });
      return { ok: false, statusCode: 503, error: message, executionId: input.executionId };
    }
    try {
      // WHAT: Record the executor boundary before invoking the selected remote role.
      // WHY: The scheduler owns the replicated lifecycle; the transport callback returns
      // role output and must not be required to mutate the initiator's execution phase.
      await state.executions.transition(input.executionId, { phase: 'running' });
      const result = await registered.execute(located.skill);
      writeFileSync(located.skill.stdoutFile, `${JSON.stringify(result)}\n`, 'utf8');
      await state.executions.transition(input.executionId, {
        phase: 'succeeded',
        result: {
          status: 'succeeded',
          summary: `federated executor ${planned.nodeId}`,
        },
      });
      await finalizeTaskExecutionArtifacts({
        runtime: input.runtime,
        executionId: input.executionId,
        jsonl: located.skill.stdoutFile,
        stderr: located.skill.stderrFile,
      });
      return { ok: true, statusCode: 200, run: reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: manifest.id,
      }) ?? manifest, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeFileSync(located.skill.stderrFile, `${message}\n`, 'utf8');
      const latest = state.executions.find(input.executionId);
      if (latest?.lifecycle.phase === 'cancelling') {
        // WHAT: Treat the child rejection after an accepted cancellation as cancellation.
        // WHY: The process error text describes signal termination, while the durable
        // pre-signal phase records the operator's intent and is the lifecycle authority.
        await state.executions.transition(input.executionId, {
          phase: 'cancelled',
          result: { status: 'cancelled', summary: 'Cancelled by operator.' },
        });
      } else if (latest && (latest.lifecycle.phase === 'starting' || latest.lifecycle.phase === 'running')) {
        await state.executions.transition(input.executionId, {
          phase: 'failed',
          error: { code: 'federated_pipeline_skill_failed', message },
          result: { status: 'failed', summary: message },
        });
      }
      if (state.executions.find(input.executionId)?.lifecycle.finishedAt) {
        await finalizeTaskExecutionArtifacts({
          runtime: input.runtime,
          executionId: input.executionId,
          jsonl: located.skill.stdoutFile,
          stderr: located.skill.stderrFile,
        });
      }
      await cancelPipelineDependents({
        runtime: input.runtime,
        pipelineRunId: manifest.id,
        executionId: input.executionId,
      });
      return { ok: false, statusCode: 500, error: message, executionId: input.executionId };
    } finally {
      federatedPipelineExecutors(input.runtime).delete(input.executionId);
      scheduleCodexRuntime(input.runtime, 'schedule-after-federated-pipeline-settlement', {
        pipelineRunId: manifest.id,
        executionId: input.executionId,
      });
    }
  }
  try {
    const skillRun = await spawnPipelineSkillProcess({
      decisionOsRoot: input.decisionOsRoot,
      runtime: input.runtime,
      pipelineRun: manifest,
      step: located.step,
      skill: located.skill,
    });
    return {
      ok: true,
      statusCode: 202,
      run: reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: manifest.id,
      }) ?? manifest,
      skillRun,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = state.executions.find(input.executionId);
    if (current?.lifecycle.phase === 'starting' || current?.lifecycle.phase === 'running') {
      await state.executions.transition(input.executionId, {
        phase: 'failed',
        error: { code: 'codex_pipeline_skill_start_failed', message },
        result: { status: 'failed', summary: message },
      });
    }
    await cancelPipelineDependents({
      runtime: input.runtime,
      pipelineRunId: execution.metadata.pipelineRunId,
      executionId: input.executionId,
    });
    return { ok: false, statusCode: 500, error: message, executionId: input.executionId };
  }
}

export async function executeFederatedPipelineSkill(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  pipelineRunId: string;
  executionId?: string;
  executor: NonNullable<CodexPipelineRunSkill['executor']>;
  execute: (skill: CodexPipelineRunSkill) => Promise<Record<string, unknown>>;
}): Promise<{ run: CodexPipelineRun; skill: CodexPipelineRunSkill; result: Record<string, unknown> }> {
  const current = reassessPipelineAfterSkill({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    pipelineRunId: input.pipelineRunId,
  });
  if (!current || current.executionMode !== 'federated') throw new Error('Federated pipeline run not found.');
  const next = input.executionId
    ? current.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })))
      .find(({ skill }) => skill.executionId === input.executionId)
    : findNextSkill(current);
  if (!next) throw new Error('Federated pipeline has no pending skill.');
  const replicatedState = taskExecutionState(input.runtime);
  if (!replicatedState) throw new Error('Replicated task execution state is unavailable.');
  {
    const executorNodeId = String(input.executor.nodeId ?? '').trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(executorNodeId)) throw new Error('Federated pipeline executor node is invalid.');
    const storedSkill = current.steps.flatMap((step) => step.skills).find((skill) => skill.executionId === next.skill.executionId);
    if (!storedSkill) throw new Error('Federated pipeline manifest is incomplete.');
    if (!storedSkill.executor || (
      storedSkill.executor.nodeId !== input.executor.nodeId
      || storedSkill.executor.projectId !== input.executor.projectId
      || storedSkill.executor.role !== input.executor.role
    )) {
      throw new Error(`Federated execution ${next.skill.executionId} has a different planned executor.`);
    }
    const execution = replicatedState.executions.find(next.skill.executionId);
    if (!execution) throw new Error(`Federated execution ${next.skill.executionId} was not admitted with its pipeline topology.`);
    if (execution.lifecycle.executorNodeId !== executorNodeId) {
      throw new Error(`Federated execution ${next.skill.executionId} belongs to executor ${execution.lifecycle.executorNodeId}.`);
    }
    if (execution.lifecycle.phase === 'succeeded') {
      try {
        const result = JSON.parse(readFileSync(next.skill.stdoutFile, 'utf8').trim()) as Record<string, unknown>;
        return {
          run: reassessPipelineAfterSkill({
            decisionOsRoot: input.decisionOsRoot,
            runtime: input.runtime,
            pipelineRunId: current.id,
          }) ?? current,
          skill: { ...next.skill, executor: input.executor },
          result,
        };
      } catch {
        throw new Error(`Federated execution ${next.skill.executionId} succeeded without readable result evidence.`);
      }
    }
    if (execution.lifecycle.phase !== 'queued') {
      throw new Error(`Federated execution ${next.skill.executionId} cannot start from ${execution.lifecycle.phase}.`);
    }
    mkdirSync(dirname(next.skill.stdoutFile), { recursive: true });
    const executors = federatedPipelineExecutors(input.runtime);
    if (executors.has(next.skill.executionId)) throw new Error(`Federated execution ${next.skill.executionId} is already active.`);
    executors.set(next.skill.executionId, { executor: input.executor, execute: input.execute });
    try {
      const schedule = input.runtime.scheduleCodexProcesses;
      if (typeof schedule !== 'function') throw new Error('Shared Codex scheduler is unavailable.');
      await schedule();
      const settled = replicatedState.executions.find(next.skill.executionId);
      if (settled?.lifecycle.phase !== 'succeeded') {
        throw new Error(settled?.lifecycle.error?.message ?? `Federated execution ${next.skill.executionId} did not succeed.`);
      }
      const result = JSON.parse(readFileSync(next.skill.stdoutFile, 'utf8').trim()) as Record<string, unknown>;
      const run = reassessPipelineAfterSkill({
        decisionOsRoot: input.decisionOsRoot,
        runtime: input.runtime,
        pipelineRunId: current.id,
      });
      if (!run) throw new Error('Federated pipeline completion could not be projected.');
      return {
        run,
        skill: run.steps.flatMap((step) => step.skills).find((skill) => skill.executionId === next.skill.executionId)
          ?? { ...next.skill, executor: input.executor },
        result,
      };
    } finally {
      executors.delete(next.skill.executionId);
    }
  }
}

function nestedJsonObjects(value: unknown): Record<string, unknown>[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? [parsed as Record<string, unknown>, ...nestedJsonObjects(parsed)]
        : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.flatMap(nestedJsonObjects);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap(nestedJsonObjects);
  return [];
}

export async function executePipelineSkillInWorkspace(input: {
  workspaceRoot: string;
  decisionOsRoot: string;
  runtime: AnyRecord;
  skillName: string;
  skillRunId: string;
  ledgerFile: string;
  context: AnyRecord;
  executionId?: string;
  stdoutFile?: string;
  stderrFile?: string;
  manageTaskExecutionLifecycle?: boolean;
  onSpawned?: (value: { processId: number; startedAt: string }) => void;
}): Promise<{ codexRunId: string; result: Record<string, unknown> }> {
  const serverSkill = resolveServerSkillContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    skillName: input.skillName,
  });
  if (!serverSkill) throw new Error(`Server pipeline skill is unavailable: ${input.skillName}.`);
  const command = resolveCodexCommand({ workspaceRoot: input.workspaceRoot, runtime: input.runtime });
  const prompt = [
    serverSkill.markdown,
    '',
    '## Injected execution context',
    '',
    'Execute this pipeline step in the current repository. Treat this JSON as authoritative runtime input:',
    JSON.stringify(input.context, null, 2),
  ].join('\n');
  const stdoutFile = input.stdoutFile ?? resolve(input.decisionOsRoot, 'project-sync', 'codex-runs', `${input.skillRunId}.jsonl`);
  const stderrFile = input.stderrFile ?? resolve(input.decisionOsRoot, 'project-sync', 'codex-runs', `${input.skillRunId}.log`);
  mkdirSync(dirname(stdoutFile), { recursive: true });
  mkdirSync(dirname(stderrFile), { recursive: true });
  return new Promise((resolvePromise, reject) => {
    // WHAT: Retain the bounded JSON-evidence parser while moving admission, capacity,
    // process identity, and lifecycle ownership to the shared execution scheduler.
    // WHY: Project-sync roles have a stricter result contract than ordinary Codex
    // streams; replacing that validation would weaken the Git verification boundary.
    const maximumOutputBytes = 8 * 1024 * 1024;
    const executionTimeoutMs = codexExecutionTimeoutMs(input.runtime);
    const child = spawn(command.command, command.args, {
      cwd: input.workspaceRoot,
      env: decisionOsCodexEnvironment({ runtime: input.runtime, decisionOsRoot: input.decisionOsRoot, ledgerFile: input.ledgerFile }),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let pendingFailure: Error | null = null;
    let settled = false;
    let forceTimer: NodeJS.Timeout | undefined;
    let settlementTimer: NodeJS.Timeout | undefined;
    const startedAt = new Date().toISOString();
    const finish = (error: Error | null, result?: { codexRunId: string; result: Record<string, unknown> }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(forceTimer);
      clearTimeout(settlementTimer);
      if (input.executionId) removeTaskExecutionProcess(input.runtime, input.executionId);
      if (error) reject(error);
      else if (result) resolvePromise(result);
    };
    const stop = (error: Error): void => {
      if (pendingFailure) return;
      pendingFailure = error;
      signalCodexProcessTree({ child, signal: 'SIGTERM' });
      forceTimer = setTimeout(() => signalCodexProcessTree({ child, signal: 'SIGKILL' }), 2_000);
      forceTimer.unref?.();
      settlementTimer = setTimeout(() => finish(error), 5_000);
      settlementTimer.unref?.();
    };
    const deadline = setTimeout(() => stop(new Error(`Pipeline skill ${input.skillName} exceeded ${executionTimeoutMs}ms.`)), executionTimeoutMs);
    deadline.unref?.();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const capture = (target: 'stdout' | 'stderr', chunk: string): void => {
      if (pendingFailure) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maximumOutputBytes) {
        stop(new Error(`Pipeline skill ${input.skillName} exceeded ${maximumOutputBytes} captured output bytes.`));
        return;
      }
      if (target === 'stdout') {
        stdout += chunk;
        appendFileSync(stdoutFile, chunk, 'utf8');
      } else {
        stderr += chunk;
        appendFileSync(stderrFile, chunk, 'utf8');
      }
    };
    child.stdout.on('data', (chunk: string) => capture('stdout', chunk));
    child.stderr.on('data', (chunk: string) => capture('stderr', chunk));
    child.stdin.on('error', (error) => stop(error));
    child.stdout.on('error', (error) => stop(error));
    child.stderr.on('error', (error) => stop(error));
    child.once('error', (error) => finish(error));
    child.once('close', (code) => {
      if (pendingFailure) return finish(pendingFailure);
      if (code !== 0) return finish(new Error(`Pipeline skill ${input.skillName} exited with code ${code}: ${stderr.trim() || 'no diagnostic'}`));
      const candidates = stdout.split('\n').filter(Boolean).flatMap((line) => nestedJsonObjects(line));
      const result = candidates.reverse().find((entry) => 'status' in entry && ('headSha' in entry || 'blocker' in entry));
      if (!result) return finish(new Error(`Pipeline skill ${input.skillName} did not return the required JSON evidence.`));
      if (!['complete', 'completed'].includes(String(result.status ?? '').toLowerCase())) {
        return finish(new Error(String(result.blocker ?? `Pipeline skill ${input.skillName} did not complete.`)));
      }
      finish(null, { codexRunId: input.skillRunId, result });
    });
    const registerAndStart = async (): Promise<void> => {
      if (input.executionId) {
        registerTaskExecutionProcess(input.runtime, {
          executionId: input.executionId,
          sessionId: input.skillRunId,
          child,
          processId: child.pid ?? 0,
          processStartTime: codexProcessIdentity(child.pid ?? 0),
          startedAt,
          stdoutFile,
          stderrFile,
        });
        if (input.manageTaskExecutionLifecycle !== false) {
          const state = taskExecutionState(input.runtime);
          const execution = state?.executions.find(input.executionId);
          if (!state || execution?.lifecycle.phase !== 'starting') {
            removeTaskExecutionProcess(input.runtime, input.executionId);
            throw new Error(`Federated execution ${input.executionId} was not durably claimed before spawn.`);
          }
          try {
            await state.executions.transition(input.executionId, { phase: 'running' });
          } catch (error) {
            removeTaskExecutionProcess(input.runtime, input.executionId);
            throw error;
          }
        }
      }
      input.onSpawned?.({ processId: child.pid ?? 0, startedAt });
      child.stdin.end(prompt);
    };
    void registerAndStart().catch((error: unknown) => stop(error instanceof Error ? error : new Error(String(error))));
  });
}

export function pipelineRunLogAvailability(skill: CodexPipelineRunSkill): {
  stdoutAvailable: boolean;
  stderrAvailable: boolean;
  logAvailable: boolean;
  lastLogWriteAt: string | null;
} {
  const stdoutAvailable = Boolean(skill.stdoutFile && existsSync(skill.stdoutFile));
  const stderrAvailable = Boolean(skill.stderrFile && existsSync(skill.stderrFile));
  const newest = Math.max(
    stdoutAvailable ? statSync(skill.stdoutFile).mtimeMs : 0,
    stderrAvailable ? statSync(skill.stderrFile).mtimeMs : 0,
  );
  return {
    stdoutAvailable,
    stderrAvailable,
    logAvailable: stdoutAvailable || stderrAvailable,
    lastLogWriteAt: newest > 0 ? new Date(newest).toISOString() : null,
  };
}
