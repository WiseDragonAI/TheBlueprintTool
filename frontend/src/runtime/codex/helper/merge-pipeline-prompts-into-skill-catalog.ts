/**
 * WHAT: Composes the skill-library catalog with pipeline-only prompt records.
 * WHY: Every skill-library surface must expose the same selectable authored content kinds.
 */
export type SkillCatalogRecord = {
  name: string;
  contentKind?: string;
};

export function mergePipelinePromptsIntoSkillCatalog<T extends SkillCatalogRecord>(
  skills: readonly T[],
  pipelineContent: readonly T[],
): T[] {
  const merged = new Map(skills.map((skill) => [skill.name, skill]));
  for (const content of pipelineContent) {
    if (content.contentKind === 'pipeline-prompt' && !merged.has(content.name)) merged.set(content.name, content);
  }
  return [...merged.values()];
}
