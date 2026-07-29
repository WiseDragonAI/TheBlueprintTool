/**
 * WHAT: Persists one workspace skill favorite through the path-free skill-library endpoint.
 * WHY: Favorite toggles must not read or rewrite SKILL.md.
 */
import type { CodexSkillLibraryDetail } from './load-codex-skill-library.js';
import { codexSkillAuthoringPath } from '../helper/codex-skill-authoring-path.js';

export type CodexSkillFavoriteSaveResult = {
  ok: boolean;
  statusCode: number;
  skill?: CodexSkillLibraryDetail;
  error?: string;
};

export async function requestCodexSkillMetadataSave(
  skillName: string,
  metadata: { favorite?: boolean; tags?: readonly string[] },
  requestProjectId: string,
): Promise<CodexSkillFavoriteSaveResult> {
  const response = await fetch(codexSkillAuthoringPath(`/${encodeURIComponent(skillName)}`, requestProjectId), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(metadata),
  }).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as { ok?: boolean; skill?: CodexSkillLibraryDetail; error?: string } | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return { ok, statusCode: response.status, skill: body.skill, error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`) };
}

export function requestCodexSkillFavoriteSave(skillName: string, favorite: boolean, requestProjectId: string): Promise<CodexSkillFavoriteSaveResult> {
  return requestCodexSkillMetadataSave(skillName, { favorite }, requestProjectId);
}
