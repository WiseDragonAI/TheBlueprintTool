/**
 * WHAT: Proves delivery admission exposes complete diagnostics while blocking only delivery-owned failures.
 * WHY: Contained project incidents must remain visible without turning deployment into global recovery authority.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeliveryAdmissionState, buildDeliveryStatusEvidence } from '../../src/business/delivery/runtime/delivery-admission-state.js';
import { createRuntimeIncidentLedger } from '../../src/business/server/helper/runtime-incident-ledger.js';

test('retains contained incident counts in ready admission state and status receipts', (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-delivery-admission-state-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  incidentLedger.record({
    scope: 'project-watcher:project-a',
    component: 'project-file-watcher',
    operation: 'publish-card-content-change',
    error: new Error('contained watcher failure'),
  });
  const input = {
    contentStatus: () => ({ queueDepth: 0, resources: [] }),
    executionStates: [],
    federationPhase: 'connected',
    incidentLedger,
    localNodeId: 'workstation',
    projectIds: ['project-a'],
    replicationStatus: () => ({
      convergence: [{ peerId: 'relay', projectId: 'project-a', converged: true }],
      pendingDeliveryIds: [],
      runtimeDirty: [],
    }),
    releaseSettings: {},
    schedulerContexts: [],
  };

  const state = buildDeliveryAdmissionState(input);
  const evidence = buildDeliveryStatusEvidence(input);

  assert.equal(state.release.status, 'ready');
  assert.equal(state.release.activeIncidentCount, 1);
  assert.equal(state.pausedScopeCount, 0);
  assert.equal(state.diagnosticPausedScopeCount, 1);
  assert.equal(evidence.find((entry) => entry.key === 'activeIncidentCount')?.value, 1);
  assert.equal(evidence.find((entry) => entry.key === 'diagnosticPausedScopeCount')?.value, 1);
});

test('keeps delivery-owned failures blocking while retaining the complete diagnostic count', (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-delivery-blocking-state-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  incidentLedger.record({
    scope: 'project-watcher:project-a',
    component: 'project-file-watcher',
    operation: 'publish-card-content-change',
    error: new Error('contained watcher failure'),
  });
  incidentLedger.record({
    scope: 'delivery:production',
    component: 'delivery-runtime',
    operation: 'activate-release',
    error: new Error('delivery failure'),
  });

  const state = buildDeliveryAdmissionState({
    contentStatus: () => ({ queueDepth: 0, resources: [] }),
    executionStates: [],
    federationPhase: 'connected',
    incidentLedger,
    localNodeId: 'workstation',
    projectIds: [],
    replicationStatus: () => ({ convergence: [], pendingDeliveryIds: [], runtimeDirty: [] }),
    releaseSettings: {},
    schedulerContexts: [],
  });

  assert.equal(state.release.status, 'degraded');
  assert.equal(state.release.activeIncidentCount, 2);
  assert.equal(state.pausedScopeCount, 1);
  assert.equal(state.diagnosticPausedScopeCount, 2);
});
