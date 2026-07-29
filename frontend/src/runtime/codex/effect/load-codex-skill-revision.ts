/**
 * WHAT: Loads one immutable Git revision selected from a skill detail history.
 * WHY: Revision navigation must address only server-authorized skill identity and commit identity.
 */
import { codexSkillAuthoringPath } from '../helper/codex-skill-authoring-path.js';
export type CodexSkillGitRevision = {
  commit: string;
  authoredAt: string;
  subject: string;
  authorName?: string;
  authorEmail?: string;
};

export type CodexSkillGitRevisionDetail = CodexSkillGitRevision & {
  markdown: string;
  patch: string;
  parentCommit: string | null;
};

export async function loadCodexSkillRevisionHistory(
  skillName: string,
  input: { requestProjectId: string; cursor?: string | null; limit?: number },
): Promise<{
  ok: boolean;
  statusCode: number;
  history: CodexSkillGitRevision[];
  nextCursor: string | null;
  error?: string;
}> {
  const query = new URLSearchParams();
  if (input.cursor) query.set('cursor', input.cursor);
  query.set('limit', String(input.limit ?? 50));
  const path = codexSkillAuthoringPath(`/${encodeURIComponent(skillName)}/revisions?${query}`, input.requestProjectId);
  const response = await fetch(path).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, history: [], nextCursor: null, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as {
    ok?: boolean;
    history?: CodexSkillGitRevision[];
    nextCursor?: string | null;
    error?: string;
  } | null;
  if (!body) return { ok: false, statusCode: response.status, history: [], nextCursor: null, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    history: Array.isArray(body.history) ? body.history : [],
    nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}

export async function loadCodexSkillRevision(skillName: string, commit: string, requestProjectId: string): Promise<{
  ok: boolean;
  statusCode: number;
  revision?: CodexSkillGitRevisionDetail;
  error?: string;
}> {
  const path = codexSkillAuthoringPath(`/${encodeURIComponent(skillName)}/revisions/${encodeURIComponent(commit)}`, requestProjectId);
  const response = await fetch(path).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as { ok?: boolean; revision?: CodexSkillGitRevisionDetail; error?: string } | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return { ok, statusCode: response.status, revision: body.revision, error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`) };
}
