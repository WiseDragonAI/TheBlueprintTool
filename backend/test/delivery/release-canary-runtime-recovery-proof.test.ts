/**
 * WHAT: Verifies watcher and incident-recovery canary artifacts against manifest-owned copied lanes.
 * WHY: Runtime recovery proof must derive success from actual owner transitions and retained incident state.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { proveReleaseCanaryRuntimeRecovery } from '../../src/business/delivery/helper/release-canary-runtime-recovery-proof.js';
import { createRuntimeIncidentLedger } from '../../src/business/server/helper/runtime-incident-ledger.js';

function lane(root: string, name: string): string {
  const laneRoot = resolve(root, 'lanes', name);
  const masterRoot = resolve(laneRoot, '.decision-os');
  const projectRoot = resolve(laneRoot, 'project');
  const decisionOsRoot = resolve(projectRoot, '.decision-os');
  const ardariaRoot = resolve(laneRoot, 'ardaria', '.decision-os');
  mkdirSync(resolve(decisionOsRoot, 'cards/tasks'), { recursive: true });
  mkdirSync(resolve(decisionOsRoot, 'threads/tasks'), { recursive: true });
  writeFileSync(resolve(decisionOsRoot, 'project.json'), `${JSON.stringify({ id: 'project-a' })}\n`);
  writeFileSync(resolve(decisionOsRoot, 'state.json'), `${JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  })}\n`);
  writeFileSync(resolve(decisionOsRoot, 'tasks.json'), `${JSON.stringify({ cards: [], threadFiles: {} })}\n`);
  mkdirSync(resolve(ardariaRoot, 'cards/tasks'), { recursive: true });
  mkdirSync(resolve(ardariaRoot, 'threads/tasks'), { recursive: true });
  writeFileSync(resolve(ardariaRoot, 'project.json'), `${JSON.stringify({ id: 'ardaria' })}\n`);
  writeFileSync(resolve(ardariaRoot, 'state.json'), `${JSON.stringify({
    ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
  })}\n`);
  writeFileSync(resolve(ardariaRoot, 'tasks.json'), `${JSON.stringify({ cards: [], threadFiles: {} })}\n`);
  mkdirSync(masterRoot, { recursive: true });
  writeFileSync(resolve(masterRoot, 'projects.json'), `${JSON.stringify({
    version: 2,
    projects: {
      ardaria: {
        id: 'ardaria',
        relativePath: 'ardaria',
        name: 'Ardaria',
        description: '',
        color: '#111111',
        registeredAt: '2026-08-07T00:00:00.000Z',
        cardId: 'ardaria',
      },
      'project-a': {
        id: 'project-a',
        relativePath: 'project',
        name: 'Project A',
        description: '',
        color: '#38d9e8',
        registeredAt: '2026-08-07T00:00:00.000Z',
        cardId: 'project-a',
      },
    },
  })}\n`);
  return laneRoot;
}

test('release canary observes bounded watcher behavior and owner-specific incident recovery', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-release-canary-runtime-recovery-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const baseline = lane(root, 'baseline');
  const candidate = lane(root, 'candidate');
  const recovery = lane(root, 'recovery');
  const copiedLedger = createRuntimeIncidentLedger({ decisionOsRoot: resolve(recovery, '.decision-os') });
  const copiedIncident = copiedLedger.record({
    scope: 'background:copied-proof-history',
    component: 'release-canary-test',
    operation: 'retain-copied-history',
    error: new Error('retained copied incident'),
  });
  copiedLedger.resolveScope('background:copied-proof-history', 'Copied historical evidence was already resolved before the canary snapshot.');
  copiedLedger.record({
    scope: 'federation-repair:project-a',
    component: 'federation-task-state-replicator',
    operation: 'retain-copied-project-repair',
    error: new Error('retained copied federation repair'),
    context: { projectId: 'project-a' },
  });

  const proof = await proveReleaseCanaryRuntimeRecovery({
    manifest: {
      runRoot: root,
      lanes: { baseline, candidate, recovery },
      projectStates: [
        { projectId: 'ardaria', relativePath: 'ardaria', state: 'no-task-state' },
        { projectId: 'project-a', relativePath: 'project', state: 'no-task-state' },
      ],
    },
  });
  assert.deepEqual(Object.keys(proof).sort(), ['incident-recovery', 'watcher-recovery']);
  for (const phase of ['watcher-recovery', 'incident-recovery'] as const) {
    const bytes = readFileSync(proof[phase].receiptFile);
    assert.equal(proof[phase].receiptId, `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    const document = JSON.parse(bytes.toString('utf8')) as { phase: string; status: string; evidence: Record<string, unknown> };
    assert.equal(document.phase, phase);
    assert.equal(document.status, 'passed');
  }

  const watcher = JSON.parse(readFileSync(proof['watcher-recovery'].receiptFile, 'utf8')) as {
    evidence: {
      baseline: { ready: boolean; publicationAttempts: number; untouchedResourceAttempts: number; activeWatcherIncidentIds: string[] };
      candidate: { ready: boolean; publicationAttempts: number; activeWatcherIncidentIds: string[]; missingCaptureResult: unknown; objectRootChanged: boolean };
    };
  };
  assert.equal(watcher.evidence.baseline.ready, false);
  assert.equal(watcher.evidence.baseline.publicationAttempts, 2);
  assert.equal(watcher.evidence.baseline.untouchedResourceAttempts, 0);
  assert.equal(watcher.evidence.baseline.activeWatcherIncidentIds.length, 1);
  assert.equal(watcher.evidence.candidate.ready, true);
  assert.equal(watcher.evidence.candidate.publicationAttempts, 0);
  assert.deepEqual(watcher.evidence.candidate.activeWatcherIncidentIds, []);
  assert.equal(watcher.evidence.candidate.missingCaptureResult, null);
  assert.equal(watcher.evidence.candidate.objectRootChanged, false);

  const incidents = JSON.parse(readFileSync(proof['incident-recovery'].receiptFile, 'utf8')) as {
    evidence: {
      hydratedScopes: { watcher: boolean; federationRepair: boolean };
      watcherRecoveries: Array<{ ok: boolean; resolvedIncidentIds: string[] }>;
      federationRecoveries: Array<{ ok: boolean; resolvedIncidentIds: string[] }>;
      federationTransitions: string[];
      federationDispatchPrecondition: { proofBoundary: string; localRoot: string; relayRoot: string; equal: boolean };
      backgroundRecovery: { receipt: { ok: boolean }; synchronizationCount: number };
      listener: { genericRecovery: { ok: boolean }; activeAfterOwnerBind: string[] };
      remainingActiveScopes: string[];
    };
  };
  assert.deepEqual(incidents.evidence.hydratedScopes, { watcher: true, federationRepair: true });
  assert.equal(incidents.evidence.watcherRecoveries.length, 1);
  assert.equal(incidents.evidence.watcherRecoveries[0]?.ok, true);
  assert.equal(incidents.evidence.federationRecoveries.length, 2);
  assert.equal(incidents.evidence.federationRecoveries.every((receipt) => receipt.ok), true);
  assert.deepEqual(incidents.evidence.federationTransitions, ['validate:ardaria', 'resume:ardaria', 'validate:project-a', 'resume:project-a']);
  assert.equal(incidents.evidence.federationDispatchPrecondition.proofBoundary, 'recovery-service-dispatch-only');
  assert.equal(incidents.evidence.federationDispatchPrecondition.equal, true);
  assert.equal(incidents.evidence.federationDispatchPrecondition.localRoot, incidents.evidence.federationDispatchPrecondition.relayRoot);
  assert.equal(incidents.evidence.backgroundRecovery.receipt.ok, true);
  assert.equal(incidents.evidence.backgroundRecovery.synchronizationCount, 1);
  assert.equal(incidents.evidence.listener.genericRecovery.ok, false);
  assert.deepEqual(incidents.evidence.listener.activeAfterOwnerBind, []);
  assert.deepEqual(incidents.evidence.remainingActiveScopes, []);
  assert.equal(copiedLedger.snapshot().incidents.some((incident) => incident.id === copiedIncident.id), true);
});

test('release canary rejects a copied active scope with no verified owner recovery', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-release-canary-unknown-incident-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const baseline = lane(root, 'baseline');
  const candidate = lane(root, 'candidate');
  const recovery = lane(root, 'recovery');
  createRuntimeIncidentLedger({ decisionOsRoot: resolve(recovery, '.decision-os') }).record({
    scope: 'background:unsupported-canary-owner',
    component: 'release-canary-test',
    operation: 'retain-unsupported-active-scope',
    error: new Error('unsupported active scope'),
  });
  await assert.rejects(
    proveReleaseCanaryRuntimeRecovery({
      manifest: {
        runRoot: root,
        lanes: { baseline, candidate, recovery },
        projectStates: [
          { projectId: 'ardaria', relativePath: 'ardaria', state: 'no-task-state' },
          { projectId: 'project-a', relativePath: 'project', state: 'no-task-state' },
        ],
      },
    }),
    /release_canary_incident_recovery_proof_failed/,
  );
});

test('release canary rejects any runnable lane that omits a manifest registry project', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-release-canary-project-omission-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const baseline = lane(root, 'baseline');
  const candidate = lane(root, 'candidate');
  const recovery = lane(root, 'recovery');
  const candidateRegistryFile = resolve(candidate, '.decision-os', 'projects.json');
  const candidateRegistry = JSON.parse(readFileSync(candidateRegistryFile, 'utf8')) as { version: 2; projects: Record<string, unknown> };
  delete candidateRegistry.projects.ardaria;
  writeFileSync(candidateRegistryFile, `${JSON.stringify(candidateRegistry)}\n`);
  await assert.rejects(
    proveReleaseCanaryRuntimeRecovery({
      manifest: {
        runRoot: root,
        lanes: { baseline, candidate, recovery },
        projectStates: [
          { projectId: 'ardaria', relativePath: 'ardaria', state: 'no-task-state' },
          { projectId: 'project-a', relativePath: 'project', state: 'no-task-state' },
        ],
      },
    }),
    /release_canary_runtime_project_coverage_invalid:candidate/,
  );
});
