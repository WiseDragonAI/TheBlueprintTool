/**
 * WHAT: Commits the exact versioned card Markdown owned by one canonical master-task graph.
 * WHY: ID-only CLI callers need an index-safe Git transaction inside the owning project repository.
 */
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { relative } from 'node:path';
import { resolveCardContentFile } from '../../ledger/helper/card-content-file.js';
import {
  AuthoredFileGitError,
  commitAuthoredFileRevision,
  sha256AuthoredBytes,
} from '../../content-authoring/helper/authored-file-git-revisions.js';
import { readRequestBuffer } from '../../server/helper/read-request-buffer.js';
import {
  HTTP_ROUTE_HANDLED,
  HTTP_ROUTE_NEXT,
  type HttpRouteOutcome,
} from '../../server/http/http-route.js';

type AnyRecord = Record<string, unknown>;

function records(value: unknown): AnyRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AnyRecord => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : [];
}

function json(response: ServerResponse, statusCode: number, body: AnyRecord): HttpRouteOutcome {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(body));
  return HTTP_ROUTE_HANDLED;
}

export async function handleTaskContentRoutes(input: {
  decisionOsRoot: string;
  projectId: string;
  request: IncomingMessage;
  response: ServerResponse;
  taskLedger: () => AnyRecord | null;
  url: string;
}): Promise<HttpRouteOutcome> {
  // WHAT: pass every unrelated request to the next project route family.
  // WHY: this handler owns one exact task-content commit operation.
  if (input.url !== '/api/task-content/master-task-commit' || input.request.method !== 'POST') return HTTP_ROUTE_NEXT;
  let body: AnyRecord;
  try {
    body = JSON.parse((await readRequestBuffer(input.request)).toString('utf8') || '{}') as AnyRecord;
  } catch {
    return json(input.response, 400, { ok: false, error: 'invalid_json' });
  }
  const masterCardId = String(body.masterCardId ?? '').trim();
  const ledgerId = String(body.ledgerId ?? '').trim();
  // WHAT: require the canonical Tasks ledger and one master identity.
  // WHY: graph discovery must not commit content from an arbitrary ledger surface.
  if (!masterCardId || ledgerId !== 'tasks') return json(input.response, 400, { ok: false, error: 'master_card_id_and_tasks_ledger_required' });
  const ledger = input.taskLedger();
  // WHAT: reject commit while the task projection is unavailable.
  // WHY: a missing projection cannot prove graph membership.
  if (!ledger) return json(input.response, 503, { ok: false, error: 'task_projection_unavailable' });
  const cards = records(ledger.cards);
  const master = cards.find((card) => String(card.id ?? '') === masterCardId);
  const masterLabels = Array.isArray(master?.labels) ? master.labels.map(String) : [];
  // WHAT: reject a missing or noncanonical master card.
  // WHY: only master-task labels can own a task graph commit.
  if (!master || !masterLabels.includes('master-task')) return json(input.response, 404, { ok: false, error: 'master_task_not_found' });
  const relationships = records(ledger.relationships)
    .filter((relationship) => String(relationship.from ?? '') === masterCardId && String(relationship.label ?? '') === 'subtask')
    .sort((left, right) => Number(left.position) - Number(right.position) || String(left.id ?? '').localeCompare(String(right.id ?? '')));
  const graphCards = [master];
  for (const relationship of relationships) {
    const subtaskId = String(relationship.to ?? '');
    const subtask = cards.find((card) => String(card.id ?? '') === subtaskId);
    // WHAT: reject a graph with a dangling canonical subtask relationship.
    // WHY: a partial file set would not represent the discovered task graph.
    if (!subtask) return json(input.response, 409, { ok: false, error: 'master_task_graph_incomplete', subtaskId });
    graphCards.push(subtask);
  }
  const files: string[] = [];
  for (const card of graphCards) {
    const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
      ? card.comment as AnyRecord
      : {};
    const file = resolveCardContentFile(input.decisionOsRoot, comment.contentFile);
    // WHAT: reject a card without a present canonical Markdown file.
    // WHY: every graph owner must contribute exact bytes to the focused commit.
    if (!file || !existsSync(file)) return json(input.response, 409, { ok: false, error: 'task_markdown_missing', cardId: String(card.id ?? '') });
    files.push(file);
  }
  try {
    const revision = await commitAuthoredFileRevision({
      repositoryRoot: input.decisionOsRoot,
      ownerId: `master-task-graph:${input.projectId}:${masterCardId}`,
      subject: `Commit Decision OS task graph ${masterCardId}`,
      confirmedFiles: files.map((file) => ({ file, contentRevision: sha256AuthoredBytes(readFileSync(file)) })),
      signal: AbortSignal.timeout(30_000),
    });
    return json(input.response, 200, {
      ok: true,
      projectId: input.projectId,
      ledgerId,
      masterCardId,
      commit: revision.commit,
      files: files.map((file) => relative(input.decisionOsRoot, file).split('\\').join('/')),
    });
  } catch (error) {
    // WHAT: expose the stable authored-Git conflict contract to the CLI.
    // WHY: staged paths and pending recovery require a caller-visible nonfatal response.
    if (error instanceof AuthoredFileGitError) {
      return json(input.response, error.statusCode, {
        ok: false,
        error: error.code,
        message: error.message,
        recoveryToken: error.recoveryToken,
        incidentId: error.incidentId,
      });
    }
    return json(input.response, 500, {
      ok: false,
      error: 'master_task_commit_failed',
      message: error instanceof Error ? error.message : 'Master-task commit failed.',
    });
  }
}
