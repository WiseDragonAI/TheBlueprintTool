/**
 * WHAT: Owns the renewable delivery lease while holding the shared repository mutation lock.
 * WHY: Delivery and authored Git mutation must be mutually exclusive across linked worktrees.
 */
import { isUtf8 } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DeliveryRunStore } from './delivery-run-store.js';
import {
  acquireRepositoryMutationLock,
  repositoryMutationOwnerProcessIsActive,
  repositoryMutationProcessIdentity,
  type RepositoryMutationLock,
} from '../../content-authoring/helper/repository-mutation-lock.js';
import {
  createRuntimeIncidentLedger,
  type RuntimeIncidentLedger,
} from '../../server/helper/runtime-incident-ledger.js';
import {
  atomicWriteDeliveryJson,
  fsyncDeliveryDirectory,
  type DeliveryPersistenceHooks,
} from './delivery-durable-json.js';
import {
  deliveryPersistenceFailure,
  DeliveryStorePausedError,
  recordDeliveryStoreIncident,
  type DeliveryStoreFailureStatus,
} from './delivery-store-boundary.js';

export type DeliveryLeaseRecord = {
  protocol: 1;
  token: string;
  deliveryId: string;
  pid: number;
  processIdentity: string;
  admittedSha: string;
  acquiredAt: string;
  renewedAt: string;
  expiresAt: string;
};

export type DeliveryLeaseReadResult =
  | { state: 'missing'; deliveryId: string }
  | { state: 'available'; deliveryId: string; lease: DeliveryLeaseRecord; expired: boolean }
  | DeliveryStoreFailureStatus;

export type DeliveryAuthorityReconciliation = {
  reconciled: true;
  checkedAt: string;
  authorityFingerprint: string;
};

export type DeliveryLease = {
  file: string;
  record: DeliveryLeaseRecord;
  repositoryLock: RepositoryMutationLock;
  renew(durationMs?: number): DeliveryLeaseRecord;
  release(): void;
};

export class DeliveryLeaseError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code:
      | 'delivery_lease_held'
      | 'delivery_lease_missing'
      | 'delivery_lease_owner_mismatch'
      | 'delivery_lease_owner_alive'
      | 'delivery_lease_journal_mismatch'
      | 'delivery_lease_reconciliation_rejected',
    message: string,
    readonly owner: DeliveryLeaseRecord | null = null,
  ) {
    super(message);
    this.name = 'DeliveryLeaseError';
    this.statusCode = code === 'delivery_lease_held' ? 423 : 409;
  }
}

function deliveryIdentity(deliveryId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(deliveryId)) throw new Error('delivery_id_invalid');
  return deliveryId;
}

function admittedCommit(admittedSha: string): string {
  if (!/^[a-f0-9]{40}$/.test(admittedSha)) throw new Error('delivery_admitted_sha_invalid');
  return admittedSha;
}

function isoTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) throw new Error(`${field}_invalid`);
  return value;
}

function exactRecord(value: unknown): DeliveryLeaseRecord {
  const keys = [
    'protocol', 'token', 'deliveryId', 'pid', 'processIdentity', 'admittedSha',
    'acquiredAt', 'renewedAt', 'expiresAt',
  ];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('delivery_lease_invalid');
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(input, key))) {
    throw new Error('delivery_lease_shape_invalid');
  }
  if (input.protocol !== 1) throw new Error('delivery_lease_protocol_invalid');
  if (typeof input.token !== 'string' || !/^[a-f0-9-]{36}$/.test(input.token)) throw new Error('delivery_lease_token_invalid');
  if (!Number.isInteger(input.pid) || Number(input.pid) <= 0) throw new Error('delivery_lease_pid_invalid');
  if (typeof input.processIdentity !== 'string' || input.processIdentity.length > 500) {
    throw new Error('delivery_lease_process_identity_invalid');
  }
  const lease: DeliveryLeaseRecord = {
    protocol: 1,
    token: input.token,
    deliveryId: deliveryIdentity(String(input.deliveryId)),
    pid: Number(input.pid),
    processIdentity: input.processIdentity,
    admittedSha: admittedCommit(String(input.admittedSha)),
    acquiredAt: isoTimestamp(input.acquiredAt, 'delivery_lease_acquired_at'),
    renewedAt: isoTimestamp(input.renewedAt, 'delivery_lease_renewed_at'),
    expiresAt: isoTimestamp(input.expiresAt, 'delivery_lease_expires_at'),
  };
  if (
    Date.parse(lease.renewedAt) < Date.parse(lease.acquiredAt)
    || Date.parse(lease.expiresAt) <= Date.parse(lease.renewedAt)
  ) throw new Error('delivery_lease_timestamps_invalid');
  return lease;
}

function boundedDuration(durationMs = 30_000): number {
  if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 300_000) {
    throw new Error('delivery_lease_duration_invalid');
  }
  return durationMs;
}

function sameLease(left: DeliveryLeaseRecord, right: DeliveryLeaseRecord): boolean {
  return left.token === right.token
    && left.deliveryId === right.deliveryId
    && left.pid === right.pid
    && left.processIdentity === right.processIdentity
    && left.admittedSha === right.admittedSha
    && left.acquiredAt === right.acquiredAt
    && left.renewedAt === right.renewedAt
    && left.expiresAt === right.expiresAt;
}

function reconciliation(value: DeliveryAuthorityReconciliation): DeliveryAuthorityReconciliation {
  if (
    !value
    || value.reconciled !== true
    || typeof value.authorityFingerprint !== 'string'
    || value.authorityFingerprint.length === 0
    || value.authorityFingerprint.length > 500
  ) throw new DeliveryLeaseError(
    'delivery_lease_reconciliation_rejected',
    'Live delivery authority reconciliation did not produce a bounded positive receipt.',
  );
  isoTimestamp(value.checkedAt, 'delivery_lease_reconciliation_checked_at');
  return value;
}

function createLeaseReader(input: {
  catalogRoot: string;
  incidentLedger: RuntimeIncidentLedger;
  now: () => Date;
}) {
  const file = resolve(input.catalogRoot, '.decision-os', 'delivery', 'lock');
  return {
    file,
    read(deliveryId = 'unknown'): DeliveryLeaseReadResult {
      const safeId = deliveryId === 'unknown' ? deliveryId : deliveryIdentity(deliveryId);
      if (!existsSync(file)) return { state: 'missing', deliveryId: safeId };
      try {
        const bytes = readFileSync(file);
        if (bytes.byteLength > 64 * 1024) throw new Error('Delivery lease exceeds 65536 bytes.');
        if (!isUtf8(bytes)) throw new Error('Delivery lease is not valid UTF-8.');
        const lease = exactRecord(JSON.parse(bytes.toString('utf8')) as unknown);
        return {
          state: 'available',
          deliveryId: lease.deliveryId,
          lease,
          expired: Date.parse(lease.expiresAt) <= input.now().getTime(),
        };
      } catch (error) {
        return recordDeliveryStoreIncident({
          incidentLedger: input.incidentLedger,
          deliveryId: safeId,
          code: 'delivery_lease_invalid',
          component: 'delivery-lease',
          operation: 'read',
          file,
          error,
        });
      }
    },
  };
}

function leaseHandle(input: {
  file: string;
  record: DeliveryLeaseRecord;
  repositoryLock: RepositoryMutationLock;
  incidentLedger: RuntimeIncidentLedger;
  now: () => Date;
  persistenceHooks?: DeliveryPersistenceHooks;
}): DeliveryLease {
  let record = input.record;
  let released = false;
  const readCurrent = (): DeliveryLeaseRecord => {
    if (!existsSync(input.file)) {
      throw new DeliveryLeaseError('delivery_lease_missing', 'The delivery lease disappeared before settlement.');
    }
    return exactRecord(JSON.parse(readFileSync(input.file, 'utf8')) as unknown);
  };
  const handle: DeliveryLease = {
    file: input.file,
    record,
    repositoryLock: input.repositoryLock,
    renew(durationMs = 30_000): DeliveryLeaseRecord {
      if (released) throw new DeliveryLeaseError('delivery_lease_missing', 'The delivery lease is already released.');
      const current = readCurrent();
      if (!sameLease(current, record)) {
        throw new DeliveryLeaseError('delivery_lease_owner_mismatch', 'The delivery lease owner changed before renewal.', current);
      }
      const observedAt = input.now();
      const observedIdentity = repositoryMutationProcessIdentity(process.pid);
      if (record.pid !== process.pid || record.processIdentity !== observedIdentity) {
        throw new DeliveryLeaseError('delivery_lease_owner_mismatch', 'Only the admitted process identity may renew the delivery lease.', current);
      }
      const next: DeliveryLeaseRecord = {
        ...record,
        renewedAt: observedAt.toISOString(),
        expiresAt: new Date(observedAt.getTime() + boundedDuration(durationMs)).toISOString(),
      };
      try {
        atomicWriteDeliveryJson({ file: input.file, value: next, hooks: input.persistenceHooks });
      } catch (error) {
        throw deliveryPersistenceFailure({
          incidentLedger: input.incidentLedger,
          deliveryId: record.deliveryId,
          code: 'delivery_lease_persistence_failed',
          component: 'delivery-lease',
          operation: 'renew',
          file: input.file,
          admittedSha: record.admittedSha,
          error,
        });
      }
      record = next;
      handle.record = record;
      return structuredClone(record);
    },
    release(): void {
      if (released) return;
      const current = readCurrent();
      if (!sameLease(current, record)) {
        throw new DeliveryLeaseError('delivery_lease_owner_mismatch', 'The delivery lease owner changed before release.', current);
      }
      try {
        rmSync(input.file);
        fsyncDeliveryDirectory(dirname(input.file));
      } catch (error) {
        throw deliveryPersistenceFailure({
          incidentLedger: input.incidentLedger,
          deliveryId: record.deliveryId,
          code: 'delivery_lease_persistence_failed',
          component: 'delivery-lease',
          operation: 'release',
          file: input.file,
          admittedSha: record.admittedSha,
          error,
        });
      }
      input.repositoryLock.release();
      released = true;
    },
  };
  return handle;
}

export function readDeliveryLeaseStatus(input: {
  catalogRoot: string;
  deliveryId?: string;
  incidentLedger?: RuntimeIncidentLedger;
  now?: () => Date;
}): DeliveryLeaseReadResult {
  const decisionOsRoot = resolve(input.catalogRoot, '.decision-os');
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({ decisionOsRoot });
  return createLeaseReader({
    catalogRoot: input.catalogRoot,
    incidentLedger,
    now: input.now ?? (() => new Date()),
  }).read(input.deliveryId);
}

export async function acquireDeliveryLease(input: {
  catalogRoot: string;
  repositoryRoot: string;
  deliveryId: string;
  admittedSha: string;
  durationMs?: number;
  signal?: AbortSignal;
  incidentLedger?: RuntimeIncidentLedger;
  persistenceHooks?: DeliveryPersistenceHooks;
  now?: () => Date;
}): Promise<DeliveryLease> {
  const deliveryId = deliveryIdentity(input.deliveryId);
  const admittedSha = admittedCommit(input.admittedSha);
  const durationMs = boundedDuration(input.durationMs);
  const now = input.now ?? (() => new Date());
  const decisionOsRoot = resolve(input.catalogRoot, '.decision-os');
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({ decisionOsRoot });
  const reader = createLeaseReader({ catalogRoot: input.catalogRoot, incidentLedger, now });
  const observed = reader.read(deliveryId);
  if (observed.state === 'paused') throw new DeliveryStorePausedError(observed);
  if (observed.state === 'available') {
    throw new DeliveryLeaseError(
      'delivery_lease_held',
      `Delivery lease ${observed.lease.deliveryId} is already held${observed.expired ? ' and requires matching resume' : ''}.`,
      observed.lease,
    );
  }

  const repositoryLock = await acquireRepositoryMutationLock({
    repositoryRoot: input.repositoryRoot,
    purpose: `delivery:${deliveryId}`,
    signal: input.signal,
  });
  try {
    const rechecked = reader.read(deliveryId);
    if (rechecked.state === 'paused') throw new DeliveryStorePausedError(rechecked);
    if (rechecked.state === 'available') {
      throw new DeliveryLeaseError('delivery_lease_held', `Delivery lease ${rechecked.lease.deliveryId} is already held.`, rechecked.lease);
    }
    const observedAt = now();
    const record: DeliveryLeaseRecord = {
      protocol: 1,
      token: randomUUID(),
      deliveryId,
      pid: process.pid,
      processIdentity: repositoryMutationProcessIdentity(process.pid),
      admittedSha,
      acquiredAt: observedAt.toISOString(),
      renewedAt: observedAt.toISOString(),
      expiresAt: new Date(observedAt.getTime() + durationMs).toISOString(),
    };
    try {
      atomicWriteDeliveryJson({ file: reader.file, value: record, hooks: input.persistenceHooks });
    } catch (error) {
      throw deliveryPersistenceFailure({
        incidentLedger,
        deliveryId,
        code: 'delivery_lease_persistence_failed',
        component: 'delivery-lease',
        operation: 'acquire',
        file: reader.file,
        admittedSha,
        error,
      });
    }
    return leaseHandle({
      file: reader.file,
      record,
      repositoryLock,
      incidentLedger,
      now,
      persistenceHooks: input.persistenceHooks,
    });
  } catch (error) {
    repositoryLock.release();
    throw error;
  }
}

export function renewDeliveryLease(lease: DeliveryLease, durationMs?: number): DeliveryLeaseRecord {
  return lease.renew(durationMs);
}

export async function resumeDeliveryLease(input: {
  catalogRoot: string;
  repositoryRoot: string;
  deliveryId: string;
  admittedSha: string;
  runStore: DeliveryRunStore;
  reconcileAuthority: (input: {
    deliveryId: string;
    admittedSha: string;
    lease: DeliveryLeaseRecord;
  }) => DeliveryAuthorityReconciliation | Promise<DeliveryAuthorityReconciliation>;
  durationMs?: number;
  signal?: AbortSignal;
  incidentLedger?: RuntimeIncidentLedger;
  persistenceHooks?: DeliveryPersistenceHooks;
  now?: () => Date;
}): Promise<DeliveryLease> {
  const deliveryId = deliveryIdentity(input.deliveryId);
  const admittedSha = admittedCommit(input.admittedSha);
  const durationMs = boundedDuration(input.durationMs);
  const now = input.now ?? (() => new Date());
  const decisionOsRoot = resolve(input.catalogRoot, '.decision-os');
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({ decisionOsRoot });
  const reader = createLeaseReader({ catalogRoot: input.catalogRoot, incidentLedger, now });
  const observed = reader.read(deliveryId);
  if (observed.state === 'paused') throw new DeliveryStorePausedError(observed);
  if (observed.state === 'missing') {
    throw new DeliveryLeaseError('delivery_lease_missing', `Delivery lease ${deliveryId} does not exist.`);
  }
  if (observed.lease.deliveryId !== deliveryId || observed.lease.admittedSha !== admittedSha) {
    throw new DeliveryLeaseError(
      'delivery_lease_owner_mismatch',
      'Resume identity does not match the durable delivery lease.',
      observed.lease,
    );
  }
  if (repositoryMutationOwnerProcessIsActive(observed.lease)) {
    throw new DeliveryLeaseError('delivery_lease_owner_alive', 'The delivery lease owner process is still active.', observed.lease);
  }
  const run = input.runStore.require(deliveryId);
  if (run.deliveryId !== deliveryId || run.admittedSha !== admittedSha || run.status === 'complete') {
    throw new DeliveryLeaseError('delivery_lease_journal_mismatch', 'The delivery journal does not admit this resume identity.', observed.lease);
  }
  const authority = reconciliation(await input.reconcileAuthority({
    deliveryId,
    admittedSha,
    lease: structuredClone(observed.lease),
  }));

  const repositoryLock = await acquireRepositoryMutationLock({
    repositoryRoot: input.repositoryRoot,
    purpose: `delivery:${deliveryId}`,
    signal: input.signal,
    authorizeChangedHeadRecovery: ({ owner }) => (
      owner.purpose === `delivery:${deliveryId}`
      && owner.pid === observed.lease.pid
      && owner.processIdentity === observed.lease.processIdentity
      && authority.reconciled
    ),
  });
  try {
    const rechecked = reader.read(deliveryId);
    if (rechecked.state === 'paused') throw new DeliveryStorePausedError(rechecked);
    if (rechecked.state === 'missing' || !sameLease(rechecked.lease, observed.lease)) {
      throw new DeliveryLeaseError(
        'delivery_lease_owner_mismatch',
        'The delivery lease changed during resume reconciliation.',
        rechecked.state === 'available' ? rechecked.lease : null,
      );
    }
    const observedAt = now();
    const resumed: DeliveryLeaseRecord = {
      ...observed.lease,
      token: randomUUID(),
      pid: process.pid,
      processIdentity: repositoryMutationProcessIdentity(process.pid),
      renewedAt: observedAt.toISOString(),
      expiresAt: new Date(observedAt.getTime() + durationMs).toISOString(),
    };
    try {
      atomicWriteDeliveryJson({ file: reader.file, value: resumed, hooks: input.persistenceHooks });
    } catch (error) {
      throw deliveryPersistenceFailure({
        incidentLedger,
        deliveryId,
        code: 'delivery_lease_persistence_failed',
        component: 'delivery-lease',
        operation: 'resume',
        file: reader.file,
        admittedSha,
        error,
      });
    }
    return leaseHandle({
      file: reader.file,
      record: resumed,
      repositoryLock,
      incidentLedger,
      now,
      persistenceHooks: input.persistenceHooks,
    });
  } catch (error) {
    repositoryLock.release();
    throw error;
  }
}
