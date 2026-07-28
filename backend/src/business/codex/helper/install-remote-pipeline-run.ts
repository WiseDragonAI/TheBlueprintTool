/**
 * WHAT: Validates and installs an immutable saved-pipeline run before remote execution admission.
 * WHY: The assigned node must own a complete local execution plan before any queued execution can be claimed.
 */
import { dirname, resolve } from 'node:path';
import {
  codexEffortOptions,
  codexModelOptions,
  type CodexPipelineRun,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { TaskExecutionLaunchRequest } from './task-execution-router.js';
import {
  assertCodexPipelineStoreAvailable,
  codexPipelineStoreWriteBlocker,
  mutateCodexPipelineStore,
  readCodexPipelineStore,
} from './codex-pipeline-store.js';
import { resolvePipelineLedgerContext } from './codex-pipeline-runner.js';
import { resolveCodexPipelineRunDirectory } from './resolve-codex-pipeline-run-directory.js';
import {
  assertPipelinePromptRunSkillSnapshot,
  assertPipelineRunSkillPromptEvidence,
} from './pipeline-prompt-snapshot.js';
import { scanCodexSkills } from './scan-codex-skills.js';
import { runtimeServerRoot } from './server-skill-context.js';

type AnyRecord = Record<string, unknown>;
const supportedModels = new Set<string>(codexModelOptions);
const supportedEfforts = new Set<string>(codexEffortOptions);

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function topology(run: CodexPipelineRun): string {
  return JSON.stringify({
    id: run.id,
    restartOfPipelineRunId: run.restartOfPipelineRunId ?? null,
    pipelineId: run.pipelineId,
    pipelineName: run.pipelineName,
    temporary: run.temporary,
    executionMode: run.executionMode ?? 'local',
    ledgerId: run.ledgerId,
    sourceCardId: run.sourceCardId,
    sourceCardTitle: run.sourceCardTitle,
    outputParentCardId: run.outputParentCardId,
    createdAt: run.createdAt,
    steps: run.steps.map((step) => ({
      id: step.id,
      stepId: step.stepId,
      name: step.name,
      purpose: step.purpose,
      outputCardId: step.outputCardId,
      outputSubtaskPosition: step.outputSubtaskPosition,
      skills: step.skills.map((skill) => ({
        id: skill.id,
        pipelineSkillId: skill.pipelineSkillId,
        skillName: skill.skillName,
        contentKind: skill.contentKind,
        ...(skill.contentKind === 'pipeline-prompt' ? {
          contentRevision: skill.contentRevision,
          contentCommit: skill.contentCommit,
          promptSnapshot: skill.promptSnapshot,
        } : {}),
        runId: skill.runId,
        executionId: skill.executionId,
        codexModel: skill.codexModel,
        codexEffort: skill.codexEffort,
        executor: skill.executor ?? null,
      })),
    })),
  });
}

function assertPendingManifest(run: CodexPipelineRun, requests: TaskExecutionLaunchRequest[]): void {
  if (!run || typeof run !== 'object' || Array.isArray(run)) throw new Error('task_execution_pipeline_manifest_invalid');
  if (!run.id || run.executionMode === 'federated' || run.status !== 'pending') {
    throw new Error('task_execution_pipeline_manifest_invalid');
  }
  if (run.startedAt !== null || run.finishedAt !== null || run.error) throw new Error('task_execution_pipeline_manifest_mutable');
  const flattened = run.steps.flatMap((step) => step.skills.map((skill) => ({ step, skill })));
  if (flattened.length !== requests.length) throw new Error('task_execution_pipeline_manifest_topology_mismatch');
  for (let index = 0; index < flattened.length; index += 1) {
    const { step, skill } = flattened[index];
    const request = requests[index];
    assertPipelineRunSkillPromptEvidence(skill);
    if (step.status !== 'pending' || step.startedAt !== null || step.finishedAt !== null || step.error
      || skill.status !== 'pending' || skill.startedAt !== null || skill.finishedAt !== null || skill.error
      || request.pipelineRunId !== run.id
      || request.pipelineStepId !== step.id
      || request.pipelineSkillRunId !== skill.runId
      || request.executionId !== skill.executionId
      || request.sessionId !== skill.runId
      || request.ledgerId !== run.ledgerId
      || request.sourceCardId !== run.sourceCardId
      || request.ownerCardId !== step.outputCardId
      || request.model !== skill.codexModel
      || request.effort !== skill.codexEffort
      || request.predecessorExecutionId !== (index === 0 ? null : flattened[index - 1].skill.executionId)) {
      throw new Error('task_execution_pipeline_manifest_topology_mismatch');
    }
  }
}

function assertExecutorCanRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  run: CodexPipelineRun;
}): void {
  const availableSkills = new Set(scanCodexSkills({
    workspaceRoot: dirname(input.decisionOsRoot),
    serverRoot: runtimeServerRoot(input.runtime),
  }).map((skill) => skill.name));
  for (const skill of input.run.steps.flatMap((step) => step.skills)) {
    if (skill.contentKind === 'pipeline-prompt') {
      assertPipelinePromptRunSkillSnapshot(skill);
    } else if (!availableSkills.has(skill.skillName)) {
      throw new Error(`task_execution_pipeline_skill_unavailable:${skill.skillName}`);
    }
    if (!supportedModels.has(skill.codexModel)) {
      throw new Error(`task_execution_pipeline_model_unsupported:${skill.codexModel}`);
    }
    if (!supportedEfforts.has(skill.codexEffort)) {
      throw new Error(`task_execution_pipeline_effort_unsupported:${skill.codexEffort}`);
    }
  }
}

export function installRemotePipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  run: CodexPipelineRun;
  requests: TaskExecutionLaunchRequest[];
}): { installed: boolean; run: CodexPipelineRun } {
  assertPendingManifest(input.run, input.requests);
  const normalized = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  const corruption = codexPipelineStoreWriteBlocker(normalized);
  if (corruption) throw new Error(`task_execution_pipeline_store_unavailable:${corruption.message}`);
  const existing = normalized.store.runs.find((run) => run.id === input.run.id);
  if (existing) {
    if (topology(existing) !== topology(input.run)) throw new Error('task_execution_pipeline_manifest_conflict');
    // WHAT: Return the installed immutable topology before consulting mutable skill discovery.
    // WHY: An exact admission retry must recover its durable receipt even when the executor's
    // library changes after the original admission; scheduler-time loss settles that execution.
    return { installed: false, run: existing };
  }
  // WHAT: Validate the executor's current library before writing the remote manifest.
  // WHY: Sender-side discovery cannot prove that the assigned node can execute the
  // topology; rejecting here preserves zero durable work for an unusable admission.
  assertExecutorCanRun(input);
  const context = resolvePipelineLedgerContext({
    decisionOsRoot: input.decisionOsRoot,
    runtime: input.runtime,
    ledgerId: input.run.ledgerId,
  });
  if (!context) throw new Error('task_execution_pipeline_ledger_not_found');
  const directory = resolveCodexPipelineRunDirectory(input.decisionOsRoot, context.ledgerPath);
  const localRun: CodexPipelineRun = {
    ...input.run,
    executionMode: 'local',
    steps: input.run.steps.map((step) => ({
      ...step,
      skills: step.skills.map((skill) => ({
        ...skill,
        stdoutFile: resolve(directory, `${safeSegment(skill.runId)}.jsonl`),
        stderrFile: resolve(directory, `${safeSegment(skill.runId)}.log`),
        processId: undefined,
        processStartTime: undefined,
        executor: undefined,
      })),
    })),
  };
  mutateCodexPipelineStore({
    decisionOsRoot: input.decisionOsRoot,
    mutate: (store) => ({
      ...store,
      runs: store.runs.some((run) => run.id === localRun.id) ? store.runs : [...store.runs, localRun],
    }),
  });
  return { installed: true, run: localRun };
}

export function installFederatedPipelineRun(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  run: CodexPipelineRun;
}): { installed: boolean; run: CodexPipelineRun } {
  if (!input.run || input.run.executionMode !== 'federated' || input.run.status !== 'pending'
    || input.run.startedAt !== null || input.run.finishedAt !== null || input.run.error
    || input.run.steps.some((step) => (
      step.status !== 'pending' || step.startedAt !== null || step.finishedAt !== null || step.error
      || step.skills.some((skill) => (
        skill.status !== 'pending' || skill.startedAt !== null || skill.finishedAt !== null || skill.error
        || skill.executor?.kind !== 'federated'
        || !skill.executor.nodeId || !skill.executor.projectId || !skill.executor.role
      ))
    ))) {
    throw new Error('task_execution_federated_pipeline_manifest_invalid');
  }
  const normalized = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  const corruption = codexPipelineStoreWriteBlocker(normalized);
  if (corruption) throw new Error(`task_execution_pipeline_store_unavailable:${corruption.message}`);
  const existing = normalized.store.runs.find((run) => run.id === input.run.id);
  if (existing) {
    if (topology(existing) !== topology(input.run)) throw new Error('task_execution_pipeline_manifest_conflict');
    return { installed: false, run: existing };
  }
  assertExecutorCanRun(input);
  const directory = resolve(input.decisionOsRoot, 'runs', 'codex-skills', safeSegment(input.run.ledgerId));
  const localRun: CodexPipelineRun = {
    ...input.run,
    steps: input.run.steps.map((step) => ({
      ...step,
      skills: step.skills.map((skill) => ({
        ...skill,
        stdoutFile: resolve(directory, `${safeSegment(skill.runId)}.jsonl`),
        stderrFile: resolve(directory, `${safeSegment(skill.runId)}.log`),
        processId: undefined,
        processStartTime: undefined,
      })),
    })),
  };
  mutateCodexPipelineStore({
    decisionOsRoot: input.decisionOsRoot,
    mutate: (store) => ({
      ...store,
      runs: store.runs.some((run) => run.id === localRun.id) ? store.runs : [...store.runs, localRun],
    }),
  });
  return { installed: true, run: localRun };
}

export function removeInstalledRemotePipelineRun(input: {
  decisionOsRoot: string;
  runId: string;
}): void {
  const normalized = readCodexPipelineStore({ decisionOsRoot: input.decisionOsRoot });
  assertCodexPipelineStoreAvailable(normalized);
  if (!normalized.store.runs.some((run) => run.id === input.runId)) return;
  mutateCodexPipelineStore({
    decisionOsRoot: input.decisionOsRoot,
    mutate: (store) => ({ ...store, runs: store.runs.filter((run) => run.id !== input.runId) }),
  });
}
