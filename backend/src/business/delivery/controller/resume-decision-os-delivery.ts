/**
 * WHAT: Resumes one interrupted delivery only after journal, lease, topology, Git, relay, and node reconciliation.
 * WHY: A stale coordinator receipt alone cannot authorize retrying an external production mutation.
 */
import { createHash } from 'node:crypto';
import {
  parseDeliveryRun,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  createRuntimeIncidentLedger,
  type RuntimeIncidentLedger,
} from '../../server/helper/runtime-incident-ledger.js';
import {
  resumeDeliveryLease,
} from '../helper/delivery-lease.js';
import {
  createDeliveryRunStore,
  type DeliveryRunStore,
} from '../helper/delivery-run-store.js';
import {
  DeliveryCoordinatorError,
  reconcileDeliveryAuthority,
  type DeliveryAuthoritySnapshot,
  type DeliveryCoordinatorEffects,
} from '../helper/delivery-coordinator.js';
import { advanceDecisionOsDelivery } from '../helper/delivery-forward-state-machine.js';
import { rollbackDecisionOsDelivery } from './rollback-decision-os-delivery.js';
import { redactDeliveryError, redactDeliveryValue } from '../helper/delivery-redactor.js';

function authorityFingerprint(authority: DeliveryAuthoritySnapshot): string {
  return createHash('sha256').update(JSON.stringify({
    observedAt: authority.observedAt,
    originDevSha: authority.originDevSha,
    originMainSha: authority.originMainSha,
    topologyFingerprint: authority.topology.fingerprint,
    relay: authority.relay,
    nodes: authority.nodes.map((node) => ({
      nodeId: node.nodeId,
      activeReleaseSha: node.activeReleaseSha,
      processIdentity: node.processIdentity,
      receiptIds: node.receipts.map((receipt) => receipt.receiptId),
    })),
  })).digest('hex');
}

export async function resumeDecisionOsDelivery(input: {
  catalogRoot: string;
  repositoryRoot: string;
  deliveryId: string;
  effects: DeliveryCoordinatorEffects;
  runStore?: DeliveryRunStore;
  incidentLedger?: RuntimeIncidentLedger;
  resumeLease?: typeof resumeDeliveryLease;
  now?: () => Date;
  signal?: AbortSignal;
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
      'delivery_resume_terminal',
      `Delivery ${run.deliveryId} is already terminal as ${run.status}.`,
      run.phase,
    );
  }
  let reconciledAuthority: DeliveryAuthoritySnapshot | null = null;
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
      reconcileDeliveryAuthority(run, authority);
      reconciledAuthority = authority;
      return {
        reconciled: true,
        checkedAt: authority.observedAt,
        authorityFingerprint: authorityFingerprint(authority),
      };
    },
  });
  try {
    const resumeCompensation = run.phase === 'compensation' || run.status === 'compensation-failed';
    const authority = reconciledAuthority ?? await input.effects.observeAuthority({
      run,
      signal: input.signal ?? new AbortController().signal,
    });
    run = runStore.write(parseDeliveryRun({
      ...reconcileDeliveryAuthority(run, authority),
      status: 'running',
      failure: null,
      updatedAt: now().toISOString(),
    }));
    if (resumeCompensation) {
      const rolledBack = await rollbackDecisionOsDelivery({
        run,
        runStore,
        effects: input.effects,
        incidentLedger,
        signal: input.signal,
        now,
        deadlineMs: input.deadlineMs,
      });
      if (rolledBack.status === 'rolled-back-runtime') lease.release();
      return rolledBack;
    }
    const completed = await advanceDecisionOsDelivery(run, {
      runStore,
      effects: input.effects,
      repositoryLock: lease.repositoryLock,
      now,
      signal: input.signal,
      deadlineMs: input.deadlineMs,
    });
    lease.release();
    return completed;
  } catch (error) {
    incidentLedger.record({
      scope: `delivery:${run.deliveryId}`,
      component: 'delivery-coordinator',
      operation: 'resume',
      code: error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : 'delivery_resume_failed',
      error: redactDeliveryError(error),
      context: redactDeliveryValue({
        deliveryId: run.deliveryId,
        releaseSha: run.mainSha ?? run.admittedSha,
        phase: run.phase,
        nodeId: error instanceof DeliveryCoordinatorError ? error.nodeId : '',
      }) as Record<string, unknown>,
    });
    throw error;
  }
}
