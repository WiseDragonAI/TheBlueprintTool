/**
 * WHAT: Loads one server-resolved Codex skill with editable Markdown and run defaults.
 * WHY: Skill editors must address skills by name and keep filesystem resolution on the backend.
 */
import type { CodexSkillSummary } from './load-codex-skills.js';

export type CodexSkillLibraryDetail = CodexSkillSummary & {
  markdown: string;
};

export type CodexSkillLibraryLoadResult = {
  ok: boolean;
  statusCode: number;
  skill?: CodexSkillLibraryDetail;
  error?: string;
};

type SkillLibraryResponse = Partial<CodexSkillLibraryLoadResult> & {
  skill?: CodexSkillLibraryDetail;
};

export async function loadCodexSkillLibrary(skillName: string): Promise<CodexSkillLibraryLoadResult> {
  const response = await fetch(`/api/codex/skill-library/${encodeURIComponent(skillName)}`).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, error: 'Request failed.' };
  const body = await response.json().catch(() => null) as SkillLibraryResponse | null;
  if (!body) return { ok: false, statusCode: response.status, error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    skill: body.skill,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
