/**
 * WHAT: Contains invalid delivery documents behind a delivery-scoped runtime incident.
 * WHY: Corrupt delivery bytes must remain untouched while status and diagnostics stay readable.
 */
import type { RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';

export type DeliveryStoreFailureStatus = {
  state: 'paused';
  deliveryId: string;
  code:
    | 'delivery_run_invalid'
    | 'delivery_node_receipt_invalid'
    | 'delivery_lease_invalid'
    | 'node_release_operation_lease_invalid'
    | 'node_release_operation_reconciliation_failed';
  message: string;
  file: string;
  incidentId: string;
};

export class DeliveryStorePausedError extends Error {
  readonly statusCode = 503;

  constructor(readonly status: DeliveryStoreFailureStatus) {
    super(status.message);
    this.name = 'DeliveryStorePausedError';
  }

  get code(): DeliveryStoreFailureStatus['code'] {
    return this.status.code;
  }
}

export class DeliveryPersistenceError extends Error {
  readonly statusCode = 503;

  constructor(
    readonly code:
      | 'delivery_run_persistence_failed'
      | 'delivery_node_receipt_persistence_failed'
      | 'delivery_lease_persistence_failed',
    message: string,
    readonly incidentId: string,
  ) {
    super(message);
    this.name = 'DeliveryPersistenceError';
  }
}

export function recordDeliveryStoreIncident(input: {
  incidentLedger: RuntimeIncidentLedger;
  deliveryId: string;
  code: DeliveryStoreFailureStatus['code'];
  component: string;
  operation: string;
  file: string;
  admittedSha?: string;
  phase?: string;
  error: unknown;
}): DeliveryStoreFailureStatus {
  let incidentId = '';
  try {
    const incident = input.incidentLedger.record({
      scope: `delivery:${input.deliveryId}`,
      component: input.component,
      operation: input.operation,
      code: input.code,
      error: input.error,
      context: {
        deliveryId: input.deliveryId,
        releaseSha: input.admittedSha ?? '',
        phase: input.phase ?? '',
        file: input.file,
      },
    });
    incidentId = incident.id;
  } catch {
    // Runtime incident recording is deliberately failsafe and cannot alter the delivery boundary.
  }
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  return {
    state: 'paused',
    deliveryId: input.deliveryId,
    code: input.code,
    message: message.slice(0, 4_000),
    file: input.file,
    incidentId,
  };
}

export function deliveryPersistenceFailure(input: {
  incidentLedger: RuntimeIncidentLedger;
  deliveryId: string;
  code: DeliveryPersistenceError['code'];
  component: string;
  operation: string;
  file: string;
  admittedSha?: string;
  phase?: string;
  error: unknown;
}): DeliveryPersistenceError {
  let incidentId = '';
  try {
    incidentId = input.incidentLedger.record({
      scope: `delivery:${input.deliveryId}`,
      component: input.component,
      operation: input.operation,
      code: input.code,
      error: input.error,
      context: {
        deliveryId: input.deliveryId,
        releaseSha: input.admittedSha ?? '',
        phase: input.phase ?? '',
        file: input.file,
      },
    }).id;
  } catch {
    // Diagnostics are failsafe and never replace the owning persistence error.
  }
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  return new DeliveryPersistenceError(input.code, message.slice(0, 4_000), incidentId);
}
