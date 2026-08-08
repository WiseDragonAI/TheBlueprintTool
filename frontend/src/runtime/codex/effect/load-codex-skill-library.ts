/**
 * WHAT: Loads one server-resolved Codex skill with editable Markdown and run defaults.
 * WHY: Skill editors must address skills by name and keep filesystem resolution on the backend.
 */
import type { CodexSkillSummary } from './load-codex-skills.js';
import type { CodexSkillGitRevision } from './load-codex-skill-revision.js';
import { codexSkillAuthoringPath } from '../helper/codex-skill-authoring-path.js';
import {
  authoredFileRevisionSnapshot,
  type AuthoredFileRevisionSnapshot,
} from '../../content-authoring/helper/authored-file-revision-snapshot.js';

export type CodexSkillLibraryDetail = CodexSkillSummary & {
  markdown: string;
  references: Array<{ name: string; markdown: string }>;
  history: CodexSkillGitRevision[];
  snapshot: AuthoredFileRevisionSnapshot | null;
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

export function decodeCodexSkillLibraryDetail(
  value: CodexSkillLibraryDetail | undefined,
): CodexSkillLibraryDetail | undefined {
  // WHY: A missing detail is a valid failure response and has no diff identity to decode.
  // WHAT: Preserve the missing detail.
  if (!value) return undefined;
  return {
    ...value,
    snapshot: authoredFileRevisionSnapshot(value.snapshot),
  };
}

export async function loadCodexSkillLibrary(skillName: string, requestProjectId: string): Promise<CodexSkillLibraryLoadResult> {
  const path = codexSkillAuthoringPath(`/${encodeURIComponent(skillName)}`, requestProjectId);
  const response = await fetch(path).catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, availableTags: [], error: 'Request failed.' };
  const body = await response.json().catch(() => null) as SkillLibraryResponse | null;
  if (!body) return { ok: false, statusCode: response.status, availableTags: [], error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    skill: decodeCodexSkillLibraryDetail(body.skill),
    availableTags: Array.isArray(body.availableTags) ? body.availableTags : [],
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
