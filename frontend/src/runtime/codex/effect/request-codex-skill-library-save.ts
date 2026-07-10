/**
 * WHAT: Saves one editable Codex skill's Markdown and default run settings.
 * WHY: The editor needs a typed conflict-aware request without sending filesystem paths.
 */
import type { CodexEffort, CodexModel } from '../helper/codex-run-options.js';
import type { CodexSkillLibraryDetail } from './load-codex-skill-library.js';

export type CodexSkillLibrarySaveRequest = {
  skillName: string;
  markdown: string;
  revision: string;
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
};

export type CodexSkillLibrarySaveResult = {
  ok: boolean;
  statusCode: number;
  conflict: boolean;
  skill?: CodexSkillLibraryDetail;
  currentRevision?: string;
  error?: string;
};

type SkillLibrarySaveResponse = Partial<CodexSkillLibrarySaveResult> & {
  skill?: CodexSkillLibraryDetail;
};

export async function requestCodexSkillLibrarySave(input: CodexSkillLibrarySaveRequest): Promise<CodexSkillLibrarySaveResult> {
  const { skillName, ...payload } = input;
  const response = await fetch(`/api/codex/skill-library/${encodeURIComponent(skillName)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, conflict: false, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as SkillLibrarySaveResponse | null;
  if (!body) return { ok: false, statusCode: response.status, conflict: response.status === 409, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    conflict: response.status === 409,
    skill: body.skill,
    currentRevision: body.currentRevision,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
