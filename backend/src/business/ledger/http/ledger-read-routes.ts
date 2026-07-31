/**
 * WHAT: Serves scoped ledger, card, thread, navigation, canvas, and search projections.
 * WHY: Ledger read-model hydration belongs to the ledger capability.
 */
import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { createLedgerRevisionTracker } from '../../server/helper/create-ledger-revision-tracker.js';
import type { createFederationContentReplicaStore } from '../../federation/helper/federation-content-replica-store.js';
import { readTaskContentOnDemand } from '../../federation/helper/read-task-content-on-demand.js';
import { resolveCardContentFile } from '../helper/card-content-file.js';
import { parseThreadMarkdown, resolveThreadContentFile } from '../helper/thread-content-file.js';
import {
  ledgerCanvasProjection,
  ledgerCardProjection,
  ledgerNavigationProjection,
  ledgerSearchProjection,
  ledgerThreadProjection,
} from '../../server/helper/ledger-read-models.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;
const ledgerRevisionHeader = 'x-decision-os-ledger-revision';

export async function handleLedgerReadRoutes(input: {
  contentDrain: (() => Promise<void>) | null;
  contentStore: ReturnType<typeof createFederationContentReplicaStore>;
  decisionOsRoot: string;
  localProject: DecisionOsProject | null;
  recordBackgroundFailure: (operation: string, error: unknown, context: AnyRecord) => void;
  request: IncomingMessage;
  response: ServerResponse;
  revisions: ReturnType<typeof createLedgerRevisionTracker>;
  stateForProject: (project: DecisionOsProject) => ProjectTaskState;
  url: string;
}): Promise<HttpRouteOutcome> {
  const ledgerRead = input.url.match(/^\/api\/ledgers\/([^/]+)\/(canvas|navigation|search)$/);
  const cardRead = input.url.match(/^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)$/);
  const threadRead = input.url.match(/^\/api\/ledgers\/([^/]+)\/threads\/([^/]+)$/);
  if (input.request.method !== 'GET' || (!ledgerRead && !cardRead && !threadRead)) {
    return HTTP_ROUTE_NEXT;
  }

  const requestUrl = new URL(input.request.url ?? '/', 'http://127.0.0.1');
  const ledgerId = decodeRouteSegment((ledgerRead ?? cardRead ?? threadRead)?.[1] ?? '');
  const taskLedger = ledgerId === 'tasks' && input.localProject
    ? input.stateForProject(input.localProject).projection().ledger
    : undefined;
  const projection = ledgerRead?.[2] === 'canvas'
    ? ledgerCanvasProjection({ decisionOsRoot: input.decisionOsRoot, ledgerId, ledger: taskLedger })
    : ledgerRead?.[2] === 'navigation'
      ? ledgerNavigationProjection({
        decisionOsRoot: input.decisionOsRoot,
        ledgerId,
        ledger: taskLedger,
      })
      : ledgerRead?.[2] === 'search'
        ? ledgerSearchProjection({
          decisionOsRoot: input.decisionOsRoot,
          ledgerId,
          ledger: taskLedger,
          zoneId: requestUrl.searchParams.get('zoneId') ?? '',
          query: requestUrl.searchParams.get('q') ?? '',
        })
        : cardRead
          ? ledgerCardProjection({
            decisionOsRoot: input.decisionOsRoot,
            ledgerId,
            ledger: taskLedger,
            cardId: decodeRouteSegment(cardRead[2]),
          })
          : ledgerThreadProjection({
            decisionOsRoot: input.decisionOsRoot,
            ledgerId,
            ledger: taskLedger,
            threadId: decodeRouteSegment(threadRead?.[2] ?? ''),
          });

  if (projection && input.localProject && ledgerId === 'tasks' && cardRead) {
    const comment = projection.comment && typeof projection.comment === 'object'
      ? projection.comment as AnyRecord
      : {};
    const key = String(comment.contentFile ?? '');
    const localFile = resolveCardContentFile(input.decisionOsRoot, key);
    if (key && (!localFile || !existsSync(localFile))) {
      const content = await readTaskContentOnDemand({
        projectId: input.localProject.id,
        store: input.stateForProject(input.localProject).store,
        key,
        contentStore: input.contentStore,
        drain: input.contentDrain,
        waitForContent: false,
        recordBackgroundFailure: (error) => input.recordBackgroundFailure(
          'hydrate-card-content-on-demand',
          error,
          { projectId: input.localProject!.id, key },
        ),
      });
      projection.comment = { ...comment, what: content.body };
      projection.state = {
        ...(projection.state as AnyRecord ?? {}),
        content: {
          status: content.available
            ? 'available'
            : content.conflict
              ? 'conflict'
              : 'synchronizing',
          resource: key,
          conflict: content.conflict,
          candidates: content.candidates,
        },
      };
    }
  }

  if (projection && input.localProject && ledgerId === 'tasks' && threadRead) {
    const threadId = decodeRouteSegment(threadRead[2]);
    const refs = taskLedger?.threadFiles && typeof taskLedger.threadFiles === 'object'
      ? taskLedger.threadFiles as AnyRecord
      : {};
    const key = String(refs[threadId] ?? '');
    const localFile = resolveThreadContentFile(input.decisionOsRoot, key);
    if (key && (!localFile || !existsSync(localFile))) {
      const content = await readTaskContentOnDemand({
        projectId: input.localProject.id,
        store: input.stateForProject(input.localProject).store,
        key,
        contentStore: input.contentStore,
        drain: input.contentDrain,
        waitForContent: false,
        recordBackgroundFailure: (error) => input.recordBackgroundFailure(
          'hydrate-thread-content-on-demand',
          error,
          { projectId: input.localProject!.id, key },
        ),
      });
      projection.notes = { [threadId]: content.body ? parseThreadMarkdown(content.body) : [] };
      projection.state = {
        ...(projection.state as AnyRecord ?? {}),
        content: {
          status: content.available
            ? 'available'
            : content.conflict
              ? 'conflict'
              : 'synchronizing',
          resource: key,
          conflict: content.conflict,
          candidates: content.candidates,
        },
      };
    }
  }

  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');
  input.response.setHeader(ledgerRevisionHeader, String(input.revisions.current(ledgerId)));
  if (input.localProject && ledgerId === 'tasks') {
    const clock = input.stateForProject(input.localProject).store.clientClock();
    input.response.setHeader(
      'x-decision-os-task-clock',
      Buffer.from(JSON.stringify(clock)).toString('base64url'),
    );
  }
  input.response.statusCode = projection ? 200 : 404;
  input.response.end(JSON.stringify(
    projection ?? { ok: false, error: 'Scoped ledger resource not found.' },
  ));
  return HTTP_ROUTE_HANDLED;
}
