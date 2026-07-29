/**
 * WHAT: Saves one editable Codex skill's Markdown and default run settings.
 * WHY: The editor needs a typed conflict-aware request without sending filesystem paths.
 */
import type { CodexEffort, CodexModel } from '../helper/codex-run-options.js';
import type { CodexSkillLibraryDetail } from './load-codex-skill-library.js';
import { codexSkillAuthoringPath } from '../helper/codex-skill-authoring-path.js';

export type CodexSkillLibrarySaveRequest = {
  skillName: string;
  markdown: string;
  revision: string;
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
  requestProjectId: string;
};

export type CodexSkillLibrarySaveResult = {
  ok: boolean;
  statusCode: number;
  conflict: boolean;
  skill?: CodexSkillLibraryDetail;
  currentRevision?: string;
  code?: string;
  recovery?: {
    authoredBytesPreserved: boolean;
    gitRevisionCreated: boolean;
    contentRevision: string;
    recoveryToken: string;
    incidentId?: string;
  };
  publication?: { status: string; error?: string };
  error?: string;
};

type SkillLibrarySaveResponse = Partial<CodexSkillLibrarySaveResult> & {
  skill?: CodexSkillLibraryDetail;
};

export async function requestCodexSkillLibrarySave(input: CodexSkillLibrarySaveRequest): Promise<CodexSkillLibrarySaveResult> {
  const { skillName, requestProjectId, ...payload } = input;
  const response = await fetch(codexSkillAuthoringPath(`/${encodeURIComponent(skillName)}`, requestProjectId), {
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
    code: body.code,
    recovery: body.recovery,
    publication: body.publication,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}

export async function requestCodexSkillRevisionRetry(input: {
  skillName: string;
  contentRevision: string;
  recoveryToken: string;
  requestProjectId: string;
}): Promise<CodexSkillLibrarySaveResult> {
  const { skillName, requestProjectId, ...payload } = input;
  const response = await fetch(
    codexSkillAuthoringPath(`/${encodeURIComponent(skillName)}/revisions/retry`, requestProjectId),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
  ).catch(() => undefined);
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
    code: body.code,
    recovery: body.recovery,
    publication: body.publication,
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}
