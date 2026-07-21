/**
 * WHAT: Admits and asynchronously advances the source-first project synchronization protocol.
 * WHY: The protocol must continue after its initiating HTTP request and settings modal are gone.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { tasksLedgerForProject, type DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { ProjectCatalogStore } from '../../server/helper/project-catalog-store.js';
import type { FederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { executeProjectSyncPipelineSkill } from './execute-project-sync-pipeline-skill.js';
import { executeFederatedPipelineSkill } from '../../codex/helper/codex-pipeline-runner.js';
import { startFederatedPipelineRun } from '../../codex/controller/start-codex-pipeline-run-controller.js';
import { restartCodexPipelineRunController } from '../../codex/controller/restart-codex-pipeline-run-controller.js';
import { projectSynchronizationPipelineDefinition } from '../helper/project-sync-pipeline-definition.js';
import { admitProjectSyncMasterTask } from '../effect/admit-project-sync-master-task.js';
import { readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import type { ProjectSyncStore } from '../helper/project-sync-store.js';
import type { ProjectSyncRole, ProjectSyncRun } from '../helper/project-sync-types.js';
import { readRepositorySyncStatus, type RepositorySyncStatus } from '../helper/repository-sync-status.js';
import { verifyProjectSyncPhase } from '../helper/verify-project-sync-phase.js';

type RoleResponse = { codexRunId: string; result: Record<string, unknown>; snapshot: RepositorySyncStatus };
type SyncSourceProject = DecisionOsProject & { ownerNodeId?: string; localProjectId?: string; online?: boolean };
const execFileAsync = promisify(execFile);

function parsed<T>(response: { status: number; body: Buffer }, label: string): T {
  let value: Record<string, unknown>;
  try { value = JSON.parse(response.body.toString('utf8')) as Record<string, unknown>; }
  catch { throw new Error(`${label} returned invalid JSON.`); }
  if (response.status < 200 || response.status >= 300) throw new Error(String(value.error ?? `${label} returned HTTP ${response.status}.`));
  return value as T;
}

function safeCloneName(value: string): string {
  const name = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  if (!name || name === '.' || name === '..') throw new Error('Source project has no safe local clone name.');
  return name;
}

export async function findOrMaterializeInitiatorProject(input: {
  masterRoot: string;
  projects: () => DecisionOsProject[];
  catalog: Pick<ProjectCatalogStore, 'register'>;
  source: SyncSourceProject;
  sourceSnapshot: RepositorySyncStatus;
  syncId: string;
  gitSshCommand?: string;
}): Promise<DecisionOsProject> {
  for (const project of input.projects().filter((entry) => entry.available)) {
    try {
      if (readRepositorySyncStatus(project.root).originFingerprint === input.sourceSnapshot.originFingerprint) {
        if (input.gitSshCommand) await execFileAsync('git', ['-C', project.root, 'config', '--local', 'core.sshCommand', input.gitSshCommand]);
        return project;
      }
    } catch { /* Non-Git projects are not synchronization matches. */ }
  }
  const cloneName = safeCloneName(input.source.name || basename(input.sourceSnapshot.originUrl));
  const destination = resolve(input.masterRoot, cloneName);
  if (dirname(destination) !== resolve(input.masterRoot)) throw new Error('Clone destination must be a direct child of the catalog root.');
  if (existsSync(destination)) {
    try {
      const destinationSnapshot = readRepositorySyncStatus(destination);
      if (destinationSnapshot.originFingerprint !== input.sourceSnapshot.originFingerprint || !existsSync(resolve(destination, '.decision-os', 'state.json'))) throw new Error('identity mismatch');
      if (input.gitSshCommand) await execFileAsync('git', ['-C', destination, 'config', '--local', 'core.sshCommand', input.gitSshCommand]);
      return input.catalog.register(cloneName);
    } catch {
      throw new Error(`Clone destination is occupied: ${basename(destination)}.`);
    }
  }
  const safeSyncId = input.syncId.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const staging = resolve(input.masterRoot, `.${cloneName}.decision-os-sync-${safeSyncId}`);
  if (dirname(staging) !== resolve(input.masterRoot)) throw new Error('Clone staging directory must be a direct child of the catalog root.');
  await rm(staging, { recursive: true, force: true });
  try {
    const cloneArguments = [
      ...(input.gitSshCommand ? ['-c', `core.sshCommand=${input.gitSshCommand}`] : []),
      'clone', '--origin', 'origin', input.sourceSnapshot.originUrl, staging,
    ];
    await execFileAsync('git', cloneArguments, { timeout: 10 * 60_000 });
    if (!existsSync(resolve(staging, '.decision-os', 'state.json'))) throw new Error('Cloned repository does not contain .decision-os/state.json.');
    if (readRepositorySyncStatus(staging).originFingerprint !== input.sourceSnapshot.originFingerprint) throw new Error('Cloned repository origin identity mismatch.');
    if (input.gitSshCommand) await execFileAsync('git', ['-C', staging, 'config', '--local', 'core.sshCommand', input.gitSshCommand]);
    await rename(staging, destination);
    return input.catalog.register(cloneName);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export function createProjectSyncController(input: {
  masterRoot: string;
  localNodeId: () => string;
  projects: () => DecisionOsProject[];
  catalog: ProjectCatalogStore;
  federation: FederationNodeConnector;
  store: ProjectSyncStore;
  runtimeForProject: (project: DecisionOsProject) => Record<string, unknown>;
  gitSshCommand: () => string;
  onRunChange: (run: ProjectSyncRun) => void;
}) {
  const running = new Set<string>();
  const localProject = (projectId: string): DecisionOsProject => {
    const project = input.projects().find((entry) => entry.id === projectId && entry.available);
    if (!project) throw new Error('Local project is unavailable.');
    return project;
  };
  const snapshot = async (nodeId: string, projectId: string): Promise<RepositorySyncStatus> => {
    if (nodeId === input.localNodeId()) return readRepositorySyncStatus(localProject(projectId).root);
    const response = await input.federation.request(nodeId, `/api/project-sync/repository-status?projectId=${encodeURIComponent(projectId)}`);
    return parsed<{ snapshot: RepositorySyncStatus }>(response, 'Remote repository preflight').snapshot;
  };
  const runRole = async (nodeId: string, projectId: string, run: ProjectSyncRun, role: ProjectSyncRole, phaseSnapshot: RepositorySyncStatus, requiredSha?: string): Promise<RoleResponse> => {
    const taskProject = localProject(run.taskProjectId);
    const executed = await executeFederatedPipelineSkill({
      decisionOsRoot: taskProject.decisionOsRoot,
      runtime: input.runtimeForProject(taskProject),
      pipelineRunId: run.pipelineRunId,
      executor: { kind: 'federated', nodeId, projectId, role },
      execute: async (skill) => {
        if (nodeId !== input.localNodeId()) {
          const response = await input.federation.request(nodeId, '/api/project-sync/role', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: Buffer.from(JSON.stringify({
              syncId: run.syncId,
              initiatorNodeId: run.initiatorNodeId,
              projectId,
              role,
              requiredSha,
              originFingerprint: run.originFingerprint,
              snapshot: phaseSnapshot,
              pipelineRunId: run.pipelineRunId,
              pipelineSkillRunId: skill.runId,
              masterTask: { projectId: run.taskProjectId, ledgerId: run.ledgerId, cardId: run.masterCardId },
            })),
          });
          return { ...parsed<RoleResponse>(response, `Remote ${role}`), executorNodeId: nodeId };
        }
        const project = localProject(projectId);
        const codex = await executeProjectSyncPipelineSkill({
          projectRoot: project.root,
          runtime: input.runtimeForProject(project),
          ledgerFile: resolve(project.decisionOsRoot, tasksLedgerForProject(project).ledgerFile.replace(/^\.decision-os\//, '')),
          syncId: run.syncId,
          nodeId,
          initiatorNodeId: run.initiatorNodeId,
          role,
          requiredSha,
          snapshot: phaseSnapshot,
          codexRunId: skill.runId,
          pipelineRunId: run.pipelineRunId,
          masterTask: { projectId: run.taskProjectId, ledgerId: run.ledgerId, cardId: run.masterCardId },
        });
        const verified = verifyProjectSyncPhase({ projectRoot: project.root, role, requiredSha, result: codex.result });
        return { ...codex, snapshot: verified, executorNodeId: nodeId };
      },
    });
    return executed.result as RoleResponse;
  };
  const fail = (run: ProjectSyncRun, message: unknown): void => {
    const failed = input.store.transition(run.syncId, 'failed', undefined, {
      phase: run.phase,
      message: message instanceof Error ? message.message : 'Project synchronization failed.',
    });
    input.onRunChange(failed);
  };
  const releaseRemoteLock = async (run: ProjectSyncRun): Promise<void> => {
    if (run.sourceNodeId === input.localNodeId()) return;
    await input.federation.request(run.sourceNodeId, '/api/project-sync/lock-release', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify({ syncId: run.syncId, originFingerprint: run.originFingerprint })),
    });
  };
  const sourceForRun = (run: ProjectSyncRun): SyncSourceProject | undefined => {
    const candidates: SyncSourceProject[] = [...input.projects(), ...input.federation.remoteProjects()];
    return candidates.find((entry) => String(entry.localProjectId ?? entry.id) === run.sourceProjectId
      && String(entry.ownerNodeId ?? input.localNodeId()) === run.sourceNodeId);
  };
  const prepare = async (runInput: ProjectSyncRun, source: SyncSourceProject): Promise<ProjectSyncRun> => {
    if (runInput.taskProjectId && runInput.masterCardId && runInput.pipelineRunId) return runInput;
    let run = input.store.setPreparationPhase(runInput.syncId, 'materializing');
    input.onRunChange(run);
    const sourceSnapshot = await snapshot(run.sourceNodeId, run.sourceProjectId);
    if (sourceSnapshot.originFingerprint !== run.originFingerprint) throw new Error('Source origin fingerprint changed before task admission.');
    if (sourceSnapshot.operationInProgress) throw new Error('Source repository has an active Git operation.');
    const taskProject = await findOrMaterializeInitiatorProject({
      masterRoot: input.masterRoot,
      projects: input.projects,
      catalog: input.catalog,
      source,
      sourceSnapshot,
      syncId: run.syncId,
      gitSshCommand: input.gitSshCommand(),
    });
    const task = await admitProjectSyncMasterTask({
      project: taskProject,
      runtime: input.runtimeForProject(taskProject),
      sourceProjectId: run.sourceProjectId,
      sourceProjectName: run.sourceProjectName,
      sourceProjectColor: run.sourceProjectColor,
      originFingerprint: run.originFingerprint,
      syncId: run.syncId,
      waitingSince: run.createdAt,
    });
    const definition = projectSynchronizationPipelineDefinition();
    const existingPipelineRun = readCodexPipelineStore({ decisionOsRoot: taskProject.decisionOsRoot }).store.runs.find((entry) =>
      entry.pipelineId === definition.pipeline.id && entry.sourceCardId === task.masterCardId
    );
    const pipeline = existingPipelineRun ? { ok: true, run: existingPipelineRun } : await startFederatedPipelineRun({
      decisionOsRoot: taskProject.decisionOsRoot,
      runtime: input.runtimeForProject(taskProject),
      ledgerId: task.ledgerId,
      sourceCardId: task.masterCardId,
      definition: { pipelineId: definition.pipeline.id, pipelineName: definition.pipeline.name, temporary: false, steps: definition.steps },
    });
    if (pipeline.ok !== true || !pipeline.run || typeof pipeline.run !== 'object') throw new Error(String(pipeline.error ?? 'Synchronization pipeline admission failed.'));
    const pipelineRun = pipeline.run as { id?: unknown };
    run = input.store.attachTask(run.syncId, {
      initiatorProjectId: taskProject.id,
      taskProjectId: taskProject.id,
      ledgerId: task.ledgerId,
      masterCardId: task.masterCardId,
      pipelineRunId: String(pipelineRun.id ?? ''),
    });
    input.onRunChange(run);
    if (run.phase === 'requested') {
      run = input.store.transition(run.syncId, 'preflight', { snapshot: sourceSnapshot });
      input.onRunChange(run);
    }
    return run;
  };
  const advance = async (runInput: ProjectSyncRun): Promise<ProjectSyncRun> => {
    let run = runInput;
    if (run.phase === 'preflight') {
      const sourceSnapshot = run.evidence.preflight?.snapshot ?? await snapshot(run.sourceNodeId, run.sourceProjectId);
      if (sourceSnapshot.originFingerprint !== run.originFingerprint) throw new Error('Source origin fingerprint changed before preflight.');
      if (sourceSnapshot.operationInProgress) throw new Error('Source repository has an active Git operation.');
      run = input.store.transition(run.syncId, 'source_publish', { snapshot: sourceSnapshot });
      input.onRunChange(run);
    }
    if (run.phase === 'source_publish') {
      const sourceSnapshot = run.evidence.source_publish?.snapshot ?? await snapshot(run.sourceNodeId, run.sourceProjectId);
      const published = await runRole(run.sourceNodeId, run.sourceProjectId, run, 'source-publisher', sourceSnapshot);
      run = input.store.transition(run.syncId, 'initiator_reconcile', { role: 'source-publisher', codexRunId: published.codexRunId, result: published.result, verifiedSha: published.snapshot.originSha });
      input.onRunChange(run);
    }
    if (run.phase === 'initiator_reconcile') {
      const sourceSha = String(run.evidence.initiator_reconcile?.verifiedSha ?? '');
      const freshPublished = await snapshot(run.sourceNodeId, run.sourceProjectId);
      if (!sourceSha || freshPublished.originSha !== sourceSha) throw new Error('Verified source SHA is no longer the origin authority.');
      const initiatorProject = localProject(run.initiatorProjectId);
      const initiatorSnapshot = readRepositorySyncStatus(initiatorProject.root);
      if (initiatorSnapshot.originFingerprint !== run.originFingerprint) throw new Error('Initiator origin fingerprint does not match the source.');
      const reconciled = await runRole(run.initiatorNodeId, initiatorProject.id, run, 'initiator-reconciler', initiatorSnapshot, sourceSha);
      run = input.store.transition(run.syncId, 'source_finalize', { role: 'initiator-reconciler', requiredSha: sourceSha, codexRunId: reconciled.codexRunId, result: reconciled.result, verifiedSha: reconciled.snapshot.originSha });
      input.onRunChange(run);
    }
    if (run.phase === 'source_finalize') {
      const finalSha = String(run.evidence.source_finalize?.verifiedSha ?? '');
      const freshSource = await snapshot(run.sourceNodeId, run.sourceProjectId);
      const finalized = await runRole(run.sourceNodeId, run.sourceProjectId, run, 'source-finalizer', freshSource, finalSha);
      if (!finalSha || finalized.snapshot.originSha !== finalSha) throw new Error('Final source SHA does not match the verified initiator SHA.');
      run = input.store.transition(run.syncId, 'complete', { role: 'source-finalizer', requiredSha: finalSha, codexRunId: finalized.codexRunId, result: finalized.result, verifiedSha: finalized.snapshot.originSha });
      input.onRunChange(run);
      await releaseRemoteLock(run);
    }
    return run;
  };
  const execute = async (runInput: ProjectSyncRun, source: SyncSourceProject, restartPipeline = false): Promise<void> => {
    if (running.has(runInput.syncId)) return;
    running.add(runInput.syncId);
    let run = runInput;
    try {
      run = await prepare(run, source);
      if (restartPipeline && run.pipelineRunId) {
        const taskProject = localProject(run.taskProjectId);
        const reset = await restartCodexPipelineRunController({
          action_payload: { runId: run.pipelineRunId },
          runtime_state: { ...input.runtimeForProject(taskProject), decisionOsRoot: taskProject.decisionOsRoot },
        });
        if (reset.ok !== true) throw new Error(String(reset.error ?? 'Synchronization pipeline could not be restarted.'));
      }
      await advance(run);
    } catch (error) {
      const current = input.store.read(run.syncId) ?? run;
      if (current.phase !== 'failed' && current.phase !== 'complete') fail(current, error);
      await releaseRemoteLock(current).catch(() => undefined);
    } finally {
      running.delete(runInput.syncId);
    }
  };
  return {
    start(source: SyncSourceProject, idempotencyKey: string): { run: ProjectSyncRun; duplicate: boolean } {
      const sourceNodeId = String(source.ownerNodeId ?? input.localNodeId());
      const fingerprint = String(source.originFingerprint ?? '').trim();
      if (!fingerprint) throw new Error('Source project does not advertise a Git-origin fingerprint.');
      if (source.online === false) throw new Error('Source node is offline.');
      const admitted = input.store.admit({
        idempotencyKey,
        initiatorNodeId: input.localNodeId(),
        sourceNodeId,
        initiatorProjectId: '',
        sourceProjectId: String(source.localProjectId ?? source.id),
        sourceProjectName: source.name,
        sourceProjectColor: source.color,
        originFingerprint: fingerprint,
      });
      const retrying = admitted.run.phase === 'failed';
      const restartPipeline = retrying && Boolean(admitted.run.pipelineRunId);
      const run = retrying ? input.store.restart(admitted.run.syncId) : admitted.run;
      input.onRunChange(run);
      void execute(run, source, restartPipeline);
      return { run, duplicate: admitted.duplicate };
    },
    retry(syncId: string): ProjectSyncRun {
      const run = input.store.read(syncId);
      if (!run || run.phase !== 'failed') throw new Error('Only a failed project synchronization can be retried.');
      const source = sourceForRun(run);
      if (!source) throw new Error('Source project is unavailable for retry.');
      const restartPipeline = Boolean(run.pipelineRunId);
      const restarted = input.store.restart(syncId);
      input.onRunChange(restarted);
      void execute(restarted, source, restartPipeline);
      return restarted;
    },
    resume(): void {
      for (const run of input.store.list().filter((entry) => !['complete', 'failed'].includes(entry.phase))) {
        const source = sourceForRun(run);
        if (source) void execute(run, source);
      }
    },
  };
}
