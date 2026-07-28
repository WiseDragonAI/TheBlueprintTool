/**
 * WHAT: Reverses activated node runtimes and relay traffic from one durable delivery journal.
 * WHY: Runtime compensation must be deterministic, resumable, receipt-backed, and must never rewind main.
 */
import {
  parseDeliveryNodeReceipt,
  parseDeliveryRun,
  type DeliveryNodeCommand,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import type { RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import { createRuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import {
  DeliveryCoordinatorError,
  nodeReceiptEvidence,
  phaseReceipt,
  receiptForOperation,
  reconcileDeliveryAuthority,
  withDeliveryDeadline,
  type DeliveryCoordinatorEffects,
} from '../helper/delivery-coordinator.js';
import type { DeliveryRunStore } from '../helper/delivery-run-store.js';
import { createDeliveryRunStore } from '../helper/delivery-run-store.js';
import { resumeDeliveryLease } from '../helper/delivery-lease.js';
import { redactDeliveryError, redactDeliveryText, redactDeliveryValue } from '../helper/delivery-redactor.js';

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : 'delivery_compensation_failed';
}

function priorRelayVersion(run: DeliveryRun): string {
  const receipt = receiptForOperation(run, 'read-relay-predecessor');
  const value = receipt?.evidence.find((entry) => entry.key === 'priorVersionId')?.value;
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(value)) {
    throw new DeliveryCoordinatorError(
      'delivery_relay_predecessor_missing',
      'The journal has no exact prior relay version receipt.',
      'compensation',
    );
  }
  return value;
}

export async function rollbackDecisionOsDelivery(input: {
  run: DeliveryRun;
  runStore: DeliveryRunStore;
  effects: DeliveryCoordinatorEffects;
  incidentLedger: RuntimeIncidentLedger;
  signal?: AbortSignal;
  now?: () => Date;
  deadlineMs?: number;
  reason?: { code: string; message: string; phase: DeliveryRun['phase']; nodeId?: string };
}): Promise<DeliveryRun> {
  const now = input.now ?? (() => new Date());
  const deadlineMs = input.deadlineMs ?? 60_000;
  let run = parseDeliveryRun(input.run);
  const persist = (next: DeliveryRun): DeliveryRun => input.runStore.write({
    ...parseDeliveryRun(next),
    updatedAt: now().toISOString(),
  });
  const execute = async <T>(operation: string, effect: (signal: AbortSignal) => Promise<T>): Promise<T> => (
    await withDeliveryDeadline({
      operation,
      deadlineMs,
      parentSignal: input.signal,
      execute: effect,
    })
  );
  const beginCompensation = (operation: string, nodeId: string, commitSha: string | null): {
    run: DeliveryRun;
    startedAt: string;
    alreadySucceeded: boolean;
  } => {
    const existing = receiptForOperation(run, operation, true);
    if (existing?.status === 'failed') {
      throw new DeliveryCoordinatorError(
        'delivery_phase_receipt_terminal',
        `Compensation operation ${operation} already failed terminally.`,
        'compensation',
        nodeId,
      );
    }
    const retry = run.retries.find((entry) => entry.operation === operation);
    const attempts = (retry?.attempts ?? 0) + 1;
    const maximumAttempts = retry?.maximumAttempts ?? 10;
    if (attempts > maximumAttempts) {
      throw new DeliveryCoordinatorError(
        'delivery_retry_limit_reached',
        `Compensation operation ${operation} exhausted its retry budget.`,
        'compensation',
        nodeId,
      );
    }
    const startedAt = existing?.startedAt ?? now().toISOString();
    run = persist({
      ...run,
      phase: 'compensation',
      retries: [
        ...run.retries.filter((entry) => entry.operation !== operation),
        { operation, attempts, maximumAttempts },
      ],
      compensationReceipts: existing
        ? run.compensationReceipts
        : [...run.compensationReceipts, phaseReceipt({
            run,
            phase: 'compensation',
            operation,
            status: 'started',
            now: new Date(startedAt),
            nodeId,
            commitSha,
          })],
      deadlines: [
        ...run.deadlines.filter((entry) => entry.operation !== operation),
        { operation, deadlineAt: new Date(now().getTime() + deadlineMs).toISOString() },
      ],
    });
    return { run, startedAt, alreadySucceeded: existing?.status === 'succeeded' };
  };

  try {
    const reconciliationStarted = beginCompensation('reconcile-before-rollback', 'coordinator', run.mainSha);
    run = reconciliationStarted.run;
    const authority = await execute('reconcile-before-rollback', async (signal) => (
      await input.effects.observeAuthority({ run, signal })
    ));
    run = persist(reconcileDeliveryAuthority(run, authority));
    if (!reconciliationStarted.alreadySucceeded) {
      run = persist({
        ...run,
        compensationReceipts: [...run.compensationReceipts, phaseReceipt({
          run,
          phase: 'compensation',
          operation: 'reconcile-before-rollback',
          status: 'succeeded',
          startedAt: reconciliationStarted.startedAt,
          now: now(),
          nodeId: 'coordinator',
          commitSha: run.mainSha,
          evidence: [{ key: 'observedAt', value: authority.observedAt }],
        })],
      });
    }
    const activated = [...run.activationOrder].reverse();
    for (const nodeId of activated) {
      const node = run.nodes.find((entry) => entry.nodeId === nodeId);
      if (!node || node.state === 'rolled-back') continue;
      if (!node.priorReleaseSha || !run.mainSha) {
        throw new DeliveryCoordinatorError(
          'delivery_node_predecessor_missing',
          `Node ${nodeId} has no rollback predecessor.`,
          'compensation',
          nodeId,
        );
      }
      const operation = `rollback-node:${nodeId}`;
      const started = beginCompensation(operation, nodeId, node.priorReleaseSha);
      run = started.run;
      const command: DeliveryNodeCommand = {
        deliveryId: run.deliveryId,
        action: 'rollback',
        targetCommit: node.priorReleaseSha,
        expectedCommit: run.mainSha,
      };
      if (!started.alreadySucceeded) {
        const receipt = parseDeliveryNodeReceipt(await execute(operation, async (signal) => (
          await input.effects.dispatchNode({ nodeId, command, signal })
        )));
        if (receipt.status !== 'complete' || receipt.activeCommit !== node.priorReleaseSha) {
          throw new DeliveryCoordinatorError(
            'delivery_node_rollback_incomplete',
            `Node ${nodeId} did not restore its predecessor.`,
            'compensation',
            nodeId,
          );
        }
        run = persist({
          ...run,
          compensationReceipts: [...run.compensationReceipts, phaseReceipt({
            run,
            phase: 'compensation',
            operation,
            status: 'succeeded',
            startedAt: started.startedAt,
            now: now(),
            nodeId,
            commitSha: node.priorReleaseSha,
            evidence: nodeReceiptEvidence(receipt),
          })],
        });
      }
      const verifyOperation = `verify-rollback-node:${nodeId}`;
      const verifyStarted = beginCompensation(verifyOperation, nodeId, node.priorReleaseSha);
      run = verifyStarted.run;
      const verified = await execute(verifyOperation, async (signal) => await input.effects.verifyNode({
        run,
        nodeId,
        expectedReleaseSha: node.priorReleaseSha!,
        previousProcessIdentity: node.processIdentity,
        signal,
      }));
      if (
        verified.activeReleaseSha !== node.priorReleaseSha
        || verified.processIdentity === node.processIdentity
        || !verified.ready
        || !verified.catalogReady
        || verified.federationPhase !== 'connected'
        || !verified.converged
      ) {
        throw new DeliveryCoordinatorError(
          'delivery_node_rollback_verification_failed',
          `Node ${nodeId} predecessor restart is not healthy.`,
          'compensation',
          nodeId,
        );
      }
      run = persist({
        ...run,
        nodes: run.nodes.map((entry) => entry.nodeId === nodeId
          ? {
              ...entry,
              activeReleaseSha: entry.priorReleaseSha,
              processIdentity: verified.processIdentity,
              state: 'rolled-back',
            }
          : entry),
        compensationReceipts: verifyStarted.alreadySucceeded
          ? run.compensationReceipts
          : [...run.compensationReceipts, phaseReceipt({
              run,
              phase: 'compensation',
              operation: verifyOperation,
              status: 'succeeded',
              startedAt: verifyStarted.startedAt,
              now: now(),
              nodeId,
              commitSha: node.priorReleaseSha,
              evidence: [{ key: 'processIdentity', value: verified.processIdentity }],
            })],
      });
    }

    if (run.relay.activeVersionId && run.relay.activeVersionId === run.relay.uploadedVersionId) {
      const priorVersionId = priorRelayVersion(run);
      const operation = 'rollback-relay';
      const started = beginCompensation(operation, 'relay', run.mainSha);
      run = started.run;
      if (!started.alreadySucceeded) {
        const receipt = await execute(operation, async (signal) => await input.effects.rollbackRelay({
          run,
          priorVersionId,
          signal,
        }));
        run = persist({
          ...run,
          relay: { ...run.relay, activeVersionId: priorVersionId },
          compensationReceipts: [...run.compensationReceipts, phaseReceipt({
            run,
            phase: 'compensation',
            operation,
            status: 'succeeded',
            startedAt: started.startedAt,
            now: now(),
            nodeId: 'relay',
            commitSha: run.mainSha,
            evidence: [
              { key: 'externalReceiptId', value: receipt.receiptId },
              { key: 'priorVersionId', value: priorVersionId },
            ],
          })],
        });
      } else {
        run = persist({ ...run, relay: { ...run.relay, activeVersionId: priorVersionId } });
      }
      const verifyOperation = 'verify-relay-rollback';
      const verifyStarted = beginCompensation(verifyOperation, 'relay', run.mainSha);
      run = verifyStarted.run;
      await execute(verifyOperation, async (signal) => await input.effects.verifyRelayRollback({
        run,
        expectedVersionId: priorVersionId,
        signal,
      }));
      if (!verifyStarted.alreadySucceeded) {
        run = persist({
          ...run,
          compensationReceipts: [...run.compensationReceipts, phaseReceipt({
            run,
            phase: 'compensation',
            operation: verifyOperation,
            status: 'succeeded',
            startedAt: verifyStarted.startedAt,
            now: now(),
            nodeId: 'relay',
            commitSha: run.mainSha,
            evidence: [{ key: 'verifiedVersionId', value: priorVersionId }],
          })],
        });
      }
    }

    const reason = input.reason ?? {
      code: 'delivery_rollback_requested',
      message: 'Runtime rollback was explicitly requested.',
      phase: run.phase,
      nodeId: '',
    };
    run = persist({
      ...run,
      phase: 'compensation',
      status: 'rolled-back-runtime',
      failure: {
        code: reason.code,
        message: reason.message.slice(0, 4_000),
        phase: reason.phase,
        nodeId: reason.nodeId ?? '',
        observedAt: now().toISOString(),
      },
    });
    return run;
  } catch (error) {
    const code = errorCode(error);
    input.incidentLedger.record({
      scope: `delivery:${run.deliveryId}`,
      component: 'delivery-coordinator',
      operation: 'rollback',
      code,
      error: redactDeliveryError(error),
      context: redactDeliveryValue({
        deliveryId: run.deliveryId,
        releaseSha: run.mainSha ?? run.admittedSha,
        phase: run.phase,
        nodeId: error instanceof DeliveryCoordinatorError ? error.nodeId : '',
      }) as Record<string, unknown>,
    });
    return persist({
      ...run,
      phase: 'compensation',
      status: 'compensation-failed',
      failure: {
        code,
        message: redactDeliveryText(error instanceof Error ? error.message : error),
        phase: 'compensation',
        nodeId: error instanceof DeliveryCoordinatorError ? error.nodeId : '',
        observedAt: now().toISOString(),
      },
    });
  }
}

export async function rollbackStoredDecisionOsDelivery(input: {
  catalogRoot: string;
  repositoryRoot: string;
  deliveryId: string;
  effects: DeliveryCoordinatorEffects;
  runStore?: DeliveryRunStore;
  incidentLedger?: RuntimeIncidentLedger;
  resumeLease?: typeof resumeDeliveryLease;
  signal?: AbortSignal;
  now?: () => Date;
  deadlineMs?: number;
}): Promise<DeliveryRun> {
  const now = input.now ?? (() => new Date());
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({
    decisionOsRoot: `${input.catalogRoot}/.decision-os`,
  });
  const runStore = input.runStore ?? createDeliveryRunStore({
    catalogRoot: input.catalogRoot,
    incidentLedger,
  });
  let run = runStore.require(input.deliveryId);
  if (run.status === 'complete' || run.status === 'admission-rejected' || run.status === 'rolled-back-runtime') {
    throw new DeliveryCoordinatorError(
      'delivery_rollback_terminal',
      `Delivery ${run.deliveryId} is already terminal as ${run.status}.`,
      run.phase,
    );
  }
  let reconciled = run;
  const lease = await (input.resumeLease ?? resumeDeliveryLease)({
    catalogRoot: input.catalogRoot,
    repositoryRoot: input.repositoryRoot,
    deliveryId: run.deliveryId,
    admittedSha: run.admittedSha,
    runStore,
    signal: input.signal,
    incidentLedger,
    reconcileAuthority: async () => {
      const authority = await input.effects.observeAuthority({
        run,
        signal: input.signal ?? new AbortController().signal,
      });
      reconciled = reconcileDeliveryAuthority(run, authority);
      return {
        reconciled: true,
        checkedAt: authority.observedAt,
        authorityFingerprint: `${authority.topology.fingerprint}:${authority.originMainSha}`,
      };
    },
  });
  run = runStore.write({ ...reconciled, updatedAt: now().toISOString() });
  const result = await rollbackDecisionOsDelivery({
    run,
    runStore,
    effects: input.effects,
    incidentLedger,
    signal: input.signal,
    now,
    deadlineMs: input.deadlineMs,
  });
  if (result.status === 'rolled-back-runtime') lease.release();
  return result;
}
