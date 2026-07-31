/**
 * WHAT: Resolves one causally selected task-content object from local storage or its federation owner.
 * WHY: Hosted projections can know the exact content hash before this node has materialized its bytes.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TaskCurrentStateStore } from '../../task-state/helper/task-current-state-store.js';
import type { FederationContentReplicaStore } from './federation-content-replica-store.js';

type ContentCandidate = { ownerNodeId: string; hash: string; type: string };

export type TaskContentReadResult = {
  body: string;
  available: boolean;
  conflict: boolean;
  candidates: ContentCandidate[];
};

export async function readTaskContentOnDemand(input: {
  projectId: string;
  store: TaskCurrentStateStore;
  key: string;
  contentStore: FederationContentReplicaStore;
  drain: (() => Promise<void>) | null;
  waitForContent?: boolean;
  recordBackgroundFailure?: (error: unknown) => void;
}): Promise<TaskContentReadResult> {
  const heads = input.store.contentHeads(input.key).sort((left, right) => left.sourceReplicaId.localeCompare(right.sourceReplicaId) || left.hash.localeCompare(right.hash));
  const candidates = heads.map((head) => ({ ownerNodeId: head.sourceReplicaId, hash: head.hash, type: head.type }));
  const identities = new Set(heads.map((head) => `${head.type}\u0000${head.hash}`));

  // WHAT: Stop before fetching when the causal state has no unique object identity.
  // WHY: Automatic selection must never hide divergent content candidates.
  if (!input.key || heads.length === 0 || identities.size !== 1) {
    return { body: '', available: false, conflict: identities.size > 1, candidates };
  }

  const head = heads[0];
  const localObject = resolve(input.store.root, 'objects', head.hash.slice(0, 2), head.hash);
  // WHAT: Serve immutable bytes already retained by the task-state store.
  // WHY: Local objects require no relay request and remain available while peers are offline.
  if (existsSync(localObject)) {
    return { body: await readFile(localObject, 'utf8'), available: true, conflict: false, candidates };
  }

  for (const source of heads) {
    input.contentStore.applyManifest(source.sourceReplicaId, {
      version: 1,
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      complete: false,
      resources: [{ type: source.type, key: source.key, hash: source.hash, bytes: source.bytes, changedAt: source.changedAt }],
    });
  }
  const source = heads[0].sourceReplicaId;
  input.contentStore.prioritize(source, input.projectId, input.key);
  // WHAT: Keep mutation preparation blocking while allowing read routes to return structural state immediately.
  // WHY: Relay delivery is required before a mutation can preserve source content, but it must not gate card or thread availability.
  if (input.waitForContent !== false) await input.drain?.();
  else void input.drain?.().catch((error: unknown) => {
    try { input.recordBackgroundFailure?.(error); }
    catch { /* Background diagnostics cannot replace the contained content-fetch failure. */ }
  });
  const content = input.contentStore.resource(source, input.projectId, input.key);
  return {
    body: content.file ? await readFile(content.file, 'utf8') : '',
    available: Boolean(content.file),
    conflict: false,
    candidates,
  };
}
