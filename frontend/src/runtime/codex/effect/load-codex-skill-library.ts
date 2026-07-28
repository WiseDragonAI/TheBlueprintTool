/**
 * WHAT: Loads one server-resolved Codex skill with editable Markdown and run defaults.
 * WHY: Skill editors must address skills by name and keep filesystem resolution on the backend.
 */
import type { CodexSkillSummary } from './load-codex-skills.js';
import type { CodexSkillGitRevision } from './load-codex-skill-revision.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';

export type CodexSkillLibraryDetail = CodexSkillSummary & {
  markdown: string;
  references: Array<{ name: string; markdown: string }>;
  history: CodexSkillGitRevision[];
};

export type CodexSkillLibraryLoadResult = {
  ok: boolean;
  statusCode: number;
  skill?: CodexSkillLibraryDetail;
  availableTags: string[];
  error?: string;
};

type SkillLibraryResponse = Partial<CodexSkillLibraryLoadResult> & {
  skill?: CodexSkillLibraryDetail;
};

export async function loadCodexSkillLibrary(skillName: string, requestProjectId: string): Promise<CodexSkillLibraryLoadResult> {
  const path = projectScopedRequestPath(`/api/codex/skill-library/${encodeURIComponent(skillName)}`, requestProjectId);
  const response = await fetch(path).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, availableTags: [], error: 'Request failed.' };
  const body = await response.json().catch(() => null) as SkillLibraryResponse | null;
  if (!body) return { ok: false, statusCode: response.status, availableTags: [], error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    skill: body.skill,
    availableTags: Array.isArray(body.availableTags) ? body.availableTags : [],
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
