/**
 * WHAT: Wires the fixed local CLI to repository settings, candidate evidence, Git, relay, and node authorities.
 * WHY: Secrets and effect addresses must remain settings-owned closures rather than CLI/operator input.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { DeliveryCliRuntime } from '../../../cli/decision-os-delivery.js';
import {
  promoteDecisionOsDelivery,
} from '../controller/promote-decision-os-delivery.js';
import {
  resumeDecisionOsDelivery,
} from '../controller/resume-decision-os-delivery.js';
import {
  rollbackStoredDecisionOsDelivery,
} from '../controller/rollback-decision-os-delivery.js';
import {
  freezeDeliveryTopology,
  type FrozenDeliveryTopology,
  type DeliveryTopologyNodeInput,
} from '../controller/delivery-topology-controller.js';
import {
  admitDecisionOsDelivery,
  type DeliveryAdmissionProof,
  type DeliveryNodeAdmissionEvidence,
  type DeliveryRelayConfigurationEvidence,
  type DeliveryRelayHealth,
  type DeliveryReleaseHealth,
} from '../controller/delivery-admission-controller.js';
import {
  assertDeliveryCredentialFileIgnored,
  observeDeliveryGitAuthority,
  preflightDeliveryGit,
  promoteDeliveryMain,
  verifyDeliveryCandidateGit,
  type DeliveryGitRunner,
} from './delivery-git.js';
import {
  deployRelayVersion,
  readCurrentRelayDeployment,
  rollbackRelayVersion,
  readRelayAuthority,
  uploadRelayVersion,
  verifyRelayReleaseHealth,
  type DeliveryRelayRunner,
} from './delivery-relay.js';
import { createDeliveryRunStore } from './delivery-run-store.js';
import {
  createDeliveryRun,
  receiptForOperation,
  withDeliveryDeadline,
  type DeliveryAuthoritySnapshot,
  type DeliveryCoordinatorEffects,
  type DeliveryMutationReceipt,
  type DeliveryNodeAuthority,
} from './delivery-coordinator.js';
import {
  parseDeliveryNodeReceipt,
  type DeliveryNodeCommand,
  type DeliveryNodeReceipt,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import { runBoundedProcess } from '../../process/helper/run-bounded-process.js';
import {
  validateDeliveryCandidateEvidence,
  writeDeliveryCandidateEvidence,
  writeDeliveryCandidateReleaseIdentity,
} from './delivery-candidate-evidence.js';

type AnyRecord = Record<string, unknown>;

type CandidateBundle = {
  protocol: 1;
  releaseSha: string;
  relayConfiguration: DeliveryRelayConfigurationEvidence;
  nodeEvidence: DeliveryNodeAdmissionEvidence[];
  proofs: DeliveryAdmissionProof[];
};

const productionServer = 'http://127.0.0.1:50150';
const canaryHealthEndpoint = 'http://127.0.0.1:50151/api/health';
const devRelayHealthEndpoint = 'http://127.0.0.1:50152/health';

function codedError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function readJsonFile(file: string, code: string): AnyRecord {
  if (!existsSync(file)) throw codedError(code, 'Required local delivery evidence is unavailable.');
  const value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw codedError(code, `Delivery JSON is invalid: ${file}.`);
  return value as AnyRecord;
}

function readSettings(catalogRoot: string): AnyRecord {
  return readJsonFile(
    resolve(catalogRoot, '.decision-os', '.settings.json'),
    'delivery_settings_missing',
  );
}

function loadRelayEnvironment(repositoryRoot: string): { environment: NodeJS.ProcessEnv; credentialFile: string | null } {
  const environment = { ...process.env };
  const file = resolve(repositoryRoot, '.env');
  if (!existsSync(file)) return { environment, credentialFile: null };
  let loaded = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\s*=\s*(.*?)\s*$/);
    if (!match || environment[match[1]]) continue;
    environment[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    loaded = true;
  }
  return { environment, credentialFile: loaded ? file : null };
}

function candidateBundle(catalogRoot: string, releaseSha: string): CandidateBundle {
  const file = resolve(catalogRoot, '.decision-os', 'delivery', 'candidate-evidence.json');
  const value = validateDeliveryCandidateEvidence(readJsonFile(file, 'delivery_candidate_evidence_missing'));
  if (value.releaseSha !== releaseSha) {
    throw codedError('delivery_candidate_evidence_invalid', 'Candidate evidence does not match the exact requested release.');
  }
  return value;
}

function candidateInput(catalogRoot: string, releaseSha: string): Pick<CandidateBundle, 'relayConfiguration' | 'proofs'> {
  const value = readJsonFile(
    resolve(catalogRoot, '.decision-os', 'delivery', 'candidate-input.json'),
    'delivery_candidate_input_missing',
  );
  const keys = ['protocol', 'releaseSha', 'relayConfiguration', 'proofs'];
  if (
    Object.keys(value).some((key) => !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
    || value.protocol !== 1
    || value.releaseSha !== releaseSha
    || !Array.isArray(value.proofs)
  ) throw codedError('delivery_candidate_input_invalid', 'Candidate input has an invalid strict shape.');
  return {
    relayConfiguration: value.relayConfiguration as DeliveryRelayConfigurationEvidence,
    proofs: value.proofs as DeliveryAdmissionProof[],
  };
}

async function readJson(
  endpoint: string,
  signal: AbortSignal,
  init: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
): Promise<AnyRecord> {
  const response = await fetchImplementation(endpoint, { ...init, signal, headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  const text = await response.text();
  let body: AnyRecord;
  try {
    body = JSON.parse(text) as AnyRecord;
  } catch {
    throw codedError('delivery_http_response_invalid', `Delivery authority ${endpoint} returned invalid JSON.`);
  }
  if (!response.ok || body.ok === false) {
    throw codedError(String(body.error ?? 'delivery_http_failed'), `Delivery authority ${endpoint} returned HTTP ${response.status}.`);
  }
  return body;
}

function mutationReceipt(input: {
  mutation: string;
  targetSha: string;
  predecessor: string;
  resultIdentity: string;
  observedAt?: string;
}): DeliveryMutationReceipt {
  const observedAt = input.observedAt ?? new Date().toISOString();
  return {
    receiptId: `external-${createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 32)}`,
    mutation: input.mutation,
    targetSha: input.targetSha,
    predecessor: input.predecessor,
    resultIdentity: input.resultIdentity,
    observedAt,
  };
}

function evidenceValue(receipt: DeliveryNodeReceipt, key: string): DeliveryNodeReceipt['evidence'][number]['value'] {
  return receipt.evidence.find((entry) => entry.key === key)?.value ?? null;
}

function releaseWorktree(settings: AnyRecord, run: DeliveryRun): string {
  if (!run.mainSha) throw codedError('delivery_main_sha_missing', 'Delivery main SHA is unavailable.');
  return resolve(String(settings.deliveryReleaseRoot ?? ''), 'releases', run.mainSha);
}

export async function createDefaultDeliveryCliRuntime(input: {
  catalogRoot: string;
  fetch?: typeof fetch;
  gitRunner?: DeliveryGitRunner;
  relayRunner?: DeliveryRelayRunner;
  processRunner?: typeof runBoundedProcess;
  now?: () => Date;
  observeEffects?: (effects: DeliveryCoordinatorEffects) => void;
}): Promise<DeliveryCliRuntime> {
  const catalogRoot = resolve(input.catalogRoot);
  const settings = readSettings(catalogRoot);
  const repositoryRoot = resolve(String(settings.deliveryRepositoryRoot ?? catalogRoot));
  const localDispatchToken = String(settings.deliveryLocalDispatchToken ?? '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(localDispatchToken)) {
    throw codedError('delivery_local_dispatch_not_configured', 'The settings-owned local delivery capability is unavailable.');
  }
  const coordinatorNodeId = String(settings.deliveryNodeId ?? '');
  const relay = loadRelayEnvironment(repositoryRoot);
  const relayEnvironment = relay.environment;
  const fetchImplementation = input.fetch ?? fetch;
  const now = input.now ?? (() => new Date());
  const runStore = createDeliveryRunStore({ catalogRoot });
  let bundle: CandidateBundle | null = null;
  let observedPreflight: { priorMainSha: string; originDevSha: string; observedAt: string } | null = null;

  const dispatchNode = async (
    nodeId: string,
    command: DeliveryNodeCommand,
    signal: AbortSignal,
  ): Promise<DeliveryNodeReceipt> => {
    const body = await readJson(
      `${productionServer}/api/federation/nodes/${encodeURIComponent(nodeId)}/delivery`,
      signal,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${localDispatchToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(command),
      },
      fetchImplementation,
    );
    return parseDeliveryNodeReceipt(body.receipt);
  };

  const statusNode = async (run: DeliveryRun, nodeId: string, signal: AbortSignal): Promise<DeliveryNodeAuthority> => {
    const node = run.nodes.find((entry) => entry.nodeId === nodeId);
    if (!node || !node.priorReleaseSha) {
      throw codedError('delivery_node_evidence_missing', `Node ${nodeId} has no journal identity.`);
    }
    const targetCommit = run.mainSha ?? run.priorMainSha;
    if (!targetCommit) throw codedError('delivery_main_sha_missing', 'Delivery Git identity is unavailable.');
    const receipt = await dispatchNode(nodeId, {
      deliveryId: run.deliveryId,
      action: 'status',
      targetCommit,
      expectedCommit: node.priorReleaseSha,
    }, signal);
    const reconstructed: DeliveryNodeReceipt[] = [];
    for (const action of ['prepare', 'activate'] as const) {
      const receiptId = evidenceValue(receipt, `${action}ReceiptId`);
      if (typeof receiptId !== 'string' || !receiptId) continue;
      reconstructed.push({
        ...receipt,
        receiptId,
        action,
        targetCommit,
        expectedCommit: node.priorReleaseSha,
      });
    }
    const rollbackReceiptId = evidenceValue(receipt, 'rollbackReceiptId');
    if (typeof rollbackReceiptId === 'string' && rollbackReceiptId) {
      reconstructed.push({
        ...receipt,
        receiptId: rollbackReceiptId,
        action: 'rollback',
        targetCommit: node.priorReleaseSha,
        expectedCommit: targetCommit,
      });
    }
    return {
      nodeId,
      activeReleaseSha: String(receipt.activeCommit ?? ''),
      processIdentity: receipt.processIdentity,
      ready: evidenceValue(receipt, 'ready') === true,
      catalogReady: evidenceValue(receipt, 'catalogReady') === true,
      federationPhase: String(evidenceValue(receipt, 'federationPhase') ?? ''),
      converged: evidenceValue(receipt, 'converged') === true,
      receipts: reconstructed.map(parseDeliveryNodeReceipt),
    };
  };

  const admissionEvidenceFromStatus = (
    node: FrozenDeliveryTopology['activeNodes'][number],
    receipt: DeliveryNodeReceipt,
  ): DeliveryNodeAdmissionEvidence => {
    const list = (key: string): string[] => {
      const value = evidenceValue(receipt, key);
      return typeof value === 'string' && value
        ? value.split(',').map((entry) => entry.trim()).filter(Boolean).sort()
        : [];
    };
    const count = (key: string): number => Number(evidenceValue(receipt, key) ?? Number.NaN);
    const observedAt = String(evidenceValue(receipt, 'observedAt') ?? receipt.completedAt);
    return {
      nodeId: node.nodeId,
      observedAt,
      projectIds: list('projectIds'),
      release: {
        ok: true,
        status: evidenceValue(receipt, 'ready') === true ? 'ready' : 'degraded',
        observedAt,
        releaseSha: String(evidenceValue(receipt, 'releaseSha') ?? receipt.activeCommit ?? ''),
        processStartedAt: String(evidenceValue(receipt, 'processStartedAt') ?? receipt.processIdentity),
        deliveryProtocol: count('deliveryProtocol'),
        activeReleasePointer: String(evidenceValue(receipt, 'activeReleasePointer') ?? ''),
        activeIncidentCount: count('activeIncidentCount'),
      },
      federationPhase: String(evidenceValue(receipt, 'federationPhase') ?? ''),
      activeExecutionCount: count('activeExecutionCount'),
      pendingExecutionCount: count('pendingExecutionCount'),
      pendingProcessQueueDepth: count('pendingProcessQueueDepth'),
      pausedScopeCount: count('pausedScopeCount'),
      fatalIncidentCount: count('fatalIncidentCount'),
      stateRuntimeDirtyCount: count('stateRuntimeDirtyCount'),
      statePendingDeliveryCount: count('statePendingDeliveryCount'),
      contentQueueDepth: count('contentQueueDepth'),
      unavailableContentResourceCount: count('unavailableContentResourceCount'),
      convergedProjectIds: list('convergedProjectIds'),
    };
  };

  const effects: DeliveryCoordinatorEffects = {
    coordinatorNodeId,
    async preflightGit({ releaseSha, repositoryLock, signal }) {
      const result = await preflightDeliveryGit({
        repositoryRoot,
        releaseSha,
        repositoryLock,
        settings,
        runner: input.gitRunner,
        signal,
      });
      observedPreflight = {
        priorMainSha: result.priorMainSha,
        originDevSha: result.originDevSha,
        observedAt: now().toISOString(),
      };
      bundle = candidateBundle(catalogRoot, releaseSha);
      return {
        priorMainSha: result.priorMainSha,
        originDevSha: result.originDevSha,
        receipt: mutationReceipt({
          mutation: 'preflight-git',
          targetSha: releaseSha,
          predecessor: result.priorMainSha,
          resultIdentity: result.originDevSha,
          observedAt: observedPreflight.observedAt,
        }),
      };
    },
    async collectAdmission({ run, signal }) {
      bundle = bundle ?? candidateBundle(catalogRoot, run.admittedSha);
      const [topologyValue, productionHealth, canaryHealth, devRelayHealth] = await Promise.all([
        readJson(`${productionServer}/api/federation/nodes`, signal, {}, fetchImplementation),
        readJson(`${productionServer}/api/health`, signal, {}, fetchImplementation),
        readJson(canaryHealthEndpoint, signal, {}, fetchImplementation),
        readJson(devRelayHealthEndpoint, signal, {}, fetchImplementation),
      ]);
      const topology = freezeDeliveryTopology({
        capturedAt: String(topologyValue.observedAt ?? ''),
        nodes: (topologyValue.nodes as DeliveryTopologyNodeInput[]) ?? [],
      });
      const nodeEvidence = await Promise.all(topology.activeNodes.map(async (node) => {
        if (!run.priorMainSha) throw codedError('delivery_preflight_evidence_missing', 'The predecessor SHA is unavailable.');
        const status = await dispatchNode(node.nodeId, {
          deliveryId: run.deliveryId,
          action: 'status',
          targetCommit: run.priorMainSha,
          expectedCommit: run.priorMainSha,
        }, signal);
        return admissionEvidenceFromStatus(node, status);
      }));
      const preflight = observedPreflight;
      if (!preflight || preflight.priorMainSha !== run.priorMainSha) {
        throw codedError('delivery_preflight_evidence_missing', 'Exact Git preflight evidence is unavailable.');
      }
      return {
        topology,
        candidate: {
          observedAt: preflight.observedAt,
          releaseSha: run.admittedSha,
          originDevSha: preflight.originDevSha,
          originMainSha: preflight.priorMainSha,
          clean: true,
          mainIsAncestor: true,
        },
        productionHealth: productionHealth as unknown as DeliveryReleaseHealth,
        canaryHealth: canaryHealth as unknown as DeliveryReleaseHealth,
        devRelayHealth: devRelayHealth as unknown as DeliveryRelayHealth,
        relayConfiguration: bundle.relayConfiguration,
        nodeEvidence,
        proofs: bundle.proofs,
      };
    },
    async promoteMain({ run, repositoryLock, signal }) {
      const preflight = await preflightDeliveryGit({
        repositoryRoot,
        releaseSha: run.admittedSha,
        repositoryLock,
        settings,
        runner: input.gitRunner,
        signal,
      });
      const promotion = await promoteDeliveryMain({
        preflight,
        repositoryLock,
        settings,
        runner: input.gitRunner,
        signal,
        verifyCandidate: async ({ worktree, signal: candidateSignal }) => {
          const result = await (input.processRunner ?? runBoundedProcess)({
            command: process.execPath,
            args: [
              resolve(repositoryRoot, 'bin', 'decision-os-verify.mjs'),
              '--',
              resolve(worktree, 'backend', 'node_modules', '.bin', 'tsc'),
              '-p',
              resolve(worktree, 'backend', 'tsconfig.json'),
              '--noEmit',
            ],
            cwd: worktree,
            deadlineMs: 10 * 60_000,
            signal: candidateSignal,
            context: { component: 'delivery-coordinator', operation: 'verify-main-candidate' },
          });
          if (!result.ok) throw codedError('delivery_main_candidate_verification_failed', 'The reviewed main candidate did not typecheck.');
        },
      });
      return {
        mainSha: promotion.mainSha,
        receipt: mutationReceipt({
          mutation: 'promote-main',
          targetSha: run.admittedSha,
          predecessor: preflight.priorMainSha,
          resultIdentity: promotion.mainSha,
        }),
      };
    },
    dispatchNode: async ({ nodeId, command, signal }) => await dispatchNode(nodeId, command, signal),
    async readRelayDeployment({ run, signal }) {
      await assertDeliveryCredentialFileIgnored({
        repositoryRoot,
        credentialFile: relay.credentialFile,
        settings,
        runner: input.gitRunner,
        signal,
      });
      const result = await readCurrentRelayDeployment({
        releaseWorktree: repositoryRoot,
        environment: relayEnvironment,
        runner: input.relayRunner,
        signal,
      });
      return {
        deploymentId: result.deployment.deploymentId,
        versionId: result.deployment.versionId,
      };
    },
    async uploadRelay({ run, signal }) {
      const result = await uploadRelayVersion({
        releaseWorktree: releaseWorktree(settings, run),
        mainSha: String(run.mainSha),
        environment: relayEnvironment,
        runner: input.relayRunner,
        signal,
      });
      return {
        versionId: result.versionId,
        receipt: mutationReceipt({
          mutation: 'upload-relay',
          targetSha: String(run.mainSha),
          predecessor: run.relay.priorDeploymentId,
          resultIdentity: result.versionId,
        }),
      };
    },
    async deployRelay({ run, versionId, signal }) {
      await deployRelayVersion({
        releaseWorktree: releaseWorktree(settings, run),
        mainSha: String(run.mainSha),
        versionId,
        environment: relayEnvironment,
        runner: input.relayRunner,
        signal,
      });
      return mutationReceipt({
        mutation: 'activate-relay',
        targetSha: String(run.mainSha),
        predecessor: run.relay.priorDeploymentId,
        resultIdentity: versionId,
      });
    },
    async rollbackRelay({ run, priorVersionId, signal }) {
      await rollbackRelayVersion({
        releaseWorktree: releaseWorktree(settings, run),
        failedMainSha: String(run.mainSha),
        priorVersionId,
        environment: relayEnvironment,
        runner: input.relayRunner,
        signal,
      });
      return mutationReceipt({
        mutation: 'rollback-relay',
        targetSha: String(run.mainSha),
        predecessor: run.relay.uploadedVersionId,
        resultIdentity: priorVersionId,
      });
    },
    async verifyRelay({ run, expectedReleaseSha, signal }) {
      const relayUrl = String(settings.federationRelayUrl ?? '').replace(/\/+$/, '');
      await verifyRelayReleaseHealth({
        expectedReleaseSha,
        signal,
        readHealth: async (healthSignal) => await readJson(`${relayUrl}/health`, healthSignal, {}, fetchImplementation),
      });
    },
    async verifyRelayRollback({ expectedVersionId, signal }) {
      const relayUrl = String(settings.federationRelayUrl ?? '').replace(/\/+$/, '');
      const authority = await readRelayAuthority({
        releaseWorktree: resolve(repositoryRoot),
        environment: relayEnvironment,
        runner: input.relayRunner,
        signal,
      });
      const predecessor = authority.versions.find((version) => version.versionId === expectedVersionId);
      if (authority.deployment.versionId !== expectedVersionId || !predecessor?.releaseSha) {
        throw codedError('delivery_relay_rollback_verification_failed', 'Relay traffic does not match the predecessor version.');
      }
      const health = await verifyRelayReleaseHealth({
        expectedReleaseSha: predecessor.releaseSha,
        signal,
        readHealth: async (healthSignal) => await readJson(`${relayUrl}/health`, healthSignal, {}, fetchImplementation),
      });
      if (health.environment !== 'production') {
        throw codedError('delivery_relay_rollback_verification_failed', 'Relay predecessor health reports the wrong environment.');
      }
    },
    async verifyNode({ run, nodeId, expectedReleaseSha, previousProcessIdentity, signal }) {
      const observed = await statusNode(run, nodeId, signal);
      if (observed.activeReleaseSha !== expectedReleaseSha || observed.processIdentity === previousProcessIdentity) {
        throw codedError('delivery_node_verification_failed', `Node ${nodeId} has not restarted into the expected release.`);
      }
      return observed;
    },
    async observeAuthority({ run, signal }) {
      if (!run.priorMainSha) throw codedError('delivery_preflight_evidence_missing', 'The predecessor SHA is unavailable.');
      const relayUrl = String(settings.federationRelayUrl ?? '').replace(/\/+$/, '');
      const [topologyValue, gitAuthority, relayAuthority, relayHealth] = await Promise.all([
        readJson(`${productionServer}/api/federation/nodes`, signal, {}, fetchImplementation),
        observeDeliveryGitAuthority({
          repositoryRoot,
          admittedSha: run.admittedSha,
          priorMainSha: run.priorMainSha,
          expectedMainSha: run.mainSha,
          settings,
          runner: input.gitRunner,
          signal,
        }),
        run.relay.priorDeploymentId
          ? readRelayAuthority({
              releaseWorktree: run.mainSha ? releaseWorktree(settings, run) : repositoryRoot,
              environment: relayEnvironment,
              runner: input.relayRunner,
              signal,
            })
          : Promise.resolve(null),
        run.relay.priorDeploymentId && relayUrl
          ? readJson(`${relayUrl}/health`, signal, {}, fetchImplementation)
          : Promise.resolve({}),
      ]);
      const topology = freezeDeliveryTopology({
        capturedAt: String(topologyValue.observedAt ?? ''),
        nodes: (topologyValue.nodes as DeliveryTopologyNodeInput[]) ?? [],
      });
      const nodes: DeliveryNodeAuthority[] = [];
      for (const node of run.nodes) {
        nodes.push(await statusNode(run, node.nodeId, signal));
      }
      const targetVersion = run.mainSha
        ? relayAuthority?.versions.find((version) => version.releaseSha === run.mainSha) ?? null
        : null;
      const activeVersionId = relayAuthority?.deployment.versionId ?? '';
      const activeReleaseSha = String((relayHealth as AnyRecord).releaseSha ?? '');
      const gitPromotion = run.mainSha && gitAuthority.exactMerge && gitAuthority.originMainSha === run.mainSha
        ? mutationReceipt({
            mutation: 'promote-main',
            targetSha: run.admittedSha,
            predecessor: run.priorMainSha,
            resultIdentity: run.mainSha,
            observedAt: gitAuthority.observedAt,
          })
        : null;
      const upload = targetVersion && run.mainSha
        ? mutationReceipt({
            mutation: 'upload-relay',
            targetSha: run.mainSha,
            predecessor: run.relay.priorDeploymentId,
            resultIdentity: targetVersion.versionId,
            observedAt: targetVersion.createdAt,
          })
        : null;
      const activation = targetVersion
        && run.mainSha
        && activeVersionId === targetVersion.versionId
        && activeReleaseSha === run.mainSha
        ? mutationReceipt({
            mutation: 'activate-relay',
            targetSha: run.mainSha,
            predecessor: run.relay.priorDeploymentId,
            resultIdentity: targetVersion.versionId,
            observedAt: relayAuthority!.deployment.createdAt,
          })
        : null;
      const priorRelayVersionId = receiptForOperation(run, 'read-relay-predecessor')
        ?.evidence.find((entry) => entry.key === 'priorVersionId')?.value;
      const rollback = run.mainSha
        && run.relay.uploadedVersionId
        && typeof priorRelayVersionId === 'string'
        && activeVersionId === priorRelayVersionId
        ? mutationReceipt({
            mutation: 'rollback-relay',
            targetSha: run.mainSha,
            predecessor: run.relay.uploadedVersionId,
            resultIdentity: activeVersionId,
            observedAt: relayAuthority!.deployment.createdAt,
          })
        : null;
      return {
        observedAt: now().toISOString(),
        originDevSha: gitAuthority.originDevSha,
        originMainSha: gitAuthority.originMainSha,
        topology,
        gitPromotion,
        relay: {
          activeVersionId,
          releaseSha: activeReleaseSha,
          upload,
          activation,
          rollback,
        },
        nodes,
      } satisfies DeliveryAuthoritySnapshot;
    },
    async verifyFinal({ run, authority }) {
      if (
        authority.originMainSha !== run.mainSha
        || authority.topology.fingerprint !== run.topology.fingerprint
        || authority.nodes.some((node) => (
          node.activeReleaseSha !== run.mainSha
          || !node.ready
          || !node.catalogReady
          || node.federationPhase !== 'connected'
          || !node.converged
        ))
      ) throw codedError('delivery_final_verification_failed', 'Final delivery authorities do not converge.');
    },
  };
  input.observeEffects?.(effects);

  return {
    candidate: async (releaseSha) => {
      const verified = await withDeliveryDeadline({
        operation: 'candidate-git-verification',
        deadlineMs: 60_000,
        execute: async (signal) => await verifyDeliveryCandidateGit({
          repositoryRoot,
          releaseSha,
          settings,
          runner: input.gitRunner,
          signal,
        }),
      });
      const configuredPointer = String(settings.deliveryCandidateCurrentPointer ?? '');
      if (!configuredPointer || !isAbsolute(configuredPointer)) {
        throw codedError('delivery_candidate_pointer_not_configured', 'The settings-owned candidate current pointer is unavailable.');
      }
      const identity = writeDeliveryCandidateReleaseIdentity({
        candidateWorktree: verified.candidateWorktree,
        currentPointer: configuredPointer,
        releaseSha,
      });
      const source = candidateInput(catalogRoot, releaseSha);
      const collected = await withDeliveryDeadline({
        operation: 'candidate-admission-collection',
        deadlineMs: 60_000,
        execute: async (signal) => {
          const [topologyValue, productionHealth, canaryHealth, devRelayHealth] = await Promise.all([
            readJson(`${productionServer}/api/federation/nodes`, signal, {}, fetchImplementation),
            readJson(`${productionServer}/api/health`, signal, {}, fetchImplementation),
            readJson(canaryHealthEndpoint, signal, {}, fetchImplementation),
            readJson(devRelayHealthEndpoint, signal, {}, fetchImplementation),
          ]);
          const topology = freezeDeliveryTopology({
            capturedAt: String(topologyValue.observedAt ?? ''),
            nodes: (topologyValue.nodes as DeliveryTopologyNodeInput[]) ?? [],
          });
          const nodeEvidence = await Promise.all(topology.activeNodes.map(async (node) => {
            const receipt = await dispatchNode(node.nodeId, {
              deliveryId: `candidate-${releaseSha.slice(0, 32)}`,
              action: 'status',
              targetCommit: verified.priorMainSha,
              expectedCommit: verified.priorMainSha,
            }, signal);
            return admissionEvidenceFromStatus(node, receipt);
          }));
          return { topology, productionHealth, canaryHealth, devRelayHealth, nodeEvidence };
        },
      });
      const synthetic = {
        ...createDeliveryRun({
          deliveryId: `candidate-${releaseSha.slice(0, 32)}`,
          admittedSha: releaseSha,
          now: now(),
        }),
        priorMainSha: verified.priorMainSha,
      };
      await admitDecisionOsDelivery({
        run: synthetic,
        observedTopology: collected.topology,
        candidate: {
          observedAt: now().toISOString(),
          releaseSha,
          originDevSha: verified.originDevSha,
          originMainSha: verified.priorMainSha,
          clean: true,
          mainIsAncestor: true,
        },
        productionHealth: collected.productionHealth as unknown as DeliveryReleaseHealth,
        canaryHealth: collected.canaryHealth as unknown as DeliveryReleaseHealth,
        devRelayHealth: collected.devRelayHealth as unknown as DeliveryRelayHealth,
        relayConfiguration: source.relayConfiguration,
        nodeEvidence: collected.nodeEvidence,
        proofs: source.proofs,
        persist: (run) => run,
        now,
      });
      const written = writeDeliveryCandidateEvidence({
        catalogRoot,
        evidence: {
          protocol: 1,
          releaseSha,
          relayConfiguration: source.relayConfiguration,
          nodeEvidence: collected.nodeEvidence,
          proofs: source.proofs,
        },
      });
      return {
        releaseSha,
        evidenceFile: written.file,
        marker: identity.marker,
        currentPointer: identity.currentPointer,
      };
    },
    promote: async (releaseSha) => await promoteDecisionOsDelivery({
      catalogRoot,
      repositoryRoot,
      releaseSha,
      effects,
      runStore,
    }),
    status: async (deliveryId) => runStore.require(deliveryId),
    resume: async (deliveryId) => await resumeDecisionOsDelivery({
      catalogRoot,
      repositoryRoot,
      deliveryId,
      effects,
      runStore,
    }),
    rollback: async (deliveryId) => await rollbackStoredDecisionOsDelivery({
      catalogRoot,
      repositoryRoot,
      deliveryId,
      effects,
      runStore,
    }),
  };
}
