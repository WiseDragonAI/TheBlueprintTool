/**
 * WHAT: Persists task-state and exact content delivery work in one retryable project outbox.
 * WHY: Local durability must survive restart without waiting for relay or peer availability.
 */
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type ReplicationLane = 'task-state' | 'content';
export type ReplicationOutboxEntry = {
  id: string;
  lane: ReplicationLane;
  resourceId: string;
  activationTaskId: string;
  state: 'held' | 'pending';
  payload: unknown;
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
};

type OutboxDocument = { version: 1; entries: ReplicationOutboxEntry[] };

function atomicWrite(file: string, value: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  const descriptor = openSync(temporary, 'wx');
  try {
    writeSync(descriptor, value);
    fsyncSync(descriptor);
  } finally { closeSync(descriptor); }
  renameSync(temporary, file);
  const directory = openSync(dirname(file), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}

/** One durable queue for task-state and exact content-resource replication. */
export function createDurableReplicationOutbox(input: { decisionOsRoot: string; now?: () => Date }) {
  const now = input.now ?? (() => new Date());
  const file = resolve(input.decisionOsRoot, 'replication', 'outbox-v1.json');
  let document: OutboxDocument;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as OutboxDocument;
    document = parsed.version === 1 && Array.isArray(parsed.entries) ? parsed : { version: 1, entries: [] };
  } catch { document = { version: 1, entries: [] }; }
  const persist = (): void => atomicWrite(file, `${JSON.stringify(document)}\n`);

  return {
    file,
    enqueue(entries: Array<Omit<ReplicationOutboxEntry, 'attempts' | 'nextAttemptAt' | 'createdAt'>>): void {
      const known = new Set(document.entries.map((entry) => entry.id));
      const createdAt = now().toISOString();
      for (const entry of entries) {
        if (known.has(entry.id)) continue;
        document.entries.push({ ...entry, attempts: 0, nextAttemptAt: createdAt, createdAt });
        known.add(entry.id);
      }
      persist();
    },
    releaseTask(taskId: string): number {
      let released = 0;
      for (const entry of document.entries) {
        if (entry.state !== 'held' || entry.activationTaskId !== taskId) continue;
        entry.state = 'pending';
        entry.nextAttemptAt = now().toISOString();
        released += 1;
      }
      if (released > 0) persist();
      return released;
    },
    due(lane: ReplicationLane, limit = 64): ReplicationOutboxEntry[] {
      const timestamp = now().getTime();
      return document.entries
        .filter((entry) => entry.lane === lane && entry.state === 'pending' && Date.parse(entry.nextAttemptAt) <= timestamp)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .slice(0, limit);
    },
    complete(ids: string[]): void {
      if (ids.length === 0) return;
      const completed = new Set(ids);
      document.entries = document.entries.filter((entry) => !completed.has(entry.id));
      persist();
    },
    fail(id: string): void {
      const entry = document.entries.find((candidate) => candidate.id === id);
      if (!entry) return;
      entry.attempts += 1;
      entry.nextAttemptAt = new Date(now().getTime() + Math.min(300_000, 1_000 * 2 ** Math.min(entry.attempts, 8))).toISOString();
      persist();
    },
    entries: (): ReplicationOutboxEntry[] => structuredClone(document.entries),
    status: () => ({
      held: document.entries.filter((entry) => entry.state === 'held').length,
      pending: document.entries.filter((entry) => entry.state === 'pending').length,
      taskState: document.entries.filter((entry) => entry.lane === 'task-state').length,
      content: document.entries.filter((entry) => entry.lane === 'content').length,
    }),
  };
}

export type DurableReplicationOutbox = ReturnType<typeof createDurableReplicationOutbox>;
