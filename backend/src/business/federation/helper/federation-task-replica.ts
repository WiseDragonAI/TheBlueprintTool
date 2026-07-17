/** Builds the task-only resource bundle exchanged by federation peers. */
import { createHash } from 'node:crypto';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { ledgerCardProjection, ledgerNavigationProjection, ledgerThreadProjection } from '../../server/helper/ledger-read-models.js';
import type { FederationReplicaSnapshot } from './federation-replica-store.js';

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is AnyRecord => Boolean(entry && typeof entry === 'object')) : [];
}

export function buildFederationTaskReplica(input: { project: DecisionOsProject; projection: AnyRecord }): FederationReplicaSnapshot {
  const tasks = records(input.projection.allTasks).filter((task) => String(task.projectId ?? '') === input.project.id && task.status !== 'task-complete');
  const ledgers: FederationReplicaSnapshot['ledgers'] = {};
  for (const ledgerEntry of input.project.ledgers) {
    const ledgerTasks = tasks.filter((task) => String(task.ledgerId ?? '') === ledgerEntry.id);
    if (ledgerTasks.length === 0) continue;
    const cardIds = new Set<string>();
    for (const task of ledgerTasks) {
      cardIds.add(String(task.cardId ?? ''));
      for (const subtask of records(task.subtasks)) cardIds.add(String(subtask.cardId ?? ''));
    }
    const navigation = ledgerNavigationProjection({ decisionOsRoot: input.project.decisionOsRoot, ledgerId: ledgerEntry.id });
    if (!navigation) continue;
    const cards = Object.fromEntries([...cardIds].flatMap((cardId) => {
      const card = ledgerCardProjection({ decisionOsRoot: input.project.decisionOsRoot, ledgerId: ledgerEntry.id, cardId });
      return card ? [[cardId, card]] : [];
    }));
    const threads = Object.fromEntries([...cardIds].flatMap((cardId) => {
      const threadId = `thread-${cardId}`;
      const thread = ledgerThreadProjection({ decisionOsRoot: input.project.decisionOsRoot, ledgerId: ledgerEntry.id, threadId });
      return thread ? [[threadId, thread]] : [];
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
