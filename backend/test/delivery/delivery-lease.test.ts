import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  acquireRepositoryMutationLock,
} from '../../src/business/content-authoring/helper/repository-mutation-lock.js';
import {
  acquireDeliveryLease,
  readDeliveryLeaseStatus,
  renewDeliveryLease,
  resumeDeliveryLease,
  type DeliveryLeaseRecord,
} from '../../src/business/delivery/helper/delivery-lease.js';
import { createRuntimeIncidentLedger } from '../../src/business/server/helper/runtime-incident-ledger.js';
import type { DeliveryPersistenceStage } from '../../src/business/delivery/helper/delivery-durable-json.js';
import { createDeliveryRunStore } from '../../src/business/delivery/helper/delivery-run-store.js';
import {
  admittedSha,
  deliveryRun,
} from './delivery-test-fixtures.js';

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Delivery Test',
      GIT_AUTHOR_EMAIL: 'delivery@test.invalid',
      GIT_COMMITTER_NAME: 'Delivery Test',
      GIT_COMMITTER_EMAIL: 'delivery@test.invalid',
    },
  }).trim();
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-delivery-lease-'));
  writeFileSync(join(root, 'tracked.txt'), 'initial\n');
  git(root, ['init', '-q']);
  git(root, ['add', 'tracked.txt']);
  git(root, ['commit', '-q', '-m', 'Initial']);
  return root;
}

test('one renewable delivery lease excludes a second delivery and authored repository mutation', async (context) => {
  const root = repository();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let nowMs = Date.parse('2026-07-28T00:00:00.000Z');
  const now = () => new Date(nowMs);
  const lease = await acquireDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    durationMs: 1_000,
    now,
  });
  await assert.rejects(acquireDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-2',
    admittedSha,
    now,
  }), (error: unknown) => (error as { code?: string }).code === 'delivery_lease_held');
  await assert.rejects(acquireRepositoryMutationLock({
    repositoryRoot: root,
    purpose: 'authored-save',
  }), (error: unknown) => (error as { code?: string }).code === 'repository_mutation_locked');

  nowMs += 500;
  const renewed = renewDeliveryLease(lease, 2_000);
  assert.equal(renewed.renewedAt, '2026-07-28T00:00:00.500Z');
  assert.equal(renewed.expiresAt, '2026-07-28T00:00:02.500Z');
  lease.release();
  assert.equal(readDeliveryLeaseStatus({ catalogRoot: root }).state, 'missing');
});

test('an expired delivery lease cannot be stolen by a new run', async (context) => {
  const root = repository();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let nowMs = Date.parse('2026-07-28T00:00:00.000Z');
  const now = () => new Date(nowMs);
  const lease = await acquireDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    durationMs: 1_000,
    now,
  });
  nowMs += 2_000;
  await assert.rejects(acquireDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-2',
    admittedSha,
    now,
  }), (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'delivery_lease_held');
    assert.match((error as Error).message, /requires matching resume/);
    return true;
  });
  lease.release();
});

test('matching resume requires owner absence, journal identity, and live authority reconciliation', async (context) => {
  const root = repository();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let nowMs = Date.parse('2026-07-28T00:00:00.000Z');
  const now = () => new Date(nowMs);
  const runStore = createDeliveryRunStore({ catalogRoot: root });
  runStore.create(deliveryRun());
  const abandoned = await acquireDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    durationMs: 1_000,
    now,
  });
  await assert.rejects(resumeDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    runStore,
    now,
    reconcileAuthority: async () => ({
      reconciled: true,
      checkedAt: now().toISOString(),
      authorityFingerprint: 'live-authority-1',
    }),
  }), (error: unknown) => (error as { code?: string }).code === 'delivery_lease_owner_alive');

  const leaseRecord = JSON.parse(readFileSync(abandoned.file, 'utf8')) as DeliveryLeaseRecord;
  leaseRecord.pid = 2_000_000_000;
  leaseRecord.processIdentity = 'linux:2000000000:missing';
  writeFileSync(abandoned.file, `${JSON.stringify(leaseRecord, null, 2)}\n`);
  const commonDirectory = resolve(root, git(root, ['rev-parse', '--git-common-dir']));
  const repositoryOwnerFile = join(commonDirectory, 'decision-os', 'repository-mutation.lock', 'owner.json');
  const repositoryOwner = JSON.parse(readFileSync(repositoryOwnerFile, 'utf8')) as {
    pid: number;
    processIdentity: string;
  };
  repositoryOwner.pid = leaseRecord.pid;
  repositoryOwner.processIdentity = leaseRecord.processIdentity;
  writeFileSync(repositoryOwnerFile, `${JSON.stringify(repositoryOwner, null, 2)}\n`);

  await assert.rejects(resumeDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    runStore,
    now,
    reconcileAuthority: async () => ({
      reconciled: false,
      checkedAt: now().toISOString(),
      authorityFingerprint: '',
    } as never),
  }), (error: unknown) => (error as { code?: string }).code === 'delivery_lease_reconciliation_rejected');

  writeFileSync(join(root, 'tracked.txt'), 'delivery advanced head\n');
  git(root, ['add', 'tracked.txt']);
  git(root, ['commit', '-q', '-m', 'Delivery advanced HEAD']);
  nowMs += 2_000;
  let reconciliationCalls = 0;
  const resumed = await resumeDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    runStore,
    now,
    reconcileAuthority: async () => {
      reconciliationCalls += 1;
      return {
        reconciled: true,
        checkedAt: now().toISOString(),
        authorityFingerprint: 'git-and-live-node-authority',
      };
    },
  });
  assert.equal(reconciliationCalls, 1);
  assert.equal(resumed.record.deliveryId, 'delivery-test-1');
  assert.equal(resumed.record.pid, process.pid);
  assert.notEqual(resumed.record.token, leaseRecord.token);
  resumed.release();
});

test('lease persistence failure keeps the prior lease readable and records a scoped incident', async (context) => {
  const root = repository();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let failure: DeliveryPersistenceStage | '' = '';
  let nowMs = Date.parse('2026-07-28T00:00:00.000Z');
  const incidentLedger = createRuntimeIncidentLedger({ decisionOsRoot: join(root, '.decision-os') });
  const lease = await acquireDeliveryLease({
    catalogRoot: root,
    repositoryRoot: root,
    deliveryId: 'delivery-test-1',
    admittedSha,
    now: () => new Date(nowMs),
    incidentLedger,
    persistenceHooks: {
      atStage(stage) {
        if (stage === failure) throw new Error(`injected-${stage}`);
      },
    },
  });
  const original = readFileSync(lease.file);
  nowMs += 1_000;
  failure = 'after-temporary-fsync';
  assert.throws(() => lease.renew(), (error: unknown) => {
    assert.equal((error as { code?: string }).code, 'delivery_lease_persistence_failed');
    assert.ok((error as { incidentId?: string }).incidentId);
    return true;
  });
  assert.deepEqual(readFileSync(lease.file), original);
  assert.equal(incidentLedger.active('delivery:delivery-test-1')[0]?.code, 'delivery_lease_persistence_failed');
  failure = '';
  lease.release();
});

test('resume preserves a corrupt lease and reports a readable delivery incident status', (context) => {
  const root = repository();
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const leaseFile = join(root, '.decision-os', 'delivery', 'lock');
  const store = createDeliveryRunStore({ catalogRoot: root });
  store.create(deliveryRun());
  writeFileSync(leaseFile, '{corrupt-lease');
  const bytes = readFileSync(leaseFile);
  const status = readDeliveryLeaseStatus({
    catalogRoot: root,
    deliveryId: 'delivery-test-1',
  });
  assert.equal(status.state, 'paused');
  if (status.state !== 'paused') return;
  assert.equal(status.code, 'delivery_lease_invalid');
  assert.ok(status.incidentId);
  assert.deepEqual(readFileSync(leaseFile), bytes);
});
