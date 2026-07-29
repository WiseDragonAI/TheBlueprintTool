import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntimeIncidentLedger } from '../../src/business/server/helper/runtime-incident-ledger.js';
import { createDeliveryRunStore } from '../../src/business/delivery/helper/delivery-run-store.js';
import { createDeliveryNodeReceiptStore } from '../../src/business/delivery/helper/delivery-node-receipt-store.js';
import type { DeliveryPersistenceStage } from '../../src/business/delivery/helper/delivery-durable-json.js';
import {
  deliveryNodeReceipt,
  deliveryRun,
} from './delivery-test-fixtures.js';

test('run writes keep the old complete journal when persistence fails before rename', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-run-store-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let failure: DeliveryPersistenceStage | '' = '';
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: join(root, '.decision-os') });
  const store = createDeliveryRunStore({
    catalogRoot: root,
    incidentLedger,
    persistenceHooks: {
      atStage(stage) {
        if (stage === failure) throw new Error(`injected-${stage}`);
      },
    },
  });
  const original = deliveryRun();
  store.create(original);
  const originalBytes = readFileSync(store.fileFor(original.deliveryId));
  failure = 'after-temporary-fsync';
  assert.throws(() => store.write(deliveryRun({
    updatedAt: '2026-07-28T00:01:00.000Z',
    phase: 'preflight',
  })), /injected-after-temporary-fsync/);
  assert.deepEqual(readFileSync(store.fileFor(original.deliveryId)), originalBytes);
  assert.equal(store.require(original.deliveryId).phase, 'created');
  assert.equal(incidentLedger.active('delivery:delivery-test-1')[0]?.code, 'delivery_run_persistence_failed');
});

test('run writes expose the complete new journal when failure follows rename', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-run-installed-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let failure: DeliveryPersistenceStage | '' = '';
  const store = createDeliveryRunStore({
    catalogRoot: root,
    persistenceHooks: {
      atStage(stage) {
        if (stage === failure) throw new Error(`injected-${stage}`);
      },
    },
  });
  store.create(deliveryRun());
  failure = 'after-rename';
  assert.throws(() => store.write(deliveryRun({
    updatedAt: '2026-07-28T00:01:00.000Z',
    phase: 'preflight',
  })), /injected-after-rename/);
  assert.equal(store.require('delivery-test-1').phase, 'preflight');
});

test('corrupt run bytes remain byte-identical in place and status stays readable through an incident', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-run-corrupt-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const decisionOsRoot = join(root, '.decision-os');
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  const store = createDeliveryRunStore({ catalogRoot: root, incidentLedger });
  store.create(deliveryRun());
  const corruptBytes = Buffer.from([0xff, 0x7b, 0x00, 0x7d]);
  writeFileSync(store.fileFor('delivery-test-1'), corruptBytes);

  const status = store.status('delivery-test-1');
  assert.equal(status.state, 'paused');
  if (status.state !== 'paused') return;
  assert.equal(status.code, 'delivery_run_invalid');
  assert.ok(status.incidentId);
  assert.deepEqual(readFileSync(store.fileFor('delivery-test-1')), corruptBytes);
  assert.equal(incidentLedger.active('delivery:delivery-test-1')[0]?.code, 'delivery_run_invalid');
  assert.throws(() => store.write(deliveryRun({ updatedAt: '2026-07-28T00:01:00.000Z' })));
  assert.deepEqual(readFileSync(store.fileFor('delivery-test-1')), corruptBytes);
});

test('node receipts are atomic, identity-stable, and preserve corrupt bytes', (context) => {
  const decisionOsRoot = mkdtempSync(join(tmpdir(), 'decision-os-delivery-receipt-'));
  context.after(() => rmSync(decisionOsRoot, { recursive: true, force: true }));
  let failure: DeliveryPersistenceStage | '' = '';
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot });
  const store = createDeliveryNodeReceiptStore({
    decisionOsRoot,
    incidentLedger,
    persistenceHooks: {
      atStage(stage) {
        if (stage === failure) throw new Error(`injected-${stage}`);
      },
    },
  });
  const original = deliveryNodeReceipt();
  store.create(original);
  const originalBytes = readFileSync(store.fileFor(original.deliveryId));
  failure = 'after-temporary-fsync';
  assert.throws(() => store.write(deliveryNodeReceipt({
    status: 'complete',
    completedAt: '2026-07-28T00:01:00.000Z',
  })));
  assert.deepEqual(readFileSync(store.fileFor(original.deliveryId)), originalBytes);
  assert.equal(incidentLedger.active('delivery:delivery-test-1')[0]?.code, 'delivery_node_receipt_persistence_failed');
  failure = '';
  const activate = deliveryNodeReceipt({
    receiptId: 'receipt-activate',
    action: 'activate',
    attempt: 2,
    startedAt: '2026-07-28T00:02:00.000Z',
  });
  store.create(activate);
  assert.equal(store.requireCommand({
    deliveryId: original.deliveryId,
    action: original.action,
    targetCommit: original.targetCommit,
    expectedCommit: original.expectedCommit,
  }).receiptId, original.receiptId);
  assert.equal(store.requireCommand({
    deliveryId: activate.deliveryId,
    action: activate.action,
    targetCommit: activate.targetCommit,
    expectedCommit: activate.expectedCommit,
  }).receiptId, activate.receiptId);
  const indexed = store.read(original.deliveryId);
  assert.equal(indexed.state, 'available');
  if (indexed.state === 'available') assert.deepEqual(indexed.actionIndex.map((entry) => entry.action), [original.action, 'activate']);

  const corruptBytes = Buffer.from('{invalid-receipt', 'utf8');
  writeFileSync(store.fileFor(original.deliveryId), corruptBytes);
  const status = store.status(original.deliveryId);
  assert.equal(status.state, 'paused');
  assert.deepEqual(readFileSync(store.fileFor(original.deliveryId)), corruptBytes);
  assert.equal(incidentLedger.active('delivery:delivery-test-1').at(-1)?.code, 'delivery_node_receipt_invalid');
});
