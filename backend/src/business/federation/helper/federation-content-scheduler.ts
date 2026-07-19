import type { FederationContentReplicaStore } from './federation-content-replica-store.js';

export function createFederationContentScheduler(input: {
  store: FederationContentReplicaStore;
  hasPriorityStateWork: () => boolean;
  fetchContent: (entry: { ownerNodeId: string; projectId: string; hash: string }) => Promise<Buffer>;
  concurrency?: number;
}) {
  const concurrency = input.concurrency ?? 2;
  let running = false;
  const drain = async (): Promise<void> => {
    if (running || input.hasPriorityStateWork()) return;
    running = true;
    try {
      while (!input.hasPriorityStateWork()) {
        const entries = input.store.due(concurrency);
        if (entries.length === 0) break;
        await Promise.all(entries.map(async (entry) => {
          try { input.store.install(entry, await input.fetchContent(entry)); }
          catch (error) { input.store.fail(entry, error instanceof Error ? error.message : 'content_transfer_failed'); }
        }));
      }
    } finally { running = false; }
  };
  return { drain, get running() { return running; } };
}

