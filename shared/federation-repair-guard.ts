/**
 * WHAT: Defines canonical epoch-4 repair identities and cumulative bucket admission.
 * WHY: Nodes and relays must make identical duplicate-work decisions without changing the wire protocol.
 */
import { hashTaskCurrentRoot } from './task-current-state-core.js';
import type { FederationStateRejection } from './federation-state-transport.js';

export type FederationRepairBucket = { bucket: string; count: number; checksum: string };
export type FederationRepairRecord = {
  version: 1;
  nodeId: string;
  projectId: string;
  generation: number;
  peerRoot: string;
  peerManifestDigest: string;
  servedBuckets: string[];
  attemptId?: string;
  relayRoot?: string;
  receiverRoot?: string;
  requestedBuckets?: string[];
  remainingEntries?: Array<{ key: string; stateHash: string }>;
  pendingDeliveries?: Array<{
    deliveryId: string;
    entries: Array<{ key: string; stateHash: string }>;
    encodedBytes: number;
  }>;
  acknowledgedEntries?: Record<string, string>;
  rejectedEntries?: Record<string, FederationStateRejection>;
  summarySent?: boolean;
  completedAt?: string;
};

const canonicalBucket = /^[a-f0-9]{2}$/;
const canonicalHash = /^[a-f0-9]{64}$/;

export function assertFederationRepairAttempt(value: unknown, field: 'attemptId' | 'relayRoot' | 'receiverRoot'): string {
  const normalized = String(value ?? '');
  // WHAT: Admit only a bounded stable identity and canonical roots for repair continuation.
  // WHY: Durable attempt lookup must not accept ambiguous identity or unbounded storage input.
  if (field === 'attemptId' ? !/^[a-f0-9:]{64,193}$/.test(normalized) : !canonicalHash.test(normalized)) {
    throw new Error('invalid_state_missing_request');
  }
  return normalized;
}

export function assertFederationRepairManifest(root: unknown, values: FederationRepairBucket[]): string {
  const buckets = new Set<string>();
  for (const value of values) {
    // WHAT: Reject a noncanonical or repeated bucket before it can identify repair work.
    // WHY: Ambiguous manifests could purchase distinct sessions for the same epoch-4 state.
    if (!canonicalBucket.test(value.bucket) || buckets.has(value.bucket)) throw new Error('invalid_state_bucket_manifest');
    buckets.add(value.bucket);
    // WHAT: Reject malformed summary metadata before hashing or storage access.
    // WHY: Repair identity is trustworthy only when every bucket has the epoch-4 summary shape.
    if (!Number.isSafeInteger(value.count) || value.count < 0 || !canonicalHash.test(value.checksum)) throw new Error('invalid_state_bucket_manifest');
  }
  const digest = hashTaskCurrentRoot(values);
  // WHAT: Reject a claimed root that does not describe the supplied sparse manifest.
  // WHY: Equal buckets with a fabricated root otherwise create a summary-only feedback loop.
  if (root !== digest) throw new Error('invalid_state_bucket_manifest');
  return digest;
}

export function canonicalFederationRepairBuckets(values: unknown[]): string[] {
  const buckets = [...new Set(values.map(String))].sort();
  // WHAT: Reject the complete selection when any requested bucket is outside the fixed namespace.
  // WHY: Invalid input must perform zero partial storage work.
  if (buckets.length === 0 || buckets.some((bucket) => !canonicalBucket.test(bucket))) throw new Error('invalid_state_missing_request');
  return buckets;
}

export function federationRepairRecordKey(nodeId: string, projectId: string): string {
  return `state:v4:repair:${encodeURIComponent(projectId)}:${encodeURIComponent(nodeId)}`;
}

export function createFederationRepairRecord(input: {
  nodeId: string;
  projectId: string;
  generation: number;
  peerRoot?: string;
  peerManifestDigest?: string;
}): FederationRepairRecord {
  return {
    version: 1,
    nodeId: input.nodeId,
    projectId: input.projectId,
    generation: input.generation,
    peerRoot: input.peerRoot ?? '',
    peerManifestDigest: input.peerManifestDigest ?? '',
    servedBuckets: [],
  };
}

export function claimFederationRepairBuckets(
  record: FederationRepairRecord,
  requested: string[],
): { record: FederationRepairRecord; admitted: string[] } {
  const served = new Set(record.servedBuckets);
  const admitted = requested.filter((bucket) => !served.has(bucket));
  return {
    admitted,
    record: { ...record, servedBuckets: [...new Set([...record.servedBuckets, ...admitted])].sort() },
  };
}
