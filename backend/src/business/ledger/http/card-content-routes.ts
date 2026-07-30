/**
 * WHAT: Adapts card Markdown authoring and Git revision history to HTTP.
 * WHY: Content authoring transport belongs to ledger content, not server composition.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import {
  saveLedgerCardContentController,
  type LedgerCardPatchReceipt,
} from '../controller/save-ledger-card-content-controller.js';
import {
  readLedgerCardRevisionContentController,
  readLedgerCardRevisionHistoryController,
} from '../controller/read-ledger-card-revisions-controller.js';
import { retryLedgerCardRevisionController } from '../controller/retry-ledger-card-revision-controller.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import { decodeRouteSegment } from '../../server/http/route-segment.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;
type AuthoringDocument = { ledger: AnyRecord; ledgerPath: string };

export async function handleCardContentRoutes(input: {
  decisionOsRoot: string;
  loadLedger: (ledgerId: string) => AuthoringDocument | null;
  localProject: DecisionOsProject | null;
  patchCard: (change: {
    cardId: string;
    ledgerId: string;
    markdown: string;
    mutationId: string;
  }) => Promise<LedgerCardPatchReceipt>;
  request: IncomingMessage;
  requestUrl: URL;
  response: ServerResponse;
  serverCloseSignal: AbortSignal;
  url: string;
}): Promise<HttpRouteOutcome> {
  const saveRoute = input.url.match(
    /^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)\/content$/,
  );
  const retryRoute = input.url.match(
    /^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)\/revisions\/retry$/,
  );
  const revisionRoute = input.url.match(
    /^\/api\/ledgers\/([^/]+)\/cards\/([^/]+)\/revisions(?:\/([^/]+))?$/,
  );
  if (!saveRoute && !retryRoute && !revisionRoute) return HTTP_ROUTE_NEXT;

  input.response.setHeader('cache-control', 'no-store');
  input.response.setHeader('content-type', 'application/json');

  if ((saveRoute || retryRoute) && !input.localProject) {
    input.response.statusCode = 403;
    input.response.end(JSON.stringify({
      ok: false,
      code: 'content_read_only',
      error: 'The card is not locally owned.',
    }));
    return HTTP_ROUTE_HANDLED;
  }

  if (saveRoute && input.request.method === 'PUT' && input.localProject) {
    const ledgerId = decodeRouteSegment(saveRoute[1]);
    const cardId = decodeRouteSegment(saveRoute[2]);
    const current = input.loadLedger(ledgerId);
    if (!current) {
      input.response.statusCode = 404;
      input.response.end(JSON.stringify({
        ok: false,
        code: 'card_content_owner_not_found',
        error: 'The ledger was not found.',
      }));
      return HTTP_ROUTE_HANDLED;
    }
    let payload: AnyRecord = {};
    try {
      payload = JSON.parse(
        (await readRequestBuffer(input.request)).toString('utf8') || '{}',
      ) as AnyRecord;
    } catch {
      // The controller returns the stable invalid payload response.
    }
    const result = await saveLedgerCardContentController({
      projectId: input.localProject.id,
      ledgerId,
      cardId,
      decisionOsRoot: input.decisionOsRoot,
      ledger: current.ledger,
      markdown: payload.markdown,
      expectedContentRevision: payload.expectedContentRevision,
      signal: input.serverCloseSignal,
      patchCard: ({ markdown, mutationId }) => input.patchCard({
        cardId,
        ledgerId,
        markdown,
        mutationId,
      }),
      reloadLedger: () => {
        const latest = input.loadLedger(ledgerId);
        if (!latest) throw new Error('The ledger disappeared after the card mutation.');
        return latest.ledger;
      },
    });
    input.response.statusCode = Number(result.statusCode ?? (result.ok === false ? 400 : 200));
    input.response.end(JSON.stringify(result));
    return HTTP_ROUTE_HANDLED;
  }

  if (retryRoute && input.request.method === 'POST' && input.localProject) {
    const ledgerId = decodeRouteSegment(retryRoute[1]);
    const cardId = decodeRouteSegment(retryRoute[2]);
    const current = input.loadLedger(ledgerId);
    let payload: AnyRecord = {};
    try {
      payload = JSON.parse(
        (await readRequestBuffer(input.request)).toString('utf8') || '{}',
      ) as AnyRecord;
    } catch {
      // Retry controller validates the absent token.
    }
    const result = current
      ? await retryLedgerCardRevisionController({
        projectId: input.localProject.id,
        ledgerId,
        cardId,
        decisionOsRoot: input.decisionOsRoot,
        ledger: current.ledger,
        recoveryToken: payload.recoveryToken,
        contentRevision: payload.contentRevision,
        signal: input.serverCloseSignal,
      })
      : {
        ok: false,
        statusCode: 404,
        code: 'card_content_owner_not_found',
        error: 'The ledger was not found.',
      };
    input.response.statusCode = Number(result.statusCode);
    input.response.end(JSON.stringify(result));
    return HTTP_ROUTE_HANDLED;
  }

  if (revisionRoute && input.request.method === 'GET') {
    const ledgerId = decodeRouteSegment(revisionRoute[1]);
    const cardId = decodeRouteSegment(revisionRoute[2]);
    const commit = revisionRoute[3] ? decodeRouteSegment(revisionRoute[3]) : '';
    const current = input.loadLedger(ledgerId);
    const result = !current
      ? {
        ok: false,
        statusCode: 404,
        code: 'card_content_owner_not_found',
        error: 'The ledger was not found.',
      }
      : commit
        ? await readLedgerCardRevisionContentController({
          decisionOsRoot: input.decisionOsRoot,
          ledger: current.ledger,
          cardId,
          commit,
          signal: input.serverCloseSignal,
        })
        : await readLedgerCardRevisionHistoryController({
          decisionOsRoot: input.decisionOsRoot,
          ledger: current.ledger,
          cardId,
          cursor: input.requestUrl.searchParams.get('cursor'),
          limit: Number(input.requestUrl.searchParams.get('limit') ?? '') || 50,
          signal: input.serverCloseSignal,
        });
    input.response.statusCode = Number(result.statusCode);
    input.response.end(JSON.stringify(result));
    return HTTP_ROUTE_HANDLED;
  }

  return HTTP_ROUTE_NEXT;
}
