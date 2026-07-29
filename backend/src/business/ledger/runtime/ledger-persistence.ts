/**
 * WHAT: Persists non-task ledgers and commits scoped task mutations with response receipts.
 * WHY: Ledger persistence and task-state delegation must not live inside HTTP server composition.
 */
import { writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import type { LedgerMutation } from '../helper/apply-ledger-mutation.js';
import { hydrateLedgerCardContent, resolveCardContentFile } from '../helper/card-content-file.js';
import { stripHydratedThreadNotes } from '../helper/thread-content-file.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { TaskEntityChange } from '../../task-state/helper/task-current-state-types.js';
import type { createLedgerRevisionTracker } from '../../server/helper/create-ledger-revision-tracker.js';
import {
  ledgerCardProjection,
  ledgerThreadProjection,
} from '../../server/helper/ledger-read-models.js';

type AnyRecord = Record<string, unknown>;
type ProjectionEntityChange = {
  entityType: TaskEntityChange['entityType'];
  entityId: string;
};
const ledgerRevisionHeader = 'x-decision-os-ledger-revision';

export function createLedgerPersistence(input: {
  decisionOsRoot: string;
  invalidateProject: (
    projectId: string,
    entities?: readonly ProjectionEntityChange[],
  ) => void;
  localProject: DecisionOsProject | null;
  projectId: string;
  publishContentChange: () => void;
  revisions: ReturnType<typeof createLedgerRevisionTracker>;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  watcher: {
    ignoreNext: (file: string) => void;
    refreshOwnership: () => void;
  };
}) {
  const persistLedger = async (
    ledgerId: string,
    ledgerPath: string,
    ledger: AnyRecord,
    response: ServerResponse,
  ): Promise<void> => {
    if (ledgerId === 'tasks') throw new Error('aggregate_task_state_commit_removed');
    stripHydratedThreadNotes(ledger);
    input.watcher.ignoreNext(ledgerPath);
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    input.watcher.refreshOwnership();
    input.invalidateProject(input.projectId);
    input.publishContentChange();
    response.setHeader(ledgerRevisionHeader, String(input.revisions.advance(ledgerId)));
    response.end(JSON.stringify(hydrateLedgerCardContent(ledger, input.decisionOsRoot)));
  };

  const persistMutation = async (
    ledgerId: string,
    ledgerPath: string,
    before: AnyRecord,
    ledger: AnyRecord,
    mutation: LedgerMutation,
    changedContentFiles: readonly string[],
    response: ServerResponse,
  ): Promise<void> => {
    if (ledgerId !== 'tasks') stripHydratedThreadNotes(ledger);
    input.watcher.ignoreNext(ledgerPath);
    let taskCommit: Awaited<ReturnType<ProjectTaskState['executeMutation']>> | null = null;
    try {
      taskCommit = ledgerId === 'tasks' && input.localProject
        ? await input.stateForProject(input.localProject).executeMutation(
          mutation,
          before,
          ledger,
          changedContentFiles,
        )
        : null;
    } catch (error) {
      if (error instanceof Error && error.message === 'task_state_bootstrap_incomplete') {
        response.statusCode = 503;
        response.end(JSON.stringify({ ok: false, error: 'task-state-bootstrap-incomplete' }));
        return;
      }
      if (error instanceof Error && error.message.startsWith('task_lifecycle_conflict:')) {
        response.statusCode = 409;
        response.end(JSON.stringify({
          ok: false,
          error: 'task-conflict',
          cardIds: error.message.slice('task_lifecycle_conflict:'.length)
            .split(',')
            .filter(Boolean),
        }));
        return;
      }
      if (error instanceof Error && error.message.startsWith('task_execution_active:')) {
        response.statusCode = 409;
        response.end(JSON.stringify({
          ok: false,
          error: 'task_execution_active',
          cardId: error.message.slice('task_execution_active:'.length),
        }));
        return;
      }
      if (error instanceof Error && error.message === 'invalid_task_assignment') {
        response.statusCode = 400;
        response.end(JSON.stringify({ ok: false, error: 'invalid_task_assignment' }));
        return;
      }
      throw error;
    }
    const persisted = taskCommit?.ledger
      ?? (writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2)), ledger);
    input.watcher.refreshOwnership();
    if (!taskCommit) input.invalidateProject(input.projectId);
    else if (taskCommit.changed) {
      input.invalidateProject(input.projectId, taskCommit.localChanges);
    }
    if (ledgerId !== 'tasks') input.publishContentChange();
    const revision = input.revisions.advance(ledgerId);
    const taskClock = taskCommit && input.localProject
      ? input.stateForProject(input.localProject).store.clientClock()
      : null;
    const cardId = String(
      mutation.cardPatch?.id
        ?? mutation.card?.id
        ?? mutation.cardId
        ?? mutation.masterTaskId
        ?? '',
    );
    const threadId = String(
      mutation.note?.threadId
        ?? ((mutation.action === 'create-card' || mutation.action === 'create-task-intake')
          && cardId
          ? `thread-${cardId}`
          : ''),
    );
    const annotationId = String(mutation.annotation?.id ?? mutation.region?.id ?? '');
    const relationshipId = String(mutation.relationship?.id ?? '');
    const createdCards = mutation.action === 'create-master-task'
      ? [mutation.card, ...(mutation.cards ?? [])]
        .filter((card): card is AnyRecord => Boolean(card?.id))
      : [];
    const body = {
      ok: true,
      ledgerId,
      revision,
      ...(taskCommit && input.localProject && taskClock
        ? {
          taskClock,
          receipt: {
            mutationId: String(mutation.mutationId ?? ''),
            clock: taskClock,
            entities: taskCommit.localChanges,
          },
          ...(taskCommit.contentGitRevision
            ? { gitRevision: taskCommit.contentGitRevision }
            : {}),
        }
        : {}),
      changedCard: cardId
        ? ledgerCardProjection({
          decisionOsRoot: input.decisionOsRoot,
          ledgerId,
          ledger: persisted,
          cardId,
        })
        : null,
      changedThread: threadId
        ? ledgerThreadProjection({
          decisionOsRoot: input.decisionOsRoot,
          ledgerId,
          ledger: ledgerId === 'tasks' ? persisted : undefined,
          threadId,
        })
        : null,
      changedAnnotation: annotationId && Array.isArray(persisted.annotations)
        ? persisted.annotations.find(
          (entry) => String((entry as AnyRecord).id ?? '') === annotationId,
        ) ?? null
        : null,
      changedRelationship: relationshipId && Array.isArray(persisted.relationships)
        ? persisted.relationships.find(
          (entry) => String((entry as AnyRecord).id ?? '') === relationshipId,
        ) ?? null
        : null,
      createdFiles: createdCards.map((card, index) => ({
        kind: index === 0 ? 'master-task' : 'subtask',
        cardId: String(card.id ?? ''),
        path: resolveCardContentFile(
          input.decisionOsRoot,
          (card.comment as AnyRecord | undefined)?.contentFile,
        ) ?? '',
      })),
      removedCardIds: mutation.action === 'delete-card' && cardId ? [cardId] : [],
      removedZoneIds: mutation.action === 'delete-zones' ? mutation.zoneIds ?? [] : [],
      removedGroupIds: mutation.action === 'delete-zones' ? mutation.groupIds ?? [] : [],
      removedRelationshipIds: mutation.action === 'delete-relationships'
        ? mutation.relationshipIds ?? []
        : [],
    };
    response.setHeader(ledgerRevisionHeader, String(revision));
    response.end(JSON.stringify(body));
  };

  return { persistLedger, persistMutation };
}
