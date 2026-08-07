/**
 * WHAT: Proves watcher containment and explicit incident recovery inside copied release-canary lanes.
 * WHY: Production recovery admission needs observed owner transitions without contacting live runtimes.
 */
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ReleaseCanaryManifest } from './release-canary-harness.js';
import { watchCardContentFiles } from '../../refresh/helper/watch-card-content-files.js';
import { createTaskContentObjectStore } from '../../task-state/helper/task-content-object-store.js';
import { createRuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import { readProjectRegistry } from '../../server/helper/project-registry.js';
import { projectFromRegisteredPath, type DecisionOsProject } from '../../server/helper/project-catalog.js';
import { createIncidentSupervisor } from '../../server/runtime/incident-supervisor.js';
import { createRuntimeRecoveryService } from '../../server/runtime/runtime-recovery-service.js';
import { createNodeHttpListener } from '../../server/http/create-node-http-listener.js';

type RuntimeProofPhase = 'watcher-recovery' | 'incident-recovery';

export type ReleaseCanaryRuntimeRecoveryProof = Record<RuntimeProofPhase, {
  receiptFile: string;
  receiptId: string;
}>;

function inside(root: string, candidate: string): boolean {
  const relation = relative(resolve(root), resolve(candidate));
  return relation === '' || (relation !== '..' && !relation.startsWith('../') && !isAbsolute(relation));
}

function firstProject(laneRoot: string): DecisionOsProject {
  return projectsInLane(laneRoot)[0]!;
}

function projectsInLane(laneRoot: string): DecisionOsProject[] {
  const masterRoot = resolve(laneRoot, '.decision-os');
  const registry = readProjectRegistry(masterRoot);
  // WHAT: Require one registered copied project.
  // WHY: Watcher and recovery evidence must run against manifest state rather than an unrelated fixture root.
  if (!registry) throw new Error('release_canary_runtime_registry_missing');
  const entries = Object.values(registry.projects).sort((left, right) => left.id.localeCompare(right.id));
  // WHAT: Reject a copied catalog with no project owner.
  // WHY: Project-scoped watcher and federation recovery require a stable durable identity.
  if (!entries[0]) throw new Error('release_canary_runtime_project_missing');
  return entries.map((entry) => projectFromRegisteredPath({ masterRoot: laneRoot, entry }));
}

function assertCompleteProjectCoverage(
  lanes: Record<'baseline' | 'candidate' | 'recovery', string>,
  expected: ReleaseCanaryManifest['projectStates'],
): Record<'baseline' | 'candidate' | 'recovery', Array<{ projectId: string; state: 'task-state' | 'no-task-state' }>> {
  const expectedProjects = expected.map(({ projectId, state }) => ({ projectId, state })).sort((left, right) => left.projectId.localeCompare(right.projectId));
  const evidence = Object.fromEntries(Object.entries(lanes).map(([lane, laneRoot]) => {
    const observed = projectsInLane(laneRoot).map((project) => ({
      projectId: project.id,
      // WHAT: Recompute lane classification from its copied format authority.
      // WHY: A manifest label alone cannot prove the runnable lane retained the same complete project state boundary.
      state: existsSync(resolve(project.decisionOsRoot, 'task-state', project.id, 'format.json'))
        ? 'task-state' as const
        : 'no-task-state' as const,
    })).sort((left, right) => left.projectId.localeCompare(right.projectId));
    // WHAT: Reject a runnable lane that omits, adds, or reclassifies any manifest project.
    // WHY: Recovery behavior on one selected fixture cannot substitute for complete registry-state accounting.
    if (JSON.stringify(observed) !== JSON.stringify(expectedProjects)) {
      throw new Error(`release_canary_runtime_project_coverage_invalid:${lane}`);
    }
    return [lane, observed];
  })) as Record<'baseline' | 'candidate' | 'recovery', Array<{ projectId: string; state: 'task-state' | 'no-task-state' }>>;
  return evidence;
}

function artifact(input: {
  runRoot: string;
  phase: RuntimeProofPhase;
  evidence: Record<string, unknown>;
}): { receiptFile: string; receiptId: string } {
  const document = { phase: input.phase, status: 'passed', evidence: input.evidence };
  const bytes = `${JSON.stringify(document, null, 2)}\n`;
  const receiptFile = resolve(input.runRoot, `${input.phase}-phase-receipt.json`);
  writeFileSync(receiptFile, bytes, { mode: 0o600 });
  return {
    receiptFile,
    receiptId: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
  };
}

async function proveWatcher(input: {
  baselineLane: string;
  candidateLane: string;
}): Promise<Record<string, unknown>> {
  const baselineProject = firstProject(input.baselineLane);
  const baselineMasterRoot = resolve(input.baselineLane, '.decision-os');
  const baselineLedger = createRuntimeIncidentLedger({ decisionOsRoot: baselineMasterRoot });
  const baselineSupervisor = createIncidentSupervisor({ incidentLedger: baselineLedger });
  const proofContentFile = '.decision-os/cards/tasks/release-canary-watcher-proof.md';
  const untouchedContentFile = '.decision-os/cards/tasks/release-canary-watcher-untouched.md';
  const baselineFile = resolve(baselineProject.decisionOsRoot, 'cards/tasks/release-canary-watcher-proof.md');
  const untouchedFile = resolve(baselineProject.decisionOsRoot, 'cards/tasks/release-canary-watcher-untouched.md');
  // WHAT: Reject collision with copied authored state.
  // WHY: Canary setup must not overwrite a real project resource.
  if (existsSync(baselineFile) || existsSync(untouchedFile)) throw new Error('release_canary_watcher_fixture_collision');
  mkdirSync(resolve(baselineFile, '..'), { recursive: true });
  writeFileSync(baselineFile, '# Release canary watcher proof\n', { mode: 0o600 });
  writeFileSync(untouchedFile, '# Release canary watcher untouched resource\n', { mode: 0o600 });
  let baselineAttempts = 0;
  let untouchedAttempts = 0;
  const baselineWatcher = watchCardContentFiles({
    decisionOsRoot: baselineProject.decisionOsRoot,
    taskProjection: () => ({
      cards: [
        { id: 'release-canary-watcher-proof', comment: { contentFile: proofContentFile } },
        { id: 'release-canary-watcher-untouched', comment: { contentFile: untouchedContentFile } },
      ],
      threadFiles: {},
    }),
    reconcileOnStart: (change) => change.file === baselineFile || change.file === untouchedFile,
    onChange: async (change) => {
      // WHAT: Count any attempt to process the second startup-owned resource.
      // WHY: Zero proves startup reconciliation stops after the first resource exhausts its retry.
      if (change.file === untouchedFile) {
        untouchedAttempts += 1;
        return;
      }
      baselineAttempts += 1;
      throw Object.assign(new Error('release_canary_injected_watcher_failure'), { code: 'EACCES' });
    },
    onError: (error, context) => {
      baselineSupervisor.recordIncident({
        scope: `project-watcher:${baselineProject.id}`,
        component: 'project-file-watcher',
        operation: context.operation,
        error,
        context: { projectId: baselineProject.id, file: context.file },
      });
      baselineSupervisor.pausedProjectWatchers.add(baselineProject.id);
    },
    auditIntervalMs: 60_000,
  });
  const baselineReady = await baselineWatcher.ready;
  await baselineWatcher.close();
  const baselineIncidents = baselineLedger.active(`project-watcher:${baselineProject.id}`);

  const candidateProject = firstProject(input.candidateLane);
  const candidateMasterRoot = resolve(input.candidateLane, '.decision-os');
  const candidateLedger = createRuntimeIncidentLedger({ decisionOsRoot: candidateMasterRoot });
  const missingContentFile = '.decision-os/threads/tasks/release-canary-missing-sidecar.md';
  const missingFile = resolve(candidateProject.decisionOsRoot, 'threads/tasks/release-canary-missing-sidecar.md');
  rmSync(missingFile, { force: true });
  const objectStore = createTaskContentObjectStore({
    decisionOsRoot: candidateProject.decisionOsRoot,
    projectId: candidateProject.id,
  });
  const objectRoot = resolve(candidateProject.decisionOsRoot, 'task-state', candidateProject.id, 'objects');
  const objectRootBefore = existsSync(objectRoot) ? statSync(objectRoot).mtimeMs : null;
  const capture = await objectStore.capture(missingContentFile);
  let candidatePublications = 0;
  const candidateWatcher = watchCardContentFiles({
    decisionOsRoot: candidateProject.decisionOsRoot,
    taskProjection: () => ({ cards: [], threadFiles: { 'release-canary-missing-sidecar': missingContentFile } }),
    reconcileOnStart: (change) => existsSync(change.file),
    onChange: () => { candidatePublications += 1; },
    onError: (error, context) => candidateLedger.record({
      scope: `project-watcher:${candidateProject.id}`,
      component: 'project-file-watcher',
      operation: context.operation,
      error,
      context: { projectId: candidateProject.id, file: context.file },
    }),
    auditIntervalMs: 60_000,
  });
  const candidateReady = await candidateWatcher.ready;
  await candidateWatcher.close();
  const candidateIncidents = candidateLedger.active(`project-watcher:${candidateProject.id}`);
  const objectRootAfter = existsSync(objectRoot) ? statSync(objectRoot).mtimeMs : null;

  // WHAT: Require bounded baseline failure and zero candidate work for an absent sidecar.
  // WHY: The fixed startup path must neither fan out incidents nor allocate empty object-store state.
  if (
    baselineReady !== false
    || baselineAttempts !== 2
    || untouchedAttempts !== 0
    || baselineIncidents.length !== 1
    || candidateReady !== true
    || candidatePublications !== 0
    || candidateIncidents.length !== 0
    || capture !== null
    || objectRootBefore !== objectRootAfter
  ) throw new Error('release_canary_watcher_recovery_proof_failed');

  return {
    baseline: {
      projectId: baselineProject.id,
      ready: baselineReady,
      publicationAttempts: baselineAttempts,
      untouchedResourceAttempts: untouchedAttempts,
      activeWatcherIncidentIds: baselineIncidents.map((incident) => incident.id),
    },
    candidate: {
      projectId: candidateProject.id,
      ready: candidateReady,
      publicationAttempts: candidatePublications,
      activeWatcherIncidentIds: candidateIncidents.map((incident) => incident.id),
      missingCaptureResult: capture,
      objectRootChanged: objectRootBefore !== objectRootAfter,
    },
  };
}

async function proveIncidents(recoveryLane: string): Promise<Record<string, unknown>> {
  const projects = projectsInLane(recoveryLane);
  const project = projects[0]!;
  const projectsById = new Map(projects.map((entry) => [entry.id, entry]));
  const masterRoot = resolve(recoveryLane, '.decision-os');
  const ledger = createRuntimeIncidentLedger({ decisionOsRoot: masterRoot });
  const copiedActiveScopes = [...new Set(ledger.snapshot().incidents
    .filter((incident) => incident.status === 'paused')
    .map((incident) => incident.scope))].sort();
  ledger.record({
    scope: `project-watcher:${project.id}`,
    component: 'project-file-watcher',
    operation: 'release-canary-copied-watcher-validation',
    error: new Error('release_canary_copied_watcher_pause'),
    context: { projectId: project.id },
  });
  ledger.record({
    scope: `federation-repair:${project.id}`,
    component: 'federation-task-state-replicator',
    operation: 'release-canary-copied-federation-validation',
    error: new Error('release_canary_copied_federation_pause'),
    context: { projectId: project.id },
  });
  const listenerIncident = ledger.record({
    scope: 'server-listener',
    component: 'http-server',
    operation: 'listen',
    error: Object.assign(new Error('release_canary_listener_prior_failure'), { code: 'EADDRINUSE' }),
    code: 'EADDRINUSE',
    severity: 'fatal',
    context: { host: '127.0.0.1', port: 0 },
  });
  ledger.record({
    scope: 'background:federated-library-sync',
    component: 'federated-library-sync',
    operation: 'release-canary-copied-library-validation',
    error: new Error('release_canary_copied_library_pause'),
    context: {},
  });
  const supervisor = createIncidentSupervisor({ incidentLedger: ledger });
  const watcherHydrated = supervisor.pausedProjectWatchers.has(project.id);
  const federationHydrated = supervisor.pausedFederationRepairs.has(project.id);
  const replacementOperations: string[] = [];
  const federationTransitions: string[] = [];
  let federatedLibrarySynchronizations = 0;
  const federationProofRoot = resolve(masterRoot, 'runtime/release-canary-federation-dispatch');
  mkdirSync(federationProofRoot, { recursive: true });
  const copiedProjectState = readFileSync(resolve(project.decisionOsRoot, 'state.json'));
  const observedRoot = createHash('sha256').update(copiedProjectState).digest('hex');
  const localRootFile = resolve(federationProofRoot, 'local-root');
  const relayRootFile = resolve(federationProofRoot, 'relay-root');
  writeFileSync(localRootFile, `${observedRoot}\n`, { mode: 0o600 });
  writeFileSync(relayRootFile, `${observedRoot}\n`, { mode: 0o600 });
  const rootsEqual = (): boolean => readFileSync(localRootFile, 'utf8').trim() === readFileSync(relayRootFile, 'utf8').trim();
  const projectRuntimeRegistry = {
    contexts: new Map(),
    dispose: () => undefined,
    tryContext: (ownedProject: DecisionOsProject, operation: string, _state: unknown, recoveryScope: string) => {
      replacementOperations.push(`${ownedProject.id}:${operation}:${recoveryScope}`);
      return { runtime: { projectId: ownedProject.id }, watcher: { close: async () => undefined }, clients: new Set() };
    },
  };
  const replicator = {
    validateProjectRepairResume: (projectId: string) => {
      federationTransitions.push(`validate:${projectId}`);
      return rootsEqual();
    },
    resumeProjectRepair: (projectId: string) => {
      federationTransitions.push(`resume:${projectId}`);
      return rootsEqual();
    },
    reconcileProject: () => undefined,
  };
  const recovery = createRuntimeRecoveryService({
    codexCoordinator: { schedule: () => undefined },
    contentObjectRoots: [],
    contentScheduler: () => null,
    federatedLibrary: {
      synchronize: async () => {
        const copiedRegistry = readProjectRegistry(masterRoot);
        // WHAT: Accept the background owner transition only after the copied catalog validates completely.
        // WHY: Resolving a timeout without reading its durable source would prove only incident mutation.
        if (!copiedRegistry || Object.keys(copiedRegistry.projects).length !== projects.length) {
          throw new Error('release_canary_copied_catalog_validation_failed');
        }
        federatedLibrarySynchronizations += 1;
      },
    },
    federation: {},
    federatedTaskRuntime: { executionStates: new Map(), projectStates: new Map(), taskStores: new Map() },
    incidentLedger: ledger,
    incidentSupervisor: supervisor,
    initializePipelineCatalog: () => undefined,
    invalidateProject: () => undefined,
    localNodeId: () => 'release-canary',
    localTaskRuntime: { states: new Map(), openStateForProject: () => { throw new Error('unexpected_local_task_recovery'); } },
    migrationAdmissionFile: resolve(masterRoot, 'runtime/release-canary-migration-admission.json'),
    migrateProjectPipelines: () => undefined,
    projectById: (projectId) => projectsById.get(projectId) ?? null,
    projectRuntimeRegistry,
    projectSyncRuntime: {},
    replicator: () => replicator,
  } as unknown as Parameters<typeof createRuntimeRecoveryService>[0]);

  const listenerRecoveryBeforeOwner = await recovery.resume('server-listener', 'Canary attempted generic listener recovery.');
  const watcherScopes = [...supervisor.pausedProjectWatchers].sort().map((projectId) => `project-watcher:${projectId}`);
  const watcherRecoveries = [];
  for (const scope of watcherScopes) {
    watcherRecoveries.push(await recovery.resume(
      scope,
      'Canary watcher state revalidated and replacement context installed.',
    ));
  }
  const federationScopes = [...supervisor.pausedFederationRepairs.keys()].sort().map((projectId) => `federation-repair:${projectId}`);
  const arbitraryFederationRecovery = await recovery.resume(
    federationScopes[0]!,
    'Arbitrary text must not authorize federation repair recovery.',
  );
  const federationRecoveries = [];
  for (const scope of federationScopes) {
    federationRecoveries.push(await recovery.resume(
      scope,
      'reconcile-local-authority',
    ));
  }
  const backgroundRecovery = await recovery.resume(
    'background:federated-library-sync',
    'Canary federated library synchronization completed through its owning dispatcher.',
  );
  const server = createNodeHttpListener({
    handleRequest: async (_request, response) => { response.end('ok'); },
    host: '127.0.0.1',
    port: 0,
    startupTasks: [],
    recordIncident: supervisor.recordIncident,
    recordStoppedOperation: supervisor.recordStoppedOperation,
    onClose: () => undefined,
    onListening: () => {
      ledger.resolveScope('server-listener', 'The canary listener owner bound successfully.');
    },
  });
  await once(server, 'listening');
  server.close();
  await once(server, 'close');
  const listenerActiveAfterOwner = ledger.active('server-listener');
  const watcherActiveAfter = ledger.active(`project-watcher:${project.id}`);
  const federationActiveAfter = federationScopes.flatMap((scope) => ledger.active(scope));
  const backgroundActiveAfter = ledger.active('background:federated-library-sync');
  const remainingActive = ledger.snapshot().incidents.filter((incident) => incident.status === 'paused');

  // WHAT: Require only owner-specific recovery paths to resolve each copied scope.
  // WHY: Generic incident mutation must not bypass watcher replacement, federation validation, or listener bind authority.
  if (
    !watcherHydrated
    || !federationHydrated
    || listenerRecoveryBeforeOwner.ok !== false
    || watcherRecoveries.length !== watcherScopes.length
    || watcherRecoveries.some((receipt) => receipt.ok !== true)
    || federationRecoveries.length !== federationScopes.length
    || federationRecoveries.some((receipt) => receipt.ok !== true)
    || arbitraryFederationRecovery.ok !== false
    || backgroundRecovery.ok !== true
    || federatedLibrarySynchronizations !== 1
    || replacementOperations.length !== watcherScopes.length
    || federationTransitions.length !== federationScopes.length * 2
    || watcherActiveAfter.length !== 0
    || federationActiveAfter.length !== 0
    || backgroundActiveAfter.length !== 0
    || listenerActiveAfterOwner.length !== 0
    || remainingActive.length !== 0
  ) throw new Error('release_canary_incident_recovery_proof_failed');

  return {
    projectId: project.id,
    copiedLedgerFile: ledger.file,
    copiedActiveScopes,
    hydratedScopes: {
      watcher: watcherHydrated,
      federationRepair: federationHydrated,
    },
    watcherRecoveries,
    watcherReplacementOperations: replacementOperations,
    federationRecoveries,
    arbitraryFederationRecovery,
    federationTransitions,
    federationDispatchPrecondition: {
      proofBoundary: 'recovery-service-dispatch-only',
      localRoot: readFileSync(localRootFile, 'utf8').trim(),
      relayRoot: readFileSync(relayRootFile, 'utf8').trim(),
      equal: rootsEqual(),
    },
    backgroundRecovery: {
      receipt: backgroundRecovery,
      synchronizationCount: federatedLibrarySynchronizations,
    },
    listener: {
      incidentId: listenerIncident.id,
      genericRecovery: listenerRecoveryBeforeOwner,
      activeAfterOwnerBind: listenerActiveAfterOwner.map((incident) => incident.id),
    },
    remainingActiveScopes: remainingActive.map((incident) => incident.scope),
  };
}

export async function proveReleaseCanaryRuntimeRecovery(input: {
  manifest: Pick<ReleaseCanaryManifest, 'runRoot' | 'lanes' | 'projectStates'>;
}): Promise<ReleaseCanaryRuntimeRecoveryProof> {
  const runRoot = resolve(input.manifest.runRoot);
  const baselineLane = resolve(input.manifest.lanes.baseline);
  const candidateLane = resolve(input.manifest.lanes.candidate);
  const recoveryLane = resolve(input.manifest.lanes.recovery);
  // WHAT: Require every runtime proof lane beneath the manifest-owned run root.
  // WHY: Recovery evidence must never attach watchers or listeners to live state.
  if (![baselineLane, candidateLane, recoveryLane].every((lane) => inside(runRoot, lane))) {
    throw new Error('release_canary_runtime_lane_invalid');
  }
  const projectCoverage = assertCompleteProjectCoverage({ baseline: baselineLane, candidate: candidateLane, recovery: recoveryLane }, input.manifest.projectStates);
  const watcherEvidence = await proveWatcher({ baselineLane, candidateLane });
  const incidentEvidence = await proveIncidents(recoveryLane);
  return {
    'watcher-recovery': artifact({ runRoot, phase: 'watcher-recovery', evidence: { projectCoverage, ...watcherEvidence } }),
    'incident-recovery': artifact({ runRoot, phase: 'incident-recovery', evidence: { projectCoverage, ...incidentEvidence } }),
  };
}
