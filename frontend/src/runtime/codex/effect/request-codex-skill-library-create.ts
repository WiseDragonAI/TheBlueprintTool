/**
 * WHAT: Creates one server-owned skill-library record without accepting a filesystem path.
 * WHY: Authors choose execution visibility while the backend owns storage and Git revision creation.
 */
import type { CodexSkillLibraryDetail } from './load-codex-skill-library.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';

export type CodexSkillContentKind = 'federated-skill' | 'workspace-skill' | 'pipeline-prompt';

export async function requestCodexSkillLibraryCreate(input: {
  name: string;
  description: string;
  instructions: string;
  contentKind: CodexSkillContentKind;
  requestProjectId: string;
}): Promise<{ ok: boolean; statusCode: number; skill?: CodexSkillLibraryDetail; error?: string }> {
  const { requestProjectId, ...payload } = input;
  const ownerProjectId = payload.contentKind === 'workspace-skill' ? requestProjectId : '';
  const response = await fetch(projectScopedRequestPath('/api/codex/skill-library', ownerProjectId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as { ok?: boolean; skill?: CodexSkillLibraryDetail; error?: string } | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return { ok, statusCode: response.status, skill: body.skill, error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`) };
}
