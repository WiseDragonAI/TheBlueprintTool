/**
 * WHAT: Exercises the default delivery runtime through injected Git, HTTP, Wrangler, and process authorities.
 * WHY: Production reconciliation and admission must be proven at the composed runtime boundary without live effects.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultDeliveryCliRuntime } from '../../src/business/delivery/helper/delivery-cli-runtime.js';
import { freezeDeliveryTopology } from '../../src/business/delivery/controller/delivery-topology-controller.js';
import type { DeliveryCoordinatorEffects } from '../../src/business/delivery/helper/delivery-coordinator.js';
import type { BoundedProcessResult, RunBoundedProcessInput } from '../../src/business/process/helper/run-bounded-process.js';
import type { DeliveryRun } from '../../../shared/schemas/decision-os-delivery-types.js';
import { admittedSha, priorSha } from './delivery-test-fixtures.js';
import type { RepositoryMutationLock } from '../../src/business/content-authoring/helper/repository-mutation-lock.js';
import {
  taskCurrentBaselineEpoch,
  taskCurrentStateVersion,
  taskStateProtocol,
} from '../../src/business/task-state/helper/task-current-state-types.js';

const mainSha = 'c'.repeat(40);
const observedAt = '2026-07-28T00:00:00.000Z';
const priorVersion = 'relay-version-prior';
const targetVersion = 'relay-version-target';
const token = 'a'.repeat(43);
const topologyInput = [
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
];
const topology = freezeDeliveryTopology({ capturedAt: observedAt, nodes: topologyInput });

function processResult(input: RunBoundedProcessInput, stdout = ''): BoundedProcessResult {
  return {
    ok: true,
    command: input.command,
    args: [...(input.args ?? [])],
    pid: 1,
    startedAt: observedAt,
    finishedAt: observedAt,
    durationMs: 0,
    exitCode: 0,
    signal: null,
    termination: null,
    stdout,
    stderr: '',
    stdoutTruncatedBytes: 0,
    stderrTruncatedBytes: 0,
    spawnError: null,
    context: input.context ?? {},
  };
}

function statusReceipt(nodeId: string, targetCommit: string, projectIds: string[], releaseSha: string) {
  return {
    protocol: 1,
    receiptId: `status-${nodeId}-${targetCommit.slice(0, 8)}`,
    deliveryId: 'delivery-runtime',
    nodeId,
    action: 'status',
    targetCommit,
    expectedCommit: priorSha,
    status: 'complete',
    attempt: 1,
    startedAt: observedAt,
    completedAt: observedAt,
    previousCommit: releaseSha,
    activeCommit: releaseSha,
    processIdentity: observedAt,
    command: null,
    evidence: [
      { key: 'observedAt', value: observedAt },
      { key: 'ready', value: true },
      { key: 'catalogReady', value: true },
      { key: 'projectIds', value: projectIds.join(',') },
      { key: 'releaseSha', value: releaseSha },
      { key: 'processStartedAt', value: observedAt },
      { key: 'deliveryProtocol', value: 1 },
      { key: 'activeReleasePointer', value: `current:${releaseSha}` },
      { key: 'activeIncidentCount', value: 0 },
      { key: 'federationPhase', value: 'connected' },
      { key: 'activeExecutionCount', value: 0 },
      { key: 'pendingExecutionCount', value: 0 },
      { key: 'pendingProcessQueueDepth', value: 0 },
      { key: 'pausedScopeCount', value: 0 },
      { key: 'fatalIncidentCount', value: 0 },
      { key: 'stateRuntimeDirtyCount', value: 0 },
      { key: 'statePendingDeliveryCount', value: 0 },
      { key: 'contentQueueDepth', value: 0 },
      { key: 'unavailableContentResourceCount', value: 0 },
      { key: 'convergedProjectIds', value: projectIds.join(',') },
      { key: 'converged', value: true },
      { key: 'prepareReceiptId', value: '' },
      { key: 'activateReceiptId', value: '' },
      { key: 'rollbackReceiptId', value: '' },
    ],
    error: null,
  };
}

test('default runtime collects fresh authenticated admission and live reconciliation authority', async (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-runtime-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = join(root, 'repository');
  const releaseRoot = join(root, 'releases');
  const releaseRelayRoot = join(releaseRoot, 'releases', mainSha, 'federation-relay');
  const deliveryRoot = join(root, '.decision-os', 'delivery');
  mkdirSync(join(repositoryRoot, 'federation-relay'), { recursive: true });
  mkdirSync(releaseRelayRoot, { recursive: true });
  mkdirSync(deliveryRoot, { recursive: true });
  writeFileSync(join(repositoryRoot, 'federation-relay', 'package.json'), JSON.stringify({
    devDependencies: { wrangler: '4.111.0' },
  }));
  writeFileSync(join(releaseRelayRoot, 'package.json'), JSON.stringify({
    devDependencies: { wrangler: '4.111.0' },
  }));
  writeFileSync(join(repositoryRoot, '.env'), 'CLOUDFLARE_API_TOKEN=fixture-token\nCLOUDFLARE_ACCOUNT_ID=fixture-account\n');
  const identityFile = join(root, 'id_wise');
  writeFileSync(identityFile, 'fixture');
  writeFileSync(join(root, '.decision-os', '.settings.json'), JSON.stringify({
    deliveryRepositoryRoot: repositoryRoot,
    deliveryReleaseRoot: releaseRoot,
    deliveryCandidateCurrentPointer: join(root, 'candidate', 'current'),
    deliveryNodeId: 'workstation',
    deliveryLocalDispatchToken: token,
    projectSyncGitSshIdentityFile: identityFile,
    federationRelayUrl: 'https://relay.fixture.invalid',
  }));
  const candidateNode = (nodeId: string, projectIds: string[]) => ({
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
    activeExecutionCount: 99,
    pendingExecutionCount: 99,
    pendingProcessQueueDepth: 99,
    pausedScopeCount: 99,
    fatalIncidentCount: 99,
    stateRuntimeDirtyCount: 99,
    statePendingDeliveryCount: 99,
    contentQueueDepth: 99,
    unavailableContentResourceCount: 99,
    convergedProjectIds: [],
  });
  writeFileSync(join(deliveryRoot, 'candidate-evidence.json'), JSON.stringify({
    protocol: 1,
    releaseSha: admittedSha,
    relayConfiguration: {
      observedAt,
      configurationHash: '3'.repeat(64),
      wranglerVersion: '4.111.0',
      productionWorkerName: 'relay-production',
      devWorkerName: 'relay-dev',
      productionDurableObjectNamespace: 'production-state',
      devDurableObjectNamespace: 'dev-state',
    },
    nodeEvidence: [candidateNode('phone', ['mobile']), candidateNode('workstation', ['decision-os'])],
    proofs: ['authoring', 'editor', 'direct-path', 'prompt-execution', 'federation'].map((proof) => ({
      proof,
      status: 'passed',
      releaseSha: admittedSha,
      observedAt,
      receiptId: `proof-${proof}`,
    })),
  }));
  writeFileSync(join(deliveryRoot, 'candidate-input.json'), JSON.stringify({
    protocol: 1,
    releaseSha: admittedSha,
    relayConfiguration: {
      observedAt,
      configurationHash: '3'.repeat(64),
      wranglerVersion: '4.111.0',
      productionWorkerName: 'relay-production',
      devWorkerName: 'relay-dev',
      productionDurableObjectNamespace: 'production-state',
      devDurableObjectNamespace: 'dev-state',
    },
    proofs: ['authoring', 'editor', 'direct-path', 'prompt-execution', 'federation'].map((proof) => ({
      proof,
      status: 'passed',
      releaseSha: admittedSha,
      observedAt,
      receiptId: `proof-${proof}`,
    })),
  }));

  const httpCalls: Array<{ url: string; method: string; authorization: string }> = [];
  let statusRelease = priorSha;
  let relayHealthSha = mainSha;
  let relayHealthEnvironment = 'production';
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = String(init?.method ?? 'GET');
    const headers = new Headers(init?.headers);
    httpCalls.push({ url, method, authorization: headers.get('authorization') ?? '' });
    let body: unknown;
    if (url.endsWith('/api/federation/nodes')) {
      body = { ok: true, observedAt, nodes: topologyInput };
    } else if (url.endsWith('/api/federation/nodes/phone/delivery')) {
      body = { ok: true, receipt: statusReceipt('phone', JSON.parse(String(init?.body)).targetCommit, ['mobile'], statusRelease) };
    } else if (url.endsWith('/api/federation/nodes/workstation/delivery')) {
      body = { ok: true, receipt: statusReceipt('workstation', JSON.parse(String(init?.body)).targetCommit, ['decision-os'], statusRelease) };
    } else if (url === 'https://relay.fixture.invalid/health') {
      body = {
        ok: true, status: 'ready', releaseSha: relayHealthSha, deliveryProtocol: 1, protocolVersion: 1,
        stateProtocol: taskStateProtocol,
        stateSchema: taskCurrentStateVersion,
        baselineEpoch: taskCurrentBaselineEpoch,
        environment: relayHealthEnvironment,
      };
    } else if (url.endsWith(':50150/api/health')) {
      body = {
        ok: true, status: 'ready', observedAt, releaseSha: priorSha, processStartedAt: observedAt,
        deliveryProtocol: 1, activeReleasePointer: `current:${priorSha}`, activeIncidentCount: 0,
      };
    } else if (url.endsWith(':50151/api/health')) {
      body = {
        ok: true, status: 'ready', observedAt, releaseSha: admittedSha, processStartedAt: observedAt,
        deliveryProtocol: 1, activeReleasePointer: `current:${admittedSha}`, activeIncidentCount: 0,
      };
    } else {
      body = {
        ok: true, status: 'ready', service: 'decision-os-federation-relay', observedAt,
        releaseSha: admittedSha, deliveryProtocol: 1, protocolVersion: 1, stateProtocol: taskStateProtocol,
        stateSchema: taskCurrentStateVersion,
        baselineEpoch: taskCurrentBaselineEpoch,
        environment: 'dev', workerName: 'relay-dev',
        durableObjectNamespace: 'dev-state',
      };
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const gitCalls: string[][] = [];
  const protectedGitlink = 'c'.repeat(40);
  let liveGit = false;
  const gitRunner = async (input: RunBoundedProcessInput) => {
    const args = input.args ?? [];
    gitCalls.push([...args]);
    if (input.context?.operation === 'candidate_list_worktrees') {
      return processResult(input, `worktree ${repositoryRoot}\nHEAD ${admittedSha}\nbranch refs/heads/dev\n`);
    }
    if (args.includes('refs/remotes/origin/dev')) return processResult(input, admittedSha);
    if (args.includes('refs/remotes/origin/main')) return processResult(input, liveGit ? mainSha : priorSha);
    if (args.includes('--format=%P')) return processResult(input, `${priorSha} ${admittedSha}`);
    // WHAT: Return the same protected gitlink for the prior and promoted main commits.
    // WHY: Live reconciliation now proves that the delivery merge preserved main's Decision OS state.
    if (args.some((argument) => argument.endsWith(':.decision-os'))) return processResult(input, protectedGitlink);
    return processResult(input);
  };
  const relayCalls: string[][] = [];
  let activeRelayVersion = targetVersion;
  const relayRunner = async (input: RunBoundedProcessInput) => {
    const args = input.args ?? [];
    relayCalls.push([...args]);
    if (args.includes('deployments')) {
      return processResult(input, JSON.stringify([{
        id: 'deployment-target',
        created_on: observedAt,
        versions: [{ version_id: activeRelayVersion, percentage: 100 }],
      }]));
    }
    return processResult(input, JSON.stringify([
      {
        id: targetVersion,
        created_on: observedAt,
        annotations: { 'workers/tag': `decision-os-${mainSha}` },
      },
      {
        id: priorVersion,
        created_on: observedAt,
        annotations: { 'workers/tag': `decision-os-${priorSha}` },
      },
    ]));
  };
  let effects: DeliveryCoordinatorEffects | null = null;
  const runtime = await createDefaultDeliveryCliRuntime({
    catalogRoot: root,
    fetch: fetchImplementation,
    gitRunner,
    relayRunner,
    now: () => new Date(observedAt),
    observeEffects: (value) => { effects = value; },
  });
  assert.ok(effects);
  const candidate = await runtime.candidate!(admittedSha);
  assert.equal(candidate.releaseSha, admittedSha);
  assert.equal(existsSync(join(root, '.decision-os', 'delivery', 'runs')), false);
  assert.equal(existsSync(join(root, '.decision-os', 'delivery', 'lock')), false);
  const admittedRun = {
    protocol: 1,
    deliveryId: 'delivery-runtime',
    admittedSha,
    priorMainSha: priorSha,
    mainSha: null,
    phase: 'preflight',
    status: 'running',
    createdAt: observedAt,
    updatedAt: observedAt,
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
  } satisfies DeliveryRun;
  const repositoryLock = {
    context: { root: repositoryRoot },
    owner: { purpose: 'decision-os-delivery:fixture' },
  } as unknown as RepositoryMutationLock;
  const preflight = await effects!.preflightGit({
    releaseSha: admittedSha,
    repositoryLock,
    signal: new AbortController().signal,
  });
  assert.equal(preflight.priorMainSha, priorSha);
  const relayPreflight = await effects!.readRelayDeployment({
    run: admittedRun,
    signal: new AbortController().signal,
  });
  assert.equal(relayPreflight.versionId, targetVersion);
  assert.equal(gitCalls.some((args) => args.includes('check-ignore')), true);
  const admission = await effects!.collectAdmission({ run: admittedRun, signal: new AbortController().signal });
  assert.equal(admission.nodeEvidence.every((entry) => entry.activeExecutionCount === 0), true);
  assert.equal(httpCalls.filter((entry) => entry.method === 'POST').length, 4);
  assert.equal(httpCalls.filter((entry) => entry.method === 'POST').every((entry) => entry.authorization === `Bearer ${token}`), true);

  const liveRun: DeliveryRun = {
    ...admittedRun,
    mainSha,
    topology: {
      capturedAt: topology.capturedAt,
      fingerprint: topology.fingerprint,
      admittedNodeIds: ['phone', 'workstation'],
      zeroProjectNodeIds: [],
    },
    relay: {
      priorDeploymentId: 'deployment-prior',
      uploadedVersionId: targetVersion,
      activeVersionId: targetVersion,
    },
    nodes: ['phone', 'workstation'].map((nodeId) => ({
      nodeId,
      priorReleaseSha: priorSha,
      stagedReleaseSha: mainSha,
      activeReleaseSha: mainSha,
      processIdentity: `${nodeId}-prior`,
      state: 'active' as const,
    })),
    activationOrder: ['phone', 'workstation'],
  };
  liveGit = true;
  statusRelease = mainSha;
  const authority = await effects!.observeAuthority({ run: liveRun, signal: new AbortController().signal });
  assert.equal(authority.originDevSha, admittedSha);
  assert.equal(authority.originMainSha, mainSha);
  assert.equal(authority.gitPromotion?.resultIdentity, mainSha);
  assert.equal(authority.relay.upload?.resultIdentity, targetVersion);
  assert.equal(authority.relay.activation?.resultIdentity, targetVersion);
  assert.equal(authority.nodes.every((node) => node.activeReleaseSha === mainSha), true);
  assert.equal(gitCalls.some((args) => args.includes('--format=%P')), true);
  assert.equal(relayCalls.some((args) => args.includes('deployments')), true);
  assert.equal(relayCalls.some((args) => args.includes('versions')), true);
  activeRelayVersion = priorVersion;
  relayHealthSha = priorSha;
  await effects!.verifyRelayRollback({
    run: liveRun,
    expectedVersionId: priorVersion,
    signal: new AbortController().signal,
  });
  relayHealthEnvironment = 'dev';
  await assert.rejects(effects!.verifyRelayRollback({
    run: liveRun,
    expectedVersionId: priorVersion,
    signal: new AbortController().signal,
  }), (error: unknown) => (error as { code?: string }).code === 'delivery_relay_rollback_verification_failed');
});
