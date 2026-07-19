import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FederationContentManifest, FederationContentManifestEntry } from './federation-content-manifest.js';

export type FederationContentState = 'missing' | 'synchronizing' | 'available' | 'stale';
type ResourceState = FederationContentManifestEntry & { ownerNodeId: string; projectId: string; state: FederationContentState; verifiedHash: string; lastVerifiedAt: string; error: string };
type QueueEntry = { ownerNodeId: string; projectId: string; key: string; hash: string; attempts: number; nextAttemptAt: string };
type ContentDocument = { version: 1; resources: Record<string, ResourceState>; queue: QueueEntry[] };

function atomicWrite(file: string, bytes: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  const descriptor = openSync(temporary, 'wx');
  try {
    if (typeof bytes === 'string') writeSync(descriptor, bytes);
    else writeSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally { closeSync(descriptor); }
  renameSync(temporary, file);
}

function resourceId(ownerNodeId: string, projectId: string, key: string): string {
  return `${ownerNodeId}\u0000${projectId}\u0000${key}`;
}

export function createFederationContentReplicaStore(input: { decisionOsRoot: string; now?: () => Date }) {
  const now = input.now ?? (() => new Date());
  const root = resolve(input.decisionOsRoot, 'cache', 'federation-content-v1');
  const documentFile = resolve(root, 'index.json');
  const objectsDirectory = resolve(root, 'objects');
  let document: ContentDocument;
  try {
    const parsed = JSON.parse(readFileSync(documentFile, 'utf8')) as ContentDocument;
    document = parsed.version === 1 ? parsed : { version: 1, resources: {}, queue: [] };
  } catch { document = { version: 1, resources: {}, queue: [] }; }
  const persist = (): void => atomicWrite(documentFile, `${JSON.stringify(document)}\n`);
  const objectFile = (hash: string): string => resolve(objectsDirectory, hash.slice(0, 2), hash);

  return {
    root,
    applyManifest(ownerNodeId: string, manifest: FederationContentManifest): void {
      const manifestKeys = new Set(manifest.resources.map((entry) => resourceId(ownerNodeId, manifest.projectId, entry.key)));
      for (const entry of manifest.resources) {
        const id = resourceId(ownerNodeId, manifest.projectId, entry.key);
        const current = document.resources[id];
        const available = existsSync(objectFile(entry.hash));
        document.resources[id] = { ...entry, ownerNodeId, projectId: manifest.projectId, state: available ? 'available' : current?.verifiedHash ? 'stale' : 'missing', verifiedHash: available ? entry.hash : current?.verifiedHash ?? '', lastVerifiedAt: available ? now().toISOString() : current?.lastVerifiedAt ?? '', error: '' };
        if (!available && !document.queue.some((queued) => queued.ownerNodeId === ownerNodeId && queued.projectId === manifest.projectId && queued.key === entry.key && queued.hash === entry.hash)) {
          document.queue.push({ ownerNodeId, projectId: manifest.projectId, key: entry.key, hash: entry.hash, attempts: 0, nextAttemptAt: now().toISOString() });
          document.resources[id].state = 'synchronizing';
        }
      }
      for (const id of Object.keys(document.resources)) {
        const resource = document.resources[id];
        if (resource.ownerNodeId === ownerNodeId && resource.projectId === manifest.projectId && !manifestKeys.has(id)) delete document.resources[id];
      }
      persist();
    },
    due(limit = 2): QueueEntry[] {
      const timestamp = now().getTime();
      return document.queue.filter((entry) => Date.parse(entry.nextAttemptAt) <= timestamp).slice(0, limit);
    },
    install(entry: QueueEntry, bytes: Buffer): void {
      if (createHash('sha256').update(bytes).digest('hex') !== entry.hash) throw new Error('invalid_federation_content_hash');
      atomicWrite(objectFile(entry.hash), bytes);
      const id = resourceId(entry.ownerNodeId, entry.projectId, entry.key);
      const resource = document.resources[id];
      if (resource && resource.hash === entry.hash) {
        resource.state = 'available';
        resource.verifiedHash = entry.hash;
        resource.lastVerifiedAt = now().toISOString();
        resource.error = '';
      }
      document.queue = document.queue.filter((queued) => queued !== entry);
      persist();
    },
    fail(entry: QueueEntry, error: string): void {
      entry.attempts += 1;
      entry.nextAttemptAt = new Date(now().getTime() + Math.min(300_000, 1_000 * 2 ** Math.min(entry.attempts, 8))).toISOString();
      const resource = document.resources[resourceId(entry.ownerNodeId, entry.projectId, entry.key)];
      if (resource) { resource.state = resource.lastVerifiedAt ? 'stale' : 'synchronizing'; resource.error = error; }
      persist();
    },
    resource(ownerNodeId: string, projectId: string, key: string): { state: FederationContentState; bytes: Buffer | null; error: string } {
      const resource = document.resources[resourceId(ownerNodeId, projectId, key)];
      if (!resource) return { state: 'missing', bytes: null, error: '' };
      const file = objectFile(resource.verifiedHash || resource.hash);
      const bytes = existsSync(file) ? readFileSync(file) : null;
      return { state: bytes ? resource.state : resource.state === 'stale' ? 'stale' : resource.state, bytes, error: resource.error };
    },
    status: () => ({ queueDepth: document.queue.length, resources: Object.values(document.resources).map(({ ownerNodeId, projectId, key, hash, state, error }) => ({ ownerNodeId, projectId, key, hash, state, error })) }),
  };
}

export type FederationContentReplicaStore = ReturnType<typeof createFederationContentReplicaStore>;
