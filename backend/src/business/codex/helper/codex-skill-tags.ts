/**
 * WHAT: Defines the complete server-owned tag vocabulary for Codex skills.
 * WHY: Skill metadata must not create categories outside the library's fixed taxonomy.
 */
export const codexSkillTags = [
  'Architecture',
  'Implementation',
  'Interface',
  'Writing',
  'Marketing',
  'Product',
  'Research',
  'Automation',
  'Artifacts',
  'Platform',
] as const;

const allowedCodexSkillTags = new Set<string>(codexSkillTags);

export function normalizeCodexSkillTags(value: unknown, limit = 1): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = [...new Set(value.map((tag) => typeof tag === 'string' ? tag.trim() : '').filter(Boolean))];
  if (tags.length > limit || tags.some((tag) => !allowedCodexSkillTags.has(tag))) return undefined;
  return tags;
}
