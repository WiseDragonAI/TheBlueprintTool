/**
 * WHAT: Verifies candidate evidence ownership, incident admission scope, and shared diagnostic redaction.
 * WHY: Production delivery must fail closed without creating parallel authority or leaking operational secrets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  writeDeliveryCandidateEvidence,
  writeDeliveryCandidateReleaseIdentity,
} from '../../src/business/delivery/helper/delivery-candidate-evidence.js';
import { deliveryBlockingIncidents } from '../../src/business/delivery/helper/delivery-incident-boundary.js';
import { redactDeliveryError, redactDeliveryText, redactDeliveryValue } from '../../src/business/delivery/helper/delivery-redactor.js';
import type { RuntimeIncident } from '../../src/business/server/helper/runtime-incident-ledger.js';
import { admittedSha, priorSha } from './delivery-test-fixtures.js';
import { runDecisionOsDeliveryCli } from '../../src/cli/decision-os-delivery.js';
import type { DeliveryRun } from '../../../shared/schemas/decision-os-delivery-types.js';

const observedAt = '2026-07-28T00:00:00.000Z';

function candidateEvidence() {
  const node = {
    nodeId: 'workstation',
    observedAt,
    projectIds: ['decision-os'],
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
    convergedProjectIds: ['decision-os'],
  };
  return {
    protocol: 1,
    releaseSha: admittedSha,
    relayConfiguration: {
      observedAt,
      configurationHash: '1'.repeat(64),
      wranglerVersion: '4.111.0',
      productionWorkerName: 'relay-production',
      devWorkerName: 'relay-dev',
      productionDurableObjectNamespace: 'namespace-production',
      devDurableObjectNamespace: 'namespace-dev',
    },
    nodeEvidence: [node],
    proofs: ['authoring', 'editor', 'direct-path', 'prompt-execution', 'federation'].map((proof) => ({
      proof,
      status: 'passed',
      releaseSha: admittedSha,
      observedAt,
      receiptId: `proof-${proof}`,
    })),
  };
}

test('candidate verification atomically writes strict evidence without creating a delivery run or lease', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-candidate-evidence-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const written = writeDeliveryCandidateEvidence({ catalogRoot: root, evidence: candidateEvidence() });
  assert.equal(JSON.parse(readFileSync(written.file, 'utf8')).releaseSha, admittedSha);
  assert.equal(existsSync(join(root, '.decision-os', 'delivery', 'runs')), false);
  assert.equal(existsSync(join(root, '.decision-os', 'delivery', 'lock')), false);
  assert.throws(() => writeDeliveryCandidateEvidence({
    catalogRoot: root,
    evidence: {
      ...candidateEvidence(),
      nodeEvidence: [{ ...candidateEvidence().nodeEvidence[0], unsupported: true }],
    },
  }), (error: unknown) => (error as { code?: string }).code === 'delivery_candidate_evidence_invalid');
});

test('clean candidate identity owns one exact marker and current pointer without a delivery journal or lease', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-candidate-identity-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const worktree = join(root, 'dev');
  const pointer = join(root, 'candidate', 'current');
  mkdirSync(worktree, { recursive: true });
  const identity = writeDeliveryCandidateReleaseIdentity({
    candidateWorktree: worktree,
    currentPointer: pointer,
    releaseSha: admittedSha,
  });
  assert.deepEqual(JSON.parse(readFileSync(identity.marker, 'utf8')), {
    protocol: 1,
    releaseSha: admittedSha,
    launcher: 'bin/decision-os-server.mjs',
  });
  assert.equal(readlinkSync(pointer), '../dev');
  assert.equal(existsSync(join(root, '.decision-os', 'delivery', 'runs')), false);
  assert.equal(existsSync(join(root, '.decision-os', 'delivery', 'lock')), false);
  assert.throws(() => writeDeliveryCandidateReleaseIdentity({
    candidateWorktree: worktree,
    currentPointer: pointer,
    releaseSha: priorSha,
  }), (error: unknown) => (error as { code?: string }).code === 'delivery_candidate_release_marker_mismatch');
});

test('only fatal server scope and paused delivery dependencies block admission', () => {
  const incident = (scope: string, severity: 'error' | 'fatal'): RuntimeIncident => ({
    id: `incident-${scope}`,
    fingerprint: `fingerprint-${scope}`,
    scope,
    component: 'fixture',
    operation: 'fixture',
    severity,
    status: 'paused',
    code: 'fixture',
    message: 'fixture',
    stack: '',
    context: {},
    firstObservedAt: observedAt,
    lastObservedAt: observedAt,
    occurrences: 1,
    resolvedAt: '',
  });
  const incidents = [
    incident('project-runtime:unrelated', 'error'),
    incident('server-runtime', 'error'),
    incident('server-runtime', 'fatal'),
    incident('delivery-dependency:task-state', 'error'),
  ];
  assert.deepEqual(deliveryBlockingIncidents(incidents).map((entry) => entry.scope), [
    'server-runtime',
    'delivery-dependency:task-state',
  ]);
});

test('one redactor removes tokens, paths, credential argv, raw output, and nested context', () => {
  const secret = 'secret-token-value';
  const text = redactDeliveryText(
    `Authorization: Bearer ${secret} CLOUDFLARE_API_TOKEN=${secret} --identity-file /home/operator/.ssh/key stderr=/tmp/raw.log`,
  );
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes('/home/operator'), false);
  assert.equal(text.includes('/tmp/raw.log'), false);
  const value = redactDeliveryValue({
    message: `failure token=${secret}`,
    stderr: `raw ${secret}`,
    context: { repositoryPath: '/home/operator/repository', authorization: `Bearer ${secret}` },
  });
  assert.equal(JSON.stringify(value).includes(secret), false);
  assert.equal(JSON.stringify(value).includes('/home/operator'), false);
  const error = redactDeliveryError(Object.assign(new Error(`failed at /home/operator/repository token=${secret}`), {
    code: 'delivery_fixture_failed',
  }));
  assert.equal(String(error.stack).includes(secret), false);
  assert.equal(String(error.stack).includes('/home/operator'), false);
});

test('CLI dispatches promote, resume, and rollback only to injected runtime controllers', async () => {
  const calls: string[] = [];
  const run = (status: DeliveryRun['status']): DeliveryRun => ({
    protocol: 1,
    deliveryId: 'delivery-cli-runtime',
    admittedSha,
    priorMainSha: priorSha,
    mainSha: null,
    phase: 'admission',
    status,
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
    failure: {
      code: 'delivery_fixture',
      message: 'fixture',
      phase: 'admission',
      nodeId: '',
      observedAt,
    },
  });
  const runtime = {
    candidate: async (tag: string) => {
      calls.push(`candidate:${tag}`);
      return { releaseSha: admittedSha, evidenceFile: '[REDACTED_PATH]', marker: '[REDACTED_PATH]', currentPointer: '[REDACTED_PATH]' };
    },
    promote: async (tag: string) => { calls.push(`promote:${tag}`); return run('admission-rejected'); },
    status: async (deliveryId: string) => { calls.push(`status:${deliveryId}`); return run('paused'); },
    resume: async (deliveryId: string) => { calls.push(`resume:${deliveryId}`); return run('partial'); },
    rollback: async (deliveryId: string) => { calls.push(`rollback:${deliveryId}`); return run('rolled-back-runtime'); },
  };
  for (const [argv, exitCode] of [
    [['candidate', '--release-tag', 'rel-0.3.1', '--json'], 0],
    [['promote', '--release-tag', 'rel-0.3.1', '--server', 'http://127.0.0.1:50150', '--json'], 2],
    [['resume', '--delivery-id', 'delivery-cli-runtime', '--json'], 3],
    [['rollback', '--delivery-id', 'delivery-cli-runtime', '--json'], 3],
  ] as const) {
    const output: string[] = [];
    assert.equal(await runDecisionOsDeliveryCli({ argv, runtime, write: (value) => output.push(value) }), exitCode);
    assert.equal(output.length, 1);
  }
  assert.deepEqual(calls, [
    'candidate:rel-0.3.1',
    'promote:rel-0.3.1',
    'resume:delivery-cli-runtime',
    'rollback:delivery-cli-runtime',
  ]);
});
