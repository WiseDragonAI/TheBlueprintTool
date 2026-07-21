import type { FederationContentReplicaStore } from './federation-content-replica-store.js';

export function createFederationContentScheduler(input: {
  store: FederationContentReplicaStore;
  hasPriorityStateWork: () => boolean;
  fetchContent: (entry: { ownerNodeId: string; projectId: string; hash: string }) => Promise<void>;
  concurrency?: number;
  minimumContentShare?: number;
}) {
  const concurrency = input.concurrency ?? 2;
  const minimumContentShare = Math.max(1, input.minimumContentShare ?? 1);
  let running = false;
  const drain = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      while (true) {
        const stateBusy = input.hasPriorityStateWork();
        const entries = input.store.due(stateBusy ? Math.min(minimumContentShare, concurrency) : concurrency);
        if (entries.length === 0) break;
        await Promise.all(entries.map(async (entry) => {
          try { await input.fetchContent(entry); input.store.complete(entry); }
          catch (error) { input.store.fail(entry, error instanceof Error ? error.message : 'content_transfer_failed'); }
        }));
        if (stateBusy) break;
      }
    } finally { running = false; }
  };
  return { drain, get running() { return running; } };
}
