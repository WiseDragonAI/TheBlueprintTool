/**
 * WHAT: Proves explicit recovery accepts a federated library that atomically synchronizes and resolves its incident.
 * WHY: Component-owned convergence must install synchronized state without being re-paused by generic recovery.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createFederatedLibraryRuntime } from '../../../../src/business/federation/runtime/federated-library-runtime.js';
import { exportFederatedSkillSnapshot } from '../../../../src/business/federation/helper/federated-library-cache.js';
import { createRuntimeIncidentLedger } from '../../../../src/business/server/helper/runtime-incident-ledger.js';
import { createIncidentSupervisor } from '../../../../src/business/server/runtime/incident-supervisor.js';
import { resumeBackgroundRuntime } from '../../../../src/business/server/runtime/resume-background-runtime.js';
import { traces } from '../../../../src/telemetry/harness.js';

test('federated library recovery remains resumed after synchronization resolves its incident', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-federated-library-resume-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'codex-pipelines.json'), JSON.stringify({
    version: 1,
    pipelines: [],
    steps: [],
    runs: [],
    skillLibrary: [],
    authoredContent: [],
    activeWorkspaceRun: null,
  }));
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  const incidentSupervisor = createIncidentSupervisor({ incidentLedger });
  const initial = incidentSupervisor.recordBackgroundFailure(
    'federated-library-sync',
    'synchronize-federated-libraries',
    new Error('fixture synchronization failed'),
  );
  const runtime: Record<string, unknown> = {};
  let requestCount = 0;
  const connector = {
    nodes: () => [{ nodeId: 'peer-a', nodeLabel: 'Peer A', online: true, projects: [] }],
    request: async (_nodeId: string, path: string) => {
      requestCount += 1;
      const payload = path.startsWith('/api/federation/skills-manifest')
        ? { version: 1, skills: [] }
        : { version: 1, pipelines: [] };
      return {
        status: 200,
        headers: {},
        body: Buffer.from(JSON.stringify(payload)),
        requestId: `fixture-request-${requestCount}`,
      };
    },
  };
  const federatedLibrary = createFederatedLibraryRuntime({
    federation: () => connector as never,
    clearPaused: (component) => incidentSupervisor.pausedBackgroundComponents.delete(component),
    incidentLedger,
    localDecisionOsRoots: () => [],
    localWorkspaceRoots: () => [],
    masterDecisionOsRoot: decisionOsRoot,
    masterRoot: workspace,
    paused: (component) => incidentSupervisor.pausedBackgroundComponents.has(component),
    recordBackgroundFailure: incidentSupervisor.recordBackgroundFailure,
    recordIncident: (input) => incidentLedger.record(input as never),
    runtime,
  });
  let genericResolutionCalled = false;

  try {
    const result = await resumeBackgroundRuntime({
      activeIncidentIds: (scope) => incidentLedger.active(scope).map((incident) => incident.id),
      codexCoordinator: {} as never,
      component: 'federated-library-sync',
      contentScheduler: () => null,
      federation: { recoverRetainedProjectCatalog: () => undefined } as never,
      federatedLibrary,
      incidentSupervisor,
      initializePipelineCatalog: () => undefined,
      migrateProjectPipelines: () => undefined,
      projectRuntimeRegistry: { contexts: new Map() } as never,
      projectSyncRuntime: {} as never,
      resolution: 'Federated library synchronization completed.',
      resolveScope: () => {
        genericResolutionCalled = true;
        return [];
      },
      scope: 'background:federated-library-sync',
    });

    assert.deepEqual(result, [initial.id]);
    assert.equal(requestCount, 2);
    assert.deepEqual(runtime.federatedLibrarySyncStatus, {
      phase: 'synchronized',
      synchronizedPeerCount: 1,
      observedAt: (runtime.federatedLibrarySyncStatus as { observedAt: string }).observedAt,
    });
    assert.equal(incidentSupervisor.pausedBackgroundComponents.has('federated-library-sync'), false);
    assert.equal(incidentLedger.active('background:federated-library-sync').length, 0);
    const settled = incidentLedger.snapshot().incidents.find((incident) => incident.id === initial.id);
    assert.equal(settled?.status, 'resolved');
    assert.match(String(settled?.context.resolution), /skills-then-pipelines synchronization succeeded/i);
    assert.equal(genericResolutionCalled, false);
    const recoveryTrace = [...traces].reverse().find((trace) => (
      trace.name === 'background-runtime-recovery-settled'
      && (trace.args as Record<string, unknown>).scope === 'background:federated-library-sync'
    ));
    assert.deepEqual(recoveryTrace?.args, {
      component: 'federated-library-sync',
      scope: 'background:federated-library-sync',
      candidateIncidentIds: [initial.id],
      resolvedIncidentIds: [initial.id],
      finalPaused: false,
      outcome: 'component-recovered',
    });
  } finally {
    federatedLibrary.stop();
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('retained federation catalog recovery validates before resolving its active background incident', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-federation-catalog-resume-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  const incidentSupervisor = createIncidentSupervisor({ incidentLedger });
  const initial = incidentSupervisor.recordBackgroundFailure(
    'federation-project-catalog',
    'read-retained-project-catalog',
    new Error('invalid_federation_project_catalog'),
  );
  let recoveryCalled = 0;
  try {
    const result = await resumeBackgroundRuntime({
      activeIncidentIds: (scope) => incidentLedger.active(scope).map((incident) => incident.id),
      codexCoordinator: {} as never,
      component: 'federation-project-catalog',
      contentScheduler: () => null,
      federation: { recoverRetainedProjectCatalog: () => { recoveryCalled += 1; } } as never,
      federatedLibrary: {} as never,
      incidentSupervisor,
      initializePipelineCatalog: () => undefined,
      migrateProjectPipelines: () => undefined,
      projectRuntimeRegistry: { contexts: new Map() } as never,
      projectSyncRuntime: {} as never,
      resolution: 'Retained federation catalog validated and persisted.',
      resolveScope: (scope, resolution) => incidentLedger.resolveScope(scope, resolution).map((incident) => incident.id),
      scope: 'background:federation-project-catalog',
    });
    assert.equal(recoveryCalled, 1);
    assert.deepEqual(result, [initial.id]);
    assert.equal(incidentSupervisor.pausedBackgroundComponents.has('federation-project-catalog'), false);
    assert.equal(incidentLedger.active('background:federation-project-catalog').length, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('peer receipt imports and acknowledges only the exact revision requested from its source node', async () => {
  const source = mkdtempSync(join(tmpdir(), 'decision-os-federated-receipt-source-'));
  const target = mkdtempSync(join(tmpdir(), 'decision-os-federated-receipt-target-'));
  const targetDecisionOsRoot = join(target, '.decision-os');
  const sourceSkillRoot = join(source, '.skills', 'receipt-source');
  mkdirSync(sourceSkillRoot, { recursive: true });
  mkdirSync(targetDecisionOsRoot, { recursive: true });
  writeFileSync(join(sourceSkillRoot, 'SKILL.md'), [
    '---', 'name: receipt-source', 'description: Receipt source package.', '---', '', '# Instructions', '', 'Import this revision.', '',
  ].join('\n'));
  execFileSync('git', ['init', '-q'], { cwd: source });
  execFileSync('git', ['add', '.skills/receipt-source/SKILL.md'], { cwd: source });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'Receipt source'], { cwd: source });
  const snapshot = await exportFederatedSkillSnapshot(source);
  const revision = snapshot.skills[0].revision;
  const connector = {
    nodes: () => [{ nodeId: 'source-node', nodeLabel: 'Source node', online: true, projects: [] }],
    request: async () => ({
      status: 200,
      headers: {},
      body: Buffer.from(JSON.stringify(snapshot)),
      requestId: 'source-snapshot',
    }),
  };
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: targetDecisionOsRoot });
  const federatedLibrary = createFederatedLibraryRuntime({
    federation: () => connector as never,
    clearPaused: () => undefined,
    incidentLedger,
    localDecisionOsRoots: () => [targetDecisionOsRoot],
    localWorkspaceRoots: () => [target],
    masterDecisionOsRoot: targetDecisionOsRoot,
    masterRoot: target,
    paused: () => false,
    recordBackgroundFailure: () => undefined,
    recordIncident: (input) => incidentLedger.record(input as never),
    runtime: {},
  });
  try {
    assert.equal((await federatedLibrary.receivePublishedSkill('source-node', 'receipt-source', '0'.repeat(64))).acknowledged, false);
    assert.deepEqual(await federatedLibrary.receivePublishedSkill('source-node', 'receipt-source', revision), {
      version: 1,
      name: 'receipt-source',
      revision,
      acknowledged: true,
    });
  } finally {
    federatedLibrary.stop();
    rmSync(source, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  }
});

test('authored skill publication deduplicates one exact-revision peer acknowledgement flight', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-federated-library-receipt-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const skillRoot = join(workspace, '.skills', 'receipt-proof');
  mkdirSync(skillRoot, { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(skillRoot, 'SKILL.md'), [
    '---',
    'name: receipt-proof',
    'description: Proves exact publication receipts.',
    '---',
    '',
    '# Instructions',
    '',
    'Prove the receipt.',
    '',
  ].join('\n'));
  writeFileSync(join(decisionOsRoot, 'codex-pipelines.json'), JSON.stringify({
    version: 1, pipelines: [], steps: [], runs: [], skillLibrary: [], authoredContent: [], activeWorkspaceRun: null,
  }));
  execFileSync('git', ['init', '-q'], { cwd: workspace });
  execFileSync('git', ['add', '.skills/receipt-proof/SKILL.md'], { cwd: workspace });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'Receipt proof'], { cwd: workspace });
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  incidentLedger.record({
    scope: 'federated-skill-publication:receipt-proof',
    component: 'federated-library-sync',
    operation: 'publish-authored-federated-skill',
    code: 'federated_skill_publication_failed',
    error: new Error('Earlier publication was not acknowledged.'),
  });
  let requestCount = 0;
  let releaseReceipt: (() => void) | null = null;
  const receiptGate = new Promise<void>((resolve) => { releaseReceipt = resolve; });
  const connector = {
    nodes: () => [{ nodeId: 'peer-a', nodeLabel: 'Peer A', online: true, projects: [] }],
    publishManifest: () => undefined,
    request: async (_nodeId: string, _path: string, options: { body?: Buffer }) => {
      requestCount += 1;
      await receiptGate;
      const payload = JSON.parse(String(options.body ?? '{}')) as { skillName: string; revision: string };
      return {
        status: 200,
        headers: {},
        body: Buffer.from(JSON.stringify({ version: 1, name: payload.skillName, revision: payload.revision, acknowledged: true })),
        requestId: 'receipt-request',
      };
    },
    status: () => ({ phase: 'connected' }),
  };
  const federatedLibrary = createFederatedLibraryRuntime({
    federation: () => connector as never,
    clearPaused: () => undefined,
    incidentLedger,
    localDecisionOsRoots: () => [decisionOsRoot],
    localWorkspaceRoots: () => [workspace],
    masterDecisionOsRoot: decisionOsRoot,
    masterRoot: workspace,
    paused: () => false,
    recordBackgroundFailure: () => undefined,
    recordIncident: (input) => incidentLedger.record(input as never),
    runtime: {},
  });
  try {
    federatedLibrary.publishAuthoredSkill('receipt-proof', 'retry');
    federatedLibrary.publishAuthoredSkill('receipt-proof', 'retry');
    for (let attempt = 0; attempt < 100 && requestCount === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(requestCount, 1);
    releaseReceipt?.();
    for (let attempt = 0; attempt < 100 && incidentLedger.active('federated-skill-publication:receipt-proof').length > 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(requestCount, 1);
    assert.equal(incidentLedger.active('federated-skill-publication:receipt-proof').length, 0);
    federatedLibrary.publishAuthoredSkill('receipt-proof', 'retry');
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(requestCount, 1);
  } finally {
    federatedLibrary.stop();
    rmSync(workspace, { recursive: true, force: true });
  }
});
