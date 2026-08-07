/**
 * WHAT: Exercises the canonical delivery controllers against run-local coordinator, relay, and node authorities.
 * WHY: Release proof must demonstrate success, crash recovery, and rollback without contacting shared dev or production systems.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { RepositoryMutationLock } from '../../content-authoring/helper/repository-mutation-lock.js';
import {
  deliveryAdmissionProofNames,
  type DeliveryAdmissionProof,
  type DeliveryNodeAdmissionEvidence,
  type DeliveryRelayConfigurationEvidence,
  type DeliveryRelayHealth,
  type DeliveryReleaseHealth,
} from '../controller/delivery-admission-controller.js';
import { freezeDeliveryTopology } from '../controller/delivery-topology-controller.js';
import { promoteDecisionOsDelivery } from '../controller/promote-decision-os-delivery.js';
import { resumeDecisionOsDelivery } from '../controller/resume-decision-os-delivery.js';
import { rollbackStoredDecisionOsDelivery } from '../controller/rollback-decision-os-delivery.js';
import {
  DeliveryInterruptedError,
  type DeliveryAuthoritySnapshot,
  type DeliveryCoordinatorEffects,
  type DeliveryMutationReceipt,
  type DeliveryNodeAuthority,
} from './delivery-coordinator.js';
import { createDeliveryRunStore } from './delivery-run-store.js';
import type { DeliveryLease } from './delivery-lease.js';
import type { ReleaseCanaryGitReceipt } from './release-canary-git-sandbox.js';
import {
  parseDeliveryNodeReceipt,
  parseDeliveryRun,
  type DeliveryNodeCommand,
  type DeliveryNodeReceipt,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../task-state/helper/task-current-state-types.js';

type DeliveryProofPhase = 'delivery-success' | 'delivery-resume' | 'delivery-rollback';

export type ReleaseCanaryDeliveryPhaseEvidence = {
  receiptFile: string;
  receiptId: string;
};

export type ReleaseCanaryDeliveryProof = Record<DeliveryProofPhase, ReleaseCanaryDeliveryPhaseEvidence>;

type Fault = { operation: 'activate-relay' | null; armed: boolean };

const coordinatorNodeId = 'canary-coordinator';
const projectId = 'canary-project';
const priorRelayVersion = 'canary-relay-prior';
const candidateRelayVersion = 'canary-relay-candidate';

function mutation(input: {
  operation: string;
  targetSha: string;
  predecessor: string;
  resultIdentity: string;
  observedAt: string;
}): DeliveryMutationReceipt {
  return {
    receiptId: `canary-${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32)}`,
    mutation: input.operation,
    targetSha: input.targetSha,
    predecessor: input.predecessor,
    resultIdentity: input.resultIdentity,
    observedAt: input.observedAt,
  };
}

function releaseHealth(releaseSha: string, observedAt: string): DeliveryReleaseHealth {
  return {
    ok: true,
    status: 'ready',
    observedAt,
    releaseSha,
    processStartedAt: observedAt,
    deliveryProtocol: 1,
    activeReleasePointer: `current:${releaseSha}`,
    activeIncidentCount: 0,
  };
}

function nodeReceipt(input: {
  command: DeliveryNodeCommand;
  activeCommit: string;
  processIdentity: string;
  observedAt: string;
}): DeliveryNodeReceipt {
  return parseDeliveryNodeReceipt({
    protocol: 1,
    receiptId: `canary-node-${input.command.action}-${createHash('sha256').update(JSON.stringify(input.command)).digest('hex').slice(0, 24)}`,
    deliveryId: input.command.deliveryId,
    nodeId: coordinatorNodeId,
    action: input.command.action,
    targetCommit: input.command.targetCommit,
    expectedCommit: input.command.expectedCommit,
    status: 'complete',
    attempt: 1,
    startedAt: input.observedAt,
    completedAt: input.observedAt,
    previousCommit: input.command.expectedCommit,
    activeCommit: input.activeCommit,
    processIdentity: input.processIdentity,
    command: null,
    evidence: [],
    error: null,
  });
}

function createIsolatedEffects(input: {
  release: ReleaseCanaryGitReceipt;
  fault: Fault;
  now: () => Date;
}): { effects: DeliveryCoordinatorEffects; externalMutationCounts: Map<string, number> } {
  const { release } = input;
  const observedAt = (): string => input.now().toISOString();
  const topology = freezeDeliveryTopology({
    capturedAt: observedAt(),
    targetNodeId: coordinatorNodeId,
    nodes: [{
      nodeId: coordinatorNodeId,
      nodeLabel: 'Release canary coordinator',
      online: true,
      projects: [{ projectId, originFingerprint: '1'.repeat(64) }],
    }],
  });
  const relayConfiguration: DeliveryRelayConfigurationEvidence = {
    observedAt: observedAt(),
    configurationHash: '2'.repeat(64),
    wranglerVersion: '4.111.0',
    productionWorkerName: 'canary-production-never-contacted',
    devWorkerName: 'canary-isolated-relay',
    productionDurableObjectNamespace: 'canary-production-namespace-never-contacted',
    devDurableObjectNamespace: 'canary-isolated-namespace',
  };
  const nodeReceipts = new Map<string, DeliveryNodeReceipt>();
  const externalMutationCounts = new Map<string, number>();
  let activeNodeSha = release.priorMainSha;
  let processGeneration = 0;
  let relayUploaded = false;
  let relayActive = false;
  let relayRollbackReceipt: DeliveryMutationReceipt | null = null;

  const count = (operation: string): void => {
    externalMutationCounts.set(operation, (externalMutationCounts.get(operation) ?? 0) + 1);
  };
  const nodeAuthority = (): DeliveryNodeAuthority => ({
    nodeId: coordinatorNodeId,
    activeReleaseSha: activeNodeSha,
    processIdentity: `canary-process-${processGeneration}`,
    ready: true,
    catalogReady: true,
    federationPhase: 'connected',
    converged: true,
    receipts: [...nodeReceipts.values()],
  });
  const authority = (): DeliveryAuthoritySnapshot => ({
    observedAt: observedAt(),
    originDevSha: release.releaseSha,
    originMainSha: release.mainSha,
    mainReleaseExact: true,
    topology,
    relay: {
      activeVersionId: relayActive ? candidateRelayVersion : priorRelayVersion,
      releaseSha: relayActive ? release.mainSha : release.priorMainSha,
      upload: relayUploaded ? mutation({
        operation: 'upload-relay',
        targetSha: release.mainSha,
        predecessor: 'canary-relay-deployment-prior',
        resultIdentity: candidateRelayVersion,
        observedAt: observedAt(),
      }) : null,
      activation: relayActive ? mutation({
        operation: 'activate-relay',
        targetSha: release.mainSha,
        predecessor: 'canary-relay-deployment-prior',
        resultIdentity: candidateRelayVersion,
        observedAt: observedAt(),
      }) : null,
      rollback: relayRollbackReceipt,
    },
    nodes: [nodeAuthority()],
  });
  const admissionProofs = (): DeliveryAdmissionProof[] => deliveryAdmissionProofNames.map((proof) => ({
    proof,
    status: 'passed',
    releaseSha: release.releaseSha,
    observedAt: observedAt(),
    receiptId: `canary-proof-${proof}`,
  }));
  const nodeAdmission = (): DeliveryNodeAdmissionEvidence => ({
    nodeId: coordinatorNodeId,
    observedAt: observedAt(),
    projectIds: [projectId],
    release: releaseHealth(release.priorMainSha, observedAt()),
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
    convergedProjectIds: [projectId],
  });
  const relayHealth = (): DeliveryRelayHealth => ({
    ok: true,
    status: 'ready',
    service: 'decision-os-federation-relay',
    observedAt: observedAt(),
    releaseSha: release.releaseSha,
    deliveryProtocol: 1,
    protocolVersion: 1,
    stateProtocol: taskStateProtocol,
    stateSchema: taskCurrentStateVersion,
    baselineEpoch: taskCurrentBaselineEpoch,
    environment: 'dev',
    workerName: relayConfiguration.devWorkerName,
    durableObjectNamespace: relayConfiguration.devDurableObjectNamespace,
  });

  const effects: DeliveryCoordinatorEffects = {
    coordinatorNodeId,
    async preflightGit({ releaseSha }) {
      // WHAT: Reject any admitted SHA except the canonical paired dev release identity.
      // WHY: The sandbox receipt, not the coordinator simulation, owns release selection.
      if (releaseSha !== release.releaseSha) throw new Error('release_canary_delivery_sha_mismatch');
      return {
        priorMainSha: release.priorMainSha,
        originDevSha: release.releaseSha,
        mainSha: release.mainSha,
        receipt: mutation({
          operation: 'admit-main-release',
          targetSha: release.releaseSha,
          predecessor: release.priorMainSha,
          resultIdentity: release.mainSha,
          observedAt: observedAt(),
        }),
      };
    },
    async collectAdmission() {
      return {
        topology,
        candidate: {
          observedAt: observedAt(),
          releaseSha: release.releaseSha,
          originDevSha: release.releaseSha,
          originMainSha: release.priorMainSha,
          clean: true,
          mainIsAncestor: true,
        },
        productionHealth: releaseHealth(release.priorMainSha, observedAt()),
        canaryHealth: releaseHealth(release.releaseSha, observedAt()),
        devRelayHealth: relayHealth(),
        relayConfiguration: { ...relayConfiguration, observedAt: observedAt() },
        nodeEvidence: [nodeAdmission()],
        proofs: admissionProofs(),
      };
    },
    async dispatchNode({ command }) {
      const key = `${command.action}:${command.targetCommit}:${command.expectedCommit}`;
      const existing = nodeReceipts.get(key);
      // WHAT: Reuse the exact prior external receipt for an identical node command.
      // WHY: Resume must prove idempotency rather than repeat an acknowledged mutation.
      if (existing) return existing;
      // WHAT: Advance the isolated node pointer only for activation and rollback commands.
      // WHY: Preparation stages bytes without changing runtime authority.
      if (command.action === 'activate' || command.action === 'rollback') {
        activeNodeSha = command.targetCommit;
        processGeneration += 1;
      }
      count(`${command.action}-node`);
      const receipt = nodeReceipt({
        command,
        activeCommit: activeNodeSha,
        processIdentity: `canary-process-${processGeneration}`,
        observedAt: observedAt(),
      });
      nodeReceipts.set(key, receipt);
      return receipt;
    },
    async readRelayDeployment() {
      return { deploymentId: 'canary-relay-deployment-prior', versionId: priorRelayVersion };
    },
    async uploadRelay() {
      // WHAT: Persist one isolated uploaded version.
      // WHY: Resume must observe the upload instead of allocating a second version.
      if (!relayUploaded) {
        relayUploaded = true;
        count('upload-relay');
      }
      return {
        versionId: candidateRelayVersion,
        receipt: mutation({
          operation: 'upload-relay',
          targetSha: release.mainSha,
          predecessor: 'canary-relay-deployment-prior',
          resultIdentity: candidateRelayVersion,
          observedAt: observedAt(),
        }),
      };
    },
    async deployRelay() {
      // WHAT: Mutate the isolated relay exactly once.
      // WHY: An interrupted response must be reconciled without a duplicate deployment.
      if (!relayActive) {
        relayActive = true;
        count('activate-relay');
      }
      // WHAT: Inject process loss after external relay activation once.
      // WHY: The resume proof must begin from a durable started receipt plus observed authority.
      if (input.fault.operation === 'activate-relay' && input.fault.armed) {
        input.fault.armed = false;
        throw new DeliveryInterruptedError('relay-activation', 'activate-relay');
      }
      return mutation({
        operation: 'activate-relay',
        targetSha: release.mainSha,
        predecessor: 'canary-relay-deployment-prior',
        resultIdentity: candidateRelayVersion,
        observedAt: observedAt(),
      });
    },
    async rollbackRelay() {
      // WHAT: Restore the isolated predecessor exactly once.
      // WHY: Rollback proof must demonstrate reverse compensation rather than journal-only status changes.
      if (relayActive) {
        relayActive = false;
        count('rollback-relay');
      }
      relayRollbackReceipt = mutation({
        operation: 'rollback-relay',
        targetSha: release.mainSha,
        predecessor: candidateRelayVersion,
        resultIdentity: priorRelayVersion,
        observedAt: observedAt(),
      });
      return relayRollbackReceipt;
    },
    async verifyRelay() {
      // WHAT: Reject verification until the isolated relay points at the candidate version.
      // WHY: A coordinator receipt alone is not runtime authority.
      if (!relayActive) throw new Error('release_canary_relay_not_active');
    },
    async verifyRelayRollback() {
      // WHAT: Reject rollback verification while the candidate relay remains active.
      // WHY: Compensation succeeds only after predecessor authority is restored.
      if (relayActive) throw new Error('release_canary_relay_not_rolled_back');
    },
    async verifyNode({ expectedReleaseSha }) {
      const observed = nodeAuthority();
      // WHAT: Reject node verification when its live pointer differs from the controller expectation.
      // WHY: Node phase receipts cannot replace live release identity.
      if (observed.activeReleaseSha !== expectedReleaseSha) throw new Error('release_canary_node_sha_mismatch');
      return observed;
    },
    async observeAuthority() {
      return authority();
    },
    async verifyFinal({ run }) {
      // WHAT: Require exact main merge authority on both isolated runtime targets.
      // WHY: Delivery success must distinguish the deployed main SHA from the admitted dev release SHA.
      if (!relayActive || activeNodeSha !== run.mainSha || run.mainSha !== release.mainSha) {
        throw new Error('release_canary_final_authority_mismatch');
      }
    },
  };
  return { effects, externalMutationCounts };
}

function fakeRepositoryLock(repositoryRoot: string, releaseSha: string, observedAt: string): RepositoryMutationLock {
  return {
    lockDirectory: resolve(repositoryRoot, '.git', 'decision-os-canary-mutation.lock'),
    context: {
      root: repositoryRoot,
      commonDirectory: resolve(repositoryRoot, '.git'),
      gitDirectory: resolve(repositoryRoot, '.git'),
      indexFile: resolve(repositoryRoot, '.git', 'index'),
    },
    owner: {
      version: 1,
      token: '00000000-0000-4000-8000-000000000000',
      pid: process.pid,
      processIdentity: 'release-canary-delivery-proof',
      purpose: 'decision-os-delivery:release-canary',
      acquiredAt: observedAt,
      head: releaseSha,
    },
    release() {},
  } as RepositoryMutationLock;
}

function fakeLease(repositoryRoot: string, releaseSha: string, observedAt: string): DeliveryLease {
  return {
    file: resolve(repositoryRoot, '.git', 'decision-os-canary-delivery-lease'),
    record: {
      protocol: 1,
      token: '00000000-0000-4000-8000-000000000000',
      deliveryId: 'release-canary',
      pid: process.pid,
      processIdentity: 'release-canary-delivery-proof',
      admittedSha: releaseSha,
      acquiredAt: observedAt,
      renewedAt: observedAt,
      expiresAt: new Date(Date.parse(observedAt) + 60_000).toISOString(),
    },
    repositoryLock: fakeRepositoryLock(repositoryRoot, releaseSha, observedAt),
    renew() { return this.record; },
    release() {},
  };
}

function phaseArtifact(input: {
  runRoot: string;
  phase: DeliveryProofPhase;
  release: ReleaseCanaryGitReceipt;
  coordinatorRoot: string;
  releaseRoot: string;
  run: DeliveryRun;
  evidence: Record<string, unknown>;
}): ReleaseCanaryDeliveryPhaseEvidence {
  const run = parseDeliveryRun(input.run);
  // WHAT: Require every typed delivery journal to bind both canonical Git identities.
  // WHY: The admitted dev release SHA and deployed main merge SHA are distinct authorities.
  if (run.admittedSha !== input.release.releaseSha || run.mainSha !== input.release.mainSha) {
    throw new Error('release_canary_delivery_identity_mismatch');
  }
  const document = {
    phase: input.phase,
    status: 'passed',
    evidence: {
      candidateSha: input.release.candidateSha,
      releaseMode: input.release.mode,
      mainStateProof: input.release.mainStateProof,
      releaseSha: input.release.releaseSha,
      mainSha: input.release.mainSha,
      priorMainSha: input.release.priorMainSha,
      releaseTag: input.release.releaseTag,
      coordinatorRoot: input.coordinatorRoot,
      releaseRoot: input.releaseRoot,
      deliveryRun: run,
      ...input.evidence,
    },
  };
  const bytes = `${JSON.stringify(document, null, 2)}\n`;
  const receiptFile = resolve(input.runRoot, `${input.phase}-phase-receipt.json`);
  writeFileSync(receiptFile, bytes, { mode: 0o600 });
  return {
    receiptFile,
    receiptId: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
  };
}

function validateCanonicalReceipt(input: {
  runRoot: string;
  release: ReleaseCanaryGitReceipt;
}): string {
  const receiptBytes = readFileSync(input.release.receiptFile);
  const expectedReceiptId = `sha256:${createHash('sha256').update(receiptBytes).digest('hex')}`;
  // WHAT: Require the exact immutable canonical release artifact.
  // WHY: Delivery proof cannot accept a detached or edited SHA tuple.
  if (expectedReceiptId !== input.release.receiptId) throw new Error('release_canary_release_receipt_invalid');
  const receiptDocument = JSON.parse(receiptBytes.toString('utf8')) as {
    phase?: unknown;
    status?: unknown;
    evidence?: Record<string, unknown>;
  };
  const evidence = receiptDocument.evidence ?? {};
  // WHAT: Require the supplied typed receipt identities to equal the hash-bound canonical artifact.
  // WHY: A caller must not pair valid receipt bytes with a substituted SHA tuple.
  if (
    receiptDocument.phase !== 'canonical-release'
    || receiptDocument.status !== 'passed'
    || evidence.mode !== input.release.mode
    || evidence.mainStateProof !== input.release.mainStateProof
    || evidence.candidateSha !== input.release.candidateSha
    || evidence.mainSha !== input.release.mainSha
    || evidence.releaseSha !== input.release.releaseSha
    || evidence.priorMainSha !== input.release.priorMainSha
    || evidence.releaseTag !== input.release.releaseTag
    || input.release.mainFirstParent !== input.release.priorMainSha
    || input.release.devSecondParent !== input.release.releaseSha
  ) throw new Error('release_canary_release_identity_invalid');
  // WHAT: Require each release mode to carry its matching main-state preservation authority.
  // WHY: A synthetic feature sentinel and published paired-child tags prove different immutable boundaries.
  if (
    (input.release.mode === 'feature' && input.release.mainStateProof !== 'synthetic-sentinel')
    || (input.release.mode === 'release-bound' && input.release.mainStateProof !== 'paired-child-tags')
  ) throw new Error('release_canary_main_state_proof_invalid');
  const releaseRoot = resolve(input.release.sandboxRoot, 'release-checkout');
  const runRelation = relative(resolve(input.runRoot), resolve(input.release.sandboxRoot));
  const releaseRelation = relative(resolve(input.runRoot), releaseRoot);
  const receiptRelation = relative(resolve(input.runRoot), resolve(input.release.receiptFile));
  // WHAT: Require the sandbox and its release checkout beneath the owned run root.
  // WHY: The delivery proof must not redirect coordinator effects to shared state.
  if (
    !runRelation
    || runRelation === '..'
    || runRelation.startsWith('../')
    || isAbsolute(runRelation)
    || !releaseRelation
    || releaseRelation === '..'
    || releaseRelation.startsWith('../')
    || isAbsolute(releaseRelation)
    || !receiptRelation
    || receiptRelation === '..'
    || receiptRelation.startsWith('../')
    || isAbsolute(receiptRelation)
  ) {
    throw new Error('release_canary_release_root_invalid');
  }
  return releaseRoot;
}

async function runScenario(input: {
  coordinatorRoot: string;
  repositoryRoot: string;
  release: ReleaseCanaryGitReceipt;
  mode: 'success' | 'resume' | 'rollback';
  now: () => Date;
}): Promise<{ run: DeliveryRun; counts: Map<string, number>; interruptedRun?: DeliveryRun }> {
  mkdirSync(input.coordinatorRoot, { recursive: true, mode: 0o700 });
  const runStore = createDeliveryRunStore({ catalogRoot: input.coordinatorRoot });
  const fault: Fault = { operation: input.mode === 'success' ? null : 'activate-relay', armed: input.mode !== 'success' };
  const isolated = createIsolatedEffects({ release: input.release, fault, now: input.now });
  const observedAt = input.now().toISOString();
  const acquireLease = async () => fakeLease(input.repositoryRoot, input.release.releaseSha, observedAt);
  const resumeLease = async (leaseInput: { reconcileAuthority: () => Promise<unknown> }) => {
    await leaseInput.reconcileAuthority();
    return fakeLease(input.repositoryRoot, input.release.releaseSha, observedAt);
  };
  let promoted: DeliveryRun;
  try {
    promoted = await promoteDecisionOsDelivery({
      catalogRoot: input.coordinatorRoot,
      repositoryRoot: input.repositoryRoot,
      releaseSha: input.release.releaseSha,
      effects: isolated.effects,
      runStore,
      acquireLease: acquireLease as never,
      now: input.now,
      deadlineMs: 5_000,
    });
  } catch (error) {
    // WHAT: Admit only the deliberately injected process interruption.
    // WHY: Every other failure is a failed delivery proof and must escape unchanged.
    if (!(error instanceof DeliveryInterruptedError)) throw error;
    const files = readdirSync(runStore.root);
    const deliveryId = String(files.find((file) => file.endsWith('.json')) ?? '').replace(/\.json$/, '');
    const interruptedRun = runStore.require(deliveryId);
    // WHAT: Resume the interrupted journal only in the resume scenario.
    // WHY: Rollback must exercise the separate stored compensation controller.
    if (input.mode === 'resume') {
      const resumed = await resumeDecisionOsDelivery({
        catalogRoot: input.coordinatorRoot,
        repositoryRoot: input.repositoryRoot,
        deliveryId,
        effects: isolated.effects,
        runStore,
        resumeLease: resumeLease as never,
        now: input.now,
        deadlineMs: 5_000,
      });
      return { run: resumed, counts: isolated.externalMutationCounts, interruptedRun };
    }
    // WHAT: Compensate the interrupted journal only in the rollback scenario.
    // WHY: Explicit rollback must restore the predecessor relay after an observed mutation.
    if (input.mode === 'rollback') {
      const rolledBack = await rollbackStoredDecisionOsDelivery({
        catalogRoot: input.coordinatorRoot,
        repositoryRoot: input.repositoryRoot,
        deliveryId,
        effects: isolated.effects,
        runStore,
        resumeLease: resumeLease as never,
        now: input.now,
        deadlineMs: 5_000,
      });
      return { run: rolledBack, counts: isolated.externalMutationCounts, interruptedRun };
    }
    throw error;
  }
  return { run: promoted, counts: isolated.externalMutationCounts };
}

export async function proveReleaseCanaryDelivery(input: {
  runRoot: string;
  release: ReleaseCanaryGitReceipt;
  now?: () => Date;
}): Promise<ReleaseCanaryDeliveryProof> {
  const runRoot = resolve(input.runRoot);
  const releaseRoot = validateCanonicalReceipt({ runRoot, release: input.release });
  const now = input.now ?? (() => new Date());
  const proofRoot = resolve(runRoot, 'delivery-proof');
  mkdirSync(proofRoot, { recursive: true, mode: 0o700 });

  const successRoot = resolve(proofRoot, 'success-coordinator');
  const success = await runScenario({ coordinatorRoot: successRoot, repositoryRoot: releaseRoot, release: input.release, mode: 'success', now });
  // WHAT: Require the success controller to reach its typed terminal state.
  // WHY: A partial journal cannot prove delivery completion.
  if (success.run.status !== 'complete' || success.run.phase !== 'complete') throw new Error('release_canary_delivery_success_incomplete');

  const resumeRoot = resolve(proofRoot, 'resume-coordinator');
  const resumed = await runScenario({ coordinatorRoot: resumeRoot, repositoryRoot: releaseRoot, release: input.release, mode: 'resume', now });
  // WHAT: Require terminal completion and one external relay activation across interruption plus resume.
  // WHY: Durable recovery must reconcile the completed mutation instead of duplicating it.
  if (resumed.run.status !== 'complete' || resumed.counts.get('activate-relay') !== 1 || !resumed.interruptedRun) {
    throw new Error('release_canary_delivery_resume_incomplete');
  }

  const rollbackRoot = resolve(proofRoot, 'rollback-coordinator');
  const rolledBack = await runScenario({ coordinatorRoot: rollbackRoot, repositoryRoot: releaseRoot, release: input.release, mode: 'rollback', now });
  // WHAT: Require terminal runtime rollback and one predecessor relay restoration.
  // WHY: Compensation proof must include the real reverse mutation and terminal journal.
  if (rolledBack.run.status !== 'rolled-back-runtime' || rolledBack.counts.get('rollback-relay') !== 1 || !rolledBack.interruptedRun) {
    throw new Error(`release_canary_delivery_rollback_incomplete:${rolledBack.run.status}:${rolledBack.run.failure?.code ?? 'none'}:${rolledBack.counts.get('rollback-relay') ?? 0}`);
  }

  return {
    'delivery-success': phaseArtifact({
      runRoot,
      phase: 'delivery-success',
      release: input.release,
      coordinatorRoot: successRoot,
      releaseRoot,
      run: success.run,
      evidence: { externalMutationCounts: Object.fromEntries(success.counts) },
    }),
    'delivery-resume': phaseArtifact({
      runRoot,
      phase: 'delivery-resume',
      release: input.release,
      coordinatorRoot: resumeRoot,
      releaseRoot,
      run: resumed.run,
      evidence: {
        interruptedRun: parseDeliveryRun(resumed.interruptedRun),
        externalMutationCounts: Object.fromEntries(resumed.counts),
      },
    }),
    'delivery-rollback': phaseArtifact({
      runRoot,
      phase: 'delivery-rollback',
      release: input.release,
      coordinatorRoot: rollbackRoot,
      releaseRoot,
      run: rolledBack.run,
      evidence: {
        interruptedRun: parseDeliveryRun(rolledBack.interruptedRun),
        externalMutationCounts: Object.fromEntries(rolledBack.counts),
      },
    }),
  };
}
