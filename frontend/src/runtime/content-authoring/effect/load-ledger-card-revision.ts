/**
 * WHAT: Loads path-free cursor history and immutable content for one card.
 * WHY: Historical reads share the card identity boundary used by writes.
 */
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import type {
  AuthoredFileRevisionDetail,
  AuthoredFileRevisionSummary,
} from '../component/render-authored-file-revision.js';
import {
  authoredFileRevisionSnapshot,
  type AuthoredFileRevisionSnapshot,
} from '../helper/authored-file-revision-snapshot.js';

function base(projectId: string, ledgerId: string, cardId: string): string {
  return projectScopedRequestPath(
    `/api/ledgers/${encodeURIComponent(ledgerId)}/cards/${encodeURIComponent(cardId)}/revisions`,
    projectId,
  );
}

export async function loadLedgerCardRevisionHistory(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  cursor?: string | null;
}): Promise<{ ok: boolean; revisions: AuthoredFileRevisionSummary[]; nextCursor: string | null; error?: string }> {
  const query = new URLSearchParams({ limit: '50' });
  if (input.cursor) query.set('cursor', input.cursor);
  const response = await fetch(`${base(input.projectId, input.ledgerId, input.cardId)}?${query}`).catch(() => undefined);
  if (!response) return { ok: false, revisions: [], nextCursor: null, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as {
    ok?: boolean;
    history?: { revisions?: AuthoredFileRevisionSummary[]; nextCursor?: string | null };
    error?: string;
  } | null;
  const ok = Boolean(response.ok && body?.ok !== false);
  return {
    ok,
    revisions: Array.isArray(body?.history?.revisions) ? body.history.revisions : [],
    nextCursor: typeof body?.history?.nextCursor === 'string' ? body.history.nextCursor : null,
    error: ok ? undefined : String(body?.error ?? `Request failed (${response.status}).`),
  };
}

export async function loadLedgerCardRevision(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  commit: string;
}): Promise<{ ok: boolean; revision?: AuthoredFileRevisionDetail; error?: string }> {
  const response = await fetch(`${base(input.projectId, input.ledgerId, input.cardId)}/${encodeURIComponent(input.commit)}`).catch(() => undefined);
  if (!response) return { ok: false, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as {
    ok?: boolean;
    revision?: AuthoredFileRevisionDetail;
    error?: string;
  } | null;
  const ok = Boolean(response.ok && body?.ok !== false);
  return {
    ok,
    revision: body?.revision,
    error: ok ? undefined : String(body?.error ?? `Request failed (${response.status}).`),
  };
}

export async function loadCurrentLedgerCardRevision(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
}): Promise<{ ok: boolean; snapshot?: AuthoredFileRevisionSnapshot; error?: string }> {
  const response = await fetch(`${base(input.projectId, input.ledgerId, input.cardId)}/current`, { cache: 'no-store' })
    .catch(() => undefined);
  if (!response) return { ok: false, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as {
    ok?: boolean;
    revision?: unknown;
    error?: string;
  } | null;
  const snapshot = authoredFileRevisionSnapshot(body?.revision);
  const ok = Boolean(response.ok && body?.ok !== false && snapshot);
  return {
    ok,
    ...(snapshot ? { snapshot } : {}),
    error: ok ? undefined : String(body?.error ?? 'The current authored-file snapshot is invalid.'),
  };
}
