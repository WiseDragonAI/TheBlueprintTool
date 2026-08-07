/**
 * WHAT: Verifies canonical epoch-4 repair identity and cumulative served-bucket accounting.
 * WHY: Duplicate suppression must remain deterministic across Worker and Termux persistence adapters.
 */
import { describe, expect, it } from 'vitest';
import {
  assertFederationRepairManifest,
  canonicalFederationRepairBuckets,
  claimFederationRepairBuckets,
  createFederationRepairRecord,
  currentFederationRepairRecord,
  federationRepairRecordKey,
} from '../../shared/federation-repair-guard';
import { hashTaskCurrentBucket, hashTaskCurrentRoot } from '../../shared/task-current-state-core';

describe('federation repair guard', () => {
  it('validates the sparse manifest and rejects fabricated roots', () => {
    const buckets = [{ bucket: '0a', count: 0, checksum: hashTaskCurrentBucket([]) }];
    const root = hashTaskCurrentRoot(buckets);
    expect(assertFederationRepairManifest(root, buckets)).toBe(root);
    expect(() => assertFederationRepairManifest('0'.repeat(64), buckets)).toThrow('invalid_state_bucket_manifest');
    expect(() => assertFederationRepairManifest(root, [...buckets, ...buckets])).toThrow('invalid_state_bucket_manifest');
  });

  it('admits each canonical bucket once for one durable generation', () => {
    const initial = createFederationRepairRecord({ nodeId: 'node-a', projectId: 'project-a', generation: 7 });
    const first = claimFederationRepairBuckets(initial, canonicalFederationRepairBuckets(['ff', '00', '00']));
    expect(first.admitted).toEqual(['00', 'ff']);
    const duplicate = claimFederationRepairBuckets(first.record, canonicalFederationRepairBuckets(['00', 'ff']));
    expect(duplicate.admitted).toEqual([]);
    expect(duplicate.record.servedBuckets).toEqual(['00', 'ff']);
    expect(federationRepairRecordKey('node-a', 'project-a')).toBe('state:v4:repair:project-a:node-a');
    expect(() => canonicalFederationRepairBuckets(['gg'])).toThrow('invalid_state_missing_request');
  });

  it('invalidates repair claims created before response-complete accounting', () => {
    const current = createFederationRepairRecord({ nodeId: 'node-a', projectId: 'project-a', generation: 7 });
    const legacy = { ...current, responseVersion: undefined };
    expect(currentFederationRepairRecord(current, 7)).toBe(true);
    expect(currentFederationRepairRecord(legacy as unknown as typeof current, 7)).toBe(false);
    expect(currentFederationRepairRecord(current, 8)).toBe(false);
  });
});
