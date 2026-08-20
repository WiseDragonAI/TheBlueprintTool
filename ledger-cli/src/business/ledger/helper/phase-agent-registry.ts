/**
 * WHAT: Declares every subagent role that the software-iteration controller may dispatch.
 * WHY: the main agent must select a known bounded role instead of inventing prompts, models, or context discovery.
 */
export type PhaseAgentDefinition = {
  effort: 'low' | 'medium';
  model: 'gpt-5.6-sol' | 'gpt-5.6-terra';
  promptName: string;
  requiredCardTitles: string[];
  title: string;
};

export const phaseAgentRegistry = {
  'operator-intent': { title: 'Operator Intent', promptName: 'OperatorIntent-Agent', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: [] },
  'git-preparation': { title: 'Git Preparation', promptName: 'SoftwareIteration-GitPreparation', model: 'gpt-5.6-terra', effort: 'medium', requiredCardTitles: ['Operator Intent'] },
  'testing-procedure': { title: 'Testing Procedure', promptName: 'SoftwareIteration-TestingProcedure', model: 'gpt-5.6-terra', effort: 'medium', requiredCardTitles: ['Operator Intent', 'Git Preparation'] },
  awareness: { title: 'Awareness', promptName: 'SoftwareIteration-Awareness', model: 'gpt-5.6-terra', effort: 'medium', requiredCardTitles: ['Operator Intent', 'Git Preparation'] },
  deltas: { title: 'Implementation: Deltas', promptName: 'SoftwareIteration-Deltas', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Operator Intent', 'Awareness'] },
  planification: { title: 'Implementation: Plan', promptName: 'SoftwareIteration-Planification', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Operator Intent', 'Git Preparation', 'Testing Procedure', 'Awareness'] },
  'scope-perfection': { title: 'Implementation Review: Scope Perfection', promptName: 'ScopePerfectionAnalysis', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Operator Intent', 'Implementation: Deltas', 'Implementation: Plan'] },
  'over-engineering': { title: 'Implementation Review: Over-Engineering', promptName: 'OverEngineering-Gate', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Implementation: Plan'] },
  weakness: { title: 'Implementation Review: Weakness', promptName: 'WeaknessAnalysis', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Implementation: Plan'] },
  pseudocode: { title: 'Pseudo-Code', promptName: 'SoftwareIteration-PseudoCode', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Implementation: Plan'] },
  'code-quality': { title: 'Implementation Review: Code Quality', promptName: 'CodeQuality-Gate', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Implementation: Plan', 'Pseudo-Code'] },
  coding: { title: 'Coding', promptName: 'SoftwareIteration-Coding', model: 'gpt-5.6-terra', effort: 'medium', requiredCardTitles: ['Git Preparation', 'Awareness', 'Implementation: Plan', 'Pseudo-Code'] },
  verification: { title: 'Verification', promptName: 'SoftwareIteration-Verify', model: 'gpt-5.6-terra', effort: 'medium', requiredCardTitles: ['Operator Intent', 'Git Preparation', 'Testing Procedure', 'Awareness', 'Implementation: Plan', 'Pseudo-Code', 'Coding'] },
  rca: { title: 'Root Cause Analysis', promptName: 'RCA', model: 'gpt-5.6-sol', effort: 'low', requiredCardTitles: ['Verification'] },
} as const satisfies Record<string, PhaseAgentDefinition>;

export type PhaseAgentName = keyof typeof phaseAgentRegistry;

export function phaseAgentNames(): string[] {
  return Object.keys(phaseAgentRegistry);
}
