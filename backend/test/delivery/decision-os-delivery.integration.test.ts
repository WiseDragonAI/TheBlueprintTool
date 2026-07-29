/**
 * WHAT: Fault-injects every forward delivery mutation and verifies exact resume plus reverse compensation.
 * WHY: Production effects must be idempotent across failures, crashes, timeouts, lost responses, and restarts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { RepositoryMutationLock } from '../../src/business/content-authoring/helper/repository-mutation-lock.js';
import { advanceDecisionOsDelivery } from '../../src/business/delivery/helper/delivery-forward-state-machine.js';
import {
  DeliveryInterruptedError,
  phaseReceipt,
  reconcileDeliveryAuthority,
  type DeliveryAuthoritySnapshot,
  type DeliveryCoordinatorEffects,
  type DeliveryMutationReceipt,
} from '../../src/business/delivery/helper/delivery-coordinator.js';
import { createDeliveryRunStore } from '../../src/business/delivery/helper/delivery-run-store.js';
import { freezeDeliveryTopology } from '../../src/business/delivery/controller/delivery-topology-controller.js';
import {
  rollbackDecisionOsDelivery,
  rollbackStoredDecisionOsDelivery,
} from '../../src/business/delivery/controller/rollback-decision-os-delivery.js';
import { promoteDecisionOsDelivery } from '../../src/business/delivery/controller/promote-decision-os-delivery.js';
import { resumeDecisionOsDelivery } from '../../src/business/delivery/controller/resume-decision-os-delivery.js';
import { createRuntimeIncidentLedger } from '../../src/business/server/helper/runtime-incident-ledger.js';
import {
  decisionOsDeliveryProtocol,
  parseDeliveryNodeReceipt,
  type DeliveryNodeCommand,
  type DeliveryNodeReceipt,
  type DeliveryRun,
} from '../../../shared/schemas/decision-os-delivery-types.js';
import { admittedSha, priorSha } from './delivery-test-fixtures.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../src/business/task-state/helper/task-current-state-types.js';

const mainSha = 'c'.repeat(40);
const priorRelayVersion = 'relay-version-prior';
const uploadedRelayVersion = 'relay-version-target';
const observedAt = '2026-07-28T00:00:00.000Z';
const topology = freezeDeliveryTopology({
  capturedAt: observedAt,
  nodes: [
    {
      nodeId: 'phone',
      nodeLabel: 'Phone',
      online: true,
      projects: [{ projectId: 'mobile', originFingerprint: '1'.repeat(64) }],
    },
    {
      nodeId: 'workstation',
      nodeLabel: 'Workstation',
      online: true,
      projects: [{ projectId: 'decision-os', originFingerprint: '2'.repeat(64) }],
    },
  ],
});

const releaseHealth = (releaseSha: string) => ({
  ok: true,
  status: 'ready',
  observedAt,
  releaseSha,
  processStartedAt: observedAt,
  deliveryProtocol: 1,
  activeReleasePointer: `current:${releaseSha}`,
  activeIncidentCount: 0,
});

const relayHealth = (releaseSha: string) => ({
  ok: true,
  status: 'ready',
  service: 'decision-os-federation-relay',
  observedAt,
  releaseSha,
  deliveryProtocol: 1,
  protocolVersion: 1,
  stateProtocol: taskStateProtocol,
  stateSchema: taskCurrentStateVersion,
  baselineEpoch: taskCurrentBaselineEpoch,
  environment: 'dev',
  workerName: 'relay-dev',
  durableObjectNamespace: 'namespace-dev',
});

const relayConfiguration = () => ({
  observedAt,
  configurationHash: 'f'.repeat(64),
  wranglerVersion: '4.111.0',
  productionWorkerName: 'relay-production',
  devWorkerName: 'relay-dev',
  productionDurableObjectNamespace: 'namespace-production',
  devDurableObjectNamespace: 'namespace-dev',
});

const nodeAdmission = (nodeId: string, projectIds: string[]) => ({
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
});

const admissionEvidence = () => ({
  topology,
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
  devRelayHealth: relayHealth(admittedSha),
  relayConfiguration: relayConfiguration(),
  nodeEvidence: topology.activeNodes.map((node) => nodeAdmission(node.nodeId, node.projects.map((project) => project.projectId))),
  proofs: ['authoring', 'editor', 'direct-path', 'prompt-execution', 'federation'].map((proof) => ({
    proof: proof as 'authoring' | 'editor' | 'direct-path' | 'prompt-execution' | 'federation',
    status: 'passed' as const,
    releaseSha: admittedSha,
    observedAt,
    receiptId: `proof-${proof}`,
  })),
});

type FaultMode = 'fail-before' | 'crash-after' | 'timeout-before' | 'timeout-after' | 'lost-after';
type MutationOperation =
  | 'promote-main'
  | 'prepare-node:phone'
  | 'prepare-node:workstation'
  | 'upload-relay'
  | 'activate-relay'
  | 'activate-node:phone'
  | 'activate-node:workstation'
  | 'rollback-node:phone'
  | 'rollback-node:workstation'
  | 'rollback-relay';

function mutation(input: {
  mutation: string;
  targetSha: string;
  predecessor: string;
  resultIdentity: string;
}): DeliveryMutationReceipt {
  return {
    ...input,
    receiptId: `external-${input.mutation.replaceAll(':', '-')}`,
    observedAt,
  };
}

function admittedRun(deliveryId: string): DeliveryRun {
  const base: DeliveryRun = {
    protocol: decisionOsDeliveryProtocol,
    deliveryId,
    admittedSha,
    priorMainSha: priorSha,
    mainSha: null,
    phase: 'admission',
    status: 'running',
    createdAt: observedAt,
    updatedAt: observedAt,
    topology: {
      capturedAt: topology.capturedAt,
      fingerprint: topology.fingerprint,
      admittedNodeIds: ['phone', 'workstation'],
      zeroProjectNodeIds: [],
    },
    relay: { priorDeploymentId: '', uploadedVersionId: '', activeVersionId: '' },
    nodes: ['phone', 'workstation'].map((nodeId) => ({
      nodeId,
      priorReleaseSha: priorSha,
      stagedReleaseSha: null,
      activeReleaseSha: priorSha,
      processIdentity: `${nodeId}-process-prior`,
      state: 'admitted' as const,
    })),
    activationOrder: [],
    phaseReceipts: [],
    compensationReceipts: [],
    artifactPaths: [],
    deadlines: [],
    retries: [],
    failure: null,
  };
  base.phaseReceipts.push(phaseReceipt({
    run: base,
    phase: 'admission',
    operation: 'admit-exact-release',
    status: 'succeeded',
    now: new Date(observedAt),
    nodeId: 'coordinator',
    commitSha: admittedSha,
  }));
  return base;
}

function nodeReceipt(
  deliveryId: string,
  nodeId: string,
  command: DeliveryNodeCommand,
  activeCommit: string,
  processIdentity: string,
): DeliveryNodeReceipt {
  return parseDeliveryNodeReceipt({
    protocol: 1,
    receiptId: `receipt-${command.action}-${nodeId}`,
    deliveryId,
    nodeId,
    action: command.action,
    targetCommit: command.targetCommit,
    expectedCommit: command.expectedCommit,
    status: 'complete',
    attempt: 1,
    startedAt: observedAt,
    completedAt: '2026-07-28T00:00:01.000Z',
    previousCommit: command.expectedCommit,
    activeCommit,
    processIdentity,
    command: null,
    evidence: [],
    error: null,
  });
}

function fakeDeliveryEffects(fault: {
  operation: MutationOperation | null;
  mode: FaultMode | null;
}) {
  const counts = new Map<string, number>();
  const receipts = new Map<string, DeliveryNodeReceipt>();
  const active = new Map([['phone', priorSha], ['workstation', priorSha]]);
  const processes = new Map([['phone', 'phone-process-prior'], ['workstation', 'workstation-process-prior']]);
  let promoted = false;
  let uploaded = false;
  let relayActive = false;
  let relayRollbackReceipt: DeliveryMutationReceipt | null = null;
  const calls: string[] = [];

  const waitForAbort = async (signal: AbortSignal): Promise<never> => await new Promise((_resolve, reject) => {
    const abort = (): void => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });

  const mutate = async <T>(
    operation: MutationOperation,
    signal: AbortSignal,
    apply: () => T,
  ): Promise<T> => {
    calls.push(operation);
    if (fault.operation === operation && fault.mode === 'fail-before') throw Object.assign(new Error('injected failure'), { code: 'delivery_injected_failure' });
    if (fault.operation === operation && fault.mode === 'timeout-before') return await waitForAbort(signal);
    const result = apply();
    counts.set(operation, (counts.get(operation) ?? 0) + 1);
    if (fault.operation === operation && fault.mode === 'crash-after') throw new DeliveryInterruptedError('compensation', operation);
    if (fault.operation === operation && fault.mode === 'lost-after') throw Object.assign(new Error('lost response'), { code: 'delivery_response_lost' });
    if (fault.operation === operation && fault.mode === 'timeout-after') return await waitForAbort(signal);
    return result;
  };

  const authority = (run: DeliveryRun): DeliveryAuthoritySnapshot => ({
    observedAt: '2026-07-28T00:00:02.000Z',
    originDevSha: admittedSha,
    originMainSha: promoted ? mainSha : priorSha,
    topology,
    gitPromotion: promoted ? mutation({
      mutation: 'promote-main',
      targetSha: admittedSha,
      predecessor: priorSha,
      resultIdentity: mainSha,
    }) : null,
    relay: {
      activeVersionId: relayActive ? uploadedRelayVersion : priorRelayVersion,
      releaseSha: relayActive ? mainSha : priorSha,
      upload: uploaded ? mutation({
        mutation: 'upload-relay',
        targetSha: mainSha,
        predecessor: 'relay-deployment-prior',
        resultIdentity: uploadedRelayVersion,
      }) : null,
      activation: relayActive ? mutation({
        mutation: 'activate-relay',
        targetSha: mainSha,
        predecessor: 'relay-deployment-prior',
        resultIdentity: uploadedRelayVersion,
      }) : null,
      rollback: relayRollbackReceipt,
    },
    nodes: ['phone', 'workstation'].map((nodeId) => ({
      nodeId,
      activeReleaseSha: active.get(nodeId)!,
      processIdentity: processes.get(nodeId)!,
      ready: true,
      catalogReady: true,
      federationPhase: 'connected',
      converged: true,
      receipts: [...receipts.values()].filter((receipt) => receipt.nodeId === nodeId),
    })),
  });

  const effects: DeliveryCoordinatorEffects = {
    coordinatorNodeId: 'workstation',
    async preflightGit() { throw new Error('preflight must not repeat after admission'); },
    async collectAdmission() { throw new Error('admission must not repeat'); },
    async promoteMain({ signal }) {
      return await mutate('promote-main', signal, () => {
        promoted = true;
        return {
          mainSha,
          receipt: mutation({
            mutation: 'promote-main',
            targetSha: admittedSha,
            predecessor: priorSha,
            resultIdentity: mainSha,
          }),
        };
      });
    },
    async dispatchNode({ nodeId, command, signal }) {
      const operation = `${command.action}-node:${nodeId}` as MutationOperation;
      return await mutate(operation, signal, () => {
        const key = `${command.action}:${nodeId}`;
        const existing = receipts.get(key);
        if (existing) return existing;
        if (command.action === 'prepare') {
          const receipt = nodeReceipt(command.deliveryId, nodeId, command, active.get(nodeId)!, processes.get(nodeId)!);
          receipts.set(key, receipt);
          return receipt;
        }
        if (command.action === 'activate') {
          active.set(nodeId, command.targetCommit);
          processes.set(nodeId, `${nodeId}-process-target`);
          const receipt = nodeReceipt(command.deliveryId, nodeId, command, command.targetCommit, processes.get(nodeId)!);
          receipts.set(key, receipt);
          return receipt;
        }
        if (command.action === 'rollback') {
          active.set(nodeId, command.targetCommit);
          processes.set(nodeId, `${nodeId}-process-rollback`);
          const receipt = nodeReceipt(command.deliveryId, nodeId, command, command.targetCommit, processes.get(nodeId)!);
          receipts.set(key, receipt);
          return receipt;
        }
        throw new Error(`unexpected action ${command.action}`);
      });
    },
    async readRelayDeployment() {
      calls.push('read-relay-predecessor');
      return { deploymentId: 'relay-deployment-prior', versionId: priorRelayVersion };
    },
    async uploadRelay({ signal }) {
      return await mutate('upload-relay', signal, () => {
        uploaded = true;
        return {
          versionId: uploadedRelayVersion,
          receipt: mutation({
            mutation: 'upload-relay',
            targetSha: mainSha,
            predecessor: 'relay-deployment-prior',
            resultIdentity: uploadedRelayVersion,
          }),
        };
      });
    },
    async deployRelay({ signal }) {
      return await mutate('activate-relay', signal, () => {
        relayActive = true;
        return mutation({
          mutation: 'activate-relay',
          targetSha: mainSha,
          predecessor: 'relay-deployment-prior',
          resultIdentity: uploadedRelayVersion,
        });
      });
    },
    async rollbackRelay({ signal }) {
      return await mutate('rollback-relay', signal, () => {
        relayActive = false;
        relayRollbackReceipt = mutation({
          mutation: 'rollback-relay',
          targetSha: mainSha,
          predecessor: uploadedRelayVersion,
          resultIdentity: priorRelayVersion,
        });
        return relayRollbackReceipt;
      });
    },
    async verifyRelay() {
      if (!relayActive) throw new Error('relay not active');
    },
    async verifyRelayRollback() {
      if (relayActive) throw new Error('relay rollback failed');
    },
    async verifyNode({ run, nodeId, expectedReleaseSha }) {
      return authority(run).nodes.find((node) => node.nodeId === nodeId && node.activeReleaseSha === expectedReleaseSha)!;
    },
    async observeAuthority({ run }) {
      return authority(run);
    },
    async verifyFinal({ run }) {
      assert.equal(promoted, true);
      assert.equal(relayActive, true);
      assert.equal([...active.values()].every((sha) => sha === run.mainSha), true);
    },
  };
  return { effects, authority, counts, calls, active, processes, receipts, relayActive: () => relayActive };
}

function fakeRepositoryLock(): RepositoryMutationLock {
  return {
    lockDirectory: '/fixture/.git/decision-os-mutation.lock',
    context: {
      root: '/fixture',
      commonDirectory: '/fixture/.git',
      gitDirectory: '/fixture/.git',
      indexFile: '/fixture/.git/index',
      file: '/fixture/.git/decision-os-mutation.lock',
    },
    owner: {
      protocol: 1,
      token: '00000000-0000-4000-8000-000000000000',
      pid: 1,
      processIdentity: 'fixture',
      purpose: 'decision-os-delivery:test',
      acquiredAt: observedAt,
      headSha: priorSha,
    },
    release() {},
  } as unknown as RepositoryMutationLock;
}

const mutationOperations: MutationOperation[] = [
  'promote-main',
  'prepare-node:phone',
  'prepare-node:workstation',
  'upload-relay',
  'activate-relay',
  'activate-node:phone',
  'activate-node:workstation',
];
const faultModes: FaultMode[] = ['fail-before', 'crash-after', 'timeout-before', 'timeout-after', 'lost-after'];

test('resumes every fail, crash, timeout, and lost-response boundary without duplicating external mutations', async (context) => {
  for (const operation of mutationOperations) {
    for (const mode of faultModes) {
      await context.test(`${mode}:${operation}`, async () => {
        const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-matrix-'));
        try {
          const runStore = createDeliveryRunStore({ catalogRoot: root });
          const initial = runStore.create(admittedRun(`delivery-${mode}-${operation.replaceAll(':', '-')}`));
          const fault = { operation: operation as MutationOperation | null, mode: mode as FaultMode | null };
          const fake = fakeDeliveryEffects(fault);
          const runOnce = async (run: DeliveryRun) => await advanceDecisionOsDelivery(run, {
            runStore,
            effects: fake.effects,
            repositoryLock: fakeRepositoryLock(),
            now: () => new Date(),
            deadlineMs: 100,
          });
          await assert.rejects(runOnce(initial));
          let interrupted = runStore.require(initial.deliveryId);
          const observed = fake.authority(interrupted);
          const reconciled = reconcileDeliveryAuthority(interrupted, observed);
          if (JSON.stringify(reconciled) !== JSON.stringify(interrupted)) {
            interrupted = runStore.write({ ...reconciled, updatedAt: new Date().toISOString() });
          }
          fault.operation = null;
          fault.mode = null;
          const completed = await runOnce(interrupted);
          assert.equal(completed.status, 'complete');
          assert.deepEqual(completed.activationOrder, ['phone', 'workstation']);
          assert.equal((fake.counts.get(operation) ?? 0) <= 1, true);
          const receipts = completed.phaseReceipts.filter((receipt) => receipt.operation === operation);
          assert.deepEqual(receipts.map((receipt) => receipt.status), ['started', 'succeeded']);
          assert.equal(completed.retries.find((entry) => entry.operation === operation)?.attempts! >= 1, true);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});

test('reads Cloudflare credentials and current deployment before the first main mutation', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-preflight-order-'));
  try {
    const runStore = createDeliveryRunStore({ catalogRoot: root });
    const fake = fakeDeliveryEffects({ operation: null, mode: null });
    fake.effects.collectAdmission = async () => admissionEvidence();
    await advanceDecisionOsDelivery(runStore.create(admittedRun('delivery-preflight-order')), {
      runStore,
      effects: fake.effects,
      repositoryLock: fakeRepositoryLock(),
      now: () => new Date(observedAt),
      deadlineMs: 500,
    });
    assert.equal(fake.calls.indexOf('read-relay-predecessor') < fake.calls.indexOf('promote-main'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('external admission and verification reads persist one stable started-to-terminal receipt pair', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-read-receipts-'));
  try {
    const runStore = createDeliveryRunStore({ catalogRoot: root });
    const fake = fakeDeliveryEffects({ operation: null, mode: null });
    fake.effects.collectAdmission = async () => admissionEvidence();
    const initial = admittedRun('delivery-read-receipts');
    initial.phaseReceipts = [];
    const completed = await advanceDecisionOsDelivery(runStore.create(initial), {
      runStore,
      effects: fake.effects,
      repositoryLock: fakeRepositoryLock(),
      now: () => new Date(observedAt),
      deadlineMs: 500,
    });
    for (const operation of [
      'collect-admission',
      'verify-relay',
      'verify-node:phone',
      'verify-node:workstation',
      'final-authority',
      'final-verification',
    ]) {
      const receipts = completed.phaseReceipts.filter((receipt) => receipt.operation === operation);
      assert.deepEqual(receipts.map((receipt) => receipt.status), ['started', 'succeeded'], operation);
      assert.equal(new Set(receipts.map((receipt) => receipt.receiptId)).size, 1, operation);
      assert.equal(completed.retries.find((entry) => entry.operation === operation)?.attempts, 1, operation);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('controller compensates a pointer-mutated node whose restart verification fails', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-controller-compensation-'));
  try {
    const runStore = createDeliveryRunStore({ catalogRoot: root });
    const fake = fakeDeliveryEffects({ operation: null, mode: null });
    const baseAuthority = fake.effects.observeAuthority;
    const baseVerifyNode = fake.effects.verifyNode;
    let releases = 0;
    const nodeEvidence = (nodeId: string, projectIds: string[]) => ({
      nodeId,
      observedAt,
      projectIds,
      release: {
        ok: true,
        status: 'ready',
        observedAt,
        releaseSha: priorSha,
        processStartedAt: observedAt,
        deliveryProtocol: 1,
        activeReleasePointer: `current:${priorSha}`,
        activeIncidentCount: 0,
      },
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
    });
    const effects: DeliveryCoordinatorEffects = {
      ...fake.effects,
      async preflightGit() {
        return {
          priorMainSha: priorSha,
          originDevSha: admittedSha,
          receipt: mutation({
            mutation: 'preflight-git',
            targetSha: admittedSha,
            predecessor: priorSha,
            resultIdentity: admittedSha,
          }),
        };
      },
      async collectAdmission() {
        return {
          topology,
          candidate: {
            observedAt,
            releaseSha: admittedSha,
            originDevSha: admittedSha,
            originMainSha: priorSha,
            clean: true,
            mainIsAncestor: true,
          },
          productionHealth: {
            ok: true,
            status: 'ready',
            observedAt,
            releaseSha: priorSha,
            processStartedAt: observedAt,
            deliveryProtocol: 1,
            activeReleasePointer: `current:${priorSha}`,
            activeIncidentCount: 0,
          },
          canaryHealth: {
            ok: true,
            status: 'ready',
            observedAt,
            releaseSha: admittedSha,
            processStartedAt: observedAt,
            deliveryProtocol: 1,
            activeReleasePointer: `current:${admittedSha}`,
            activeIncidentCount: 0,
          },
          devRelayHealth: {
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
            workerName: 'relay-dev',
            durableObjectNamespace: 'dev-state',
          },
          relayConfiguration: {
            observedAt,
            configurationHash: '4'.repeat(64),
            wranglerVersion: '4.111.0',
            productionWorkerName: 'relay-production',
            devWorkerName: 'relay-dev',
            productionDurableObjectNamespace: 'production-state',
            devDurableObjectNamespace: 'dev-state',
          },
          nodeEvidence: [
            nodeEvidence('phone', ['mobile']),
            nodeEvidence('workstation', ['decision-os']),
          ],
          proofs: (['authoring', 'editor', 'direct-path', 'prompt-execution', 'federation'] as const).map((proof) => ({
            proof,
            status: 'passed' as const,
            releaseSha: admittedSha,
            observedAt,
            receiptId: `proof-${proof}`,
          })),
        };
      },
      async verifyNode(input) {
        if (input.expectedReleaseSha === mainSha && input.nodeId === 'phone') {
          throw Object.assign(new Error('restart verification failed'), { code: 'delivery_node_verification_failed' });
        }
        return await baseVerifyNode(input);
      },
      async observeAuthority(input) {
        const authority = await baseAuthority(input);
        const phone = authority.nodes.find((node) => node.nodeId === 'phone');
        if (phone?.activeReleaseSha === mainSha) phone.ready = false;
        return authority;
      },
    };
    const result = await promoteDecisionOsDelivery({
      catalogRoot: root,
      repositoryRoot: root,
      releaseSha: admittedSha,
      effects,
      runStore,
      now: () => new Date(observedAt),
      deadlineMs: 500,
      acquireLease: async () => ({
        file: resolve(root, '.decision-os/delivery/lock'),
        record: {} as never,
        repositoryLock: fakeRepositoryLock(),
        renew: () => ({} as never),
        release: () => { releases += 1; },
      }),
    });
    assert.equal(result.status, 'rolled-back-runtime', JSON.stringify(result.failure));
    assert.equal(fake.calls.includes('rollback-node:phone'), true);
    assert.equal(result.activationOrder.includes('phone'), true);
    assert.equal(releases, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('compensation-failed retains the lease and matching resume completes compensation through controllers', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-controller-resume-compensation-'));
  try {
    const runStore = createDeliveryRunStore({ catalogRoot: root });
    const fault = { operation: null as MutationOperation | null, mode: null as FaultMode | null };
    const fake = fakeDeliveryEffects(fault);
    const completed = await advanceDecisionOsDelivery(runStore.create(admittedRun('delivery-controller-resume-compensation')), {
      runStore,
      effects: fake.effects,
      repositoryLock: fakeRepositoryLock(),
      now: () => new Date(),
      deadlineMs: 500,
    });
    runStore.write({
      ...completed,
      phase: 'node-activation',
      status: 'running',
      failure: null,
      updatedAt: new Date().toISOString(),
    });
    let releases = 0;
    const resumeLease = async () => ({
      file: resolve(root, '.decision-os/delivery/lock'),
      record: {} as never,
      repositoryLock: fakeRepositoryLock(),
      renew: () => ({} as never),
      release: () => { releases += 1; },
    });
    fault.operation = 'rollback-node:workstation';
    fault.mode = 'fail-before';
    const failed = await rollbackStoredDecisionOsDelivery({
      catalogRoot: root,
      repositoryRoot: root,
      deliveryId: completed.deliveryId,
      effects: fake.effects,
      runStore,
      resumeLease,
      now: () => new Date(),
      deadlineMs: 500,
    });
    assert.equal(failed.status, 'compensation-failed');
    assert.equal(releases, 0);
    fault.operation = null;
    fault.mode = null;
    const resumed = await resumeDecisionOsDelivery({
      catalogRoot: root,
      repositoryRoot: root,
      deliveryId: completed.deliveryId,
      effects: fake.effects,
      runStore,
      resumeLease,
      now: () => new Date(),
      deadlineMs: 500,
    });
    assert.equal(resumed.status, 'rolled-back-runtime');
    assert.equal(releases, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('compensates activated nodes in reverse order, then relay, while preserving published main', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-rollback-'));
  try {
    const runStore = createDeliveryRunStore({ catalogRoot: root });
    const fake = fakeDeliveryEffects({ operation: null, mode: null });
    const completed = await advanceDecisionOsDelivery(
      runStore.create(admittedRun('delivery-rollback-order')),
      {
        runStore,
        effects: fake.effects,
        repositoryLock: fakeRepositoryLock(),
        now: () => new Date(),
        deadlineMs: 500,
      },
    );
    const running = runStore.write({
      ...completed,
      phase: 'node-activation',
      status: 'running',
      failure: null,
      updatedAt: new Date().toISOString(),
    });
    fake.calls.length = 0;
    const rolledBack = await rollbackDecisionOsDelivery({
      run: running,
      runStore,
      effects: fake.effects,
      incidentLedger: createRuntimeIncidentLedger({ decisionOsRoot: resolve(root, '.decision-os') }),
      now: () => new Date(),
      deadlineMs: 500,
    });
    assert.equal(rolledBack.status, 'rolled-back-runtime');
    assert.equal(rolledBack.mainSha, mainSha);
    assert.deepEqual(fake.calls.filter((entry) => entry.startsWith('rollback')), [
      'rollback-node:workstation',
      'rollback-node:phone',
      'rollback-relay',
    ]);
    assert.equal(rolledBack.nodes.every((node) => node.state === 'rolled-back' && node.activeReleaseSha === priorSha), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resumes every node and relay compensation mutation boundary without duplicate rollback', async (context) => {
  const rollbackOperations: MutationOperation[] = [
    'rollback-node:workstation',
    'rollback-node:phone',
    'rollback-relay',
  ];
  for (const operation of rollbackOperations) {
    for (const mode of faultModes) {
      await context.test(`${mode}:${operation}`, async () => {
        const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-compensation-matrix-'));
        try {
          const runStore = createDeliveryRunStore({ catalogRoot: root });
          const fault = { operation: null as MutationOperation | null, mode: null as FaultMode | null };
          const fake = fakeDeliveryEffects(fault);
          const completed = await advanceDecisionOsDelivery(
            runStore.create(admittedRun(`delivery-compensation-${mode}-${operation.replaceAll(':', '-')}`)),
            {
              runStore,
              effects: fake.effects,
              repositoryLock: fakeRepositoryLock(),
              now: () => new Date(),
              deadlineMs: 500,
            },
          );
          let run = runStore.write({
            ...completed,
            phase: 'node-activation',
            status: 'running',
            failure: null,
            updatedAt: new Date().toISOString(),
          });
          fault.operation = operation;
          fault.mode = mode;
          run = await rollbackDecisionOsDelivery({
            run,
            runStore,
            effects: fake.effects,
            incidentLedger: createRuntimeIncidentLedger({ decisionOsRoot: resolve(root, '.decision-os') }),
            now: () => new Date(),
            deadlineMs: 100,
          });
          assert.equal(run.status, 'compensation-failed');
          fault.operation = null;
          fault.mode = null;
          run = await rollbackDecisionOsDelivery({
            run,
            runStore,
            effects: fake.effects,
            incidentLedger: createRuntimeIncidentLedger({ decisionOsRoot: resolve(root, '.decision-os') }),
            now: () => new Date(),
            deadlineMs: 500,
          });
          assert.equal(run.status, 'rolled-back-runtime');
          assert.equal(run.mainSha, mainSha);
          assert.equal((fake.counts.get(operation) ?? 0) <= 1, true);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});
