/**
 * WHAT: Persists coordinator delivery runs below the catalog root with strict validation.
 * WHY: Resume and compensation require one crash-safe journal without reinterpreting corrupt bytes.
 */
import { isUtf8 } from 'node:buffer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  maximumDeliveryDocumentBytes,
  parseDeliveryRun,
  type DeliveryRun,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  createRuntimeIncidentLedger,
  type RuntimeIncidentLedger,
} from '../../server/helper/runtime-incident-ledger.js';
import {
  atomicWriteDeliveryJson,
  type DeliveryPersistenceHooks,
} from './delivery-durable-json.js';
import {
  deliveryPersistenceFailure,
  DeliveryStorePausedError,
  recordDeliveryStoreIncident,
  type DeliveryStoreFailureStatus,
} from './delivery-store-boundary.js';

export type DeliveryRunReadResult =
  | { state: 'missing'; deliveryId: string }
  | { state: 'available'; deliveryId: string; run: DeliveryRun }
  | DeliveryStoreFailureStatus;

function assertDeliveryId(deliveryId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(deliveryId)) {
    throw new Error('delivery_id_invalid');
  }
  return deliveryId;
}

export function createDeliveryRunStore(input: {
  catalogRoot: string;
  incidentLedger?: RuntimeIncidentLedger;
  persistenceHooks?: DeliveryPersistenceHooks;
}) {
  const decisionOsRoot = resolve(input.catalogRoot, '.decision-os');
  const root = resolve(decisionOsRoot, 'delivery', 'runs');
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({ decisionOsRoot });
  const fileFor = (deliveryId: string): string => resolve(root, `${assertDeliveryId(deliveryId)}.json`);

  const read = (deliveryId: string): DeliveryRunReadResult => {
    const safeId = assertDeliveryId(deliveryId);
    const file = fileFor(safeId);
    if (!existsSync(file)) return { state: 'missing', deliveryId: safeId };
    try {
      const bytes = readFileSync(file);
      if (bytes.byteLength > maximumDeliveryDocumentBytes) {
        throw new Error(`Delivery run exceeds ${maximumDeliveryDocumentBytes} bytes.`);
      }
      if (!isUtf8(bytes)) throw new Error('Delivery run is not valid UTF-8.');
      const run = parseDeliveryRun(JSON.parse(bytes.toString('utf8')) as unknown);
      if (run.deliveryId !== safeId) throw new Error('Delivery run identity does not match its filename.');
      return { state: 'available', deliveryId: safeId, run };
    } catch (error) {
      return recordDeliveryStoreIncident({
        incidentLedger,
        deliveryId: safeId,
        code: 'delivery_run_invalid',
        component: 'delivery-run-store',
        operation: 'read',
        file,
        error,
      });
    }
  };

  const persist = (runValue: DeliveryRun, mode: 'create' | 'write'): DeliveryRun => {
    const run = parseDeliveryRun(runValue);
    const current = read(run.deliveryId);
    if (current.state === 'paused') throw new DeliveryStorePausedError(current);
    if (mode === 'create' && current.state !== 'missing') {
      const error = new Error(`Delivery run ${run.deliveryId} already exists.`) as Error & { code?: string };
      error.code = 'delivery_run_exists';
      throw error;
    }
    if (mode === 'write' && current.state === 'missing') {
      const error = new Error(`Delivery run ${run.deliveryId} does not exist.`) as Error & { code?: string };
      error.code = 'delivery_run_missing';
      throw error;
    }
    if (current.state === 'available') {
      if (
        current.run.admittedSha !== run.admittedSha
        || current.run.createdAt !== run.createdAt
        || (
          current.run.topology.fingerprint
          && JSON.stringify(current.run.topology) !== JSON.stringify(run.topology)
        )
      ) {
        const error = new Error('Immutable delivery run identity changed.') as Error & { code?: string };
        error.code = 'delivery_run_identity_conflict';
        throw error;
      }
      if (Date.parse(run.updatedAt) < Date.parse(current.run.updatedAt)) {
        const error = new Error('Delivery run updatedAt moved backwards.') as Error & { code?: string };
        error.code = 'delivery_run_revision_conflict';
        throw error;
      }
    }
    const bytes = Buffer.byteLength(JSON.stringify(run), 'utf8');
    if (bytes > maximumDeliveryDocumentBytes) {
      const error = new Error(`Delivery run exceeds ${maximumDeliveryDocumentBytes} bytes.`) as Error & { code?: string };
      error.code = 'delivery_run_too_large';
      throw error;
    }
    try {
      atomicWriteDeliveryJson({ file: fileFor(run.deliveryId), value: run, hooks: input.persistenceHooks });
    } catch (error) {
      throw deliveryPersistenceFailure({
        incidentLedger,
        deliveryId: run.deliveryId,
        code: 'delivery_run_persistence_failed',
        component: 'delivery-run-store',
        operation: mode,
        file: fileFor(run.deliveryId),
        admittedSha: run.admittedSha,
        phase: run.phase,
        error,
      });
    }
    return structuredClone(run);
  };

  return {
    root,
    fileFor,
    read,
    status: read,
    create(run: DeliveryRun): DeliveryRun {
      return persist(run, 'create');
    },
    write(run: DeliveryRun): DeliveryRun {
      return persist(run, 'write');
    },
    require(deliveryId: string): DeliveryRun {
      const result = read(deliveryId);
      if (result.state === 'paused') throw new DeliveryStorePausedError(result);
      if (result.state === 'missing') {
        const error = new Error(`Delivery run ${deliveryId} does not exist.`) as Error & { code?: string };
        error.code = 'delivery_run_missing';
        throw error;
      }
      return structuredClone(result.run);
    },
  };
}

export type DeliveryRunStore = ReturnType<typeof createDeliveryRunStore>;
