import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
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
  now?: () => Date;
};

const defaultSegmentMaximumBytes = 4 * 1024 * 1024;
const defaultSnapshotTailMaximum = 500;

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
  for (const event of events) (buckets.get(bucketFor(event.emittedAt)) ?? (buckets.set(bucketFor(event.emittedAt), []), buckets.get(bucketFor(event.emittedAt))!)).push(event);
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
  mkdirSync(segmentsDirectory, { recursive: true });
  mkdirSync(snapshotsDirectory, { recursive: true });

  const eventFiles = (): string[] => readdirSync(segmentsDirectory)
    .filter((name) => name === 'open.jsonl' || /^segment-.*\.jsonl$/.test(name))
    .sort((left, right) => left === 'open.jsonl' ? 1 : right === 'open.jsonl' ? -1 : left.localeCompare(right))
    .map((name) => resolve(segmentsDirectory, name));

  const readEvents = (): TaskFieldEvent[] => {
    const seen = new Set<string>();
    const events: TaskFieldEvent[] = [];
    for (const file of eventFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as TaskFieldEvent;
        assertTaskFieldEvent(event);
        if (event.projectId !== options.projectId || seen.has(event.eventId)) continue;
        seen.add(event.eventId);
        events.push(event);
      }
    }
    return events;
  };

  const readSnapshots = (): TaskStateSnapshot[] => readdirSync(snapshotsDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => {
      try {
        const snapshot = JSON.parse(readFileSync(resolve(snapshotsDirectory, name), 'utf8')) as TaskStateSnapshot;
        verifySnapshot(snapshot);
        return [snapshot];
      } catch { return []; }
    });

  const verifySnapshot = (snapshot: TaskStateSnapshot): void => {
    const manifest = snapshot?.manifest;
    if (!manifest || manifest.version !== 1 || manifest.projectId !== options.projectId || manifest.reducerVersion !== taskEventReducerVersion) throw new Error('incompatible_task_snapshot');
    const body = snapshotBody(snapshot);
    if (body.byteLength !== manifest.size || sha256(body) !== manifest.snapshotChecksum) throw new Error('invalid_task_snapshot_checksum');
    if (sha256(canonicalJson(snapshot.projection.ledger)) !== manifest.projectionChecksum) throw new Error('invalid_task_projection_checksum');
  };

  const writeProjection = (projection: TaskProjection): void => {
    atomicWrite(projectionFile, `${JSON.stringify(projection, null, 2)}\n`);
    if (options.compatibilityLedgerFile) atomicWrite(options.compatibilityLedgerFile, `${JSON.stringify(projection.ledger, null, 2)}\n`);
  };

  const rebuild = (invalidFromBucket?: string): TaskProjection => {
    const events = readEvents();
    if (invalidFromBucket) {
      for (const name of readdirSync(snapshotsDirectory).filter((entry) => entry.endsWith('.json'))) {
        const file = resolve(snapshotsDirectory, name);
        const snapshot = jsonFile<TaskStateSnapshot | null>(file, null);
        if (snapshot?.manifest?.throughBucket && snapshot.manifest.throughBucket >= invalidFromBucket) rmSync(file, { force: true });
      }
    }
    const snapshots = readSnapshots();
    const baseSnapshot = snapshots.at(-1);
    const base = baseSnapshot?.projection ?? emptyTaskProjection(options.projectId);
    const projection = reduceTaskEvents({ projectId: options.projectId, events, base });
    writeProjection(projection);
    const tailCount = events.filter((event) => !new Set(base.appliedEventIds).has(event.eventId)).length;
    if (!baseSnapshot || tailCount >= snapshotTailMaximum || invalidFromBucket) createSnapshot(projection, events);
    return projection;
  };

  const createSnapshot = (projection = readProjection(), events = readEvents()): TaskStateSnapshot => {
    const createdAt = now().toISOString();
    const eventBuckets = bucketManifest(events.filter((event) => projection.appliedEventIds.includes(event.eventId)));
    const draft: TaskStateSnapshot = {
      manifest: {
        version: 1,
        snapshotId: sha256(`${options.projectId}\n${createdAt}\n${projection.appliedEventIds.length}`).slice(0, 24),
        projectId: options.projectId,
        reducerVersion: taskEventReducerVersion,
        createdAt,
        throughBucket: eventBuckets.at(-1)?.bucket ?? '',
        projectionChecksum: sha256(canonicalJson(projection.ledger)),
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
    return draft;
  };

  const readProjection = (): TaskProjection => {
    const projection = jsonFile<TaskProjection | null>(projectionFile, null);
    if (projection?.version === 1 && projection.projectId === options.projectId) return projection;
    return rebuild();
  };

  const effectiveBucketManifest = (): TaskBucketManifestEntry[] => {
    const snapshot = readSnapshots().at(-1);
    if (!snapshot) return bucketManifest(readEvents());
    const covered = new Set(snapshot.projection.appliedEventIds);
    return mergeBucketManifests(snapshot.manifest.eventBuckets, bucketManifest(readEvents().filter((event) => !covered.has(event.eventId))));
  };

  const sealOpenSegment = (): string | null => {
    if (!existsSync(openSegment) || statSync(openSegment).size === 0) return null;
    const events = readFileSync(openSegment, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as TaskFieldEvent);
    const checksum = sha256(events.map((event) => event.checksum).join('\n'));
    const target = resolve(segmentsDirectory, `segment-${events[0].emittedAt.replaceAll(':', '-')}-${checksum.slice(0, 16)}.jsonl`);
    renameSync(openSegment, target);
    return target;
  };

  const appendBatch = (incoming: TaskFieldEvent[]): { acceptedEventIds: string[]; projection: TaskProjection } => {
    for (const event of incoming) {
      assertTaskFieldEvent(event);
      if (event.projectId !== options.projectId) throw new Error('task_event_project_mismatch');
    }
    const currentEvents = readEvents();
    const newestSnapshot = readSnapshots().at(-1);
    const currentProjection = existsSync(projectionFile)
      ? readProjection()
      : newestSnapshot?.projection ?? emptyTaskProjection(options.projectId);
    const known = new Set([...currentEvents.map((entry) => entry.eventId), ...currentProjection.appliedEventIds]);
    const events = incoming.filter((event) => !known.has(event.eventId));
    if (events.length === 0) return { acceptedEventIds: [], projection: currentProjection };
    const firstIncomingBucket = events.map((event) => bucketFor(event.emittedAt)).sort()[0];
    const coveredHistoryAvailable = newestSnapshot?.projection.appliedEventIds.every((eventId) => currentEvents.some((event) => event.eventId === eventId)) ?? true;
    if (newestSnapshot?.manifest.throughBucket && firstIncomingBucket <= newestSnapshot.manifest.throughBucket && !coveredHistoryAvailable) {
      throw new Error('task_event_requires_snapshot_refresh');
    }
    mkdirSync(dirname(openSegment), { recursive: true });
    const descriptor = openSync(openSegment, 'a');
    try {
      writeSync(descriptor, events.map((event) => JSON.stringify(event)).join('\n') + '\n');
      fsyncSync(descriptor);
    } finally { closeSync(descriptor); }
    if (statSync(openSegment).size >= segmentMaximumBytes) sealOpenSegment();
    const eventBucket = events.map((event) => bucketFor(event.emittedAt)).sort()[0];
    const invalidFromBucket = newestSnapshot?.manifest.eventBuckets.some((bucket) => bucket.bucket >= eventBucket) ? eventBucket : undefined;
    return { acceptedEventIds: events.map((event) => event.eventId), projection: rebuild(invalidFromBucket) };
  };

  const append = (event: TaskFieldEvent): { accepted: boolean; projection: TaskProjection } => {
    const result = appendBatch([event]);
    return { accepted: result.acceptedEventIds.length === 1, projection: result.projection };
  };

  const installSnapshot = (snapshot: TaskStateSnapshot): TaskProjection => {
    verifySnapshot(snapshot);
    const file = resolve(snapshotsDirectory, snapshotName(snapshot));
    atomicWrite(file, `${JSON.stringify(snapshot)}\n`);
    return rebuild();
  };

  const pending = (): PendingDocument => jsonFile(pendingFile, { version: 1, peers: {} });
  const persistPending = (document: PendingDocument): void => atomicWrite(pendingFile, `${JSON.stringify(document)}\n`);

  return {
    root,
    projectionFile,
    append,
    appendBatch,
    events: readEvents,
    projection: readProjection,
    rebuild,
    createSnapshot,
    snapshots: readSnapshots,
    snapshotFiles: (): string[] => readdirSync(snapshotsDirectory).filter((name) => name.endsWith('.json')).sort().map((name) => resolve(snapshotsDirectory, name)),
    installSnapshot,
    verifySnapshot,
    sealOpenSegment,
    bucketManifest: effectiveBucketManifest,
    snapshotManifests: (): TaskStateSnapshotManifest[] => readSnapshots().map((snapshot) => snapshot.manifest),
    markPending(peerId: string, eventId: string): void {
      const document = pending();
      const values = document.peers[peerId] ?? [];
      if (!values.includes(eventId)) values.push(eventId);
      document.peers[peerId] = values;
      persistPending(document);
    },
    acknowledge(peerId: string, eventIds: string[]): void {
      const document = pending();
      const acknowledged = new Set(eventIds);
      document.peers[peerId] = (document.peers[peerId] ?? []).filter((eventId) => !acknowledged.has(eventId));
      persistPending(document);
    },
    pendingFor(peerId: string): TaskFieldEvent[] {
      const identifiers = new Set(pending().peers[peerId] ?? []);
      return readEvents().filter((event) => identifiers.has(event.eventId));
    },
    segmentFiles: (): string[] => eventFiles().filter((file) => basename(file) !== 'open.jsonl'),
  };
}

export type TaskEventStore = ReturnType<typeof createTaskEventStore>;
