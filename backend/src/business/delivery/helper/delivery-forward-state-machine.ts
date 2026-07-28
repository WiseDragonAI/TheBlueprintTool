/**
 * WHAT: Advances one admitted delivery through reviewed main, relay, rolling nodes, and final proof.
 * WHY: Every external mutation needs a durable started boundary and terminal receipt before later phases advance.
 */
import {
  parseDeliveryNodeReceipt,
  parseDeliveryRun,
  type DeliveryNodeCommand,
  type DeliveryPhase,
  type DeliveryPhaseReceipt,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import { admitDecisionOsDelivery } from '../controller/delivery-admission-controller.js';
import { assertDeliveryTopologyUnchanged } from '../controller/delivery-topology-controller.js';
import type { DeliveryRunStore } from './delivery-run-store.js';
import type { RepositoryMutationLock } from '../../content-authoring/helper/repository-mutation-lock.js';
import {
  DeliveryCoordinatorError,
  mutationReceiptEvidence,
  nodeReceiptEvidence,
  phaseReceipt,
  receiptForOperation,
  reconcileDeliveryAuthority,
  withDeliveryDeadline,
  type DeliveryCoordinatorEffects,
} from './delivery-coordinator.js';

type ForwardContext = {
  runStore: DeliveryRunStore;
  effects: DeliveryCoordinatorEffects;
  now: () => Date;
  repositoryLock: RepositoryMutationLock;
  signal?: AbortSignal;
  deadlineMs?: number;
};

function persist(context: ForwardContext, runValue: DeliveryRun): DeliveryRun {
  const run = parseDeliveryRun(runValue);
  return context.runStore.write({ ...run, updatedAt: context.now().toISOString() });
}

function begin(input: {
  context: ForwardContext;
  run: DeliveryRun;
  phase: DeliveryPhase;
  operation: string;
  nodeId?: string;
  commitSha?: string | null;
  compensation?: boolean;
}): DeliveryRun {
  const now = input.context.now();
  const deadlineAt = new Date(now.getTime() + (input.context.deadlineMs ?? 60_000)).toISOString();
  const receipts = input.compensation ? input.run.compensationReceipts : input.run.phaseReceipts;
  const existing = receipts.find((entry) => entry.operation === input.operation);
  if (existing && existing.status !== 'started') {
    throw new DeliveryCoordinatorError(
      'delivery_phase_receipt_terminal',
      `Operation ${input.operation} already has a terminal receipt.`,
      input.phase,
      input.nodeId,
    );
  }
  const retry = input.run.retries.find((entry) => entry.operation === input.operation);
  const attempts = (retry?.attempts ?? 0) + 1;
  const maximumAttempts = retry?.maximumAttempts ?? 10;
  if (attempts > maximumAttempts) {
    throw new DeliveryCoordinatorError(
      'delivery_retry_limit_reached',
      `Operation ${input.operation} exhausted its retry budget.`,
      input.phase,
      input.nodeId,
    );
  }
  const retries = [
    ...input.run.retries.filter((entry) => entry.operation !== input.operation),
    { operation: input.operation, attempts, maximumAttempts },
  ];
  if (existing) {
    return persist(input.context, {
      ...input.run,
      phase: input.phase,
      retries,
      deadlines: [
        ...input.run.deadlines.filter((entry) => entry.operation !== input.operation),
        { operation: input.operation, deadlineAt },
      ],
    });
  }
  const receipt = phaseReceipt({
    run: input.run,
    phase: input.phase,
    operation: input.operation,
    status: 'started',
    now,
    nodeId: input.nodeId,
    commitSha: input.commitSha,
  });
  return persist(input.context, {
    ...input.run,
    phase: input.phase,
    deadlines: [
      ...input.run.deadlines.filter((entry) => entry.operation !== input.operation),
      { operation: input.operation, deadlineAt },
    ],
    retries,
    ...(input.compensation
      ? { compensationReceipts: [...input.run.compensationReceipts, receipt] }
      : { phaseReceipts: [...input.run.phaseReceipts, receipt] }),
  });
}

function complete(input: {
  context: ForwardContext;
  run: DeliveryRun;
  phase: DeliveryPhase;
  operation: string;
  evidence?: DeliveryPhaseReceipt['evidence'];
  nodeId?: string;
  commitSha?: string | null;
  mutate?: (run: DeliveryRun) => void;
  compensation?: boolean;
}): DeliveryRun {
  const started = receiptForOperation(input.run, input.operation, input.compensation);
  if (!started || started.status !== 'started') {
    throw new DeliveryCoordinatorError(
      'delivery_phase_receipt_missing',
      `Operation ${input.operation} has no durable started receipt.`,
      input.phase,
      input.nodeId,
    );
  }
  const next = structuredClone(input.run);
  input.mutate?.(next);
  const receipt = phaseReceipt({
    run: next,
    phase: input.phase,
    operation: input.operation,
    status: 'succeeded',
    startedAt: started.startedAt,
    now: input.context.now(),
    nodeId: input.nodeId,
    commitSha: input.commitSha,
    evidence: input.evidence,
  });
  if (input.compensation) next.compensationReceipts.push(receipt);
  else next.phaseReceipts.push(receipt);
  return persist(input.context, next);
}

async function execute<T>(
  context: ForwardContext,
  operation: string,
  effect: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  return await withDeliveryDeadline({
    operation,
    deadlineMs: context.deadlineMs ?? 60_000,
    parentSignal: context.signal,
    execute: effect,
  });
}

function requiredNodeCommand(input: {
  run: DeliveryRun;
  nodeId: string;
  action: DeliveryNodeCommand['action'];
  targetCommit: string;
  expectedCommit: string;
}): DeliveryNodeCommand {
  const node = input.run.nodes.find((entry) => entry.nodeId === input.nodeId);
  if (!node) throw new DeliveryCoordinatorError('delivery_node_evidence_missing', `Node ${input.nodeId} is absent.`, input.run.phase, input.nodeId);
  return {
    deliveryId: input.run.deliveryId,
    action: input.action,
    targetCommit: input.targetCommit,
    expectedCommit: input.expectedCommit,
  };
}

export async function advanceDecisionOsDelivery(
  runValue: DeliveryRun,
  context: ForwardContext,
): Promise<DeliveryRun> {
  let run = parseDeliveryRun(runValue);
  if (run.status !== 'running') return run;

  if (!run.priorMainSha) {
    const operation = 'preflight-git';
    run = begin({ context, run, phase: 'preflight', operation, commitSha: run.admittedSha });
    const preflight = await execute(context, operation, async (signal) => await context.effects.preflightGit({
      releaseSha: run.admittedSha,
      repositoryLock: context.repositoryLock,
      signal,
    }));
    if (preflight.originDevSha !== run.admittedSha) {
      throw new DeliveryCoordinatorError('delivery_candidate_sha_mismatch', 'origin/dev changed during preflight.', 'preflight');
    }
    run = complete({
      context,
      run,
      phase: 'preflight',
      operation,
      commitSha: run.admittedSha,
      evidence: mutationReceiptEvidence(preflight.receipt),
      mutate: (next) => { next.priorMainSha = preflight.priorMainSha; },
    });
  }

  if (!receiptForOperation(run, 'admit-exact-release')) {
    const operation = 'collect-admission';
    run = begin({ context, run, phase: 'admission', operation, commitSha: run.admittedSha });
    const evidence = await execute(context, operation, async (signal) => await context.effects.collectAdmission({ run, signal }));
    run = await admitDecisionOsDelivery({
      run,
      observedTopology: evidence.topology,
      candidate: evidence.candidate,
      productionHealth: evidence.productionHealth,
      canaryHealth: evidence.canaryHealth,
      devRelayHealth: evidence.devRelayHealth,
      relayConfiguration: evidence.relayConfiguration,
      nodeEvidence: evidence.nodeEvidence,
      proofs: evidence.proofs,
      persist: (next) => context.runStore.write(next),
      now: context.now,
    });
    run = complete({
      context,
      run,
      phase: 'admission',
      operation,
      commitSha: run.admittedSha,
      evidence: [
        { key: 'topologyFingerprint', value: evidence.topology.fingerprint },
        { key: 'activeNodeCount', value: evidence.topology.activeNodes.length },
        { key: 'proofCount', value: evidence.proofs.length },
      ],
    });
  }

  if (!run.relay.priorDeploymentId) {
    const operation = 'read-relay-predecessor';
    run = begin({ context, run, phase: 'relay-upload', operation, nodeId: 'relay', commitSha: run.admittedSha });
    const current = await execute(context, operation, async (signal) => (
      await context.effects.readRelayDeployment({ run, signal })
    ));
    run = complete({
      context,
      run,
      phase: 'relay-upload',
      operation,
      nodeId: 'relay',
      commitSha: run.admittedSha,
      evidence: [
        { key: 'priorDeploymentId', value: current.deploymentId },
        { key: 'priorVersionId', value: current.versionId },
      ],
      mutate: (next) => { next.relay.priorDeploymentId = current.deploymentId; },
    });
  }

  if (!run.mainSha) {
    const operation = 'promote-main';
    run = begin({ context, run, phase: 'main-promotion', operation, commitSha: run.admittedSha });
    const promoted = await execute(context, operation, async (signal) => await context.effects.promoteMain({
      run,
      repositoryLock: context.repositoryLock,
      signal,
    }));
    run = complete({
      context,
      run,
      phase: 'main-promotion',
      operation,
      commitSha: promoted.mainSha,
      evidence: mutationReceiptEvidence(promoted.receipt),
      mutate: (next) => { next.mainSha = promoted.mainSha; },
    });
  }

  for (const node of run.nodes) {
    if (node.stagedReleaseSha === run.mainSha) continue;
    const operation = `prepare-node:${node.nodeId}`;
    run = begin({ context, run, phase: 'node-preparation', operation, nodeId: node.nodeId, commitSha: run.mainSha });
    const command = requiredNodeCommand({
      run,
      nodeId: node.nodeId,
      action: 'prepare',
      targetCommit: run.mainSha,
      expectedCommit: String(node.priorReleaseSha),
    });
    const receipt = parseDeliveryNodeReceipt(await execute(
      context,
      operation,
      async (signal) => await context.effects.dispatchNode({ nodeId: node.nodeId, command, signal }),
    ));
    if (receipt.status !== 'complete') {
      throw new DeliveryCoordinatorError('delivery_node_prepare_incomplete', `Node ${node.nodeId} did not prepare.`, 'node-preparation', node.nodeId);
    }
    run = complete({
      context,
      run,
      phase: 'node-preparation',
      operation,
      nodeId: node.nodeId,
      commitSha: run.mainSha,
      evidence: nodeReceiptEvidence(receipt),
      mutate: (next) => {
        const target = next.nodes.find((entry) => entry.nodeId === node.nodeId)!;
        target.stagedReleaseSha = next.mainSha;
        target.state = 'prepared';
      },
    });
  }

  if (!run.relay.uploadedVersionId) {
    const operation = 'upload-relay';
    run = begin({ context, run, phase: 'relay-upload', operation, nodeId: 'relay', commitSha: run.mainSha });
    const uploaded = await execute(context, operation, async (signal) => await context.effects.uploadRelay({ run, signal }));
    run = complete({
      context,
      run,
      phase: 'relay-upload',
      operation,
      nodeId: 'relay',
      commitSha: run.mainSha,
      evidence: mutationReceiptEvidence(uploaded.receipt),
      mutate: (next) => { next.relay.uploadedVersionId = uploaded.versionId; },
    });
  }

  if (run.relay.activeVersionId !== run.relay.uploadedVersionId) {
    const operation = 'activate-relay';
    run = begin({ context, run, phase: 'relay-activation', operation, nodeId: 'relay', commitSha: run.mainSha });
    const receipt = await execute(context, operation, async (signal) => await context.effects.deployRelay({
      run,
      versionId: run.relay.uploadedVersionId,
      signal,
    }));
    run = complete({
      context,
      run,
      phase: 'relay-activation',
      operation,
      nodeId: 'relay',
      commitSha: run.mainSha,
      evidence: mutationReceiptEvidence(receipt),
      mutate: (next) => { next.relay.activeVersionId = next.relay.uploadedVersionId; },
    });
  }
  const relayVerifyReceipt = receiptForOperation(run, 'verify-relay');
  if (relayVerifyReceipt?.status !== 'succeeded') {
    const verifyOperation = 'verify-relay';
    run = begin({ context, run, phase: 'relay-activation', operation: verifyOperation, nodeId: 'relay', commitSha: run.mainSha });
    await execute(context, verifyOperation, async (signal) => await context.effects.verifyRelay({
      run,
      expectedReleaseSha: String(run.mainSha),
      expectedVersionId: run.relay.activeVersionId,
      signal,
    }));
    run = complete({
      context,
      run,
      phase: 'relay-activation',
      operation: verifyOperation,
      nodeId: 'relay',
      commitSha: run.mainSha,
      evidence: [{ key: 'verifiedVersionId', value: run.relay.activeVersionId }],
    });
  }

  const remoteNodeIds = run.nodes
    .map((node) => node.nodeId)
    .filter((nodeId) => nodeId !== context.effects.coordinatorNodeId)
    .sort();
  const activationNodeIds = [...remoteNodeIds, context.effects.coordinatorNodeId]
    .filter((nodeId) => run.nodes.some((node) => node.nodeId === nodeId));
  for (const nodeId of activationNodeIds) {
    const node = run.nodes.find((entry) => entry.nodeId === nodeId)!;
    const wasAlreadyActive = node.state === 'active' && node.activeReleaseSha === run.mainSha;
    if (node.state !== 'active' || node.activeReleaseSha !== run.mainSha) {
      const operation = `activate-node:${nodeId}`;
      run = begin({ context, run, phase: 'node-activation', operation, nodeId, commitSha: run.mainSha });
      const command = requiredNodeCommand({
        run,
        nodeId,
        action: 'activate',
        targetCommit: String(run.mainSha),
        expectedCommit: String(node.priorReleaseSha),
      });
      const receipt = parseDeliveryNodeReceipt(await execute(
        context,
        operation,
        async (signal) => await context.effects.dispatchNode({ nodeId, command, signal }),
      ));
      if (receipt.status !== 'complete' || receipt.activeCommit !== run.mainSha) {
        throw new DeliveryCoordinatorError('delivery_node_activation_incomplete', `Node ${nodeId} did not activate.`, 'node-activation', nodeId);
      }
      run = complete({
        context,
        run,
        phase: 'node-activation',
        operation,
        nodeId,
        commitSha: run.mainSha,
        evidence: nodeReceiptEvidence(receipt),
        mutate: (next) => {
          const target = next.nodes.find((entry) => entry.nodeId === nodeId)!;
          target.activeReleaseSha = next.mainSha;
          target.state = 'active';
          if (!next.activationOrder.includes(nodeId)) next.activationOrder.push(nodeId);
        },
      });
    }
    const verifyOperation = `verify-node:${nodeId}`;
    if (receiptForOperation(run, verifyOperation)?.status === 'succeeded') continue;
    run = begin({ context, run, phase: 'node-activation', operation: verifyOperation, nodeId, commitSha: run.mainSha });
    const verified = await execute(context, verifyOperation, async (signal) => await context.effects.verifyNode({
      run,
      nodeId,
      expectedReleaseSha: String(run.mainSha),
      previousProcessIdentity: wasAlreadyActive ? '' : node.processIdentity,
      signal,
    }));
    if (
      verified.activeReleaseSha !== run.mainSha
      || (!wasAlreadyActive && verified.processIdentity === node.processIdentity)
      || !verified.ready
      || !verified.catalogReady
      || verified.federationPhase !== 'connected'
      || !verified.converged
    ) {
      throw new DeliveryCoordinatorError('delivery_node_verification_failed', `Node ${nodeId} failed restart verification.`, 'node-activation', nodeId);
    }
    run = complete({
      context,
      run,
      phase: 'node-activation',
      operation: verifyOperation,
      nodeId,
      commitSha: run.mainSha,
      evidence: [
        { key: 'processIdentity', value: verified.processIdentity },
        { key: 'activeReleaseSha', value: verified.activeReleaseSha },
      ],
      mutate: (next) => {
        next.nodes = next.nodes.map((entry) => entry.nodeId === nodeId
          ? { ...entry, activeReleaseSha: next.mainSha, processIdentity: verified.processIdentity, state: 'active' }
          : entry);
      },
    });
  }

  const authorityOperation = 'final-authority';
  run = begin({ context, run, phase: 'final-verification', operation: authorityOperation, commitSha: run.mainSha });
  const authority = await execute(context, authorityOperation, async (signal) => await context.effects.observeAuthority({ run, signal }));
  assertDeliveryTopologyUnchanged({
    capturedAt: run.topology.capturedAt,
    fingerprint: run.topology.fingerprint,
    activeNodes: authority.topology.activeNodes,
    zeroProjectNodes: authority.topology.zeroProjectNodes,
  }, authority.topology);
  run = persist(context, reconcileDeliveryAuthority(run, authority));
  const verificationOperation = 'final-verification';
  if (receiptForOperation(run, verificationOperation)?.status !== 'succeeded') {
    run = begin({ context, run, phase: 'final-verification', operation: verificationOperation, commitSha: run.mainSha });
    await execute(context, verificationOperation, async (signal) => await context.effects.verifyFinal({ run, authority, signal }));
    run = complete({
      context,
      run,
      phase: 'final-verification',
      operation: verificationOperation,
      commitSha: run.mainSha,
      evidence: [{ key: 'releaseSha', value: run.mainSha }],
    });
  }
  if (
    authority.originMainSha !== run.mainSha
    || authority.relay.activeVersionId !== run.relay.activeVersionId
    || authority.relay.releaseSha !== run.mainSha
    || run.nodes.some((node) => node.state !== 'active' || node.activeReleaseSha !== run.mainSha)
  ) throw new DeliveryCoordinatorError('delivery_final_verification_failed', 'Final release authorities do not agree.', 'final-verification');
  run = complete({
    context,
    run,
    phase: 'final-verification',
    operation: authorityOperation,
    commitSha: run.mainSha,
    evidence: [
      { key: 'observedAt', value: authority.observedAt },
      { key: 'topologyFingerprint', value: authority.topology.fingerprint },
    ],
  });
  run = persist(context, {
    ...run,
    phase: 'complete',
    status: 'complete',
    failure: null,
  });
  return run;
}
