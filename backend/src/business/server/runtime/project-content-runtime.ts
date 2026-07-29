/**
 * WHAT: Owns one project's file watcher, revisions, and scoped SSE publication.
 * WHY: Content observation and invalidation form one lifecycle that must be disposed together.
 */
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { telemetry } from '@backend/telemetry/harness.js';
import { createLedgerRevisionTracker } from '../helper/create-ledger-revision-tracker.js';
import { resolveCardContentChange, type CardContentChange } from '../../refresh/helper/watch-card-content-files.js';
import { watchProjectFiles } from '../../refresh/helper/watch-project-files.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';

type AnyRecord = Record<string, unknown>;
type Watcher = ReturnType<typeof watchProjectFiles>;

export type ProjectContentRuntime = {
  clients: Set<ServerResponse>;
  publishCard: (event: CardContentChange | AnyRecord) => void;
  publishLedger: (event: AnyRecord) => void;
  revisions: ReturnType<typeof createLedgerRevisionTracker>;
  watcher: Watcher;
};

export function createProjectContentRuntime(input: {
  activeDecisionOsRoot: string;
  activeTaskState: ProjectTaskState | null;
  globalClients: Set<ServerResponse>;
  invalidateProject: (projectId: string, changes?: readonly { entityType: string; entityId: string }[]) => void;
  pauseWatcher: (projectId: string) => void;
  project: () => DecisionOsProject | null;
  projectId: string;
  publishFederationChange: () => void;
  publishPipelineSnapshot: (projectId: string, pipelineRunId: string, executionId: string) => void;
  recordContentFailure: (project: DecisionOsProject, error: unknown) => void;
  recordWatcherIncident: (input: AnyRecord) => { id: string; scope: string };
  refreshProject: (projectId: string) => void;
  serverClosing: () => boolean;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
}): ProjectContentRuntime {
  const clients = new Set<ServerResponse>();
  const revisions = createLedgerRevisionTracker();
  let watcher: Watcher | null = null;
  const broadcast = (message: string): void => {
    for (const client of clients) client.write(message);
    for (const client of input.globalClients) client.write(message);
  };
  const publishCard = (event: CardContentChange | AnyRecord): void => {
    const ledgerId = String(event.ledgerId ?? '');
    const hasCompleteScope = Boolean(
      ledgerId && (event.kind !== 'thread-content' || String(event.threadId ?? '')),
    );
    const resolved = hasCompleteScope ? null : resolveCardContentChange({
      decisionOsRoot: input.activeDecisionOsRoot,
      taskProjection: () => input.activeTaskState?.projection().ledger ?? null,
      change: {
        contentFile: String(event.contentFile ?? ''),
        file: String(event.file ?? resolve(
          input.activeDecisionOsRoot,
          String(event.contentFile ?? '').replace(/^\/?\.decision-os\//, ''),
        )),
        kind: event.kind === 'thread-content' ? 'thread-content' : 'card-content',
      },
    });
    const scoped = hasCompleteScope ? event : resolved ? { ...event, ...resolved } : null;
    if (!scoped) return;
    if (String(scoped.ledgerId) === 'tasks') {
      const threadId = String(scoped.threadId ?? '');
      const taskId = String(scoped.cardId ?? (threadId.startsWith('thread-')
        ? threadId.slice('thread-'.length)
        : ''));
      const project = input.project();
      if (!input.serverClosing() && project?.available && taskId) void Promise.resolve()
        .then(() => input.stateForProject(project).recordContentContribution(
          taskId,
          String(scoped.contentFile ?? ''),
        ))
        .then((delta) => input.invalidateProject(input.projectId, delta.entities))
        .catch((error: unknown) => {
          if (!input.serverClosing()) input.recordContentFailure(project, error);
        });
    }
    const invalidationRevision = revisions.advance(String(scoped.ledgerId));
    broadcast(`event: card-content-change\ndata: ${JSON.stringify({
      ...scoped,
      projectId: input.projectId,
      invalidationRevision,
    })}\n\n`);
    input.publishFederationChange();
  };
  const publishLedger = (event: AnyRecord): void => {
    if (event.kind === 'state') input.refreshProject(input.projectId);
    input.invalidateProject(input.projectId);
    watcher?.refreshOwnership();
    const ledgerId = String(event.ledgerId ?? '');
    const invalidationRevision = ledgerId ? revisions.advance(ledgerId) : 0;
    broadcast(`event: ledger-content-change\ndata: ${JSON.stringify({
      ...event,
      projectId: input.projectId,
      invalidationRevision,
    })}\n\n`);
    input.publishFederationChange();
    const pipelineRunId = String(event.pipelineRunId ?? '');
    if (pipelineRunId) {
      input.publishPipelineSnapshot(
        input.projectId,
        pipelineRunId,
        String(event.executionId ?? ''),
      );
    }
  };
  watcher = watchProjectFiles({
    decisionOsRoot: input.activeDecisionOsRoot,
    taskProjection: () => input.activeTaskState?.projection().ledger ?? null,
    onContentChange: publishCard,
    onProjectChange: publishLedger,
    onError: (error, context) => {
      const incident = input.recordWatcherIncident({
        scope: `project-watcher:${input.projectId}`,
        component: 'project-file-watcher',
        operation: context.operation,
        error,
        context: {
          projectId: input.projectId,
          decisionOsRoot: input.activeDecisionOsRoot,
          file: context.file,
        },
      });
      telemetry('runtime-scope-paused', {
        scope: incident.scope,
        incidentId: incident.id,
        projectId: input.projectId,
      });
      input.pauseWatcher(input.projectId);
      watcher?.close();
    },
  });
  return { clients, publishCard, publishLedger, revisions, watcher };
}
