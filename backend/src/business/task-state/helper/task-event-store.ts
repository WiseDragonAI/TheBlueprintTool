/**
 * WHAT: Stores immutable task events and materializes their bounded local projection.
 * WHY: Request-path appends must remain finite while restart, repair, and checkpoint maintenance stay deterministic.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { canonicalJson, assertTaskFieldEvent, sha256, snapshotBody } from './task-event-codec.js';
import { emptyTaskProjection, reduceTaskEvents } from './task-event-reducer.js';
import { taskEventReducerVersion, type TaskBucketManifestEntry, type TaskFieldEvent, type TaskProjection, type TaskStateSnapshot, type TaskStateSnapshotManifest } from './task-event-types.js';

type PendingDocument = { version: 1; peers: Record<string, string[]> };
type StoreOptions = {
  decisionOsRoot: string;
  projectId: string;
  compatibilityLedgerFile?: string;
  segmentMaximumBytes?: number;
  snapshotTailMaximum?: number;
  snapshotRetainMaximum?: number;
  now?: () => Date;
};

const defaultSegmentMaximumBytes = 4 * 1024 * 1024;
const defaultSnapshotTailMaximum = 500;
const defaultSnapshotRetainMaximum = 2;

function atomicWrite(file: string, bytes: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  const descriptor = openSync(temporary, 'wx');
  try {
    if (typeof bytes === 'string') writeSync(descriptor, bytes);
    else writeSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, file);
  const directory = openSync(dirname(file), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

function jsonFile<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

function bucketFor(emittedAt: string): string {
  return emittedAt.slice(0, 13);
}

function xorChecksums(checksums: string[]): string {
  const result = Buffer.alloc(32);
  for (const checksum of checksums) {
    const bytes = Buffer.from(checksum, 'hex');
    for (let index = 0; index < result.length; index += 1) result[index] ^= bytes[index] ?? 0;
  }
  return result.toString('hex');
}

function bucketManifest(events: TaskFieldEvent[]): TaskBucketManifestEntry[] {
  const buckets = new Map<string, TaskFieldEvent[]>();
  for (const event of events) {
    const bucket = bucketFor(event.emittedAt);
    const values = buckets.get(bucket) ?? [];
    values.push(event);
    buckets.set(bucket, values);
  }
  return [...buckets].sort(([left], [right]) => left.localeCompare(right)).map(([bucket, entries]) => ({
    bucket,
    count: entries.length,
    checksum: xorChecksums(entries.map((event) => event.checksum)),
  }));
}

function mergeBucketManifests(base: TaskBucketManifestEntry[], tail: TaskBucketManifestEntry[]): TaskBucketManifestEntry[] {
  const result = new Map(base.map((entry) => [entry.bucket, { ...entry }]));
  for (const entry of tail) {
    const current = result.get(entry.bucket);
    result.set(entry.bucket, current
      ? { bucket: entry.bucket, count: current.count + entry.count, checksum: xorChecksums([current.checksum, entry.checksum]) }
      : { ...entry });
  }
  return [...result.values()].sort((left, right) => left.bucket.localeCompare(right.bucket));
}

function snapshotName(snapshot: TaskStateSnapshot): string {
  return `${snapshot.manifest.createdAt.replaceAll(':', '-').replaceAll('.', '-')}-${snapshot.manifest.snapshotId}.json`;
}

/**
 * Durable task event storage with an in-memory projection and indexes.
 * Request-path appends touch one segment, one projection, and one compatibility file;
 * snapshot scans, compaction, and archival are explicit maintenance work.
 */
export function createTaskEventStore(options: StoreOptions) {
  const now = options.now ?? (() => new Date());
  const root = resolve(options.decisionOsRoot, 'task-state', options.projectId);
  const segmentsDirectory = resolve(root, 'events');
  const snapshotsDirectory = resolve(root, 'snapshots');
  const projectionFile = resolve(root, 'projection.json');
  const pendingFile = resolve(root, 'pending-peers.json');
  const openSegment = resolve(segmentsDirectory, 'open.jsonl');
  const segmentMaximumBytes = options.segmentMaximumBytes ?? defaultSegmentMaximumBytes;
  const snapshotTailMaximum = options.snapshotTailMaximum ?? defaultSnapshotTailMaximum;
  const snapshotRetainMaximum = Math.max(1, options.snapshotRetainMaximum ?? defaultSnapshotRetainMaximum);
  mkdirSync(segmentsDirectory, { recursive: true });
  mkdirSync(snapshotsDirectory, { recursive: true });

  const eventFiles = (): string[] => readdirSync(segmentsDirectory)
    .filter((name) => name === 'open.jsonl' || /^segment-.*\.jsonl$/.test(name))
    .sort((left, right) => left === 'open.jsonl' ? 1 : right === 'open.jsonl' ? -1 : left.localeCompare(right))
    .map((name) => resolve(segmentsDirectory, name));

  const verifySnapshot = (snapshot: TaskStateSnapshot): void => {
    const manifest = snapshot?.manifest;
    if (!manifest || manifest.version !== 1 || manifest.projectId !== options.projectId || manifest.reducerVersion !== taskEventReducerVersion) throw new Error('incompatible_task_snapshot');
    const body = snapshotBody(snapshot);
    if (body.byteLength !== manifest.size || sha256(body) !== manifest.snapshotChecksum) throw new Error('invalid_task_snapshot_checksum');
    if (sha256(canonicalJson(snapshot.projection.ledger)) !== manifest.projectionChecksum) throw new Error('invalid_task_projection_checksum');
  };

  const loadEvents = (): TaskFieldEvent[] => {
    const seen = new Set<string>();
    const values: TaskFieldEvent[] = [];
    for (const file of eventFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as TaskFieldEvent;
        assertTaskFieldEvent(event);
        if (event.projectId !== options.projectId || seen.has(event.eventId)) continue;
        seen.add(event.eventId);
        values.push(event);
      }
    }
    return values;
  };

  const loadSnapshots = (): TaskStateSnapshot[] => readdirSync(snapshotsDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => {
      try {
        const snapshot = JSON.parse(readFileSync(resolve(snapshotsDirectory, name), 'utf8')) as TaskStateSnapshot;
        verifySnapshot(snapshot);
        return [snapshot];
      } catch { return []; }
    });

  let events = loadEvents();
  let eventIds = new Set(events.map((event) => event.eventId));
  let snapshots = loadSnapshots();
  let pendingDocument = jsonFile<PendingDocument>(pendingFile, { version: 1, peers: {} });
  let projectionCache: TaskProjection | null = null;

  const writeProjection = (projection: TaskProjection): void => {
    atomicWrite(projectionFile, `${JSON.stringify(projection, null, 2)}\n`);
    if (options.compatibilityLedgerFile) atomicWrite(options.compatibilityLedgerFile, `${JSON.stringify(projection.ledger, null, 2)}\n`);
  };

  const retainSnapshots = (): void => {
    snapshots.sort((left, right) => left.manifest.createdAt.localeCompare(right.manifest.createdAt));
    const discarded = snapshots.splice(0, Math.max(0, snapshots.length - snapshotRetainMaximum));
    for (const snapshot of discarded) rmSync(resolve(snapshotsDirectory, snapshotName(snapshot)), { force: true });
  };

  const rebuild = (optionsInput: { discardSnapshotsFromBucket?: string; ignoreProjectionFile?: boolean } = {}): TaskProjection => {
    if (optionsInput.discardSnapshotsFromBucket) {
      const retained: TaskStateSnapshot[] = [];
      for (const snapshot of snapshots) {
        if (snapshot.manifest.throughBucket && snapshot.manifest.throughBucket >= optionsInput.discardSnapshotsFromBucket) {
          rmSync(resolve(snapshotsDirectory, snapshotName(snapshot)), { force: true });
        } else retained.push(snapshot);
      }
      snapshots = retained;
    }
    const newestSnapshot = snapshots.at(-1);
    const diskProjection = optionsInput.ignoreProjectionFile ? null : jsonFile<TaskProjection | null>(projectionFile, null);
    const validDiskProjection = diskProjection?.version === 1
      && diskProjection.reducerVersion === taskEventReducerVersion
      && diskProjection.projectId === options.projectId ? diskProjection : null;
    const base = validDiskProjection && (!newestSnapshot || validDiskProjection.appliedEventIds.length >= newestSnapshot.projection.appliedEventIds.length)
      ? validDiskProjection
      : newestSnapshot?.projection ?? emptyTaskProjection(options.projectId);
    projectionCache = reduceTaskEvents({ projectId: options.projectId, events, base });
    writeProjection(projectionCache);
    return projectionCache;
  };

  const readProjection = (): TaskProjection => projectionCache ?? rebuild();
  const readEvents = (): TaskFieldEvent[] => events.slice();
  const readSnapshots = (): TaskStateSnapshot[] => snapshots.slice();

  const effectiveBucketManifest = (): TaskBucketManifestEntry[] => {
    const snapshot = snapshots.at(-1);
    if (!snapshot) return bucketManifest(events);
    const covered = new Set(snapshot.projection.appliedEventIds);
    return mergeBucketManifests(snapshot.manifest.eventBuckets, bucketManifest(events.filter((event) => !covered.has(event.eventId))));
  };

  const sealOpenSegment = (): string | null => {
    if (!existsSync(openSegment) || statSync(openSegment).size === 0) return null;
    const segmentEvents = readFileSync(openSegment, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as TaskFieldEvent);
    const checksum = sha256(segmentEvents.map((event) => event.checksum).join('\n'));
    const target = resolve(segmentsDirectory, `segment-${segmentEvents[0].emittedAt.replaceAll(':', '-')}-${checksum.slice(0, 16)}.jsonl`);
    renameSync(openSegment, target);
    return target;
  };

  const appendBatch = (incoming: TaskFieldEvent[]): { acceptedEventIds: string[]; projection: TaskProjection } => {
    for (const event of incoming) {
      assertTaskFieldEvent(event);
      if (event.projectId !== options.projectId) throw new Error('task_event_project_mismatch');
    }
    const currentProjection = readProjection();
    const known = new Set([...eventIds, ...currentProjection.appliedEventIds]);
    const accepted = incoming.filter((event) => !known.has(event.eventId));
    if (accepted.length === 0) return { acceptedEventIds: [], projection: currentProjection };

    const causalRevisions = accepted.flatMap((event) => event.revision === undefined ? [] : [event.revision]);
    const hasLegacyEvent = accepted.some((event) => event.revision === undefined);
    const lateCausalEvent = causalRevisions.some((revision) => revision <= (currentProjection.lastRevision ?? 0));
    const newestSnapshot = snapshots.at(-1);
    const completeCoveredHistory = newestSnapshot?.projection.appliedEventIds.every((eventId) => eventIds.has(eventId)) ?? true;
    if (lateCausalEvent && newestSnapshot && !completeCoveredHistory) throw new Error('task_event_requires_snapshot_refresh');

    const descriptor = openSync(openSegment, 'a');
    try {
      writeSync(descriptor, `${accepted.map((event) => JSON.stringify(event)).join('\n')}\n`);
      fsyncSync(descriptor);
    } finally { closeSync(descriptor); }
    events.push(...accepted);
    for (const event of accepted) eventIds.add(event.eventId);
    if (statSync(openSegment).size >= segmentMaximumBytes) sealOpenSegment();

    if (lateCausalEvent || hasLegacyEvent) projectionCache = reduceTaskEvents({ projectId: options.projectId, events });
    else projectionCache = reduceTaskEvents({ projectId: options.projectId, events: accepted, base: currentProjection });
    writeProjection(projectionCache);
    return { acceptedEventIds: accepted.map((event) => event.eventId), projection: projectionCache };
  };

  const append = (event: TaskFieldEvent): { accepted: boolean; projection: TaskProjection } => {
    const result = appendBatch([event]);
    return { accepted: result.acceptedEventIds.length === 1, projection: result.projection };
  };

  const createSnapshot = (projection = readProjection()): TaskStateSnapshot => {
    const projectionChecksum = sha256(canonicalJson(projection.ledger));
    const current = snapshots.at(-1);
    if (current && current.manifest.projectionChecksum === projectionChecksum && current.projection.appliedEventIds.length === projection.appliedEventIds.length) return current;
    const createdAt = now().toISOString();
    const eventBuckets = effectiveBucketManifest();
    const draft: TaskStateSnapshot = {
      manifest: {
        version: 1,
        snapshotId: sha256(`${options.projectId}\n${createdAt}\n${projection.appliedEventIds.length}\n${projectionChecksum}`).slice(0, 24),
        projectId: options.projectId,
        reducerVersion: taskEventReducerVersion,
        createdAt,
        throughBucket: eventBuckets.at(-1)?.bucket ?? '',
        projectionChecksum,
        snapshotChecksum: '',
        size: 0,
        eventBuckets,
      },
      projection,
    };
    const body = snapshotBody(draft);
    draft.manifest.snapshotChecksum = sha256(body);
    draft.manifest.size = body.byteLength;
    atomicWrite(resolve(snapshotsDirectory, snapshotName(draft)), `${JSON.stringify(draft)}\n`);
    snapshots.push(draft);
    retainSnapshots();
    return draft;
  };

  const installSnapshot = (snapshot: TaskStateSnapshot): TaskProjection => {
    verifySnapshot(snapshot);
    const current = snapshots.at(-1);
    if (!current || current.manifest.snapshotId !== snapshot.manifest.snapshotId) {
      atomicWrite(resolve(snapshotsDirectory, snapshotName(snapshot)), `${JSON.stringify(snapshot)}\n`);
      snapshots.push(snapshot);
      retainSnapshots();
    }
    projectionCache = reduceTaskEvents({ projectId: options.projectId, events, base: snapshot.projection });
    writeProjection(projectionCache);
    return projectionCache;
  };

  const persistPending = (): void => atomicWrite(pendingFile, `${JSON.stringify(pendingDocument)}\n`);

  return {
    root,
    projectionFile,
    append,
    appendBatch,
    events: readEvents,
    projection: readProjection,
    rebuild: () => rebuild({ ignoreProjectionFile: true }),
    createSnapshot,
    snapshots: readSnapshots,
    snapshotFiles: (): string[] => snapshots.map((snapshot) => resolve(snapshotsDirectory, snapshotName(snapshot))),
    installSnapshot,
    verifySnapshot,
    sealOpenSegment,
    bucketManifest: effectiveBucketManifest,
    snapshotManifests: (): TaskStateSnapshotManifest[] => snapshots.map((snapshot) => snapshot.manifest),
    nextRevision: (): number => (readProjection().lastRevision ?? 0) + 1,
    maintain(): { snapshotCreated: boolean; segmentSealed: boolean } {
      const beforeSnapshot = snapshots.at(-1);
      const covered = new Set(beforeSnapshot?.projection.appliedEventIds ?? []);
      const shouldSnapshot = !beforeSnapshot || events.filter((event) => !covered.has(event.eventId)).length >= snapshotTailMaximum;
      const snapshot = shouldSnapshot ? createSnapshot() : beforeSnapshot;
      return { snapshotCreated: Boolean(snapshot && snapshot !== beforeSnapshot), segmentSealed: Boolean(sealOpenSegment()) };
    },
    markPending(peerId: string, eventId: string): void {
      const values = pendingDocument.peers[peerId] ?? [];
      if (!values.includes(eventId)) values.push(eventId);
      pendingDocument.peers[peerId] = values;
      persistPending();
    },
    markPendingBatch(peerId: string, incomingEventIds: string[]): void {
      const values = new Set(pendingDocument.peers[peerId] ?? []);
      for (const eventId of incomingEventIds) values.add(eventId);
      pendingDocument.peers[peerId] = [...values];
      persistPending();
    },
    markPendingForPeers(peerIds: string[], incomingEventIds: string[]): void {
      for (const peerId of peerIds) {
        const values = new Set(pendingDocument.peers[peerId] ?? []);
        for (const eventId of incomingEventIds) values.add(eventId);
        pendingDocument.peers[peerId] = [...values];
      }
      persistPending();
    },
    acknowledge(peerId: string, acknowledgedEventIds: string[]): void {
      const acknowledged = new Set(acknowledgedEventIds);
      pendingDocument.peers[peerId] = (pendingDocument.peers[peerId] ?? []).filter((eventId) => !acknowledged.has(eventId));
      persistPending();
    },
    pendingFor(peerId: string): TaskFieldEvent[] {
      const identifiers = new Set(pendingDocument.peers[peerId] ?? []);
      return events.filter((event) => identifiers.has(event.eventId));
    },
    segmentFiles: (): string[] => eventFiles().filter((file) => basename(file) !== 'open.jsonl'),
  };
}

export type TaskEventStore = ReturnType<typeof createTaskEventStore>;
