/**
 * WHAT: Validates and executes one federated project-sync role against its task execution lane.
 * WHY: Cross-project execution identity and lifecycle belong to project-sync runtime, not HTTP.
 */
import { resolve } from 'node:path';
import type { CodexPipelineRun } from '../../../../../shared/schemas/codex-pipeline-types.js';
import type { TaskExecutionMetadata } from '../../task-state/helper/task-current-state-types.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { tasksLedgerForProject } from '../../server/helper/project-catalog.js';
import { installFederatedPipelineRun } from '../../codex/helper/install-remote-pipeline-run.js';
import { executeFederatedPipelineSkill } from '../../codex/helper/codex-pipeline-runner.js';
import type { createProjectSyncStore } from '../helper/project-sync-store.js';
import { readRepositorySyncStatus } from '../helper/repository-sync-status.js';
import { executeProjectSyncPipelineSkill } from '../controller/execute-project-sync-pipeline-skill.js';
import { verifyProjectSyncPhase } from '../helper/verify-project-sync-phase.js';
import type { ProjectSyncRole } from '../helper/project-sync-types.js';

type AnyRecord = Record<string, unknown>;
type ExecutionState = Pick<ProjectTaskState, 'executions' | 'finalizeExecutionArtifacts'>;

export async function executeFederatedProjectSyncRole(input: {
  authenticatedNodeId: string;
  body: AnyRecord;
  executionState: (projectId: string, ownerNodeId: string) => ExecutionState | null;
  installSchedulerRuntime: (executionId: string, root: string, runtime: AnyRecord) => void;
  localNodeId: string;
  projectRuntime: (project: DecisionOsProject) => AnyRecord;
  projects: DecisionOsProject[];
  removeSchedulerRuntime: (executionId: string) => void;
  store: ReturnType<typeof createProjectSyncStore>;
}): Promise<AnyRecord> {
  const body = input.body;
  if (!input.authenticatedNodeId
    || input.authenticatedNodeId !== String(body.initiatorNodeId ?? '')) {
    throw new Error('Federation participant authentication failed.');
  }
  const project = input.projects.find(
    (entry) => entry.id === String(body.projectId ?? '') && entry.available,
  );
  if (!project) throw new Error('Local project is unavailable.');
  const role = String(body.role ?? '') as ProjectSyncRole;
  if (!['source-publisher', 'initiator-reconciler', 'source-finalizer'].includes(role)) {
    throw new Error('Invalid project synchronization role.');
  }
  const snapshot = body.snapshot as ReturnType<typeof readRepositorySyncStatus>;
  if (!snapshot
    || snapshot.originFingerprint !== readRepositorySyncStatus(project.root).originFingerprint) {
    throw new Error('Project synchronization snapshot identity mismatch.');
  }
  if (String(body.originFingerprint ?? '') !== snapshot.originFingerprint) {
    throw new Error('Project synchronization origin lock identity mismatch.');
  }
  input.store.acquireLock(snapshot.originFingerprint, String(body.syncId ?? ''));
  const masterTask = body.masterTask && typeof body.masterTask === 'object'
    ? body.masterTask as AnyRecord
    : {};
  const executionId = String(body.executionId ?? '');
  if (!executionId) throw new Error('Project synchronization execution identity is required.');
  const projectRuntime = input.projectRuntime(project);
  const installed = installFederatedPipelineRun({
    decisionOsRoot: project.decisionOsRoot,
    runtime: projectRuntime,
    run: body.pipelineRun as CodexPipelineRun,
  }).run;
  const skill = installed.steps.flatMap((step) => step.skills)
    .find((entry) => entry.executionId === executionId);
  if (!skill?.executor
    || skill.executor.nodeId !== input.localNodeId
    || skill.executor.projectId !== project.id
    || skill.executor.role !== role) {
    throw new Error('Project synchronization executor plan does not target this node and project.');
  }
  const metadata = body.executionMetadata as TaskExecutionMetadata;
  if (!metadata
    || metadata.executionId !== executionId
    || metadata.pipelineRunId !== installed.id
    || metadata.pipelineSkillRunId !== skill.runId) {
    throw new Error('Project synchronization execution metadata does not match its pipeline plan.');
  }
  const taskProjectId = String(masterTask.projectId ?? '');
  if (!taskProjectId || metadata.projectId !== taskProjectId) {
    throw new Error('Project synchronization task project does not match its execution metadata.');
  }
  const state = input.executionState(taskProjectId, input.authenticatedNodeId);
  if (!state) throw new Error('Project synchronization task execution state is unavailable.');
  let execution = state.executions.find(executionId);
  if (!execution) {
    execution = await state.executions.admit({
      metadata,
      executorNodeId: input.localNodeId,
    });
  }
  if (execution.lifecycle.executorNodeId !== input.localNodeId) {
    throw new Error('Project synchronization execution belongs to another node.');
  }
  if (execution.lifecycle.phase === 'preparing') {
    await state.executions.transition(executionId, { phase: 'queued' });
  }
  if (metadata.predecessorExecutionId) {
    const deadline = Date.now() + 15_000;
    while (state.executions.find(metadata.predecessorExecutionId)?.lifecycle.phase !== 'succeeded'
      && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    if (state.executions.find(metadata.predecessorExecutionId)?.lifecycle.phase !== 'succeeded') {
      throw new Error('Project synchronization predecessor did not converge on the selected executor.');
    }
  }
  const runtime = Object.create(projectRuntime) as AnyRecord;
  Object.defineProperty(runtime, 'taskExecutionState', {
    value: state,
    configurable: true,
    enumerable: false,
  });
  input.installSchedulerRuntime(executionId, project.decisionOsRoot, runtime);
  try {
    const executed = await executeFederatedPipelineSkill({
      decisionOsRoot: project.decisionOsRoot,
      runtime,
      pipelineRunId: installed.id,
      executionId,
      executor: skill.executor,
      execute: async (plannedSkill) => {
        const codex = await executeProjectSyncPipelineSkill({
          projectRoot: project.root,
          runtime,
          ledgerFile: resolve(
            project.decisionOsRoot,
            tasksLedgerForProject(project).ledgerFile.replace(/^\.decision-os\//, ''),
          ),
          syncId: String(body.syncId ?? ''),
          nodeId: input.localNodeId,
          initiatorNodeId: String(body.initiatorNodeId ?? ''),
          role,
          requiredSha: String(body.requiredSha ?? '') || undefined,
          snapshot,
          codexRunId: plannedSkill.runId,
          executionId: plannedSkill.executionId,
          manageTaskExecutionLifecycle: false,
          stdoutFile: plannedSkill.stdoutFile,
          stderrFile: plannedSkill.stderrFile,
          pipelineRunId: installed.id,
          masterTask: {
            projectId: String(masterTask.projectId ?? ''),
            ledgerId: String(masterTask.ledgerId ?? ''),
            cardId: String(masterTask.cardId ?? ''),
          },
        });
        return {
          ...codex,
          snapshot: verifyProjectSyncPhase({
            projectRoot: project.root,
            role,
            requiredSha: String(body.requiredSha ?? '') || undefined,
            result: codex.result,
          }),
          executorNodeId: input.localNodeId,
        };
      },
    });
    return { ok: true, ...executed.result };
  } finally {
    input.removeSchedulerRuntime(executionId);
  }
}
