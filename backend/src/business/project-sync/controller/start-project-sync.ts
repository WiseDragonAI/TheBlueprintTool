/**
 * WHAT: Admits and asynchronously advances the source-first project synchronization protocol.
 * WHY: The protocol must continue after its initiating HTTP request and settings modal are gone.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { ProjectCatalogStore } from '../../server/helper/project-catalog-store.js';
import type { FederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import { startProjectSyncCodex } from './start-project-sync-codex.js';
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

export function createProjectSyncController(input: {
  masterRoot: string;
  localNodeId: () => string;
  projects: () => DecisionOsProject[];
  catalog: ProjectCatalogStore;
  federation: FederationNodeConnector;
  store: ProjectSyncStore;
  runtimeForProject: (project: DecisionOsProject) => Record<string, unknown>;
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
    if (nodeId !== input.localNodeId()) {
      const response = await input.federation.request(nodeId, '/api/project-sync/role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({ syncId: run.syncId, initiatorNodeId: run.initiatorNodeId, projectId, role, requiredSha, originFingerprint: run.originFingerprint, snapshot: phaseSnapshot })),
      });
      return parsed<RoleResponse>(response, `Remote ${role}`);
    }
    const project = localProject(projectId);
    const codex = await startProjectSyncCodex({
      projectRoot: project.root,
      runtime: input.runtimeForProject(project),
      syncId: run.syncId,
      nodeId,
      initiatorNodeId: run.initiatorNodeId,
      role,
      requiredSha,
      snapshot: phaseSnapshot,
    });
    const verified = verifyProjectSyncPhase({ projectRoot: project.root, role, requiredSha, result: codex.result });
    return { ...codex, snapshot: verified };
  };
  const findOrMaterializeInitiator = (run: ProjectSyncRun, source: SyncSourceProject, sourceSnapshot: RepositorySyncStatus): DecisionOsProject => {
    for (const project of input.projects().filter((entry) => entry.available)) {
      try {
        if (readRepositorySyncStatus(project.root).originFingerprint === sourceSnapshot.originFingerprint) return project;
      } catch { /* Non-Git projects are not synchronization matches. */ }
    }
    const destination = resolve(input.masterRoot, safeCloneName(source.name || basename(sourceSnapshot.originUrl)));
    if (dirname(destination) !== resolve(input.masterRoot)) throw new Error('Clone destination must be a direct child of the catalog root.');
    if (existsSync(destination)) throw new Error(`Clone destination is occupied: ${basename(destination)}.`);
    try {
      execFileSync('git', ['clone', '--origin', 'origin', sourceSnapshot.originUrl, destination], { stdio: 'pipe', timeout: 10 * 60_000 });
      if (!existsSync(resolve(destination, '.decision-os', 'state.json'))) throw new Error('Cloned repository does not contain .decision-os/state.json.');
      return input.catalog.register(basename(destination));
    } catch (error) {
      // The destination was proven absent immediately before this run created it.
      if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
      throw error;
    }
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
        const initiatorProject = findOrMaterializeInitiator(run, source, freshPublished);
        run.initiatorProjectId = initiatorProject.id;
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
        originFingerprint: fingerprint,
      });
      input.onRunChange(admitted.run);
      if (!admitted.duplicate) void advance(admitted.run, source);
      return admitted;
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
