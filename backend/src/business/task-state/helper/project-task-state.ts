import { existsSync, readFileSync } from 'node:fs';
import type { TaskFieldEvent } from './task-event-types.js';
import { createTaskEventStore } from './task-event-store.js';
import { taskLedgerEventsBetween } from './task-ledger-events.js';
import { createTaskStateArchiver } from './task-state-git-archive.js';

type AnyRecord = Record<string, unknown>;

/** Owns one project's task projection and seeds its first immutable segment from the existing task ledger. */
export function createProjectTaskState(input: {
  projectId: string;
  writerId: string;
  decisionOsRoot: string;
  tasksLedgerFile: string;
  publish?: (event: TaskFieldEvent) => void | Promise<void>;
  repositoryRoot?: string;
  archiveRemote?: string;
}) {
  const store = createTaskEventStore({ decisionOsRoot: input.decisionOsRoot, projectId: input.projectId, compatibilityLedgerFile: input.tasksLedgerFile });
  const archiver = input.repositoryRoot ? createTaskStateArchiver({ repositoryRoot: input.repositoryRoot, writerId: input.writerId, projectId: input.projectId, remote: input.archiveRemote }) : null;
  const archivedFiles = new Set<string>();
  const pendingArchiveFiles = new Set<string>();
  const archiveNewArtifacts = (): void => {
    if (!archiver) return;
    const files = [...store.segmentFiles(), ...store.snapshotFiles()]
      .filter((file) => !archivedFiles.has(file) && !pendingArchiveFiles.has(file));
    if (files.length === 0) return;
    for (const file of files) pendingArchiveFiles.add(file);
    void archiver.enqueue(files).then(() => {
      for (const file of files) archivedFiles.add(file);
    }).catch(() => undefined).finally(() => {
      for (const file of files) pendingArchiveFiles.delete(file);
    });
  };
  if (store.events().length === 0 && existsSync(input.tasksLedgerFile)) {
    const ledger = JSON.parse(readFileSync(input.tasksLedgerFile, 'utf8')) as AnyRecord;
    const events = taskLedgerEventsBetween({ projectId: input.projectId, writerId: input.writerId, emittedAt: new Date().toISOString(), before: null, after: ledger });
    store.appendBatch(events);
    store.sealOpenSegment();
    store.createSnapshot();
    archiveNewArtifacts();
  }
  let queue = Promise.resolve();
  const commitNow = (ledger: AnyRecord, emittedAt = new Date().toISOString()): { events: TaskFieldEvent[]; ledger: AnyRecord } => {
    const before = store.projection().ledger;
    const events = taskLedgerEventsBetween({ projectId: input.projectId, writerId: input.writerId, emittedAt, before, after: ledger });
    const appended = store.appendBatch(events);
    archiveNewArtifacts();
    for (const eventId of appended.acceptedEventIds) {
      const event = events.find((candidate) => candidate.eventId === eventId)!;
      Promise.resolve(input.publish?.(event)).catch(() => undefined);
    }
    return { events, ledger: appended.projection.ledger };
  };
  const commit = (ledger: AnyRecord, emittedAt = new Date().toISOString()): Promise<{ events: TaskFieldEvent[]; ledger: AnyRecord }> => {
    let resolveCommit: (value: { events: TaskFieldEvent[]; ledger: AnyRecord }) => void = () => undefined;
    let rejectCommit: (error: unknown) => void = () => undefined;
    const result = new Promise<{ events: TaskFieldEvent[]; ledger: AnyRecord }>((resolve, reject) => { resolveCommit = resolve; rejectCommit = reject; });
    queue = queue.then(async () => {
      resolveCommit(commitNow(ledger, emittedAt));
    }).catch(rejectCommit);
    return result;
  };
  return { store, commit, commitNow, projection: () => store.projection() };
}

export type ProjectTaskState = ReturnType<typeof createProjectTaskState>;
