/**
 * WHAT: Reads, saves, and retries one identity-addressed card Markdown owner.
 * WHY: The browser must never send a filesystem path for card authoring.
 */
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import {
  authoredFileRevisionSnapshot,
  type AuthoredFileRevisionSnapshot,
} from '../helper/authored-file-revision-snapshot.js';

export type LedgerCardContentDetail = Record<string, unknown> & {
  id: string;
  contentRevision: string;
};

export type LedgerCardContentSaveResult = {
  ok: boolean;
  statusCode: number;
  card?: LedgerCardContentDetail;
  contentRevision?: string;
  currentRevision?: string;
  snapshot?: AuthoredFileRevisionSnapshot;
  code?: string;
  recovery?: {
    authoredBytesPreserved: boolean;
    gitRevisionCreated: boolean;
    contentRevision: string;
    recoveryToken: string;
    incidentId?: string;
  };
  error?: string;
};

async function responseResult(response: Response | undefined): Promise<LedgerCardContentSaveResult> {
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  const recovery = body.recovery && typeof body.recovery === 'object'
    ? body.recovery as LedgerCardContentSaveResult['recovery']
    : body.recoveryToken
      ? {
          authoredBytesPreserved: body.authoredBytesPreserved === true,
          gitRevisionCreated: body.gitRevisionCreated === true,
          contentRevision: String(body.contentRevision ?? ''),
          recoveryToken: String(body.recoveryToken),
          incidentId: typeof body.incidentId === 'string' ? body.incidentId : undefined,
        }
      : undefined;
  return {
    ok,
    statusCode: response.status,
    card: body.card as LedgerCardContentDetail | undefined,
    contentRevision: typeof body.contentRevision === 'string' ? body.contentRevision : undefined,
    currentRevision: typeof body.currentRevision === 'string' ? body.currentRevision : undefined,
    snapshot: authoredFileRevisionSnapshot(body.snapshot) ?? undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
    recovery,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}

function cardContentPath(projectId: string, ledgerId: string, cardId: string): string {
  return projectScopedRequestPath(
    `/api/ledgers/${encodeURIComponent(ledgerId)}/cards/${encodeURIComponent(cardId)}/content`,
    projectId,
  );
}

export async function loadLedgerCardContent(projectId: string, ledgerId: string, cardId: string): Promise<LedgerCardContentSaveResult> {
  const response = await fetch(
    projectScopedRequestPath(`/api/ledgers/${encodeURIComponent(ledgerId)}/cards/${encodeURIComponent(cardId)}`, projectId),
    { cache: 'no-store' },
  ).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  if (!response.ok) return {
    ok: false,
    statusCode: response.status,
    code: typeof body.code === 'string' ? body.code : undefined,
    error: String(body.error ?? `Request failed (${response.status}).`),
  };
  const loaded = (body.card && typeof body.card === 'object' ? body.card : body) as LedgerCardContentDetail;
  return { ok: true, statusCode: response.status, card: loaded, contentRevision: String(loaded.contentRevision ?? '') };
}

export async function requestLedgerCardContentSave(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  markdown: string;
  expectedContentRevision: string;
}): Promise<LedgerCardContentSaveResult> {
  const response = await fetch(cardContentPath(input.projectId, input.ledgerId, input.cardId), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      markdown: input.markdown,
      expectedContentRevision: input.expectedContentRevision,
    }),
  }).catch(() => undefined);
  return responseResult(response);
}

export async function requestLedgerCardRevisionRetry(input: {
  projectId: string;
  ledgerId: string;
  cardId: string;
  contentRevision: string;
  recoveryToken: string;
}): Promise<LedgerCardContentSaveResult> {
  const response = await fetch(projectScopedRequestPath(
    `/api/ledgers/${encodeURIComponent(input.ledgerId)}/cards/${encodeURIComponent(input.cardId)}/revisions/retry`,
    input.projectId,
  ), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentRevision: input.contentRevision,
      recoveryToken: input.recoveryToken,
    }),
  }).catch(() => undefined);
  return responseResult(response);
}
