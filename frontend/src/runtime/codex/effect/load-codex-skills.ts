/**
 * WHAT: Loads Codex skill summaries from the backend.
 * WHY: Skill launch and editing need the same server-authoritative identity, defaults, and write boundary.
 */
import type { CodexEffort, CodexModel } from '../helper/codex-run-options.js';

export type CodexSkillSource = 'server' | 'workspace' | 'user' | 'system' | 'plugin';

export type CodexSkillSummary = {
  name: string;
  description: string;
  source: CodexSkillSource;
  editable: boolean;
  readOnlyReason: string | null;
  revision: string;
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
  effectiveCodexModel: string;
  effectiveCodexEffort: string;
};

export type CodexSkillCatalogResult = {
  ok: boolean;
  statusCode: number;
  skills: CodexSkillSummary[];
  error?: string;
};

export async function loadCodexSkillsResult(): Promise<CodexSkillCatalogResult> {
  const response = await fetch('/api/codex/skills').catch(() => undefined);
  if (!response) return { ok: false, statusCode: 0, skills: [], error: 'Request failed.' };
  const body = await response.json().catch(() => null) as { ok?: boolean; skills?: CodexSkillSummary[]; error?: string } | null;
  if (!body) return { ok: false, statusCode: response.status, skills: [], error: 'Invalid response.' };
  const ok = response.ok && body.ok !== false;
  return {
    ok,
    statusCode: response.status,
    skills: Array.isArray(body.skills) ? body.skills : [],
    error: ok ? undefined : String(body.error ?? `Request failed (${response.status}).`),
  };
}

export async function loadCodexSkills(): Promise<CodexSkillSummary[]> {
  return (await loadCodexSkillsResult()).skills;
}
