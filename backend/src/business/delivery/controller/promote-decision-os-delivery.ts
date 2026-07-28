/**
 * WHAT: Creates and drives one protocol-1 promotion under the durable delivery and repository lease.
 * WHY: The explicit promote command is the only boundary allowed to create a run and begin admission.
 */
import {
  parseDeliveryRun,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  createRuntimeIncidentLedger,
  type RuntimeIncidentLedger,
} from '../../server/helper/runtime-incident-ledger.js';
import {
  acquireDeliveryLease,
  type DeliveryLease,
} from '../helper/delivery-lease.js';
import {
  createDeliveryRunStore,
  type DeliveryRunStore,
} from '../helper/delivery-run-store.js';
import {
  createDeliveryId,
  createDeliveryRun,
  DeliveryCoordinatorError,
  DeliveryInterruptedError,
  reconcileDeliveryAuthority,
  type DeliveryCoordinatorEffects,
} from '../helper/delivery-coordinator.js';
import { advanceDecisionOsDelivery } from '../helper/delivery-forward-state-machine.js';
import { rollbackDecisionOsDelivery } from './rollback-decision-os-delivery.js';
import { redactDeliveryError, redactDeliveryText, redactDeliveryValue } from '../helper/delivery-redactor.js';

function codeOf(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : 'delivery_promotion_failed';
}

function messageOf(error: unknown): string {
  return redactDeliveryText(error instanceof Error ? error.message : error);
}

export async function promoteDecisionOsDelivery(input: {
  catalogRoot: string;
  repositoryRoot: string;
  releaseSha: string;
  effects: DeliveryCoordinatorEffects;
  runStore?: DeliveryRunStore;
  incidentLedger?: RuntimeIncidentLedger;
  acquireLease?: typeof acquireDeliveryLease;
  now?: () => Date;
  signal?: AbortSignal;
  deadlineMs?: number;
}): Promise<DeliveryRun> {
  const now = input.now ?? (() => new Date());
  const deliveryId = createDeliveryId(input.releaseSha, now());
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({
    decisionOsRoot: `${input.catalogRoot}/.decision-os`,
  });
  const runStore = input.runStore ?? createDeliveryRunStore({
    catalogRoot: input.catalogRoot,
    incidentLedger,
  });
  const acquireLease = input.acquireLease ?? acquireDeliveryLease;
  const lease = await acquireLease({
    catalogRoot: input.catalogRoot,
    repositoryRoot: input.repositoryRoot,
    deliveryId,
    admittedSha: input.releaseSha,
    signal: input.signal,
    incidentLedger,
  });
  let run: DeliveryRun;
  try {
    run = runStore.create(createDeliveryRun({ deliveryId, admittedSha: input.releaseSha, now: now() }));
  } catch (error) {
    lease.release();
    throw error;
  }

  const context = {
    runStore,
    effects: input.effects,
    repositoryLock: lease.repositoryLock,
    now,
    signal: input.signal,
    deadlineMs: input.deadlineMs,
  };
  try {
    run = await advanceDecisionOsDelivery(run, context);
    lease.release();
    return run;
  } catch (error) {
    // WHY: A process-death fixture represents the owner disappearing before any further durable action.
    // WHAT: Preserve the running journal and stale lease for authority-proven resume.
    if (error instanceof DeliveryInterruptedError || codeOf(error) === 'delivery_process_interrupted') throw error;
    const failureCode = codeOf(error);
    const failurePhase = error instanceof DeliveryCoordinatorError ? error.phase : run.phase;
    const nodeId = error instanceof DeliveryCoordinatorError ? error.nodeId : '';
    incidentLedger.record({
      scope: `delivery:${run.deliveryId}`,
      component: 'delivery-coordinator',
      operation: 'promote',
      code: failureCode,
      error: redactDeliveryError(error),
      context: redactDeliveryValue({
        deliveryId: run.deliveryId,
        releaseSha: run.mainSha ?? run.admittedSha,
        phase: failurePhase,
        nodeId,
      }) as Record<string, unknown>,
    });

    const current = runStore.require(run.deliveryId);
    // WHY: A missing response cannot be classified as failure until live authorities are inspected.
    // WHAT: Reconcile exact external receipts once and continue when they prove the mutation completed.
    try {
      const authority = await input.effects.observeAuthority({
        run: current,
        signal: input.signal ?? new AbortController().signal,
      });
      const reconciled = reconcileDeliveryAuthority(current, authority);
      if (JSON.stringify(reconciled) !== JSON.stringify(current)) {
        run = runStore.write({ ...reconciled, updatedAt: now().toISOString() });
        run = await advanceDecisionOsDelivery(run, context);
        lease.release();
        return run;
      }
    } catch (reconciliationError) {
      if (codeOf(reconciliationError) === 'delivery_topology_changed') {
        error = reconciliationError;
      }
    }

    run = runStore.require(run.deliveryId);
    const runtimeMutated = Boolean(
      run.relay.activeVersionId
      || run.activationOrder.length > 0
      || run.nodes.some((node) => node.state === 'active'),
    );
    // WHY: Runtime mutations require deterministic compensation while a main-only failure stays resumable.
    // WHAT: Roll back activated nodes and relay only after live receipt reconciliation fails to advance.
    if (runtimeMutated) {
      const rolledBack = await rollbackDecisionOsDelivery({
        run,
        runStore,
        effects: input.effects,
        incidentLedger,
        signal: input.signal,
        now,
        deadlineMs: input.deadlineMs,
        reason: {
          code: codeOf(error),
          message: messageOf(error),
          phase: error instanceof DeliveryCoordinatorError ? error.phase : run.phase,
          nodeId: error instanceof DeliveryCoordinatorError ? error.nodeId : '',
        },
      });
      if (rolledBack.status === 'rolled-back-runtime') lease.release();
      return rolledBack;
    }
    const admissionRejected = !run.mainSha && (failurePhase === 'created' || failurePhase === 'preflight' || failurePhase === 'admission');
    run = runStore.write(parseDeliveryRun({
      ...run,
      status: admissionRejected ? 'admission-rejected' : 'paused',
      failure: {
        code: codeOf(error),
        message: messageOf(error),
        phase: failurePhase,
        nodeId,
        observedAt: now().toISOString(),
      },
      updatedAt: now().toISOString(),
    }));
    if (admissionRejected) lease.release();
    return run;
  }
}

export type PromoteDecisionOsDeliveryLease = DeliveryLease;
