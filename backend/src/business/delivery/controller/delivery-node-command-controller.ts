/**
 * WHAT: Executes the fixed protocol-1 node delivery command set behind durable idempotent receipts.
 * WHY: Remote delivery authority must not expose shell, path, environment, URL, port, or supervisor inputs.
 */
import { createHash } from 'node:crypto';
import {
  decisionOsDeliveryProtocol,
  parseDeliveryNodeCommand,
  type DeliveryNodeCommand,
  type DeliveryNodeReceipt,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import type { DeliveryNodeReceiptStore } from '../helper/delivery-node-receipt-store.js';
import type { NodeReleaseStore } from '../helper/node-release-store.js';
import { repositoryMutationProcessIdentity } from '../../content-authoring/helper/repository-mutation-lock.js';
import { redactDeliveryText } from '../helper/delivery-redactor.js';

type AnyRecord = Record<string, unknown>;

export class DeliveryNodeCommandError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode = 409) {
    super(message);
    this.name = 'DeliveryNodeCommandError';
  }
}

function receiptId(nodeId: string, command: DeliveryNodeCommand): string {
  return `delivery-node-${createHash('sha256').update(JSON.stringify({ nodeId, ...command })).digest('hex').slice(0, 32)}`;
}

function validateNodeSettings(settingsInput: unknown, nodeId: string): void {
  const settings = settingsInput && typeof settingsInput === 'object' ? settingsInput as AnyRecord : {};
  if (
    settings.deliveryProtocol !== decisionOsDeliveryProtocol
    || settings.deliveryNodeId !== nodeId
    || settings.deliverySupervisorAdopted !== true
    || settings.deliverySupervisedExit !== true
    || settings.deliveryEmergencyHealth !== true
  ) throw new DeliveryNodeCommandError('delivery_node_not_bootstrapped', 'The target node has not adopted delivery protocol 1.', 503);
}

export async function executeDeliveryNodeCommand(input: {
  command: unknown;
  nodeId: string;
  settings: unknown;
  receiptStore: DeliveryNodeReceiptStore;
  releaseStore: NodeReleaseStore;
  scheduleSupervisedExit: (receipt: DeliveryNodeReceipt) => void;
  readStatusEvidence?: () => DeliveryNodeReceipt['evidence'];
  now?: () => Date;
  signal?: AbortSignal;
}): Promise<DeliveryNodeReceipt> {
  const command = parseDeliveryNodeCommand(input.command);
  validateNodeSettings(input.settings, input.nodeId);
  const now = input.now ?? (() => new Date());
  if (command.action === 'status') {
    const active = input.releaseStore.active();
    const statusEvidence = input.readStatusEvidence?.() ?? [];
    const actionReceipt = (action: 'prepare' | 'activate' | 'rollback'): DeliveryNodeReceipt | null => {
      const targetCommit = action === 'rollback' ? command.expectedCommit : command.targetCommit;
      const expectedCommit = action === 'rollback' ? command.targetCommit : command.expectedCommit;
      const state = input.receiptStore.readCommand({
        deliveryId: command.deliveryId,
        action,
        targetCommit,
        expectedCommit,
      });
      return state.state === 'available' && state.receipt.status === 'complete' ? state.receipt : null;
    };
    const prepare = actionReceipt('prepare');
    const activate = actionReceipt('activate');
    const rollback = actionReceipt('rollback');
    const observedAt = now().toISOString();
    const processStartedAt = statusEvidence.find((entry) => entry.key === 'processStartedAt')?.value;
    return {
      protocol: decisionOsDeliveryProtocol,
      receiptId: `delivery-status-${createHash('sha256').update(JSON.stringify({
        nodeId: input.nodeId,
        deliveryId: command.deliveryId,
        observedAt,
      })).digest('hex').slice(0, 32)}`,
      deliveryId: command.deliveryId,
      nodeId: input.nodeId,
      action: 'status',
      targetCommit: command.targetCommit,
      expectedCommit: command.expectedCommit,
      status: 'complete',
      attempt: 1,
      startedAt: observedAt,
      completedAt: observedAt,
      previousCommit: active.releaseSha || null,
      activeCommit: active.releaseSha || null,
      processIdentity: typeof processStartedAt === 'string'
        ? processStartedAt
        : repositoryMutationProcessIdentity(process.pid),
      command: null,
      evidence: [
        { key: 'activeReleasePointer', value: active.releaseSha ? `current:${active.releaseSha}` : 'unbootstrapped' },
        { key: 'prepareReceiptId', value: prepare?.receiptId ?? '' },
        { key: 'prepareReceiptStatus', value: prepare?.status ?? '' },
        { key: 'activateReceiptId', value: activate?.receiptId ?? '' },
        { key: 'activateReceiptStatus', value: activate?.status ?? '' },
        { key: 'rollbackReceiptId', value: rollback?.receiptId ?? '' },
        { key: 'rollbackReceiptStatus', value: rollback?.status ?? '' },
        ...statusEvidence,
      ],
      error: null,
    };
  }
  const current = input.receiptStore.readCommand(command);
  if (current.state === 'paused') {
    throw new DeliveryNodeCommandError(current.code, current.message, 503);
  }
  if (current.state === 'available' && current.receipt.status !== 'accepted') return current.receipt;
  if (current.state === 'available') {
    const accepted = current.receipt;
    const operationLease = input.releaseStore.operationLeaseStatus?.();
    if (operationLease?.state === 'paused') {
      throw new DeliveryNodeCommandError(operationLease.code, operationLease.message, 503);
    }
    if (operationLease?.state === 'available') {
      const exactLease = operationLease.lease.operation === command.action
        && operationLease.lease.targetCommit === command.targetCommit
        && operationLease.lease.expectedCommit === command.expectedCommit;
      if (!exactLease) {
        throw new DeliveryNodeCommandError(
          'node_release_operation_reconciliation_mismatch',
          'The accepted receipt does not match the unsettled node operation lease.',
        );
      }
      if (operationLease.ownerActive || !operationLease.expired) {
        throw new DeliveryNodeCommandError(
          'node_release_operation_locked',
          'The accepted node operation is still owned by its original process.',
          409,
        );
      }
      input.releaseStore.reconcileOperationLease?.({
        operation: command.action as 'prepare' | 'activate' | 'rollback',
        targetCommit: command.targetCommit,
        expectedCommit: command.expectedCommit,
      });
    }
    const active = input.releaseStore.active();
    if ((command.action === 'activate' || command.action === 'rollback') && active.releaseSha === command.targetCommit) {
      const complete = {
        ...accepted,
        status: 'complete' as const,
        completedAt: now().toISOString(),
        activeCommit: active.releaseSha,
        evidence: [{ key: 'activeReleasePointer', value: `current:${active.releaseSha}` }],
      };
      input.receiptStore.write(complete);
      input.scheduleSupervisedExit(complete);
      return complete;
    }
    if (command.action === 'preflight') {
      const complete = {
        ...accepted,
        status: 'complete' as const,
        completedAt: now().toISOString(),
        activeCommit: active.releaseSha || null,
        evidence: [
          { key: 'supervisorAdopted', value: true },
          { key: 'deliveryProtocol', value: decisionOsDeliveryProtocol },
        ],
      };
      input.receiptStore.write(complete);
      return complete;
    }
    if (active.releaseSha !== command.expectedCommit) {
      const failed = {
        ...accepted,
        status: 'failed' as const,
        completedAt: now().toISOString(),
        activeCommit: active.releaseSha || null,
        error: {
          code: 'node_release_pointer_conflict',
          message: 'The live pointer matches neither the accepted operation predecessor nor its target.',
        },
      };
      input.receiptStore.write(failed);
      return failed;
    }
    // The exact operation lease is settled and the live pointer still matches the predecessor.
    // Retrying the immutable prepare or pointer mutation is safe under the node release lease.
  }
  const startedAt = now().toISOString();
  const delivery = input.receiptStore.read(command.deliveryId);
  if (delivery.state === 'paused') {
    throw new DeliveryNodeCommandError(delivery.code, delivery.message, 503);
  }
  const attempt = delivery.state === 'available' ? delivery.actionIndex.length + 1 : 1;
  const activeBefore = input.releaseStore.active();
  const accepted: DeliveryNodeReceipt = current.state === 'available' ? current.receipt : {
    protocol: decisionOsDeliveryProtocol,
    receiptId: receiptId(input.nodeId, command),
    deliveryId: command.deliveryId,
    nodeId: input.nodeId,
    action: command.action,
    targetCommit: command.targetCommit,
    expectedCommit: command.expectedCommit,
    status: 'accepted',
    attempt,
    startedAt,
    completedAt: '',
    previousCommit: activeBefore.releaseSha || null,
    activeCommit: activeBefore.releaseSha || null,
    processIdentity: repositoryMutationProcessIdentity(process.pid),
    command: null,
    evidence: [],
    error: null,
  };
  if (current.state !== 'available') input.receiptStore.create(accepted);

  try {
    let evidence: DeliveryNodeReceipt['evidence'] = [];
    if (input.signal?.aborted) throw new DeliveryNodeCommandError('delivery_node_command_cancelled', 'The node delivery command was cancelled.', 499);
    if (activeBefore.releaseSha !== command.expectedCommit) {
      throw new DeliveryNodeCommandError('node_release_pointer_conflict', 'The active release does not match expectedCommit.');
    }
    if (command.action === 'preflight') {
      evidence = [
        { key: 'supervisorAdopted', value: true },
        { key: 'deliveryProtocol', value: decisionOsDeliveryProtocol },
      ];
    } else if (command.action === 'prepare') {
      const prepared = await input.releaseStore.prepare(command.targetCommit, input.signal);
      if (input.signal?.aborted) throw new DeliveryNodeCommandError('delivery_node_command_cancelled', 'The node delivery command was cancelled.', 499);
      evidence = [{ key: 'releaseReused', value: prepared.reused }];
    } else if (command.action === 'activate' || command.action === 'rollback') {
      if (input.signal?.aborted) throw new DeliveryNodeCommandError('delivery_node_command_cancelled', 'The node delivery command was cancelled.', 499);
      const activation = command.action === 'activate'
        ? input.releaseStore.activate(command.targetCommit, command.expectedCommit)
        : input.releaseStore.rollback(command.targetCommit, command.expectedCommit);
      evidence = [{ key: 'activeReleasePointer', value: `current:${activation.activeCommit}` }];
    }
    const activeAfter = input.releaseStore.active();
    const complete: DeliveryNodeReceipt = {
      ...accepted,
      status: 'complete',
      completedAt: now().toISOString(),
      activeCommit: activeAfter.releaseSha || null,
      evidence,
    };
    input.receiptStore.write(complete);
    if (command.action === 'activate' || command.action === 'rollback') input.scheduleSupervisedExit(complete);
    return complete;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'delivery_node_action_failed';
    const failed: DeliveryNodeReceipt = {
      ...accepted,
      status: 'failed',
      completedAt: now().toISOString(),
      activeCommit: input.releaseStore.active().releaseSha || null,
      error: { code, message: redactDeliveryText(error instanceof Error ? error.message : error) },
    };
    input.receiptStore.write(failed);
    throw new DeliveryNodeCommandError(code, failed.error.message, error instanceof DeliveryNodeCommandError ? error.statusCode : 500);
  }
}
