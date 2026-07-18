/** Builds the task-only resource bundle exchanged by federation peers. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import { parseThreadMarkdown, resolveThreadContentFile } from '../../ledger/helper/thread-content-file.js';
import type { FederationReplicaSnapshot } from './federation-replica-store.js';

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

type ReplicaFileSystem = {
  exists(file: string): boolean;
  readText(file: string): string;
};

const defaultFileSystem: ReplicaFileSystem = {
  exists: existsSync,
  readText: (file) => readFileSync(file, 'utf8'),
};

function projectSliceFingerprint(projection: AnyRecord, projectId: string): string {
  const slice = records(projection.projectSlices).find((entry) => String(entry.projectId ?? '') === projectId);
  if (typeof slice?.fingerprint === 'string' && slice.fingerprint) return slice.fingerprint;
  const tasks = records(projection.allTasks).filter((task) => String(task.projectId ?? '') === projectId);
  return createHash('sha256').update(JSON.stringify(tasks)).digest('hex');
}

function cardDescription(input: { decisionOsRoot: string; card: AnyRecord; fileSystem: ReplicaFileSystem }): string {
  const comment = input.card.comment && typeof input.card.comment === 'object' ? input.card.comment as AnyRecord : {};
  const file = resolveCardContentFile(input.decisionOsRoot, comment.contentFile);
  if (file && input.fileSystem.exists(file)) return input.fileSystem.readText(file);
  return typeof comment.what === 'string' ? comment.what : '';
}

/** Builds one immutable replica from one in-memory parse of each participating ledger. */
export function buildFederationTaskReplica(input: { project: DecisionOsProject; projection: AnyRecord; fileSystem?: ReplicaFileSystem }): FederationReplicaSnapshot {
  const fileSystem = input.fileSystem ?? defaultFileSystem;
  const tasks = records(input.projection.allTasks).filter((task) => String(task.projectId ?? '') === input.project.id && task.status !== 'task-complete');
  const ledgers: FederationReplicaSnapshot['ledgers'] = {};
  for (const ledgerEntry of input.project.ledgers) {
    const ledgerTasks = tasks.filter((task) => String(task.ledgerId ?? '') === ledgerEntry.id);
    if (ledgerTasks.length === 0) continue;
    const ledgerPath = resolve(input.project.decisionOsRoot, ledgerEntry.ledgerFile.replace(/^\.decision-os\//, ''));
    if (!fileSystem.exists(ledgerPath)) continue;
    const ledger = JSON.parse(fileSystem.readText(ledgerPath)) as AnyRecord;
    const ledgerCards = records(ledger.cards);
    const cardIds = new Set<string>();
    for (const task of ledgerTasks) {
      cardIds.add(String(task.cardId ?? ''));
      for (const subtask of records(task.subtasks)) cardIds.add(String(subtask.cardId ?? ''));
    }
    const navigation = {
      id: ledger.id ?? ledgerEntry.id,
      annotations: ledger.annotations ?? [],
      relationships: ledger.relationships ?? [],
      cards: ledgerCards.map((card) => ({
        id: card.id,
        title: card.title,
        status: card.status,
        labels: card.labels,
        x: card.x,
        y: card.y,
        w: card.w,
        h: card.h,
        codexActiveRunId: card.codexActiveRunId ?? null,
        codexActiveExecutionId: card.codexActiveExecutionId ?? null,
        codexThreadRunId: card.codexThreadRunId ?? null,
        codexRunId: card.codexRunId ?? null,
        codexRunModel: card.codexRunModel ?? null,
        codexRunEffort: card.codexRunEffort ?? null,
      })),
    };
    const cards = Object.fromEntries([...cardIds].flatMap((cardId) => {
      const card = ledgerCards.find((entry) => String(entry.id ?? '') === cardId);
      if (!card) return [];
      const comment = card.comment && typeof card.comment === 'object' ? card.comment as AnyRecord : {};
      return [[cardId, { ...card, comment: { ...comment, what: cardDescription({ decisionOsRoot: input.project.decisionOsRoot, card, fileSystem }) } }]];
    }));
    const threads = Object.fromEntries([...cardIds].flatMap((cardId) => {
      const threadId = `thread-${cardId}`;
      const threadFiles = ledger.threadFiles && typeof ledger.threadFiles === 'object' ? ledger.threadFiles as AnyRecord : {};
      const contentFile = String(threadFiles[threadId] ?? '');
      const file = resolveThreadContentFile(input.project.decisionOsRoot, contentFile);
      if (!contentFile || !file || !fileSystem.exists(file)) return [];
      const deleted = ledger.deletedNoteIds && typeof ledger.deletedNoteIds === 'object' ? ledger.deletedNoteIds as AnyRecord : {};
      const deletedIds = Array.isArray(deleted[threadId]) ? (deleted[threadId] as unknown[]).map(String) : [];
      return [[threadId, {
        ledgerId: ledgerEntry.id,
        threadId,
        contentFile,
        threadFiles: { [threadId]: contentFile },
        notes: { [threadId]: parseThreadMarkdown(fileSystem.readText(file)) },
        deletedNoteIds: { [threadId]: deletedIds },
      }]];
    }));
    const filteredNavigation = {
      ...navigation,
      cards: records(navigation.cards).filter((card) => cardIds.has(String(card.id ?? ''))),
      relationships: records(navigation.relationships).filter((relationship) => cardIds.has(String(relationship.from ?? '')) && cardIds.has(String(relationship.to ?? ''))),
    };
    ledgers[ledgerEntry.id] = { navigation: filteredNavigation, cards, threads };
  }
  const project = {
    id: input.project.id,
    name: input.project.name,
    description: input.project.description,
    color: input.project.color,
    ledgers: input.project.ledgers,
    originFingerprint: String(records(input.projection.projects).find((entry) => String(entry.id ?? '') === input.project.id)?.originFingerprint ?? ''),
  };
  const state = { projectId: input.project.id, projectName: input.project.name, projectColor: input.project.color, ledgers: input.project.ledgers };
  const controlRoom = {
    queue: tasks.filter((task) => task.status === 'task-waiting'),
    exec: tasks.filter((task) => task.status === 'task-execution'),
    backlog: tasks.filter((task) => task.status === 'task-backlog'),
    done: [],
    allTasks: tasks,
    projects: [project],
    diagnostics: [],
  };
  const body = { version: 1 as const, project, controlRoom, state, ledgers };
  const revision = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return { ...body, revision, generatedAt: new Date().toISOString() };
}

/** Reuses an unchanged project snapshot instead of rebuilding it on every federation heartbeat. */
export function createFederationTaskReplicaCache(input: { build?: typeof buildFederationTaskReplica } = {}): {
  get(value: { project: DecisionOsProject; projection: AnyRecord }): FederationReplicaSnapshot;
} {
  const build = input.build ?? buildFederationTaskReplica;
  const entries = new Map<string, { fingerprint: string; snapshot: FederationReplicaSnapshot }>();
  return {
    get(value) {
      const fingerprint = projectSliceFingerprint(value.projection, value.project.id);
      const current = entries.get(value.project.id);
      if (current?.fingerprint === fingerprint) return current.snapshot;
      const snapshot = build(value);
      entries.set(value.project.id, { fingerprint, snapshot });
      return snapshot;
    },
  };
}
