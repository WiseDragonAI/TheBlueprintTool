/**
 * WHAT: Admits one exact delivery SHA from fresh canary, topology, node, relay, and convergence evidence.
 * WHY: No production mutation may begin until every release and runtime authority agrees in one durable receipt.
 */
import { createHash } from 'node:crypto';
import {
  decisionOsDeliveryProtocol,
  type DeliveryPhaseReceipt,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../task-state/helper/task-current-state-types.js';
import {
  assertDeliveryTopologyUnchanged,
  type FrozenDeliveryTopology,
} from './delivery-topology-controller.js';
import { runDeliveryOperationBoundary } from '../helper/run-delivery-operation-boundary.js';

export const fixedDeliveryAdmissionEndpoints = Object.freeze({
  productionHealth: 'http://127.0.0.1:50150/api/health',
  canaryHealth: 'http://127.0.0.1:50151/api/health',
  devRelayHealth: 'http://127.0.0.1:50152/health',
});

export const deliveryAdmissionProofNames = [
  'authoring',
  'editor',
  'direct-path',
  'prompt-execution',
  'federation',
] as const;

export type DeliveryAdmissionProofName = typeof deliveryAdmissionProofNames[number];

export type DeliveryCandidateEvidence = {
  observedAt: string;
  releaseSha: string;
  originDevSha: string;
  originMainSha: string;
  clean: boolean;
  mainIsAncestor: boolean;
};

export type DeliveryReleaseHealth = {
  ok: boolean;
  status: string;
  observedAt: string;
  releaseSha: string;
  processStartedAt: string;
  deliveryProtocol: number;
  activeReleasePointer: string;
  activeIncidentCount: number;
};

export type DeliveryRelayHealth = {
  ok: boolean;
  status: string;
  service: string;
  observedAt: string;
  releaseSha: string;
  deliveryProtocol: number;
  protocolVersion: number;
  stateProtocol: string;
  stateSchema: number;
  baselineEpoch: number;
  environment: string;
  workerName: string;
  durableObjectNamespace: string;
};

export type DeliveryRelayConfigurationEvidence = {
  observedAt: string;
  configurationHash: string;
  wranglerVersion: string;
  productionWorkerName: string;
  devWorkerName: string;
  productionDurableObjectNamespace: string;
  devDurableObjectNamespace: string;
};

export type DeliveryNodeAdmissionEvidence = {
  nodeId: string;
  observedAt: string;
  projectIds: string[];
  release: DeliveryReleaseHealth;
  federationPhase: string;
  activeExecutionCount: number;
  pendingExecutionCount: number;
  pendingProcessQueueDepth: number;
  pausedScopeCount: number;
  fatalIncidentCount: number;
  stateRuntimeDirtyCount: number;
  statePendingDeliveryCount: number;
  contentQueueDepth: number;
  unavailableContentResourceCount: number;
  convergedProjectIds: string[];
};

export type DeliveryAdmissionProof = {
  proof: DeliveryAdmissionProofName;
  status: 'passed';
  releaseSha: string;
  observedAt: string;
  receiptId: string;
};

export type FixedAdmissionSurfaceEvidence = {
  productionHealth: unknown;
  canaryHealth: unknown;
  devRelayHealth: unknown;
};

export class DeliveryAdmissionError extends Error {
  readonly exitCode = 2;

  constructor(
    readonly code: string,
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DeliveryAdmissionError';
  }
}

function sha(value: unknown, field: string): string {
  const candidate = String(value ?? '');
  if (!/^[a-f0-9]{40}$/.test(candidate)) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_invalid', `${field} is not a lowercase 40-character Git SHA.`, { field });
  }
  return candidate;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_invalid', `${field} must be a non-negative integer.`, { field });
  }
  return Number(value);
}

function freshTimestamp(value: unknown, field: string, now: Date, maximumAgeMs: number): string {
  const timestamp = String(value ?? '');
  const observed = Date.parse(timestamp);
  if (!Number.isFinite(observed)) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', `${field} is missing a valid observedAt timestamp.`, { field });
  }
  if (observed > now.getTime() + 5_000 || now.getTime() - observed > maximumAgeMs) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_stale', `${field} is outside the admission freshness window.`, {
      field,
      observedAt: timestamp,
      admissionAt: now.toISOString(),
      maximumAgeMs,
    });
  }
  return new Date(observed).toISOString();
}

function exactStringSet(valuesInput: unknown, field: string): string[] {
  if (!Array.isArray(valuesInput)) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', `${field} must be an array.`, { field });
  }
  const values = valuesInput.map((value) => String(value ?? '').trim()).sort();
  if (values.some((value) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(value)) || new Set(values).size !== values.length) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_invalid', `${field} contains an invalid or duplicate identity.`, { field });
  }
  return values;
}

function assertReleaseHealth(input: {
  evidence: DeliveryReleaseHealth;
  field: string;
  expectedSha: string;
  now: Date;
  maximumAgeMs: number;
}): void {
  const evidence = input.evidence;
  if (!evidence || typeof evidence !== 'object') {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', `${input.field} is missing.`, { field: input.field });
  }
  freshTimestamp(evidence.observedAt, input.field, input.now, input.maximumAgeMs);
  if (evidence.ok !== true || evidence.status !== 'ready') {
    throw new DeliveryAdmissionError('delivery_release_health_not_ready', `${input.field} is not ready.`, { field: input.field });
  }
  if (sha(evidence.releaseSha, `${input.field}.releaseSha`) !== input.expectedSha) {
    throw new DeliveryAdmissionError('delivery_release_sha_mismatch', `${input.field} reports the wrong release SHA.`, {
      field: input.field,
      expectedSha: input.expectedSha,
      observedSha: evidence.releaseSha,
    });
  }
  if (
    evidence.deliveryProtocol !== decisionOsDeliveryProtocol
    || evidence.activeReleasePointer !== `current:${input.expectedSha}`
    || !Number.isFinite(Date.parse(evidence.processStartedAt))
  ) {
    throw new DeliveryAdmissionError('delivery_release_identity_mismatch', `${input.field} does not expose the required protocol-1 process identity.`, {
      field: input.field,
    });
  }
  if (nonNegativeInteger(evidence.activeIncidentCount, `${input.field}.activeIncidentCount`) !== 0) {
    throw new DeliveryAdmissionError('delivery_paused_or_fatal_scope', `${input.field} reports an active incident.`, { field: input.field });
  }
}

function assertRelayHealth(input: {
  evidence: DeliveryRelayHealth;
  configuration: DeliveryRelayConfigurationEvidence;
  expectedSha: string;
  now: Date;
  maximumAgeMs: number;
}): void {
  const health = input.evidence;
  if (!health || typeof health !== 'object') {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', 'Dev relay health evidence is missing.', { field: 'devRelayHealth' });
  }
  freshTimestamp(health.observedAt, 'devRelayHealth', input.now, input.maximumAgeMs);
  if (
    health.ok !== true
    || health.status !== 'ready'
    || health.service !== 'decision-os-federation-relay'
    || sha(health.releaseSha, 'devRelayHealth.releaseSha') !== input.expectedSha
  ) {
    throw new DeliveryAdmissionError('delivery_relay_release_mismatch', 'The dev relay does not report the admitted release.', {
      expectedSha: input.expectedSha,
      observedSha: health.releaseSha,
    });
  }
  if (
    health.deliveryProtocol !== decisionOsDeliveryProtocol
    || health.protocolVersion !== 1
    || health.stateProtocol !== taskStateProtocol
    || health.stateSchema !== taskCurrentStateVersion
    || health.baselineEpoch !== taskCurrentBaselineEpoch
  ) {
    throw new DeliveryAdmissionError('delivery_relay_protocol_incompatible', 'The dev relay protocol is not compatible with the admitted nodes.');
  }
  if (
    health.environment !== 'dev'
    || health.workerName !== input.configuration.devWorkerName
    || health.durableObjectNamespace !== input.configuration.devDurableObjectNamespace
  ) {
    throw new DeliveryAdmissionError('delivery_relay_identity_mismatch', 'The dev relay health identity does not match source configuration.');
  }
}

function assertRelayConfiguration(
  evidence: DeliveryRelayConfigurationEvidence,
  now: Date,
  maximumAgeMs: number,
): void {
  if (!evidence || typeof evidence !== 'object') {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', 'Relay configuration evidence is missing.', {
      field: 'relayConfiguration',
    });
  }
  freshTimestamp(evidence.observedAt, 'relayConfiguration', now, maximumAgeMs);
  if (!/^[a-f0-9]{64}$/.test(evidence.configurationHash) || evidence.wranglerVersion !== '4.111.0') {
    throw new DeliveryAdmissionError('delivery_relay_configuration_invalid', 'Relay configuration hash or pinned Wrangler version is invalid.');
  }
  if (
    !evidence.productionWorkerName
    || !evidence.devWorkerName
    || evidence.productionWorkerName === evidence.devWorkerName
    || !evidence.productionDurableObjectNamespace
    || !evidence.devDurableObjectNamespace
    || evidence.productionDurableObjectNamespace === evidence.devDurableObjectNamespace
  ) {
    throw new DeliveryAdmissionError('delivery_relay_identity_reused', 'Production and dev relay Worker/state identities are not distinct.');
  }
}

function assertNoProductionMutation(run: DeliveryRun): void {
  const mutationReceipt = run.phaseReceipts.find((receipt) => (
    receipt.status === 'succeeded'
    && ['main-promotion', 'node-preparation', 'relay-upload', 'relay-activation', 'node-activation'].includes(receipt.phase)
  ));
  // WHAT: Reject runtime mutation while allowing the read-only admitted main SHA from Git preflight.
  // WHY: Observing the merge is admission evidence; node and relay changes remain forbidden before admission.
  if (
    run.relay.priorDeploymentId
    || run.relay.uploadedVersionId
    || run.relay.activeVersionId
    || run.activationOrder.length > 0
    || run.nodes.some((node) => node.stagedReleaseSha !== null || node.state !== 'admitted')
    || mutationReceipt
  ) {
    throw new DeliveryAdmissionError('delivery_production_mutation_detected', 'Production state changed before admission.');
  }
}

function assertCandidate(input: {
  run: DeliveryRun;
  evidence: DeliveryCandidateEvidence;
  now: Date;
  maximumAgeMs: number;
}): void {
  const evidence = input.evidence;
  if (!evidence || typeof evidence !== 'object') {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', 'Candidate Git evidence is missing.', { field: 'candidate' });
  }
  freshTimestamp(evidence.observedAt, 'candidate', input.now, input.maximumAgeMs);
  const admittedSha = sha(input.run.admittedSha, 'run.admittedSha');
  if (
    sha(evidence.releaseSha, 'candidate.releaseSha') !== admittedSha
    || sha(evidence.originDevSha, 'candidate.originDevSha') !== admittedSha
  ) {
    throw new DeliveryAdmissionError('delivery_candidate_sha_mismatch', 'Candidate evidence does not match the exact admitted origin/dev SHA.');
  }
  const priorMainSha = sha(input.run.priorMainSha, 'run.priorMainSha');
  if (sha(evidence.originMainSha, 'candidate.originMainSha') !== priorMainSha) {
    throw new DeliveryAdmissionError('delivery_main_ref_changed', 'Candidate evidence reports a different origin/main predecessor.');
  }
  if (evidence.clean !== true) {
    throw new DeliveryAdmissionError('delivery_candidate_dirty', 'The admitted candidate is not clean.');
  }
  if (evidence.mainIsAncestor !== true) {
    throw new DeliveryAdmissionError('delivery_main_ancestry_invalid', 'origin/main is not an ancestor of the admitted candidate.');
  }
}

function assertProofs(input: {
  proofs: DeliveryAdmissionProof[];
  expectedSha: string;
  now: Date;
  maximumAgeMs: number;
}): void {
  if (!Array.isArray(input.proofs)) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', 'Canary proof receipts are missing.', { field: 'proofs' });
  }
  const byName = new Map(input.proofs.map((proof) => [proof.proof, proof]));
  for (const name of deliveryAdmissionProofNames) {
    const proof = byName.get(name);
    if (!proof || proof.status !== 'passed' || !proof.receiptId) {
      throw new DeliveryAdmissionError('delivery_canary_proof_missing', `Canary proof ${name} is missing.`, { proof: name });
    }
    freshTimestamp(proof.observedAt, `proofs.${name}`, input.now, input.maximumAgeMs);
    if (sha(proof.releaseSha, `proofs.${name}.releaseSha`) !== input.expectedSha) {
      throw new DeliveryAdmissionError('delivery_canary_proof_sha_mismatch', `Canary proof ${name} belongs to a different release.`, {
        proof: name,
      });
    }
  }
  if (byName.size !== deliveryAdmissionProofNames.length) {
    throw new DeliveryAdmissionError('delivery_canary_proof_invalid', 'Canary proof evidence contains an unsupported or duplicate proof.');
  }
}

function assertNodeEvidence(input: {
  topology: FrozenDeliveryTopology;
  evidence: DeliveryNodeAdmissionEvidence[];
  expectedSha: string;
  now: Date;
  maximumAgeMs: number;
}): void {
  if (!Array.isArray(input.evidence)) {
    throw new DeliveryAdmissionError('delivery_admission_evidence_missing', 'Active-node admission evidence is missing.', {
      field: 'nodes',
    });
  }
  const byNode = new Map(input.evidence.map((entry) => [entry.nodeId, entry]));
  const activeNodeIds = input.topology.activeNodes.map((node) => node.nodeId).sort();
  if (
    byNode.size !== activeNodeIds.length
    || [...byNode.keys()].sort().some((nodeId, index) => nodeId !== activeNodeIds[index])
  ) {
    throw new DeliveryAdmissionError('delivery_node_evidence_set_mismatch', 'Node evidence does not match the frozen active topology.');
  }
  for (const node of input.topology.activeNodes) {
    const evidence = byNode.get(node.nodeId);
    if (!evidence) {
      throw new DeliveryAdmissionError('delivery_node_evidence_missing', `Node ${node.nodeId} has no admission evidence.`, {
        nodeId: node.nodeId,
      });
    }
    freshTimestamp(evidence.observedAt, `nodes.${node.nodeId}`, input.now, input.maximumAgeMs);
    assertReleaseHealth({
      evidence: evidence.release,
      field: `nodes.${node.nodeId}.release`,
      expectedSha: input.expectedSha,
      now: input.now,
      maximumAgeMs: input.maximumAgeMs,
    });
    const expectedProjects = node.projects.map((project) => project.projectId).sort();
    const observedProjects = exactStringSet(evidence.projectIds, `nodes.${node.nodeId}.projectIds`);
    if (JSON.stringify(observedProjects) !== JSON.stringify(expectedProjects)) {
      throw new DeliveryAdmissionError('delivery_topology_changed', `Node ${node.nodeId} reports a different project set.`, {
        nodeId: node.nodeId,
      });
    }
    if (evidence.federationPhase !== 'connected') {
      throw new DeliveryAdmissionError('delivery_federation_not_connected', `Node ${node.nodeId} is not connected to the relay.`, {
        nodeId: node.nodeId,
      });
    }
    const counters = {
      activeExecutionCount: nonNegativeInteger(evidence.activeExecutionCount, `nodes.${node.nodeId}.activeExecutionCount`),
      pendingExecutionCount: nonNegativeInteger(evidence.pendingExecutionCount, `nodes.${node.nodeId}.pendingExecutionCount`),
      pendingProcessQueueDepth: nonNegativeInteger(evidence.pendingProcessQueueDepth, `nodes.${node.nodeId}.pendingProcessQueueDepth`),
      pausedScopeCount: nonNegativeInteger(evidence.pausedScopeCount, `nodes.${node.nodeId}.pausedScopeCount`),
      fatalIncidentCount: nonNegativeInteger(evidence.fatalIncidentCount, `nodes.${node.nodeId}.fatalIncidentCount`),
      stateRuntimeDirtyCount: nonNegativeInteger(evidence.stateRuntimeDirtyCount, `nodes.${node.nodeId}.stateRuntimeDirtyCount`),
      statePendingDeliveryCount: nonNegativeInteger(evidence.statePendingDeliveryCount, `nodes.${node.nodeId}.statePendingDeliveryCount`),
      contentQueueDepth: nonNegativeInteger(evidence.contentQueueDepth, `nodes.${node.nodeId}.contentQueueDepth`),
      unavailableContentResourceCount: nonNegativeInteger(evidence.unavailableContentResourceCount, `nodes.${node.nodeId}.unavailableContentResourceCount`),
    };
    const rejection = Object.entries(counters).find(([, count]) => count !== 0);
    if (rejection) {
      const code = rejection[0] === 'activeExecutionCount' || rejection[0] === 'pendingExecutionCount'
        ? 'delivery_active_execution'
        : rejection[0] === 'pausedScopeCount' || rejection[0] === 'fatalIncidentCount'
          ? 'delivery_paused_or_fatal_scope'
          : rejection[0] === 'stateRuntimeDirtyCount'
            ? 'delivery_state_runtime_dirty'
            : rejection[0] === 'statePendingDeliveryCount'
              ? 'delivery_state_delivery_pending'
              : rejection[0] === 'contentQueueDepth' || rejection[0] === 'unavailableContentResourceCount'
                ? 'delivery_content_not_available'
                : 'delivery_process_queue_pending';
      throw new DeliveryAdmissionError(code, `Node ${node.nodeId} has non-zero ${rejection[0]}.`, {
        nodeId: node.nodeId,
        field: rejection[0],
        count: rejection[1],
      });
    }
    const convergedProjects = exactStringSet(evidence.convergedProjectIds, `nodes.${node.nodeId}.convergedProjectIds`);
    if (JSON.stringify(convergedProjects) !== JSON.stringify(expectedProjects)) {
      throw new DeliveryAdmissionError('delivery_federation_not_converged', `Node ${node.nodeId} is not converged for every owned project.`, {
        nodeId: node.nodeId,
      });
    }
  }
}

function receipt(input: {
  run: DeliveryRun;
  topology: FrozenDeliveryTopology;
  candidate: DeliveryCandidateEvidence;
  productionHealth: DeliveryReleaseHealth;
  canaryHealth: DeliveryReleaseHealth;
  devRelayHealth: DeliveryRelayHealth;
  relayConfiguration: DeliveryRelayConfigurationEvidence;
  proofs: DeliveryAdmissionProof[];
  now: Date;
}): DeliveryPhaseReceipt {
  const evidenceHash = createHash('sha256').update(JSON.stringify({
    topology: input.topology,
    candidate: input.candidate,
    productionHealth: input.productionHealth,
    canaryHealth: input.canaryHealth,
    devRelayHealth: input.devRelayHealth,
    relayConfiguration: input.relayConfiguration,
    proofs: input.proofs,
  })).digest('hex');
  return {
    receiptId: `delivery-admission-${evidenceHash.slice(0, 32)}`,
    phase: 'admission',
    operation: 'admit-exact-release',
    status: 'succeeded',
    nodeId: 'coordinator',
    commitSha: input.run.admittedSha,
    startedAt: input.now.toISOString(),
    completedAt: input.now.toISOString(),
    command: null,
    evidence: [
      { key: 'evidenceHash', value: evidenceHash },
      { key: 'topologyFingerprint', value: input.topology.fingerprint },
      { key: 'productionReleaseSha', value: input.productionHealth.releaseSha },
      { key: 'canaryReleaseSha', value: input.canaryHealth.releaseSha },
      { key: 'devRelayReleaseSha', value: input.devRelayHealth.releaseSha },
      { key: 'relayConfigurationHash', value: input.relayConfiguration.configurationHash },
      { key: 'activeNodeCount', value: input.topology.activeNodes.length },
      { key: 'zeroProjectNodeCount', value: input.topology.zeroProjectNodes.length },
    ],
  };
}

export async function admitDecisionOsDelivery(input: {
  run: DeliveryRun;
  observedTopology: FrozenDeliveryTopology;
  frozenTopology?: FrozenDeliveryTopology;
  candidate: DeliveryCandidateEvidence;
  productionHealth: DeliveryReleaseHealth;
  canaryHealth: DeliveryReleaseHealth;
  devRelayHealth: DeliveryRelayHealth;
  relayConfiguration: DeliveryRelayConfigurationEvidence;
  nodeEvidence: DeliveryNodeAdmissionEvidence[];
  proofs: DeliveryAdmissionProof[];
  persist: (run: DeliveryRun) => DeliveryRun | Promise<DeliveryRun>;
  now?: () => Date;
  maximumEvidenceAgeMs?: number;
}): Promise<DeliveryRun> {
  const now = input.now?.() ?? new Date();
  const maximumAgeMs = Math.max(1_000, Math.min(30 * 60_000, input.maximumEvidenceAgeMs ?? 5 * 60_000));
  assertNoProductionMutation(input.run);
  assertCandidate({ run: input.run, evidence: input.candidate, now, maximumAgeMs });
  if (input.frozenTopology) assertDeliveryTopologyUnchanged(input.frozenTopology, input.observedTopology);
  freshTimestamp(input.observedTopology.capturedAt, 'topology', now, maximumAgeMs);
  assertRelayConfiguration(input.relayConfiguration, now, maximumAgeMs);
  const priorMainSha = sha(input.run.priorMainSha, 'run.priorMainSha');
  assertReleaseHealth({
    evidence: input.productionHealth,
    field: 'productionHealth',
    expectedSha: priorMainSha,
    now,
    maximumAgeMs,
  });
  assertReleaseHealth({
    evidence: input.canaryHealth,
    field: 'canaryHealth',
    expectedSha: input.run.admittedSha,
    now,
    maximumAgeMs,
  });
  assertRelayHealth({
    evidence: input.devRelayHealth,
    configuration: input.relayConfiguration,
    expectedSha: input.run.admittedSha,
    now,
    maximumAgeMs,
  });
  assertNodeEvidence({
    topology: input.observedTopology,
    evidence: input.nodeEvidence,
    expectedSha: priorMainSha,
    now,
    maximumAgeMs,
  });
  assertProofs({ proofs: input.proofs, expectedSha: input.run.admittedSha, now, maximumAgeMs });
  const admissionReceipt = receipt({
    run: input.run,
    topology: input.observedTopology,
    candidate: input.candidate,
    productionHealth: input.productionHealth,
    canaryHealth: input.canaryHealth,
    devRelayHealth: input.devRelayHealth,
    relayConfiguration: input.relayConfiguration,
    proofs: input.proofs,
    now,
  });
  const nextRun: DeliveryRun = {
    ...structuredClone(input.run),
    phase: 'admission',
    updatedAt: now.toISOString(),
    topology: {
      capturedAt: input.observedTopology.capturedAt,
      fingerprint: input.observedTopology.fingerprint,
      admittedNodeIds: input.observedTopology.activeNodes.map((node) => node.nodeId),
      zeroProjectNodeIds: input.observedTopology.zeroProjectNodes.map((node) => node.nodeId),
    },
    nodes: input.observedTopology.activeNodes.map((node) => {
      const nodeEvidence = input.nodeEvidence.find((entry) => entry.nodeId === node.nodeId)!;
      return {
        nodeId: node.nodeId,
        priorReleaseSha: nodeEvidence.release.releaseSha,
        stagedReleaseSha: null,
        activeReleaseSha: nodeEvidence.release.releaseSha,
        processIdentity: nodeEvidence.release.processStartedAt,
        state: 'admitted',
      };
    }),
    phaseReceipts: [...input.run.phaseReceipts, admissionReceipt],
  };
  return await input.persist(nextRun);
}

export async function collectFixedAdmissionSurfaceEvidence(input: {
  readJson: (endpoint: string, signal: AbortSignal) => Promise<unknown>;
  signal?: AbortSignal;
  deadlineMs?: number;
}): Promise<FixedAdmissionSurfaceEvidence> {
  try {
    return await runDeliveryOperationBoundary({
      deadlineMs: input.deadlineMs ?? 10_000,
      maximumDeadlineMs: 60_000,
      signal: input.signal,
      cancellationError: () => new Error('delivery_admission_cancelled'),
      timeoutError: () => new Error('delivery_admission_evidence_timeout'),
      execute: async (signal) => {
        const [productionHealth, canaryHealth, devRelayHealth] = await Promise.all([
          input.readJson(fixedDeliveryAdmissionEndpoints.productionHealth, signal),
          input.readJson(fixedDeliveryAdmissionEndpoints.canaryHealth, signal),
          input.readJson(fixedDeliveryAdmissionEndpoints.devRelayHealth, signal),
        ]);
        return { productionHealth, canaryHealth, devRelayHealth };
      },
    });
  } catch (error) {
    const code = String(error).includes('timeout')
      ? 'delivery_admission_evidence_timeout'
      : input.signal?.aborted
        ? 'delivery_admission_cancelled'
        : 'delivery_admission_evidence_unavailable';
    throw new DeliveryAdmissionError(code, error instanceof Error ? error.message : String(error));
  }
}
