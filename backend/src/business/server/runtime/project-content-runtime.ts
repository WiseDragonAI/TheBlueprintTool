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
import { validateExternalThreadMarkdown } from '../../ledger/helper/thread-content-file.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { DecisionOsProject } from '../helper/project-catalog.js';

type AnyRecord = Record<string, unknown>;
type Watcher = ReturnType<typeof watchProjectFiles>;

export type ProjectContentRuntime = {
  clients: Set<ServerResponse>;
  publishCard: (event: CardContentChange | AnyRecord) => void;
  publishLedger: (event: AnyRecord) => void;
  ready: Promise<boolean>;
  revisions: ReturnType<typeof createLedgerRevisionTracker>;
  watcher: Watcher;
};

export function createProjectContentRuntime(input: {
  activeDecisionOsRoot: string;
  globalClients: Set<ServerResponse>;
  invalidateProject: (projectId: string, changes?: readonly { entityType: string; entityId: string }[]) => void;
  pauseWatcher: (projectId: string) => void;
  project: () => DecisionOsProject | null;
  projectId: string;
  publishFederationChange: () => void;
  publishPipelineSnapshot: (projectId: string, pipelineRunId: string, executionId: string) => void;
  recordWatcherIncident: (input: AnyRecord) => { id: string; scope: string };
  refreshProject: (projectId: string) => void;
  serverClosing: () => boolean;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  taskState: () => ProjectTaskState | null;
}): ProjectContentRuntime {
  const clients = new Set<ServerResponse>();
  const revisions = createLedgerRevisionTracker();
  let watcher: Watcher | null = null;
  const broadcast = (message: string): void => {
    for (const client of clients) client.write(message);
    for (const client of input.globalClients) client.write(message);
  };
  const scopedCardEvent = (event: CardContentChange | AnyRecord): AnyRecord | null => {
    const ledgerId = String(event.ledgerId ?? '');
    const hasCompleteScope = Boolean(
      ledgerId && (event.kind !== 'thread-content' || String(event.threadId ?? '')),
    );
    const resolved = hasCompleteScope ? null : resolveCardContentChange({
      decisionOsRoot: input.activeDecisionOsRoot,
      taskProjection: () => input.taskState()?.projection().ledger ?? null,
      change: {
        contentFile: String(event.contentFile ?? ''),
        file: String(event.file ?? resolve(
          input.activeDecisionOsRoot,
          String(event.contentFile ?? '').replace(/^\/?\.decision-os\//, ''),
        )),
        kind: event.kind === 'thread-content' ? 'thread-content' : 'card-content',
      },
    });
    return hasCompleteScope ? event : resolved ? { ...event, ...resolved } : null;
  };
  const broadcastCard = (scoped: AnyRecord): void => {
    const invalidationRevision = revisions.advance(String(scoped.ledgerId ?? ''));
    broadcast(`event: card-content-change\ndata: ${JSON.stringify({
      ...scoped,
      projectId: input.projectId,
      invalidationRevision,
    })}\n\n`);
  };
  const publishCard = (event: CardContentChange | AnyRecord): void => {
    const scoped = scopedCardEvent(event);
    // WHAT: Ignore a committed notification whose exact content owner cannot be resolved.
    // WHY: A guessed ledger event could refresh and federate an unrelated resource.
    if (!scoped) return;
    broadcastCard(scoped);
    // WHAT: Notify federation directly only for non-task authored content.
    // WHY: Task mutations publish their causal resource head through the task-state runtime before this committed event.
    if (String(scoped.ledgerId) !== 'tasks') input.publishFederationChange();
  };
  const observeCardFileChange = async (event: CardContentChange): Promise<void> => {
    const scoped = scopedCardEvent(event);
    // WHAT: Reject an external file observation without one exact registered owner.
    // WHY: Manual Markdown authority must never be inferred from an ambiguous path.
    if (!scoped) throw new Error(`task_content_owner_unresolved:${event.file}`);
    // WHAT: Reuse committed publication directly for non-task ledgers.
    // WHY: Epoch-4 resource heads and task serialization apply only to the Tasks ledger.
    if (String(scoped.ledgerId) !== 'tasks') {
      publishCard(scoped);
      return;
    }
    const project = input.project();
    // WHAT: Stop observation when the owning project cannot accept a local causal contribution.
    // WHY: A success event without available project authority would recreate the original ordering defect.
    if (input.serverClosing() || !project?.available) throw new Error(`task_content_project_unavailable:${input.projectId}`);
    const taskState = input.stateForProject(project);
    const contentFile = String(scoped.contentFile ?? '');
    const receipt = await taskState.recordContentContributionReceipt(
      '',
      contentFile,
      (head, body) => {
        // WHAT: Apply the strict note-identity contract only to externally edited thread Markdown.
        // WHY: Card Markdown is free-form while thread blocks own later identity-scoped mutations.
        if (head.type !== 'thread-markdown') return;
        const validation = validateExternalThreadMarkdown(body);
        // WHAT: Preserve invalid external bytes without advancing their authoritative task-content head.
        // WHY: Canonical hydration would otherwise reinterpret malformed or duplicate note identities.
        if (validation.ok === false) throw new Error(`${validation.error}:${head.key}`);
      },
    );
    // WHAT: Consume an observation whose own serialized contribution committed no entity change.
    // WHY: A concurrent canonical command owns its head transition and event; global head drift cannot attribute that commit to this watcher.
    // WHAT: Consume an observation that committed no resource in its own serialized queue turn.
    // WHY: Global head drift and replication visibility cannot attribute a local commit to this watcher operation.
    if (!receipt.committedResourceIds.includes(contentFile)) return;
    input.invalidateProject(input.projectId, receipt.delta.entities.length > 0
      ? receipt.delta.entities
      : [{ entityType: 'resource', entityId: contentFile }]);
    broadcastCard(scoped);
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
    taskProjection: () => input.taskState()?.projection().ledger ?? null,
    reconcileContentOnStart: (change) => {
      // WHAT: Reconcile startup bytes only for an exactly owned task resource with one retained head.
      // WHY: Headless held resources and causal conflicts must not be activated or resolved by a filesystem scan.
      const taskState = input.taskState();
      // WHAT: Reject non-task resources and unavailable task state before startup reconciliation.
      // WHY: Only the owning active task-state resource may authorize a local content contribution.
      if (change.ledgerId !== 'tasks' || !taskState) return false;
      return taskState.store.contentHeads(change.contentFile).length === 1;
    },
    onContentChange: observeCardFileChange,
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
  return { clients, publishCard, publishLedger, ready: watcher.ready, revisions, watcher };
}
