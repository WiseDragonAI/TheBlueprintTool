import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeliveryNodeReceiptStore } from '../../src/business/delivery/helper/delivery-node-receipt-store.js';
import { executeDeliveryNodeCommand } from '../../src/business/delivery/controller/delivery-node-command-controller.js';
import { createDeliveryTransportCapabilityAuthority } from '../../src/business/federation/helper/federation-node-connector.js';
import type { NodeReleaseStore } from '../../src/business/delivery/helper/node-release-store.js';

const firstSha = 'a'.repeat(40);
const secondSha = 'b'.repeat(40);

function fakeReleaseStore() {
  let active = firstSha;
  const calls: string[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  const store = {
    active: () => ({ releaseSha: active, activeReleasePointer: '/fixture/current', activeReleasePath: `/fixture/${active}`, deliveryProtocol: 1 }),
    async prepare(target: string, signal?: AbortSignal) {
      calls.push(`prepare:${target}`);
      signals.push(signal);
      return { releaseSha: target, releasePath: `/fixture/${target}`, activeBefore: this.active(), reused: false };
    },
    activate(target: string, expected: string) {
      calls.push(`activate:${target}:${expected}`);
      if (active !== expected) throw Object.assign(new Error('conflict'), { code: 'node_release_pointer_conflict' });
      const previousCommit = active;
      active = target;
      return { previousCommit, activeCommit: active, pointer: '/fixture/current' };
    },
    rollback(target: string, expected: string) {
      calls.push(`rollback:${target}:${expected}`);
      return this.activate(target, expected);
    },
  } as unknown as NodeReleaseStore;
  return { store, calls, signals };
}

test('fixed node actions persist idempotent receipts and schedule supervised exit only after activation', async (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-node-command-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const receiptStore = createDeliveryNodeReceiptStore({ decisionOsRoot });
  const release = fakeReleaseStore();
  const settings = {
    deliveryProtocol: 1,
    deliveryNodeId: 'workstation',
    deliverySupervisorAdopted: true,
    deliverySupervisedExit: true,
    deliveryEmergencyHealth: true,
  };
  let exits = 0;
  const prepareCommand = { deliveryId: 'delivery-1', action: 'prepare' as const, targetCommit: secondSha, expectedCommit: firstSha };
  const prepared = await executeDeliveryNodeCommand({
    command: prepareCommand,
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => { exits += 1; },
  });
  assert.equal(prepared.status, 'complete');
  const replay = await executeDeliveryNodeCommand({
    command: prepareCommand,
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => { exits += 1; },
  });
  assert.equal(replay.receiptId, prepared.receiptId);
  assert.equal(release.calls.filter((call) => call.startsWith('prepare:')).length, 1);

  const activated = await executeDeliveryNodeCommand({
    command: { deliveryId: 'delivery-1', action: 'activate', targetCommit: secondSha, expectedCommit: firstSha },
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => { exits += 1; },
  });
  assert.equal(activated.activeCommit, secondSha);
  assert.equal(exits, 1);
  assert.equal(receiptStore.require('delivery-1').action, 'activate');
  assert.equal(receiptStore.requireCommand(prepareCommand).receiptId, prepared.receiptId);
  const indexed = receiptStore.read('delivery-1');
  assert.equal(indexed.state, 'available');
  if (indexed.state === 'available') assert.deepEqual(indexed.actionIndex.map((entry) => entry.action), ['prepare', 'activate']);
});

test('an accepted duplicate safely retries its exact settled operation and writes one terminal receipt', async (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-node-command-accepted-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const receiptStore = createDeliveryNodeReceiptStore({ decisionOsRoot });
  const release = fakeReleaseStore();
  const command = { deliveryId: 'delivery-accepted', action: 'prepare' as const, targetCommit: secondSha, expectedCommit: firstSha };
  receiptStore.create({
    protocol: 1,
    receiptId: `delivery-node-${'c'.repeat(32)}`,
    deliveryId: command.deliveryId,
    nodeId: 'workstation',
    action: command.action,
    targetCommit: command.targetCommit,
    expectedCommit: command.expectedCommit,
    status: 'accepted',
    attempt: 1,
    startedAt: '2026-07-28T00:00:00.000Z',
    completedAt: '',
    previousCommit: firstSha,
    activeCommit: firstSha,
    processIdentity: 'fixture',
    command: null,
    evidence: [],
    error: null,
  });
  const duplicate = await executeDeliveryNodeCommand({
    command,
    nodeId: 'workstation',
    settings: {
      deliveryProtocol: 1,
      deliveryNodeId: 'workstation',
      deliverySupervisorAdopted: true,
      deliverySupervisedExit: true,
      deliveryEmergencyHealth: true,
    },
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => undefined,
  });
  assert.equal(duplicate.status, 'complete');
  assert.equal(duplicate.startedAt, '2026-07-28T00:00:00.000Z');
  assert.deepEqual(release.calls, [`prepare:${secondSha}`]);
  assert.equal(receiptStore.requireCommand(command).status, 'complete');
});

test('status is a fresh read-only observation after rollback and never persists a status snapshot', async (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-node-command-status-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const receiptStore = createDeliveryNodeReceiptStore({ decisionOsRoot });
  const release = fakeReleaseStore();
  const settings = {
    deliveryProtocol: 1,
    deliveryNodeId: 'workstation',
    deliverySupervisorAdopted: true,
    deliverySupervisedExit: true,
    deliveryEmergencyHealth: true,
  };
  await executeDeliveryNodeCommand({
    command: { deliveryId: 'delivery-status', action: 'prepare', targetCommit: secondSha, expectedCommit: firstSha },
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => undefined,
  });
  await executeDeliveryNodeCommand({
    command: { deliveryId: 'delivery-status', action: 'activate', targetCommit: secondSha, expectedCommit: firstSha },
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => undefined,
  });
  await executeDeliveryNodeCommand({
    command: { deliveryId: 'delivery-status', action: 'rollback', targetCommit: firstSha, expectedCommit: secondSha },
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => undefined,
  });
  let tick = 0;
  const statusCommand = {
    deliveryId: 'delivery-status',
    action: 'status' as const,
    targetCommit: secondSha,
    expectedCommit: firstSha,
  };
  const first = await executeDeliveryNodeCommand({
    command: statusCommand,
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    now: () => new Date(`2026-07-28T00:00:0${tick++}.000Z`),
    readStatusEvidence: () => [{ key: 'ready', value: true }],
    scheduleSupervisedExit: () => undefined,
  });
  const second = await executeDeliveryNodeCommand({
    command: statusCommand,
    nodeId: 'workstation',
    settings,
    receiptStore,
    releaseStore: release.store,
    now: () => new Date(`2026-07-28T00:00:0${tick++}.000Z`),
    readStatusEvidence: () => [{ key: 'ready', value: false }],
    scheduleSupervisedExit: () => undefined,
  });
  assert.equal(first.activeCommit, firstSha);
  assert.equal(second.activeCommit, firstSha);
  assert.notEqual(first.receiptId, second.receiptId);
  assert.equal(second.evidence.find((entry) => entry.key === 'ready')?.value, false);
  const indexed = receiptStore.read('delivery-status');
  assert.equal(indexed.state, 'available');
  if (indexed.state === 'available') assert.equal(indexed.actionIndex.some((entry) => entry.action === 'status'), false);
});

test('node command schema rejects arbitrary command fields before receipt state changes', async (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-node-command-shape-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const receiptStore = createDeliveryNodeReceiptStore({ decisionOsRoot });
  const release = fakeReleaseStore();
  await assert.rejects(executeDeliveryNodeCommand({
    command: {
      deliveryId: 'delivery-1',
      action: 'prepare',
      targetCommit: secondSha,
      expectedCommit: firstSha,
      shell: 'rm -rf /',
    },
    nodeId: 'workstation',
    settings: {
      deliveryProtocol: 1,
      deliveryNodeId: 'workstation',
      deliverySupervisorAdopted: true,
      deliverySupervisedExit: true,
      deliveryEmergencyHealth: true,
    },
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => undefined,
  }));
  assert.equal(receiptStore.read('delivery-1').state, 'missing');
});

test('node command passes the owning HTTP cancellation signal into release preparation', async (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-node-command-signal-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  const receiptStore = createDeliveryNodeReceiptStore({ decisionOsRoot });
  const release = fakeReleaseStore();
  const abort = new AbortController();
  await executeDeliveryNodeCommand({
    command: { deliveryId: 'delivery-signal', action: 'prepare', targetCommit: secondSha, expectedCommit: firstSha },
    nodeId: 'workstation',
    settings: {
      deliveryProtocol: 1,
      deliveryNodeId: 'workstation',
      deliverySupervisorAdopted: true,
      deliverySupervisedExit: true,
      deliveryEmergencyHealth: true,
    },
    receiptStore,
    releaseStore: release.store,
    scheduleSupervisedExit: () => undefined,
    signal: abort.signal,
  });
  assert.equal(release.signals.length, 1);
  assert.equal(release.signals[0], abort.signal);
});

test('transport capabilities are short-lived, node-bound, and one-use', () => {
  let now = 1_000;
  const authority = createDeliveryTransportCapabilityAuthority({ now: () => now, ttlMs: 1_000 });
  const token = authority.issue('workstation', 'phone', 'request-1');
  assert.equal(authority.consume(token, 'workstation'), null);
  assert.equal(authority.consume(token, 'phone'), null);
  const replayToken = authority.issue('workstation', 'phone', 'request-2');
  assert.deepEqual(authority.consume(replayToken, 'phone'), { requesterNodeId: 'workstation', requestId: 'request-2' });
  assert.equal(authority.consume(replayToken, 'phone'), null);
  const expired = authority.issue('workstation', 'phone', 'request-3');
  now += 1_001;
  assert.equal(authority.consume(expired, 'phone'), null);
});
