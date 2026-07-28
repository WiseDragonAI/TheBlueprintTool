/**
 * WHAT: Verifies exact-SHA delivery admission and every pre-mutation runtime rejection boundary.
 * WHY: Missing, stale, mismatched, busy, paused, queued, and unconverged evidence must fail closed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  admitDecisionOsDelivery,
  collectFixedAdmissionSurfaceEvidence,
  DeliveryAdmissionError,
  deliveryAdmissionProofNames,
  fixedDeliveryAdmissionEndpoints,
  type DeliveryAdmissionProof,
  type DeliveryNodeAdmissionEvidence,
  type DeliveryRelayConfigurationEvidence,
  type DeliveryRelayHealth,
  type DeliveryReleaseHealth,
} from '../../src/business/delivery/controller/delivery-admission-controller.js';
import {
  freezeDeliveryTopology,
} from '../../src/business/delivery/controller/delivery-topology-controller.js';
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../src/business/task-state/helper/task-current-state-types.js';
import { admittedSha, deliveryRun, priorSha } from './delivery-test-fixtures.js';

const now = new Date('2026-07-28T00:01:00.000Z');
const observedAt = '2026-07-28T00:00:30.000Z';
const workstationOrigin = '1'.repeat(64);
const phoneOrigin = '2'.repeat(64);

function releaseHealth(releaseSha: string): DeliveryReleaseHealth {
  return {
    ok: true,
    status: 'ready',
    observedAt,
    releaseSha,
    processStartedAt: '2026-07-28T00:00:00.000Z',
    deliveryProtocol: 1,
    activeReleasePointer: `current:${releaseSha}`,
    activeIncidentCount: 0,
  };
}

function relayConfiguration(): DeliveryRelayConfigurationEvidence {
  return {
    observedAt,
    configurationHash: 'c'.repeat(64),
    wranglerVersion: '4.111.0',
    productionWorkerName: 'decision-os-federation-relay',
    devWorkerName: 'decision-os-federation-relay-dev',
    productionDurableObjectNamespace: 'decision-os-federations-production',
    devDurableObjectNamespace: 'decision-os-federations-dev',
  };
}

function relayHealth(): DeliveryRelayHealth {
  return {
    ok: true,
    status: 'ready',
    service: 'decision-os-federation-relay',
    observedAt,
    releaseSha: admittedSha,
    deliveryProtocol: 1,
    protocolVersion: 1,
    stateProtocol: taskStateProtocol,
    stateSchema: taskCurrentStateVersion,
    baselineEpoch: taskCurrentBaselineEpoch,
    environment: 'dev',
    workerName: 'decision-os-federation-relay-dev',
    durableObjectNamespace: 'decision-os-federations-dev',
  };
}

function frozenTopology() {
  return freezeDeliveryTopology({
    capturedAt: observedAt,
    nodes: [
      {
        nodeId: 'phone',
        nodeLabel: 'Phone',
        online: true,
        projects: [{ projectId: 'mobile', originFingerprint: phoneOrigin }],
      },
      {
        nodeId: 'verifier',
        nodeLabel: 'Verifier',
        online: false,
        projects: [],
      },
      {
        nodeId: 'workstation',
        nodeLabel: 'Workstation',
        online: true,
        projects: [{ projectId: 'decision-os', originFingerprint: workstationOrigin }],
      },
    ],
  });
}

function nodeEvidence(nodeId: string, projectIds: string[]): DeliveryNodeAdmissionEvidence {
  return {
    nodeId,
    observedAt,
    projectIds,
    release: releaseHealth(priorSha),
    federationPhase: 'connected',
    activeExecutionCount: 0,
    pendingExecutionCount: 0,
    pendingProcessQueueDepth: 0,
    pausedScopeCount: 0,
    fatalIncidentCount: 0,
    stateRuntimeDirtyCount: 0,
    statePendingDeliveryCount: 0,
    contentQueueDepth: 0,
    unavailableContentResourceCount: 0,
    convergedProjectIds: projectIds,
  };
}

function proofs(): DeliveryAdmissionProof[] {
  return deliveryAdmissionProofNames.map((proof) => ({
    proof,
    status: 'passed',
    releaseSha: admittedSha,
    observedAt,
    receiptId: `receipt-${proof}`,
  }));
}

function admissionInput() {
  const topology = frozenTopology();
  return {
    run: deliveryRun({ phase: 'preflight' }),
    observedTopology: topology,
    frozenTopology: topology,
    candidate: {
      observedAt,
      releaseSha: admittedSha,
      originDevSha: admittedSha,
      originMainSha: priorSha,
      clean: true,
      mainIsAncestor: true,
    },
    productionHealth: releaseHealth(priorSha),
    canaryHealth: releaseHealth(admittedSha),
    devRelayHealth: relayHealth(),
    relayConfiguration: relayConfiguration(),
    nodeEvidence: [
      nodeEvidence('phone', ['mobile']),
      nodeEvidence('workstation', ['decision-os']),
    ],
    proofs: proofs(),
    persist: async (run: ReturnType<typeof deliveryRun>) => run,
    now: () => now,
  };
}

test('writes one exact-SHA admission receipt only after every frozen authority agrees', async () => {
  let writes = 0;
  const input = admissionInput();
  const admitted = await admitDecisionOsDelivery({
    ...input,
    persist: async (run) => {
      writes += 1;
      return run;
    },
  });
  assert.equal(writes, 1);
  assert.equal(admitted.phase, 'admission');
  assert.deepEqual(admitted.topology.admittedNodeIds, ['phone', 'workstation']);
  assert.deepEqual(admitted.topology.zeroProjectNodeIds, ['verifier']);
  assert.equal(admitted.nodes.every((node) => node.state === 'admitted' && node.priorReleaseSha === priorSha), true);
  assert.deepEqual(admitted.phaseReceipts.at(-1), {
    receiptId: admitted.phaseReceipts.at(-1)?.receiptId,
    phase: 'admission',
    operation: 'admit-exact-release',
    status: 'succeeded',
    nodeId: 'coordinator',
    commitSha: admittedSha,
    startedAt: now.toISOString(),
    completedAt: now.toISOString(),
    command: null,
    evidence: admitted.phaseReceipts.at(-1)?.evidence,
  });
});

test('rejects every stale, mismatched, busy, paused, queued, dirty, pending, unavailable, and unconverged boundary before persistence', async (context) => {
  const cases: Array<{
    name: string;
    code: string;
    mutate: (input: ReturnType<typeof admissionInput>) => void;
  }> = [
    { name: 'dirty candidate', code: 'delivery_candidate_dirty', mutate: (input) => { input.candidate.clean = false; } },
    { name: 'changed origin/dev', code: 'delivery_candidate_sha_mismatch', mutate: (input) => { input.candidate.originDevSha = 'd'.repeat(40); } },
    { name: 'stale evidence', code: 'delivery_admission_evidence_stale', mutate: (input) => { input.candidate.observedAt = '2026-07-27T00:00:00.000Z'; } },
    { name: 'production release mismatch', code: 'delivery_release_sha_mismatch', mutate: (input) => { input.productionHealth.releaseSha = admittedSha; } },
    { name: 'canary release mismatch', code: 'delivery_release_sha_mismatch', mutate: (input) => { input.canaryHealth.releaseSha = priorSha; } },
    { name: 'reused relay state', code: 'delivery_relay_identity_reused', mutate: (input) => { input.relayConfiguration.devDurableObjectNamespace = input.relayConfiguration.productionDurableObjectNamespace; } },
    { name: 'relay release mismatch', code: 'delivery_relay_release_mismatch', mutate: (input) => { input.devRelayHealth.releaseSha = priorSha; } },
    { name: 'missing proof', code: 'delivery_canary_proof_missing', mutate: (input) => { input.proofs.pop(); } },
    { name: 'active execution', code: 'delivery_active_execution', mutate: (input) => { input.nodeEvidence[0].activeExecutionCount = 1; } },
    { name: 'pending execution', code: 'delivery_active_execution', mutate: (input) => { input.nodeEvidence[0].pendingExecutionCount = 1; } },
    { name: 'pending process queue', code: 'delivery_process_queue_pending', mutate: (input) => { input.nodeEvidence[0].pendingProcessQueueDepth = 1; } },
    { name: 'paused scope', code: 'delivery_paused_or_fatal_scope', mutate: (input) => { input.nodeEvidence[0].pausedScopeCount = 1; } },
    { name: 'fatal scope', code: 'delivery_paused_or_fatal_scope', mutate: (input) => { input.nodeEvidence[0].fatalIncidentCount = 1; } },
    { name: 'runtime dirty', code: 'delivery_state_runtime_dirty', mutate: (input) => { input.nodeEvidence[0].stateRuntimeDirtyCount = 1; } },
    { name: 'state delivery pending', code: 'delivery_state_delivery_pending', mutate: (input) => { input.nodeEvidence[0].statePendingDeliveryCount = 1; } },
    { name: 'content queue', code: 'delivery_content_not_available', mutate: (input) => { input.nodeEvidence[0].contentQueueDepth = 1; } },
    { name: 'content unavailable', code: 'delivery_content_not_available', mutate: (input) => { input.nodeEvidence[0].unavailableContentResourceCount = 1; } },
    { name: 'federation disconnected', code: 'delivery_federation_not_connected', mutate: (input) => { input.nodeEvidence[0].federationPhase = 'retrying'; } },
    { name: 'federation unconverged', code: 'delivery_federation_not_converged', mutate: (input) => { input.nodeEvidence[0].convergedProjectIds = []; } },
    { name: 'topology project mismatch', code: 'delivery_topology_changed', mutate: (input) => { input.nodeEvidence[0].projectIds = ['other']; } },
  ];
  for (const entry of cases) {
    await context.test(entry.name, async () => {
      const input = admissionInput();
      let writes = 0;
      entry.mutate(input);
      await assert.rejects(admitDecisionOsDelivery({
        ...input,
        persist: async (run) => {
          writes += 1;
          return run;
        },
      }), (error: unknown) => error instanceof DeliveryAdmissionError && error.code === entry.code);
      assert.equal(writes, 0);
    });
  }
});

test('collects only the fixed production, canary, and dev relay endpoints with cancellation', async () => {
  const endpoints: string[] = [];
  const evidence = await collectFixedAdmissionSurfaceEvidence({
    readJson: async (endpoint, signal) => {
      assert.equal(signal.aborted, false);
      endpoints.push(endpoint);
      return { endpoint };
    },
  });
  assert.deepEqual(endpoints.sort(), Object.values(fixedDeliveryAdmissionEndpoints).sort());
  assert.deepEqual(evidence.productionHealth, { endpoint: fixedDeliveryAdmissionEndpoints.productionHealth });

  const abort = new AbortController();
  abort.abort(new Error('operator_cancelled'));
  await assert.rejects(
    collectFixedAdmissionSurfaceEvidence({
      signal: abort.signal,
      readJson: async (_endpoint, signal) => {
        throw signal.reason;
      },
    }),
    (error: unknown) => error instanceof DeliveryAdmissionError && error.code === 'delivery_admission_cancelled',
  );
  await assert.rejects(
    collectFixedAdmissionSurfaceEvidence({
      deadlineMs: 100,
      readJson: async () => await new Promise<never>(() => undefined),
    }),
    (error: unknown) => error instanceof DeliveryAdmissionError && error.code === 'delivery_admission_evidence_timeout',
  );
});
