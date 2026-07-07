/**
 * WHAT: Loads Codex skill summaries from the backend.
 * WHY: The skill modal needs server-authoritative names and descriptions.
 */
export type CodexSkillSummary = {
  name: string;
  description: string;
  source: string;
};

export async function loadCodexSkills(): Promise<CodexSkillSummary[]> {
  const response = await fetch('/api/codex/skills').catch(() => undefined);
  if (!response?.ok) return [];
  const body = await response.json().catch(() => null) as { skills?: CodexSkillSummary[] } | null;
  return Array.isArray(body?.skills) ? body.skills : [];
}
