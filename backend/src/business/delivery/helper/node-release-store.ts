/**
 * WHAT: Prepares immutable node releases and atomically owns the active release pointer.
 * WHY: Delivery must never reset a primary checkout or trust an unfetched local Git object.
 */
import { randomUUID } from 'node:crypto';
import { isUtf8 } from 'node:buffer';
import {
  existsSync,
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeSync,
  writeFileSync,
  openSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  runBoundedProcess,
  type BoundedProcessResult,
  type RunBoundedProcessInput,
} from '../../process/helper/run-bounded-process.js';
import { projectSyncGitSshCommand } from '../../project-sync/helper/project-sync-git-ssh-command.js';
import {
  repositoryMutationOwnerProcessIsActive,
  repositoryMutationProcessIdentity,
} from '../../content-authoring/helper/repository-mutation-lock.js';
import {
  createRuntimeIncidentLedger,
  type RuntimeIncidentLedger,
} from '../../server/helper/runtime-incident-ledger.js';
import {
  fsyncDeliveryDirectory,
  type DeliveryPersistenceHooks,
} from './delivery-durable-json.js';
import { recordDeliveryStoreIncident } from './delivery-store-boundary.js';

export type NodeReleaseProcessRunner = (input: RunBoundedProcessInput) => Promise<BoundedProcessResult>;

export type NodeReleaseIdentity = {
  releaseSha: string;
  activeReleasePointer: string;
  activeReleasePath: string;
  deliveryProtocol: number;
};

export type PreparedNodeRelease = {
  releaseSha: string;
  releasePath: string;
  activeBefore: NodeReleaseIdentity;
  reused: boolean;
};

export class NodeReleaseError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'NodeReleaseError';
  }
}

type NodeReleaseOperation = 'prepare' | 'initialize' | 'activate' | 'rollback';

export type NodeReleaseOperationLease = {
  protocol: 1;
  token: string;
  pid: number;
  processIdentity: string;
  operation: NodeReleaseOperation;
  targetCommit: string;
  expectedCommit: string;
  acquiredAt: string;
  expiresAt: string;
};

type NodeReleaseOperationLeaseRead =
  | { state: 'missing' }
  | { state: 'available'; lease: NodeReleaseOperationLease; expired: boolean; ownerActive: boolean }
  | { state: 'paused'; code: string; message: string; incidentId: string; file: string };

function sha(value: string, field: string): string {
  if (!/^[a-f0-9]{40}$/.test(value)) throw new NodeReleaseError(`node_release_${field}_invalid`, `${field} must be a lowercase 40-character Git SHA.`);
  return value;
}

function absoluteDirectory(value: string, field: string): string {
  if (!isAbsolute(value)) throw new NodeReleaseError(`node_release_${field}_invalid`, `${field} must be absolute.`);
  return resolve(value);
}

function contained(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return inner === '' || (!inner.startsWith('..') && !isAbsolute(inner));
}

function operationLeaseRecord(value: unknown): NodeReleaseOperationLease {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('Node release operation lease must be an object.');
  }
  const input = value as Record<string, unknown>;
  const keys = [
    'protocol', 'token', 'pid', 'processIdentity', 'operation', 'targetCommit',
    'expectedCommit', 'acquiredAt', 'expiresAt',
  ];
  if (Object.keys(input).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(input, key))) {
    throw new Error('Node release operation lease shape is invalid.');
  }
  if (input.protocol !== 1 || typeof input.token !== 'string' || !/^[a-f0-9-]{36}$/.test(input.token)) {
    throw new Error('Node release operation lease identity is invalid.');
  }
  if (!Number.isInteger(input.pid) || Number(input.pid) <= 0 || typeof input.processIdentity !== 'string' || input.processIdentity.length > 500) {
    throw new Error('Node release operation process identity is invalid.');
  }
  if (!['prepare', 'initialize', 'activate', 'rollback'].includes(String(input.operation))) {
    throw new Error('Node release operation is invalid.');
  }
  const targetCommit = sha(String(input.targetCommit), 'operation_target_commit');
  const expectedCommit = input.expectedCommit === '' ? '' : sha(String(input.expectedCommit), 'operation_expected_commit');
  for (const field of ['acquiredAt', 'expiresAt'] as const) {
    if (
      typeof input[field] !== 'string'
      || !Number.isFinite(Date.parse(input[field] as string))
      || !String(input[field]).endsWith('Z')
    ) throw new Error(`Node release operation ${field} is invalid.`);
  }
  if (Date.parse(input.expiresAt as string) <= Date.parse(input.acquiredAt as string)) {
    throw new Error('Node release operation lease expiry is invalid.');
  }
  return {
    protocol: 1,
    token: input.token,
    pid: Number(input.pid),
    processIdentity: input.processIdentity,
    operation: input.operation as NodeReleaseOperation,
    targetCommit,
    expectedCommit,
    acquiredAt: input.acquiredAt as string,
    expiresAt: input.expiresAt as string,
  };
}

async function processText(input: {
  command: string;
  args: string[];
  cwd: string;
  runner: NodeReleaseProcessRunner;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  operation: string;
}): Promise<string> {
  const result = await input.runner({
    command: input.command,
    args: input.args,
    cwd: input.cwd,
    env: input.env,
    deadlineMs: 10 * 60_000,
    signal: input.signal,
    maximumOutputBytes: 1024 * 1024,
    context: { component: 'node-release-store', operation: input.operation },
  });
  if (!result.ok) {
    const detail = result.stderr.trim() || result.stdout.trim() || result.spawnError || result.termination || `exit ${result.exitCode}`;
    throw new NodeReleaseError(`node_release_${input.operation}_failed`, `${input.operation} failed: ${detail}.`);
  }
  return result.stdout.trim();
}

function markerFile(releasePath: string): string {
  return resolve(releasePath, '.decision-os-release.json');
}

function readMarker(releasePath: string): { protocol: 1; releaseSha: string; launcher: string } {
  try {
    const value = JSON.parse(readFileSync(markerFile(releasePath), 'utf8')) as Record<string, unknown>;
    if (
      value.protocol !== 1
      || typeof value.releaseSha !== 'string'
      || !/^[a-f0-9]{40}$/.test(value.releaseSha)
      || value.launcher !== 'bin/decision-os-server.mjs'
    ) throw new Error('invalid marker');
    return value as { protocol: 1; releaseSha: string; launcher: string };
  } catch {
    throw new NodeReleaseError('node_release_marker_invalid', 'The immutable release marker is invalid.');
  }
}

function writeMarker(releasePath: string, releaseSha: string): void {
  writeFileSync(markerFile(releasePath), `${JSON.stringify({
    protocol: 1,
    releaseSha,
    launcher: 'bin/decision-os-server.mjs',
  }, null, 2)}\n`, { flag: 'wx', mode: 0o444 });
}

export function readActiveNodeRelease(input: {
  releaseRoot: string;
  currentPointer?: string;
}): NodeReleaseIdentity {
  const releaseRoot = absoluteDirectory(input.releaseRoot, 'root');
  const currentPointer = resolve(input.currentPointer ?? resolve(releaseRoot, 'current'));
  if (!contained(releaseRoot, currentPointer)) throw new NodeReleaseError('node_release_pointer_outside_root', 'The active release pointer is outside the release root.');
  if (!existsSync(currentPointer)) return {
    releaseSha: '',
    activeReleasePointer: currentPointer,
    activeReleasePath: '',
    deliveryProtocol: 1,
  };
  if (!lstatSync(currentPointer).isSymbolicLink()) throw new NodeReleaseError('node_release_pointer_invalid', 'The active release pointer must be a symbolic link.');
  const target = resolve(resolve(currentPointer, '..'), readlinkSync(currentPointer));
  if (!contained(resolve(releaseRoot, 'releases'), target)) throw new NodeReleaseError('node_release_pointer_outside_releases', 'The active release target is outside immutable releases.');
  const marker = readMarker(target);
  if (basename(target) !== marker.releaseSha) throw new NodeReleaseError('node_release_pointer_identity_mismatch', 'The active release directory does not match its marker SHA.');
  return {
    releaseSha: marker.releaseSha,
    activeReleasePointer: currentPointer,
    activeReleasePath: target,
    deliveryProtocol: marker.protocol,
  };
}

export function createNodeReleaseStore(input: {
  repositoryRoot: string;
  releaseRoot: string;
  settings: unknown;
  runner?: NodeReleaseProcessRunner;
  environment?: NodeJS.ProcessEnv;
  incidentLedger?: RuntimeIncidentLedger;
  decisionOsRoot?: string;
  now?: () => Date;
  operationLeaseDurationMs?: number;
  processId?: number;
  processIdentity?: string;
  processIsActive?: (owner: Pick<NodeReleaseOperationLease, 'pid' | 'processIdentity'>) => boolean;
  persistenceHooks?: DeliveryPersistenceHooks;
  operationHooks?: { beforeLeaseRelease?(): void };
}) {
  const repositoryRoot = absoluteDirectory(input.repositoryRoot, 'repository_root');
  const releaseRoot = absoluteDirectory(input.releaseRoot, 'root');
  const releasesRoot = resolve(releaseRoot, 'releases');
  const currentPointer = resolve(releaseRoot, 'current');
  const runner = input.runner ?? runBoundedProcess;
  const ssh = projectSyncGitSshCommand(input.settings);
  if (!ssh) throw new NodeReleaseError('node_release_ssh_identity_missing', 'The Wise SSH identity is not configured.');
  const env = { ...(input.environment ?? process.env), GIT_SSH_COMMAND: ssh, GIT_TERMINAL_PROMPT: '0' };
  mkdirSync(releasesRoot, { recursive: true });
  const operationLock = resolve(releaseRoot, 'release-operation.lock');
  const now = input.now ?? (() => new Date());
  const processId = input.processId ?? process.pid;
  const processIdentity = input.processIdentity ?? repositoryMutationProcessIdentity(processId);
  const processIsActive = input.processIsActive ?? repositoryMutationOwnerProcessIsActive;
  const operationLeaseDurationMs = Math.min(
    60 * 60_000,
    Math.max(60_000, Math.floor(input.operationLeaseDurationMs ?? 30 * 60_000)),
  );
  const settingsRecord = input.settings && typeof input.settings === 'object'
    ? input.settings as Record<string, unknown>
    : {};
  const incidentDecisionOsRoot = resolve(input.decisionOsRoot
    ?? String(settingsRecord.deliveryDecisionOsRoot ?? resolve(releaseRoot, '.decision-os')));
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({ decisionOsRoot: incidentDecisionOsRoot });
  const incidentDeliveryId = `node-release-${String(settingsRecord.deliveryNodeId ?? 'local')}`;

  const readOperationLease = (): NodeReleaseOperationLeaseRead => {
    if (!existsSync(operationLock)) return { state: 'missing' };
    try {
      const bytes = readFileSync(operationLock);
      if (bytes.byteLength > 64 * 1024) throw new Error('Node release operation lease exceeds 65536 bytes.');
      if (!isUtf8(bytes)) throw new Error('Node release operation lease is not valid UTF-8.');
      const lease = operationLeaseRecord(JSON.parse(bytes.toString('utf8')) as unknown);
      return {
        state: 'available',
        lease,
        expired: Date.parse(lease.expiresAt) <= now().getTime(),
        ownerActive: processIsActive(lease),
      };
    } catch (error) {
      const paused = recordDeliveryStoreIncident({
        incidentLedger,
        deliveryId: incidentDeliveryId,
        code: 'node_release_operation_lease_invalid',
        component: 'node-release-store',
        operation: 'read-operation-lease',
        file: operationLock,
        error,
      });
      return {
        state: 'paused',
        code: paused.code,
        message: paused.message,
        incidentId: paused.incidentId,
        file: paused.file,
      };
    }
  };

  const requireNoPausedOperationLease = (): Exclude<NodeReleaseOperationLeaseRead, { state: 'paused' }> => {
    const observed = readOperationLease();
    if (observed.state === 'paused') {
      throw new NodeReleaseError(observed.code, `${observed.message} Incident ${observed.incidentId}.`);
    }
    return observed;
  };

  const acquireOperationLease = (
    operation: NodeReleaseOperation,
    targetCommit: string,
    expectedCommit = '',
  ): (() => void) => {
    const observed = requireNoPausedOperationLease();
    if (observed.state === 'available') {
      const code = !observed.ownerActive && observed.expired
        ? 'node_release_operation_recovery_required'
        : 'node_release_operation_locked';
      throw new NodeReleaseError(
        code,
        code === 'node_release_operation_recovery_required'
          ? 'The prior node release operation requires explicit state reconciliation.'
          : 'Another node release operation lease is active.',
      );
    }
    const acquiredAt = now();
    const lease: NodeReleaseOperationLease = {
      protocol: 1,
      token: randomUUID(),
      pid: processId,
      processIdentity,
      operation,
      targetCommit,
      expectedCommit,
      acquiredAt: acquiredAt.toISOString(),
      expiresAt: new Date(acquiredAt.getTime() + operationLeaseDurationMs).toISOString(),
    };
    try {
      input.persistenceHooks?.atStage?.('before-temporary-open', { file: operationLock, temporaryFile: operationLock });
      const descriptor = openSync(operationLock, 'wx', 0o600);
      try {
        const bytes = Buffer.from(`${JSON.stringify(lease, null, 2)}\n`, 'utf8');
        writeSync(descriptor, bytes, 0, bytes.length);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      fsyncDeliveryDirectory(releaseRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new NodeReleaseError('node_release_operation_locked', 'Another node release operation lease is active.');
      }
      throw error;
    }
    return () => {
      input.operationHooks?.beforeLeaseRelease?.();
      const current = requireNoPausedOperationLease();
      if (current.state !== 'available' || current.lease.token !== lease.token) {
        throw new NodeReleaseError('node_release_operation_owner_mismatch', 'The node release operation lease owner changed before cleanup.');
      }
      rmSync(operationLock);
      fsyncDeliveryDirectory(releaseRoot);
    };
  };

  const git = async (args: string[], operation: string, signal?: AbortSignal): Promise<string> => await processText({
    command: 'git',
    args: ['-C', repositoryRoot, ...args],
    cwd: repositoryRoot,
    runner,
    env,
    signal,
    operation,
  });

  const active = (): NodeReleaseIdentity => readActiveNodeRelease({ releaseRoot, currentPointer });

  return {
    repositoryRoot,
    releaseRoot,
    releasesRoot,
    currentPointer,
    active,
    operationLeaseFile: operationLock,
    operationLeaseStatus: readOperationLease,
    reconcileOperationLease(inputValue: {
      operation: NodeReleaseOperation;
      targetCommit: string;
      expectedCommit?: string;
    }): { recovered: true; outcome: 'applied' | 'not-applied' } {
      const targetCommit = sha(inputValue.targetCommit, 'operation_target_commit');
      const expectedCommit = inputValue.expectedCommit
        ? sha(inputValue.expectedCommit, 'operation_expected_commit')
        : '';
      const observed = requireNoPausedOperationLease();
      if (observed.state === 'missing') {
        throw new NodeReleaseError('node_release_operation_lease_missing', 'No node release operation lease requires reconciliation.');
      }
      if (observed.ownerActive) {
        throw new NodeReleaseError('node_release_operation_locked', 'The node release operation lease owner is still active.');
      }
      if (!observed.expired) {
        throw new NodeReleaseError('node_release_operation_lease_unexpired', 'The node release operation lease has not reached its finite expiry.');
      }
      const lease = observed.lease;
      if (
        lease.operation !== inputValue.operation
        || lease.targetCommit !== targetCommit
        || lease.expectedCommit !== expectedCommit
      ) {
        throw new NodeReleaseError('node_release_operation_reconciliation_mismatch', 'Recovery input does not match the durable node release operation lease.');
      }
      let outcome: 'applied' | 'not-applied';
      try {
        if (lease.operation === 'prepare') {
          const target = resolve(releasesRoot, targetCommit);
          if (!existsSync(target)) outcome = 'not-applied';
          else {
            const marker = readMarker(target);
            if (marker.releaseSha !== targetCommit) throw new Error('Prepared release identity differs from the lease.');
            outcome = 'applied';
          }
        } else {
          const current = active().releaseSha;
          if (current === targetCommit) outcome = 'applied';
          else if (current === expectedCommit) outcome = 'not-applied';
          else throw new Error('The active release pointer matches neither side of the interrupted operation.');
        }
      } catch (error) {
        const paused = recordDeliveryStoreIncident({
          incidentLedger,
          deliveryId: incidentDeliveryId,
          code: 'node_release_operation_reconciliation_failed',
          component: 'node-release-store',
          operation: 'reconcile-operation-lease',
          file: operationLock,
          admittedSha: targetCommit,
          error,
        });
        throw new NodeReleaseError(paused.code, `${paused.message} Incident ${paused.incidentId}.`);
      }
      const rechecked = requireNoPausedOperationLease();
      if (rechecked.state !== 'available' || rechecked.lease.token !== lease.token) {
        throw new NodeReleaseError('node_release_operation_owner_mismatch', 'The node release operation lease changed during reconciliation.');
      }
      rmSync(operationLock);
      fsyncDeliveryDirectory(releaseRoot);
      return { recovered: true, outcome };
    },
    releasePath(releaseSha: string): string {
      return resolve(releasesRoot, sha(releaseSha, 'sha'));
    },
    async prepare(releaseShaInput: string, signal?: AbortSignal): Promise<PreparedNodeRelease> {
      const releaseSha = sha(releaseShaInput, 'sha');
      const releaseOperation = acquireOperationLease('prepare', releaseSha);
      try {
        await git(['fetch', '--prune', 'origin', 'main'], 'fetch_origin_main', signal);
        const originMain = sha(await git(['rev-parse', 'refs/remotes/origin/main'], 'read_origin_main', signal), 'origin_main');
        await git(['cat-file', '-e', `${releaseSha}^{commit}`], 'verify_commit_object', signal);
        await git(['merge-base', '--is-ancestor', releaseSha, originMain], 'verify_origin_main_reachability', signal);
        const releasePath = resolve(releasesRoot, releaseSha);
        const activeBefore = active();
        if (existsSync(releasePath)) {
          const marker = readMarker(releasePath);
          if (marker.releaseSha !== releaseSha) throw new NodeReleaseError('node_release_identity_conflict', 'The existing release path has another identity.');
          return { releaseSha, releasePath, activeBefore, reused: true };
        }
        try {
          await git(['worktree', 'add', '--detach', releasePath, releaseSha], 'create_release_worktree', signal);
          for (const workspace of ['', 'backend', 'frontend']) {
            const lockfile = resolve(releasePath, workspace, 'package-lock.json');
            if (!existsSync(lockfile)) throw new NodeReleaseError('node_release_lockfile_missing', `Missing lockfile for ${workspace || 'root'} workspace.`);
            await processText({
              command: 'npm',
              args: ['ci', '--no-audit', '--no-fund'],
              cwd: resolve(releasePath, workspace),
              runner,
              env,
              signal,
              operation: `install_${workspace || 'root'}_dependencies`,
            });
          }
          const launcher = resolve(releasePath, 'bin', 'decision-os-server.mjs');
          if (!existsSync(launcher)) throw new NodeReleaseError('node_release_launcher_missing', 'The release launcher is missing.');
          writeMarker(releasePath, releaseSha);
        } catch (error) {
          await git(['worktree', 'remove', '--force', releasePath], 'remove_failed_release', signal).catch(() => undefined);
          rmSync(releasePath, { recursive: true, force: true });
          throw error;
        }
        return { releaseSha, releasePath, activeBefore, reused: false };
      } finally {
        releaseOperation();
      }
    },
    initialize(targetCommitInput: string): { activeCommit: string; pointer: string } {
      const targetCommit = sha(targetCommitInput, 'target_commit');
      const releaseOperation = acquireOperationLease('initialize', targetCommit);
      try {
        const current = active();
        if (current.releaseSha) {
          if (current.releaseSha !== targetCommit) {
            throw new NodeReleaseError('node_release_bootstrap_pointer_conflict', 'Bootstrap found a different existing active release.');
          }
          return { activeCommit: targetCommit, pointer: currentPointer };
        }
        const target = resolve(releasesRoot, targetCommit);
        if (!existsSync(target) || readMarker(target).releaseSha !== targetCommit) {
          throw new NodeReleaseError('node_release_not_prepared', 'The initial release has not been prepared.');
        }
        const temporary = resolve(releaseRoot, `.current-${process.pid}-${randomUUID()}`);
        symlinkSync(relative(releaseRoot, target), temporary);
        try { renameSync(temporary, currentPointer); }
        finally { rmSync(temporary, { force: true }); }
        fsyncDeliveryDirectory(releaseRoot);
        return { activeCommit: targetCommit, pointer: currentPointer };
      } finally {
        releaseOperation();
      }
    },
    activate(targetCommitInput: string, expectedCommitInput: string): { previousCommit: string; activeCommit: string; pointer: string } {
      const targetCommit = sha(targetCommitInput, 'target_commit');
      const expectedCommit = sha(expectedCommitInput, 'expected_commit');
      const releaseOperation = acquireOperationLease('activate', targetCommit, expectedCommit);
      try {
        const current = active();
        if (current.releaseSha !== expectedCommit) {
          throw new NodeReleaseError('node_release_pointer_conflict', 'The active release no longer matches expectedCommit.');
        }
        const target = resolve(releasesRoot, targetCommit);
        if (!existsSync(target) || readMarker(target).releaseSha !== targetCommit) {
          throw new NodeReleaseError('node_release_not_prepared', 'The target release has not been prepared.');
        }
        if (current.releaseSha === targetCommit) {
          return { previousCommit: expectedCommit, activeCommit: targetCommit, pointer: currentPointer };
        }
        const temporary = resolve(releaseRoot, `.current-${process.pid}-${randomUUID()}`);
        symlinkSync(relative(releaseRoot, target), temporary);
        try { renameSync(temporary, currentPointer); }
        finally { rmSync(temporary, { force: true }); }
        fsyncDeliveryDirectory(dirname(currentPointer));
        return { previousCommit: expectedCommit, activeCommit: targetCommit, pointer: currentPointer };
      } finally {
        releaseOperation();
      }
    },
    rollback(targetCommit: string, expectedCommit: string) {
      const target = sha(targetCommit, 'target_commit');
      const expected = sha(expectedCommit, 'expected_commit');
      const releaseOperation = acquireOperationLease('rollback', target, expected);
      try {
        const current = active();
        if (current.releaseSha !== expected) {
          throw new NodeReleaseError('node_release_pointer_conflict', 'The active release no longer matches expectedCommit.');
        }
        const releasePath = resolve(releasesRoot, target);
        if (!existsSync(releasePath) || readMarker(releasePath).releaseSha !== target) {
          throw new NodeReleaseError('node_release_not_prepared', 'The rollback release has not been prepared.');
        }
        if (current.releaseSha !== target) {
          const temporary = resolve(releaseRoot, `.current-${processId}-${randomUUID()}`);
          symlinkSync(relative(releaseRoot, releasePath), temporary);
          try { renameSync(temporary, currentPointer); }
          finally { rmSync(temporary, { force: true }); }
          fsyncDeliveryDirectory(dirname(currentPointer));
        }
        return { previousCommit: expected, activeCommit: target, pointer: currentPointer };
      } finally {
        releaseOperation();
      }
    },
  };
}

export type NodeReleaseStore = ReturnType<typeof createNodeReleaseStore>;
