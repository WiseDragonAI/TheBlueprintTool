/**
 * WHAT: Admits and asynchronously advances the source-first project synchronization protocol.
 * WHY: The protocol must continue after its initiating HTTP request and settings modal are gone.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { tasksLedgerForProject, type DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { ProjectCatalogStore } from '../../server/helper/project-catalog-store.js';
import type { FederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { executeProjectSyncPipelineSkill } from './execute-project-sync-pipeline-skill.js';
import { executeFederatedPipelineSkill } from '../../codex/helper/codex-pipeline-runner.js';
import { startFederatedPipelineRun } from '../../codex/controller/start-codex-pipeline-run-controller.js';
import { projectSynchronizationPipelineDefinition } from '../helper/project-sync-pipeline-definition.js';
import { admitProjectSyncMasterTask } from '../effect/admit-project-sync-master-task.js';
import { readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import type { ProjectSyncStore } from '../helper/project-sync-store.js';
import type { ProjectSyncRole, ProjectSyncRun } from '../helper/project-sync-types.js';
import { readRepositorySyncStatus, type RepositorySyncStatus } from '../helper/repository-sync-status.js';
import { verifyProjectSyncPhase } from '../helper/verify-project-sync-phase.js';

type RoleResponse = { codexRunId: string; result: Record<string, unknown>; snapshot: RepositorySyncStatus };
type SyncSourceProject = DecisionOsProject & { ownerNodeId?: string; localProjectId?: string; online?: boolean };

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

export function findOrMaterializeInitiatorProject(input: {
  masterRoot: string;
  projects: () => DecisionOsProject[];
  catalog: Pick<ProjectCatalogStore, 'register'>;
  source: SyncSourceProject;
  sourceSnapshot: RepositorySyncStatus;
  gitSshCommand?: string;
}): DecisionOsProject {
  for (const project of input.projects().filter((entry) => entry.available)) {
    try {
      if (readRepositorySyncStatus(project.root).originFingerprint === input.sourceSnapshot.originFingerprint) {
        if (input.gitSshCommand) execFileSync('git', ['-C', project.root, 'config', '--local', 'core.sshCommand', input.gitSshCommand], { stdio: 'pipe' });
        return project;
      }
    } catch { /* Non-Git projects are not synchronization matches. */ }
  }
  const destination = resolve(input.masterRoot, safeCloneName(input.source.name || basename(input.sourceSnapshot.originUrl)));
  if (dirname(destination) !== resolve(input.masterRoot)) throw new Error('Clone destination must be a direct child of the catalog root.');
  if (existsSync(destination)) throw new Error(`Clone destination is occupied: ${basename(destination)}.`);
  try {
    const cloneArguments = [
      ...(input.gitSshCommand ? ['-c', `core.sshCommand=${input.gitSshCommand}`] : []),
      'clone', '--origin', 'origin', input.sourceSnapshot.originUrl, destination,
    ];
    execFileSync('git', cloneArguments, { stdio: 'pipe', timeout: 10 * 60_000 });
    if (!existsSync(resolve(destination, '.decision-os', 'state.json'))) throw new Error('Cloned repository does not contain .decision-os/state.json.');
    if (input.gitSshCommand) execFileSync('git', ['-C', destination, 'config', '--local', 'core.sshCommand', input.gitSshCommand], { stdio: 'pipe' });
    return input.catalog.register(basename(destination));
  } catch (error) {
    // The destination was proven absent immediately before this run created it.
    if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
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
  const advance = async (runInput: ProjectSyncRun, source: SyncSourceProject): Promise<void> => {
    if (running.has(runInput.syncId)) return;
    running.add(runInput.syncId);
    let run = runInput;
    try {
      if (run.phase === 'requested' || run.phase === 'failed') {
        run = input.store.transition(run.syncId, 'preflight');
        input.onRunChange(run);
      }
      if (run.phase === 'preflight') {
        const sourceSnapshot = await snapshot(run.sourceNodeId, run.sourceProjectId);
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
      const finalSha = String(run.evidence.source_finalize?.verifiedSha ?? '');
      const freshSource = await snapshot(run.sourceNodeId, run.sourceProjectId);
      const finalized = await runRole(run.sourceNodeId, run.sourceProjectId, run, 'source-finalizer', freshSource, finalSha);
      if (!finalSha || finalized.snapshot.originSha !== finalSha) throw new Error('Final source SHA does not match the verified initiator SHA.');
      run = input.store.transition(run.syncId, 'complete', { role: 'source-finalizer', requiredSha: finalSha, codexRunId: finalized.codexRunId, result: finalized.result, verifiedSha: finalized.snapshot.originSha });
      input.onRunChange(run);
      await releaseRemoteLock(run);
    } catch (error) {
      fail(run, error);
      await releaseRemoteLock(run).catch(() => undefined);
    } finally {
      running.delete(run.syncId);
    }
  };
  return {
    async start(source: SyncSourceProject, idempotencyKey: string): Promise<{ run: ProjectSyncRun; duplicate: boolean }> {
      const sourceNodeId = String(source.ownerNodeId ?? input.localNodeId());
      const fingerprint = String(source.originFingerprint ?? '').trim();
      if (!fingerprint) throw new Error('Source project does not advertise a Git-origin fingerprint.');
      if (source.online === false) throw new Error('Source node is offline.');
      const gitSshCommand = input.gitSshCommand();
      const admitted = input.store.admit({
        idempotencyKey,
        initiatorNodeId: input.localNodeId(),
        sourceNodeId,
        initiatorProjectId: '',
        sourceProjectId: String(source.localProjectId ?? source.id),
        originFingerprint: fingerprint,
      });
      input.onRunChange(admitted.run);
      if (admitted.duplicate && admitted.run.masterCardId && admitted.run.pipelineRunId) return admitted;
      try {
        const sourceSnapshot = await snapshot(sourceNodeId, String(source.localProjectId ?? source.id));
        if (sourceSnapshot.originFingerprint !== fingerprint) throw new Error('Source origin fingerprint changed before task admission.');
        if (sourceSnapshot.operationInProgress) throw new Error('Source repository has an active Git operation.');
        const taskProject = findOrMaterializeInitiatorProject({
          masterRoot: input.masterRoot,
          projects: input.projects,
          catalog: input.catalog,
          source,
          sourceSnapshot,
          gitSshCommand,
        });
        const task = admitProjectSyncMasterTask({
          project: taskProject,
          sourceProjectId: source.id,
          sourceProjectName: source.name,
          originFingerprint: fingerprint,
          syncId: admitted.run.syncId,
          waitingSince: admitted.run.createdAt,
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
        const run = input.store.attachTask(admitted.run.syncId, {
          initiatorProjectId: taskProject.id,
          taskProjectId: taskProject.id,
          ledgerId: task.ledgerId,
          masterCardId: task.masterCardId,
          pipelineRunId: String(pipelineRun.id ?? ''),
        });
        input.onRunChange(run);
        void advance(run, source);
        return { run, duplicate: admitted.duplicate };
      } catch (error) {
        if (admitted.run.phase === 'requested') fail(admitted.run, error);
        throw error;
      }
    },
    retry(syncId: string): ProjectSyncRun {
      const run = input.store.read(syncId);
      if (!run || run.phase !== 'failed') throw new Error('Only a failed project synchronization can be retried.');
      const candidates: SyncSourceProject[] = [...input.projects(), ...input.federation.remoteProjects()];
      const source = candidates.find((entry) => String(entry.localProjectId ?? entry.id) === run.sourceProjectId && String(entry.ownerNodeId ?? input.localNodeId()) === run.sourceNodeId);
      if (!source) throw new Error('Source project is unavailable for retry.');
      void advance(run, source);
      return run;
    },
    resume(): void {
      for (const run of input.store.list().filter((entry) => !['complete', 'failed'].includes(entry.phase))) {
        const candidates: SyncSourceProject[] = [...input.projects(), ...input.federation.remoteProjects()];
        const source = candidates.find((entry) => String(entry.localProjectId ?? entry.id) === run.sourceProjectId && String(entry.ownerNodeId ?? input.localNodeId()) === run.sourceNodeId);
        if (source) void advance(run, source);
      }
    },
  };
}
