/**
 * WHAT: Persists one node's protocol-1 delivery receipt below its stable ignored settings root.
 * WHY: Lost responses must be reconciled from a complete durable receipt without repeating mutation.
 */
import { isUtf8 } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  maximumDeliveryDocumentBytes,
  parseDeliveryNodeCommand,
  parseDeliveryNodeReceipt,
  type DeliveryNodeCommand,
  type DeliveryNodeReceipt,
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

export type DeliveryNodeReceiptReadResult =
  | { state: 'missing'; deliveryId: string }
  | {
      state: 'available';
      deliveryId: string;
      receipt: DeliveryNodeReceipt;
      actionIndex: DeliveryNodeReceiptIndexEntry[];
    }
  | DeliveryStoreFailureStatus;

export type DeliveryNodeReceiptIndexEntry = {
  key: string;
  receiptId: string;
  action: DeliveryNodeCommand['action'];
  targetCommit: string;
  expectedCommit: string;
};

type DeliveryNodeReceiptDocument = {
  protocol: 1;
  deliveryId: string;
  nodeId: string;
  actionIndex: DeliveryNodeReceiptIndexEntry[];
  receipts: Record<string, DeliveryNodeReceipt>;
};

function assertDeliveryId(deliveryId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(deliveryId)) {
    throw new Error('delivery_id_invalid');
  }
  return deliveryId;
}

function actionKey(command: DeliveryNodeCommand): string {
  return createHash('sha256').update(JSON.stringify({
    deliveryId: command.deliveryId,
    action: command.action,
    targetCommit: command.targetCommit,
    expectedCommit: command.expectedCommit,
  })).digest('hex');
}

function exactDocument(value: unknown, deliveryId: string): DeliveryNodeReceiptDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('Delivery node receipt index must be an object.');
  }
  const input = value as Record<string, unknown>;
  const keys = ['protocol', 'deliveryId', 'nodeId', 'actionIndex', 'receipts'];
  if (Object.keys(input).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(input, key))) {
    throw new Error('Delivery node receipt index shape is invalid.');
  }
  if (input.protocol !== 1 || input.deliveryId !== deliveryId) {
    throw new Error('Delivery node receipt index identity is invalid.');
  }
  if (typeof input.nodeId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(input.nodeId)) {
    throw new Error('Delivery node receipt index node identity is invalid.');
  }
  if (!Array.isArray(input.actionIndex) || input.actionIndex.length > 256) {
    throw new Error('Delivery node receipt action index is invalid.');
  }
  if (!input.receipts || typeof input.receipts !== 'object' || Array.isArray(input.receipts) || Object.getPrototypeOf(input.receipts) !== Object.prototype) {
    throw new Error('Delivery node receipt map is invalid.');
  }
  const receiptsInput = input.receipts as Record<string, unknown>;
  const seen = new Set<string>();
  const actionIndex = input.actionIndex.map((entryValue, index): DeliveryNodeReceiptIndexEntry => {
    if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue) || Object.getPrototypeOf(entryValue) !== Object.prototype) {
      throw new Error(`Delivery node receipt action index ${index} is invalid.`);
    }
    const entry = entryValue as Record<string, unknown>;
    const entryKeys = ['key', 'receiptId', 'action', 'targetCommit', 'expectedCommit'];
    if (Object.keys(entry).some((key) => !entryKeys.includes(key)) || entryKeys.some((key) => !Object.hasOwn(entry, key))) {
      throw new Error(`Delivery node receipt action index ${index} shape is invalid.`);
    }
    const command = parseDeliveryNodeCommand({
      deliveryId,
      action: entry.action,
      targetCommit: entry.targetCommit,
      expectedCommit: entry.expectedCommit,
    });
    const key = actionKey(command);
    if (entry.key !== key || typeof entry.receiptId !== 'string' || seen.has(key)) {
      throw new Error(`Delivery node receipt action index ${index} identity is invalid.`);
    }
    const receipt = parseDeliveryNodeReceipt(receiptsInput[key]);
    if (
      receipt.receiptId !== entry.receiptId
      || receipt.deliveryId !== deliveryId
      || receipt.nodeId !== input.nodeId
      || receipt.action !== command.action
      || receipt.targetCommit !== command.targetCommit
      || receipt.expectedCommit !== command.expectedCommit
    ) throw new Error(`Delivery node receipt action index ${index} does not match its immutable receipt.`);
    seen.add(key);
    return {
      key,
      receiptId: receipt.receiptId,
      action: command.action,
      targetCommit: command.targetCommit,
      expectedCommit: command.expectedCommit,
    };
  });
  if (Object.keys(receiptsInput).length !== seen.size || Object.keys(receiptsInput).some((key) => !seen.has(key))) {
    throw new Error('Delivery node receipt map and action index differ.');
  }
  const receipts = Object.fromEntries(actionIndex.map((entry) => [
    entry.key,
    parseDeliveryNodeReceipt(receiptsInput[entry.key]),
  ]));
  return {
    protocol: 1,
    deliveryId,
    nodeId: input.nodeId,
    actionIndex,
    receipts,
  };
}

export function createDeliveryNodeReceiptStore(input: {
  decisionOsRoot: string;
  incidentLedger?: RuntimeIncidentLedger;
  persistenceHooks?: DeliveryPersistenceHooks;
}) {
  const root = resolve(input.decisionOsRoot, 'delivery', 'nodes');
  const incidentLedger = input.incidentLedger ?? createRuntimeIncidentLedger({ decisionOsRoot: input.decisionOsRoot });
  const fileFor = (deliveryId: string): string => resolve(root, `${assertDeliveryId(deliveryId)}.json`);

  const read = (deliveryId: string): DeliveryNodeReceiptReadResult => {
    const safeId = assertDeliveryId(deliveryId);
    const file = fileFor(safeId);
    if (!existsSync(file)) return { state: 'missing', deliveryId: safeId };
    try {
      const bytes = readFileSync(file);
      if (bytes.byteLength > maximumDeliveryDocumentBytes) {
        throw new Error(`Delivery node receipt index exceeds ${maximumDeliveryDocumentBytes} bytes.`);
      }
      if (!isUtf8(bytes)) throw new Error('Delivery node receipt index is not valid UTF-8.');
      const document = exactDocument(JSON.parse(bytes.toString('utf8')) as unknown, safeId);
      const last = document.actionIndex.at(-1);
      if (!last) throw new Error('Delivery node receipt index is empty.');
      return {
        state: 'available',
        deliveryId: safeId,
        receipt: structuredClone(document.receipts[last.key]),
        actionIndex: structuredClone(document.actionIndex),
      };
    } catch (error) {
      return recordDeliveryStoreIncident({
        incidentLedger,
        deliveryId: safeId,
        code: 'delivery_node_receipt_invalid',
        component: 'delivery-node-receipt-store',
        operation: 'read',
        file,
        error,
      });
    }
  };

  const readDocument = (deliveryId: string): DeliveryNodeReceiptDocument | null => {
    const state = read(deliveryId);
    if (state.state === 'paused') throw new DeliveryStorePausedError(state);
    if (state.state === 'missing') return null;
    const bytes = readFileSync(fileFor(deliveryId));
    return exactDocument(JSON.parse(bytes.toString('utf8')) as unknown, deliveryId);
  };

  const persist = (receiptValue: DeliveryNodeReceipt, mode: 'create' | 'write'): DeliveryNodeReceipt => {
    const receipt = parseDeliveryNodeReceipt(receiptValue);
    const command = parseDeliveryNodeCommand({
      deliveryId: receipt.deliveryId,
      action: receipt.action,
      targetCommit: receipt.targetCommit,
      expectedCommit: receipt.expectedCommit,
    });
    const key = actionKey(command);
    const current = readDocument(receipt.deliveryId);
    if (mode === 'create' && current?.receipts[key]) {
      const before = current.receipts[key];
      if (JSON.stringify(before) === JSON.stringify(receipt)) return structuredClone(before);
      const error = new Error(`Delivery action receipt ${receipt.receiptId} already exists.`) as Error & { code?: string };
      error.code = 'delivery_node_receipt_exists';
      throw error;
    }
    if (mode === 'write' && !current?.receipts[key]) {
      const error = new Error(`Delivery receipt ${receipt.deliveryId} does not exist.`) as Error & { code?: string };
      error.code = 'delivery_node_receipt_missing';
      throw error;
    }
    if (current) {
      if (current.nodeId !== receipt.nodeId) {
        const error = new Error('Delivery node receipt index belongs to another node.') as Error & { code?: string };
        error.code = 'delivery_node_receipt_identity_conflict';
        throw error;
      }
      const before = current.receipts[key];
      if (before && (
        before.receiptId !== receipt.receiptId
        || before.startedAt !== receipt.startedAt
        || before.attempt !== receipt.attempt
      )) {
        const error = new Error('Immutable delivery node receipt identity changed.') as Error & { code?: string };
        error.code = 'delivery_node_receipt_identity_conflict';
        throw error;
      }
      if (before && before.status !== 'accepted' && JSON.stringify(before) !== JSON.stringify(receipt)) {
        const error = new Error('A terminal delivery node receipt is immutable.') as Error & { code?: string };
        error.code = 'delivery_node_receipt_terminal';
        throw error;
      }
    }
    const document: DeliveryNodeReceiptDocument = current ?? {
      protocol: 1,
      deliveryId: receipt.deliveryId,
      nodeId: receipt.nodeId,
      actionIndex: [],
      receipts: {},
    };
    if (!document.receipts[key]) {
      document.actionIndex.push({
        key,
        receiptId: receipt.receiptId,
        action: receipt.action,
        targetCommit: receipt.targetCommit,
        expectedCommit: receipt.expectedCommit,
      });
    }
    document.receipts[key] = receipt;
    exactDocument(document, receipt.deliveryId);
    const bytes = Buffer.byteLength(JSON.stringify(document), 'utf8');
    if (bytes > maximumDeliveryDocumentBytes) {
      const error = new Error(`Delivery node receipt index exceeds ${maximumDeliveryDocumentBytes} bytes.`) as Error & { code?: string };
      error.code = 'delivery_node_receipt_too_large';
      throw error;
    }
    try {
      atomicWriteDeliveryJson({ file: fileFor(receipt.deliveryId), value: document, hooks: input.persistenceHooks });
    } catch (error) {
      throw deliveryPersistenceFailure({
        incidentLedger,
        deliveryId: receipt.deliveryId,
        code: 'delivery_node_receipt_persistence_failed',
        component: 'delivery-node-receipt-store',
        operation: mode,
        file: fileFor(receipt.deliveryId),
        admittedSha: receipt.targetCommit,
        error,
      });
    }
    return structuredClone(receipt);
  };

  return {
    root,
    fileFor,
    read,
    status: read,
    readCommand(commandValue: DeliveryNodeCommand): DeliveryNodeReceiptReadResult {
      const command = parseDeliveryNodeCommand(commandValue);
      const state = read(command.deliveryId);
      if (state.state !== 'available') return state;
      const document = readDocument(command.deliveryId)!;
      const receipt = document.receipts[actionKey(command)];
      return receipt
        ? {
            state: 'available',
            deliveryId: command.deliveryId,
            receipt: structuredClone(receipt),
            actionIndex: structuredClone(document.actionIndex),
          }
        : { state: 'missing', deliveryId: command.deliveryId };
    },
    create(receipt: DeliveryNodeReceipt): DeliveryNodeReceipt {
      return persist(receipt, 'create');
    },
    write(receipt: DeliveryNodeReceipt): DeliveryNodeReceipt {
      return persist(receipt, 'write');
    },
    require(deliveryId: string): DeliveryNodeReceipt {
      const result = read(deliveryId);
      if (result.state === 'paused') throw new DeliveryStorePausedError(result);
      if (result.state === 'missing') {
        const error = new Error(`Delivery receipt ${deliveryId} does not exist.`) as Error & { code?: string };
        error.code = 'delivery_node_receipt_missing';
        throw error;
      }
      return structuredClone(result.receipt);
    },
    requireCommand(commandValue: DeliveryNodeCommand): DeliveryNodeReceipt {
      const command = parseDeliveryNodeCommand(commandValue);
      const result = this.readCommand(command);
      if (result.state === 'paused') throw new DeliveryStorePausedError(result);
      if (result.state === 'missing') {
        const error = new Error(`Delivery action receipt ${command.deliveryId}:${command.action} does not exist.`) as Error & { code?: string };
        error.code = 'delivery_node_receipt_missing';
        throw error;
      }
      return structuredClone(result.receipt);
    },
  };
}

export type DeliveryNodeReceiptStore = ReturnType<typeof createDeliveryNodeReceiptStore>;
