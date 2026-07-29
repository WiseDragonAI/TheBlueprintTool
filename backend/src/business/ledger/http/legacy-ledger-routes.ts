/**
 * WHAT: Preserves the legacy aggregate ledger endpoint behind explicit persistence callbacks.
 * WHY: Compatibility routing must not own task-state persistence or server composition.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { LedgerMutation } from '../helper/apply-ledger-mutation.js';
import { applyLedgerMutation } from '../helper/apply-ledger-mutation.js';
import { createLinkedLedger } from '../helper/create-linked-ledger.js';
import { deleteLinkedLedger } from '../helper/delete-linked-ledger.js';
import { ensureLedgersCanvasDocument } from '../helper/ensure-ledgers-canvas-document.js';
import { readCanonicalDecisionOsState } from '../helper/read-canonical-decision-os-state.js';
import { renameLinkedLedger } from '../helper/rename-linked-ledger.js';
import { hydrateLedgerCardContent } from '../helper/card-content-file.js';
import { hasLedgerProjectionSource } from '../../task-state/helper/read-ledger-projection.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;
const ledgerRevisionHeader = 'x-decision-os-ledger-revision';

export async function handleLegacyLedgerRoutes(input: {
  activeExecutionPhase: (taskId: string) => string;
  advanceRevision: (ledgerId: string) => number;
  currentRevision: (ledgerId: string) => number;
  decisionOsRoot: string;
  materializeTaskMutation: (
    before: AnyRecord,
    mutation: LedgerMutation,
  ) => Promise<{ error: string; key: string; statusCode: number } | null>;
  persistLedger: (
    ledgerId: string,
    ledgerPath: string,
    ledger: AnyRecord,
  ) => Promise<void>;
  persistMutation: (
    ledgerId: string,
    ledgerPath: string,
    before: AnyRecord,
    ledger: AnyRecord,
    mutation: LedgerMutation,
    changedFiles: readonly string[],
  ) => Promise<void>;
  projectColor: string;
  projectId: string;
  projectName: string;
  request: IncomingMessage;
  response: ServerResponse;
  runtime: AnyRecord;
  taskLedger: () => AnyRecord | null;
  url: string;
}): Promise<HttpRouteOutcome> {
  if (input.url === '/decision-os/ledgers' && input.request.method === 'POST') {
    let payload: AnyRecord = {};
    try {
      payload = JSON.parse(
        (await readRequestBuffer(input.request)).toString('utf8') || '{}',
      ) as AnyRecord;
    } catch {
      payload = {};
    }
    const title = String(payload.title || 'New Ledger').trim() || 'New Ledger';
    const created = createLinkedLedger({ decisionOsRoot: input.decisionOsRoot, title });
    input.response.setHeader('content-type', 'application/json');
    input.response.statusCode = 201;
    input.response.end(JSON.stringify(created));
    return HTTP_ROUTE_HANDLED;
  }

  if (!input.url.startsWith('/decision-os/')) return HTTP_ROUTE_NEXT;
  const tabId = input.url.split('/').filter(Boolean)[1] ?? 'state';
  const stateRead = readCanonicalDecisionOsState({
    action_payload: {
      decisionOsFile: resolve(input.decisionOsRoot, 'state.json'),
      writeBack: true,
    },
  });
  const tab = tabId === 'state'
    ? undefined
    : stateRead.ledgers.find((entry) => entry.id === tabId);
  const isLedgersCanvas = tabId === 'ledgers-canvas';
  const ledgerFile = tabId === 'state'
    ? 'state.json'
    : isLedgersCanvas
      ? 'ledgers-canvas.json'
      : String(tab?.ledgerFile ?? '').replace(/^\.decision-os\//, '');
  const ledgerPath = resolve(input.decisionOsRoot, ledgerFile);
  const hasSource = hasLedgerProjectionSource({
    ledgerId: tabId,
    ledgerPath,
    runtime: input.runtime,
  });
  input.response.setHeader('content-type', 'application/json');
  if (!ledgerFile) {
    input.response.statusCode = 404;
    input.response.end(JSON.stringify({ ok: false, missing: tabId }));
    return HTTP_ROUTE_HANDLED;
  }
  if (isLedgersCanvas) ensureLedgersCanvasDocument({ decisionOsRoot: input.decisionOsRoot });

  if (tabId !== 'state' && input.request.method !== 'GET' && hasSource) {
    const body = await readRequestBuffer(input.request);
    const mutation = body.length > 0
      ? JSON.parse(body.toString('utf8')) as LedgerMutation
      : {} as LedgerMutation;
    const taskLedger = input.taskLedger();
    const ledger = (tabId === 'tasks' && taskLedger
      ? structuredClone(taskLedger)
      : JSON.parse(readFileSync(ledgerPath, 'utf8'))) as AnyRecord;
    if (isLedgersCanvas && mutation.action === 'create-card' && mutation.card?.id) {
      createLinkedLedger({
        decisionOsRoot: input.decisionOsRoot,
        title: String(mutation.card.title ?? 'New Ledger'),
        rect: {
          x: Number(mutation.card.x ?? 0),
          y: Number(mutation.card.y ?? 0),
          width: Number(mutation.card.w ?? mutation.card.width ?? 360),
          height: Number(mutation.card.h ?? mutation.card.height ?? 180),
        },
      });
      const overview = ensureLedgersCanvasDocument({ decisionOsRoot: input.decisionOsRoot });
      input.response.setHeader(ledgerRevisionHeader, String(input.advanceRevision(tabId)));
      input.response.end(JSON.stringify(
        hydrateLedgerCardContent(overview.document, input.decisionOsRoot),
      ));
      return HTTP_ROUTE_HANDLED;
    }
    if (isLedgersCanvas
      && mutation.action === 'patch-card'
      && mutation.cardPatch?.id
      && typeof mutation.cardPatch.title === 'string') {
      const renamed = renameLinkedLedger({
        decisionOsRoot: input.decisionOsRoot,
        cardId: mutation.cardPatch.id,
        title: mutation.cardPatch.title,
        overviewDocument: ledger,
      });
      if (renamed.ok === false) {
        input.response.statusCode = 404;
        input.response.end(JSON.stringify({ ok: false, error: renamed.error }));
        return HTTP_ROUTE_HANDLED;
      }
      await input.persistLedger(tabId, ledgerPath, ledger);
      return HTTP_ROUTE_HANDLED;
    }
    if (isLedgersCanvas && mutation.action === 'delete-card' && mutation.cardId) {
      const deleted = deleteLinkedLedger({
        decisionOsRoot: input.decisionOsRoot,
        cardId: String(mutation.cardId),
        overviewDocument: ledger,
      });
      if (deleted.ok === false) {
        input.response.statusCode = 404;
        input.response.end(JSON.stringify({ ok: false, error: deleted.error }));
        return HTTP_ROUTE_HANDLED;
      }
      await input.persistLedger(tabId, ledgerPath, ledger);
      return HTTP_ROUTE_HANDLED;
    }
    const before = structuredClone(ledger);
    if (mutation.action === 'transition-card-lifecycle'
      && mutation.lifecycleStatus === 'backlog'
      && mutation.cardId) {
      const phase = input.activeExecutionPhase(String(mutation.cardId));
      if (phase) {
        input.response.statusCode = 409;
        input.response.end(JSON.stringify({
          ok: false,
          error: 'A queued or running task cannot move to backlog.',
          phase,
        }));
        return HTTP_ROUTE_HANDLED;
      }
    }
    if (tabId === 'tasks') {
      const materialization = await input.materializeTaskMutation(before, mutation);
      if (materialization) {
        input.response.statusCode = materialization.statusCode;
        input.response.end(JSON.stringify({
          ok: false,
          error: materialization.error,
          contentFile: materialization.key,
        }));
        return HTTP_ROUTE_HANDLED;
      }
    }
    const result = applyLedgerMutation({
      decisionOsRoot: input.decisionOsRoot,
      ledgerPath,
      ledger,
      mutation,
    });
    if (result.error) {
      input.response.statusCode = result.error.statusCode;
      input.response.end(JSON.stringify(result.error.body));
      return HTTP_ROUTE_HANDLED;
    }
    await input.persistMutation(
      tabId,
      ledgerPath,
      before,
      ledger,
      mutation,
      result.changedContentFiles,
    );
    return HTTP_ROUTE_HANDLED;
  }

  if (hasSource) {
    const taskLedger = input.taskLedger();
    const ledger = isLedgersCanvas
      ? ensureLedgersCanvasDocument({ decisionOsRoot: input.decisionOsRoot }).document
      : tabId === 'tasks' && taskLedger
        ? structuredClone(taskLedger)
        : JSON.parse(readFileSync(ledgerPath, 'utf8')) as AnyRecord;
    if (tabId !== 'state') {
      input.response.setHeader(ledgerRevisionHeader, String(input.currentRevision(tabId)));
    }
    input.response.end(JSON.stringify(tabId === 'state'
      ? {
        projectId: input.projectId,
        projectName: input.projectName,
        projectColor: input.projectColor,
        ledgers: stateRead.ledgers,
      }
      : hydrateLedgerCardContent(ledger, input.decisionOsRoot)));
  } else {
    input.response.statusCode = 404;
    input.response.end(JSON.stringify({
      ok: false,
      error: 'ledger_source_not_found',
      missing: ledgerPath,
    }));
  }
  return HTTP_ROUTE_HANDLED;
}
