/**
 * WHAT: Defines the injected authority boundary and durable phase utilities used by delivery coordinators.
 * WHY: Promotion, resume, and rollback must share one receipt identity, reconciliation, and deadline contract.
 */
import { createHash } from 'node:crypto';
import {
  decisionOsDeliveryProtocol,
  deliveryExitCodeForStatus,
  parseDeliveryNodeReceipt,
  parseDeliveryRun,
  type DeliveryExitCode,
  type DeliveryNodeCommand,
  type DeliveryNodeReceipt,
  type DeliveryPhase,
  type DeliveryPhaseReceipt,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import { runDeliveryOperationBoundary } from './run-delivery-operation-boundary.js';
import type {
  DeliveryAdmissionProof,
  DeliveryCandidateEvidence,
  DeliveryNodeAdmissionEvidence,
  DeliveryRelayConfigurationEvidence,
  DeliveryRelayHealth,
  DeliveryReleaseHealth,
} from '../controller/delivery-admission-controller.js';
import type { FrozenDeliveryTopology } from '../controller/delivery-topology-controller.js';
import type { RepositoryMutationLock } from '../../content-authoring/helper/repository-mutation-lock.js';

export type DeliveryMutationReceipt = {
  receiptId: string;
  mutation: string;
  targetSha: string;
  predecessor: string;
  resultIdentity: string;
  observedAt: string;
};

export type DeliveryNodeAuthority = {
  nodeId: string;
  activeReleaseSha: string;
  processIdentity: string;
  ready: boolean;
  catalogReady: boolean;
  federationPhase: string;
  converged: boolean;
  receipts: DeliveryNodeReceipt[];
};

export type DeliveryAuthoritySnapshot = {
  observedAt: string;
  originDevSha: string;
  originMainSha: string;
  topology: FrozenDeliveryTopology;
  gitPromotion: DeliveryMutationReceipt | null;
  relay: {
    activeVersionId: string;
    releaseSha: string;
    upload: DeliveryMutationReceipt | null;
    activation: DeliveryMutationReceipt | null;
    rollback: DeliveryMutationReceipt | null;
  };
  nodes: DeliveryNodeAuthority[];
};

export type DeliveryAdmissionEvidence = {
  topology: FrozenDeliveryTopology;
  candidate: DeliveryCandidateEvidence;
  productionHealth: DeliveryReleaseHealth;
  canaryHealth: DeliveryReleaseHealth;
  devRelayHealth: DeliveryRelayHealth;
  relayConfiguration: DeliveryRelayConfigurationEvidence;
  nodeEvidence: DeliveryNodeAdmissionEvidence[];
  proofs: DeliveryAdmissionProof[];
};

export type DeliveryCoordinatorEffects = {
  coordinatorNodeId: string;
  preflightGit(input: { releaseSha: string; repositoryLock: RepositoryMutationLock; signal: AbortSignal }): Promise<{
    priorMainSha: string;
    originDevSha: string;
    receipt: DeliveryMutationReceipt;
  }>;
  collectAdmission(input: {
    run: DeliveryRun;
    signal: AbortSignal;
  }): Promise<DeliveryAdmissionEvidence>;
  promoteMain(input: {
    run: DeliveryRun;
    repositoryLock: RepositoryMutationLock;
    signal: AbortSignal;
  }): Promise<{ mainSha: string; receipt: DeliveryMutationReceipt }>;
  dispatchNode(input: {
    nodeId: string;
    command: DeliveryNodeCommand;
    signal: AbortSignal;
  }): Promise<DeliveryNodeReceipt>;
  readRelayDeployment(input: { run: DeliveryRun; signal: AbortSignal }): Promise<{
    deploymentId: string;
    versionId: string;
  }>;
  uploadRelay(input: {
    run: DeliveryRun;
    signal: AbortSignal;
  }): Promise<{ versionId: string; receipt: DeliveryMutationReceipt }>;
  deployRelay(input: {
    run: DeliveryRun;
    versionId: string;
    signal: AbortSignal;
  }): Promise<DeliveryMutationReceipt>;
  rollbackRelay(input: {
    run: DeliveryRun;
    priorVersionId: string;
    signal: AbortSignal;
  }): Promise<DeliveryMutationReceipt>;
  verifyRelay(input: {
    run: DeliveryRun;
    expectedReleaseSha: string;
    expectedVersionId: string;
    signal: AbortSignal;
  }): Promise<void>;
  verifyRelayRollback(input: {
    run: DeliveryRun;
    expectedVersionId: string;
    signal: AbortSignal;
  }): Promise<void>;
  verifyNode(input: {
    run: DeliveryRun;
    nodeId: string;
    expectedReleaseSha: string;
    previousProcessIdentity: string;
    signal: AbortSignal;
  }): Promise<DeliveryNodeAuthority>;
  observeAuthority(input: { run: DeliveryRun; signal: AbortSignal }): Promise<DeliveryAuthoritySnapshot>;
  verifyFinal(input: { run: DeliveryRun; authority: DeliveryAuthoritySnapshot; signal: AbortSignal }): Promise<void>;
};

export type DeliveryRunSummary = {
  protocol: typeof decisionOsDeliveryProtocol;
  deliveryId: string;
  admittedSha: string;
  priorMainSha: string | null;
  mainSha: string | null;
  phase: DeliveryRun['phase'];
  status: DeliveryRun['status'];
  exitCode: DeliveryExitCode | null;
  topologyFingerprint: string;
  relay: DeliveryRun['relay'];
  nodes: DeliveryRun['nodes'];
  activationOrder: string[];
  failure: DeliveryRun['failure'];
  updatedAt: string;
};

export class DeliveryCoordinatorError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly phase: DeliveryPhase,
    readonly nodeId = '',
  ) {
    super(message);
    this.name = 'DeliveryCoordinatorError';
  }
}

export class DeliveryInterruptedError extends DeliveryCoordinatorError {
  constructor(phase: DeliveryPhase, operation: string) {
    super('delivery_process_interrupted', `Delivery process interrupted during ${operation}.`, phase);
    this.name = 'DeliveryInterruptedError';
  }
}

function stableIdentifier(value: string, field: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(value)) {
    throw new DeliveryCoordinatorError('delivery_identity_invalid', `${field} is invalid.`, 'created');
  }
  return value;
}

function exactSha(value: string, field: string): string {
  if (!/^[a-f0-9]{40}$/.test(value)) {
    throw new DeliveryCoordinatorError('delivery_sha_invalid', `${field} is invalid.`, 'created');
  }
  return value;
}

export function createDeliveryId(releaseSha: string, now = new Date()): string {
  exactSha(releaseSha, 'releaseSha');
  return `delivery-${now.toISOString().replace(/\D/g, '').slice(0, 17)}-${releaseSha.slice(0, 12)}`;
}

export function createDeliveryRun(input: {
  deliveryId: string;
  admittedSha: string;
  now: Date;
}): DeliveryRun {
  return parseDeliveryRun({
    protocol: decisionOsDeliveryProtocol,
    deliveryId: stableIdentifier(input.deliveryId, 'deliveryId'),
    admittedSha: exactSha(input.admittedSha, 'admittedSha'),
    priorMainSha: null,
    mainSha: null,
    phase: 'created',
    status: 'running',
    createdAt: input.now.toISOString(),
    updatedAt: input.now.toISOString(),
    topology: { capturedAt: '', fingerprint: '', admittedNodeIds: [], zeroProjectNodeIds: [] },
    relay: { priorDeploymentId: '', uploadedVersionId: '', activeVersionId: '' },
    nodes: [],
    activationOrder: [],
    phaseReceipts: [],
    compensationReceipts: [],
    artifactPaths: [],
    deadlines: [],
    retries: [],
    failure: null,
  });
}

export function deliveryRunSummary(runValue: DeliveryRun): DeliveryRunSummary {
  const run = parseDeliveryRun(runValue);
  return {
    protocol: decisionOsDeliveryProtocol,
    deliveryId: run.deliveryId,
    admittedSha: run.admittedSha,
    priorMainSha: run.priorMainSha,
    mainSha: run.mainSha,
    phase: run.phase,
    status: run.status,
    exitCode: deliveryExitCodeForStatus(run.status),
    topologyFingerprint: run.topology.fingerprint,
    relay: structuredClone(run.relay),
    nodes: structuredClone(run.nodes),
    activationOrder: [...run.activationOrder],
    failure: run.failure ? structuredClone(run.failure) : null,
    updatedAt: run.updatedAt,
  };
}

function receiptId(run: DeliveryRun, phase: DeliveryPhase, operation: string): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ deliveryId: run.deliveryId, phase, operation }))
    .digest('hex')
    .slice(0, 32);
  return `delivery-${digest}`;
}

export function phaseReceipt(input: {
  run: DeliveryRun;
  phase: DeliveryPhase;
  operation: string;
  status: DeliveryPhaseReceipt['status'];
  now: Date;
  startedAt?: string;
  nodeId?: string;
  commitSha?: string | null;
  evidence?: DeliveryPhaseReceipt['evidence'];
}): DeliveryPhaseReceipt {
  return {
    receiptId: receiptId(input.run, input.phase, input.operation),
    phase: input.phase,
    operation: stableIdentifier(input.operation, 'operation'),
    status: input.status,
    nodeId: input.nodeId ?? '',
    commitSha: input.commitSha ?? null,
    startedAt: input.startedAt ?? input.now.toISOString(),
    completedAt: input.status === 'started' ? '' : input.now.toISOString(),
    command: null,
    evidence: structuredClone(input.evidence ?? []),
  };
}

export function receiptForOperation(run: DeliveryRun, operation: string, compensation = false): DeliveryPhaseReceipt | null {
  const receipts = compensation ? run.compensationReceipts : run.phaseReceipts;
  return [...receipts].reverse().find((receipt) => receipt.operation === operation) ?? null;
}

export async function withDeliveryDeadline<T>(input: {
  operation: string;
  deadlineMs: number;
  parentSignal?: AbortSignal;
  execute(signal: AbortSignal): Promise<T>;
}): Promise<T> {
  return await runDeliveryOperationBoundary({
    deadlineMs: input.deadlineMs,
    maximumDeadlineMs: 10 * 60_000,
    signal: input.parentSignal,
    cancellationError: () => new Error('delivery_operation_cancelled'),
    timeoutError: () => new DeliveryCoordinatorError(
      'delivery_phase_timeout',
      `Delivery operation ${input.operation} exceeded its deadline.`,
      'compensation',
    ),
    execute: input.execute,
  });
}

function mutationMatches(
  receipt: DeliveryMutationReceipt | null,
  mutation: string,
  targetSha: string,
  predecessor: string,
): receipt is DeliveryMutationReceipt {
  return Boolean(
    receipt
    && receipt.mutation === mutation
    && receipt.targetSha === targetSha
    && receipt.predecessor === predecessor
    && receipt.receiptId
    && Number.isFinite(Date.parse(receipt.observedAt)),
  );
}

function nodeReceipt(
  authority: DeliveryNodeAuthority,
  command: DeliveryNodeCommand,
): DeliveryNodeReceipt | null {
  const receipt = authority.receipts.find((entry) => (
    entry.deliveryId === command.deliveryId
    && entry.nodeId === authority.nodeId
    && entry.action === command.action
    && entry.targetCommit === command.targetCommit
    && entry.expectedCommit === command.expectedCommit
  ));
  return receipt ? parseDeliveryNodeReceipt(receipt) : null;
}

export function reconcileDeliveryAuthority(runValue: DeliveryRun, authority: DeliveryAuthoritySnapshot): DeliveryRun {
  const run = parseDeliveryRun(runValue);
  if (
    authority.originDevSha !== run.admittedSha
    || authority.topology.fingerprint !== run.topology.fingerprint
    || JSON.stringify(authority.topology.activeNodes.map((node) => node.nodeId)) !== JSON.stringify(run.topology.admittedNodeIds)
  ) {
    throw new DeliveryCoordinatorError(
      authority.originDevSha !== run.admittedSha ? 'delivery_candidate_sha_mismatch' : 'delivery_topology_changed',
      'Live delivery identity differs from the durable journal.',
      run.phase,
    );
  }
  const next = structuredClone(run);
  const recoverReceipt = (
    operation: string,
    phase: DeliveryPhase,
    evidence: DeliveryPhaseReceipt['evidence'],
    nodeId = '',
    commitSha: string | null = null,
    compensation = false,
  ): void => {
    const receipts = compensation ? next.compensationReceipts : next.phaseReceipts;
    const started = [...receipts].reverse().find((entry) => entry.operation === operation && entry.status === 'started');
    const settled = [...receipts].reverse().find((entry) => entry.operation === operation && entry.status === 'succeeded');
    // WHY: Reconciliation must not duplicate a coordinator receipt already persisted before interruption.
    // WHAT: Append one recovered terminal receipt only for an unsettled started operation.
    if (!started || settled) return;
    receipts.push(phaseReceipt({
      run,
      phase,
      operation,
      status: 'succeeded',
      now: new Date(authority.observedAt),
      startedAt: started.startedAt,
      nodeId,
      commitSha,
      evidence,
    }));
  };
  const promotionStarted = receiptForOperation(run, 'promote-main')?.status === 'started';
  // WHY: A lost Git response may leave main changed without a coordinator success receipt.
  // WHAT: Accept the live SHA only with an exact external promotion receipt bound to this run.
  if (!next.mainSha && promotionStarted && mutationMatches(
    authority.gitPromotion,
    'promote-main',
    run.admittedSha,
    String(run.priorMainSha ?? ''),
  )) {
    next.mainSha = exactSha(authority.gitPromotion.resultIdentity, 'mainSha');
    recoverReceipt(
      'promote-main',
      'main-promotion',
      mutationReceiptEvidence(authority.gitPromotion),
      'coordinator',
      next.mainSha,
    );
  }
  if (next.mainSha && authority.originMainSha !== next.mainSha) {
    throw new DeliveryCoordinatorError('delivery_main_ref_changed', 'origin/main differs from the journal main SHA.', run.phase);
  }
  const uploadStarted = receiptForOperation(run, 'upload-relay')?.status === 'started';
  // WHY: Wrangler may upload an immutable version before its response reaches the coordinator.
  // WHAT: Recover the version only from the exact upload receipt bound to the journal main SHA.
  if (
    !next.relay.uploadedVersionId
    && next.mainSha
    && uploadStarted
    && mutationMatches(authority.relay.upload, 'upload-relay', next.mainSha, run.relay.priorDeploymentId)
  ) {
    next.relay.uploadedVersionId = stableIdentifier(authority.relay.upload.resultIdentity, 'uploadedVersionId');
    recoverReceipt('upload-relay', 'relay-upload', mutationReceiptEvidence(authority.relay.upload), 'relay', next.mainSha);
  }
  const activationStarted = receiptForOperation(run, 'activate-relay')?.status === 'started';
  // WHY: Relay traffic can move before the deploy response is observed locally.
  // WHAT: Recover activation only when live traffic, release identity, and the exact deploy receipt agree.
  if (
    !next.relay.activeVersionId
    && next.mainSha
    && next.relay.uploadedVersionId
    && activationStarted
    && authority.relay.activeVersionId === next.relay.uploadedVersionId
    && authority.relay.releaseSha === next.mainSha
    && mutationMatches(
      authority.relay.activation,
      'activate-relay',
      next.mainSha,
      run.relay.priorDeploymentId,
    )
  ) {
    next.relay.activeVersionId = next.relay.uploadedVersionId;
    recoverReceipt(
      'activate-relay',
      'relay-activation',
      mutationReceiptEvidence(authority.relay.activation),
      'relay',
      next.mainSha,
    );
  }
  const rollbackStarted = receiptForOperation(run, 'rollback-relay', true)?.status === 'started';
  const priorRelayVersion = receiptForOperation(run, 'read-relay-predecessor')
    ?.evidence.find((entry) => entry.key === 'priorVersionId')?.value;
  // WHY: A lost rollback response must not redeploy the predecessor a second time.
  // WHAT: Recover relay compensation only from the exact rollback receipt and live predecessor traffic.
  if (
    rollbackStarted
    && typeof priorRelayVersion === 'string'
    && authority.relay.activeVersionId === priorRelayVersion
    && mutationMatches(
      authority.relay.rollback,
      'rollback-relay',
      String(run.mainSha ?? ''),
      run.relay.uploadedVersionId,
    )
  ) {
    next.relay.activeVersionId = priorRelayVersion;
    recoverReceipt(
      'rollback-relay',
      'compensation',
      mutationReceiptEvidence(authority.relay.rollback),
      'relay',
      run.mainSha,
      true,
    );
  }

  for (const node of next.nodes) {
    const observed = authority.nodes.find((entry) => entry.nodeId === node.nodeId);
    if (!observed) throw new DeliveryCoordinatorError('delivery_node_evidence_missing', `Node ${node.nodeId} is absent.`, run.phase, node.nodeId);
    const targetSha = next.mainSha ?? run.admittedSha;
    const prepare = nodeReceipt(observed, {
      deliveryId: run.deliveryId,
      action: 'prepare',
      targetCommit: targetSha,
      expectedCommit: String(node.priorReleaseSha ?? ''),
    });
    // WHY: Prepared releases are immutable but do not change the live pointer.
    // WHAT: Advance prepared state only from the exact terminal node receipt.
    if (prepare?.status === 'complete') {
      node.stagedReleaseSha = targetSha;
      if (node.state === 'admitted') node.state = 'prepared';
      recoverReceipt(
        `prepare-node:${node.nodeId}`,
        'node-preparation',
        nodeReceiptEvidence(prepare),
        node.nodeId,
        targetSha,
      );
    }
    const activate = nodeReceipt(observed, {
      deliveryId: run.deliveryId,
      action: 'activate',
      targetCommit: targetSha,
      expectedCommit: String(node.priorReleaseSha ?? ''),
    });
    // WHY: A lost activation response is recoverable only from receipt, pointer, and restarted health.
    // WHAT: Mark active after all three exact authorities agree on the target release.
    if (
      activate?.status === 'complete'
      && observed.activeReleaseSha === targetSha
      && observed.processIdentity !== node.processIdentity
      && observed.ready
      && observed.catalogReady
      && observed.federationPhase === 'connected'
      && observed.converged
    ) {
      node.activeReleaseSha = targetSha;
      node.processIdentity = observed.processIdentity;
      node.state = 'active';
      if (!next.activationOrder.includes(node.nodeId)) next.activationOrder.push(node.nodeId);
      recoverReceipt(
        `activate-node:${node.nodeId}`,
        'node-activation',
        nodeReceiptEvidence(activate),
        node.nodeId,
        targetSha,
      );
    }
    const rollback = nodeReceipt(observed, {
      deliveryId: run.deliveryId,
      action: 'rollback',
      targetCommit: String(node.priorReleaseSha ?? ''),
      expectedCommit: targetSha,
    });
    // WHY: Compensation cannot claim rollback from a request acknowledgement alone.
    // WHAT: Accept rollback only after receipt, predecessor pointer, restart, health, catalog, and convergence agree.
    if (
      rollback?.status === 'complete'
      && observed.activeReleaseSha === node.priorReleaseSha
      && observed.ready
      && observed.catalogReady
      && observed.federationPhase === 'connected'
      && observed.converged
    ) {
      node.activeReleaseSha = node.priorReleaseSha;
      node.processIdentity = observed.processIdentity;
      node.state = 'rolled-back';
      recoverReceipt(
        `rollback-node:${node.nodeId}`,
        'compensation',
        nodeReceiptEvidence(rollback),
        node.nodeId,
        node.priorReleaseSha,
        true,
      );
    }
  }
  return parseDeliveryRun(next);
}

export function mutationReceiptEvidence(receipt: DeliveryMutationReceipt): DeliveryPhaseReceipt['evidence'] {
  return [
    { key: 'externalReceiptId', value: stableIdentifier(receipt.receiptId, 'externalReceiptId') },
    { key: 'mutation', value: stableIdentifier(receipt.mutation, 'mutation') },
    { key: 'predecessor', value: receipt.predecessor },
    { key: 'resultIdentity', value: receipt.resultIdentity },
    { key: 'observedAt', value: receipt.observedAt },
  ];
}

export function nodeReceiptEvidence(receipt: DeliveryNodeReceipt): DeliveryPhaseReceipt['evidence'] {
  return [
    { key: 'nodeReceiptId', value: receipt.receiptId },
    { key: 'nodeAction', value: receipt.action },
    { key: 'activeCommit', value: receipt.activeCommit },
    { key: 'processIdentity', value: receipt.processIdentity },
  ];
}
