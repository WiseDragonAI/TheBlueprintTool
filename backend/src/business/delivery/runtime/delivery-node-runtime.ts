import { executeDeliveryNodeCommand, DeliveryNodeCommandError } from '../controller/delivery-node-command-controller.js';
import { createDeliveryNodeReceiptStore } from '../helper/delivery-node-receipt-store.js';
import { createNodeReleaseStore } from '../helper/node-release-store.js';
import type { RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';

type AnyRecord = Record<string, unknown>;

export function createDeliveryNodeRuntime(input: {
  decisionOsRoot: string;
  incidentLedger: RuntimeIncidentLedger;
  localNodeId: () => string;
  readStatusEvidence: () => Array<{
    key: string;
    value: string | number | boolean;
  }>;
  settings: () => AnyRecord;
}) {
  let context: {
    receiptStore: ReturnType<typeof createDeliveryNodeReceiptStore>;
    releaseStore: ReturnType<typeof createNodeReleaseStore>;
  } | null = null;

  const requireContext = () => {
    if (context) return context;
    const settings = input.settings();
    if (settings.deliveryProtocol !== 1) {
      throw new DeliveryNodeCommandError(
        'delivery_node_not_bootstrapped',
        'The local node has not adopted delivery protocol 1.',
        503,
      );
    }
    context = {
      receiptStore: createDeliveryNodeReceiptStore({
        decisionOsRoot: input.decisionOsRoot,
        incidentLedger: input.incidentLedger,
      }),
      releaseStore: createNodeReleaseStore({
        repositoryRoot: String(settings.deliveryRepositoryRoot ?? ''),
        releaseRoot: String(settings.deliveryReleaseRoot ?? ''),
        settings,
        decisionOsRoot: input.decisionOsRoot,
        incidentLedger: input.incidentLedger,
      }),
    };
    return context;
  };

  return {
    run: async (command: unknown, signal?: AbortSignal) => {
      const active = requireContext();
      return await executeDeliveryNodeCommand({
        command,
        nodeId: input.localNodeId(),
        settings: input.settings(),
        receiptStore: active.receiptStore,
        releaseStore: active.releaseStore,
        signal,
        readStatusEvidence: input.readStatusEvidence,
        scheduleSupervisedExit: () => {
          setImmediate(() => process.exit(0));
        },
      });
    },
  };
}
