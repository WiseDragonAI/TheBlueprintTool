/**
 * WHAT: Tracks current remote resource heads and runtime-only exact-object demand.
 * WHY: Retry demand is derivable from causal heads and object existence, so no durable manifest queue is required.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FederationContentManifest, FederationContentManifestEntry } from './federation-content-manifest.js';

export type FederationContentState = 'missing' | 'synchronizing' | 'available' | 'stale';
type ResourceState = FederationContentManifestEntry & { ownerNodeId: string; projectId: string; state: FederationContentState; verifiedHash: string; error: string };
export type FederationContentDemand = { ownerNodeId: string; projectId: string; key: string; hash: string; attempts: number; nextAttemptAt: number; priority: number };

function resourceId(ownerNodeId: string, projectId: string, key: string): string {
  return `${ownerNodeId}\u0000${projectId}\u0000${key}`;
}

function demandId(entry: Pick<FederationContentDemand, 'ownerNodeId' | 'projectId' | 'key' | 'hash'>): string {
  return `${resourceId(entry.ownerNodeId, entry.projectId, entry.key)}\u0000${entry.hash}`;
}

export function createFederationContentReplicaStore(input: { decisionOsRoot: string; now?: () => Date }) {
  const now = input.now ?? (() => new Date());
  const root = resolve(input.decisionOsRoot, 'cache', 'federation-content-current');
  const resources = new Map<string, ResourceState>();
  const demands = new Map<string, FederationContentDemand>();
  const objectFile = (hash: string): string => resolve(root, 'objects', hash.slice(0, 2), hash);

  const queue = (resource: ResourceState): void => {
    const demand: FederationContentDemand = { ownerNodeId: resource.ownerNodeId, projectId: resource.projectId, key: resource.key, hash: resource.hash, attempts: 0, nextAttemptAt: now().getTime(), priority: 0 };
    if (!demands.has(demandId(demand))) demands.set(demandId(demand), demand);
    resource.state = 'synchronizing';
  };

  return {
    root,
    objectFile,
    applyManifest(ownerNodeId: string, manifest: FederationContentManifest): void {
      for (const entry of manifest.resources) {
        const id = resourceId(ownerNodeId, manifest.projectId, entry.key);
        const current = resources.get(id);
        const available = existsSync(objectFile(entry.hash));
        const resource: ResourceState = { ...entry, ownerNodeId, projectId: manifest.projectId, state: available ? 'available' : current?.verifiedHash ? 'stale' : 'missing', verifiedHash: available ? entry.hash : current?.verifiedHash ?? '', error: '' };
        resources.set(id, resource);
        for (const [key, demand] of demands) if (demand.ownerNodeId === ownerNodeId && demand.projectId === manifest.projectId && demand.key === entry.key && demand.hash !== entry.hash) demands.delete(key);
        if (!available) queue(resource);
      }
    },
    due(limit = 2): FederationContentDemand[] {
      const timestamp = now().getTime();
      return [...demands.values()].filter((entry) => entry.nextAttemptAt <= timestamp).sort((left, right) => right.priority - left.priority || left.nextAttemptAt - right.nextAttemptAt).slice(0, limit);
    },
    prioritize(ownerNodeId: string, projectId: string, key: string): boolean {
      const resource = resources.get(resourceId(ownerNodeId, projectId, key));
      if (!resource) return false;
      queue(resource);
      const demand = demands.get(demandId({ ownerNodeId, projectId, key, hash: resource.hash }));
      if (!demand) return false;
      demand.priority = 1;
      demand.nextAttemptAt = now().getTime();
      return true;
    },
    complete(entry: FederationContentDemand): void {
      if (!existsSync(objectFile(entry.hash))) throw new Error('missing_federation_content_object');
      const resource = resources.get(resourceId(entry.ownerNodeId, entry.projectId, entry.key));
      if (resource?.hash === entry.hash) {
        resource.state = 'available';
        resource.verifiedHash = entry.hash;
        resource.error = '';
      }
      demands.delete(demandId(entry));
    },
    fail(entry: FederationContentDemand, error: string): void {
      entry.attempts += 1;
      entry.nextAttemptAt = now().getTime() + Math.min(300_000, 1_000 * 2 ** Math.min(entry.attempts, 8));
      const resource = resources.get(resourceId(entry.ownerNodeId, entry.projectId, entry.key));
      if (resource) {
        resource.state = resource.verifiedHash ? 'stale' : 'synchronizing';
        resource.error = error;
      }
    },
    resource(ownerNodeId: string, projectId: string, key: string): { state: FederationContentState; file: string | null; error: string } {
      const resource = resources.get(resourceId(ownerNodeId, projectId, key));
      if (!resource) return { state: 'missing', file: null, error: '' };
      const file = objectFile(resource.verifiedHash || resource.hash);
      return { state: resource.state, file: existsSync(file) ? file : null, error: resource.error };
    },
    status: () => ({ queueDepth: demands.size, resources: [...resources.values()].map(({ ownerNodeId, projectId, key, hash, state, error }) => ({ ownerNodeId, projectId, key, hash, state, error })) }),
  };
}

export type FederationContentReplicaStore = ReturnType<typeof createFederationContentReplicaStore>;
