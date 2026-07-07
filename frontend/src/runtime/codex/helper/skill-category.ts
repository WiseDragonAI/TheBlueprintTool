export type SkillCategory =
  | 'Architecture'
  | 'Implementation'
  | 'Interface'
  | 'Writing'
  | 'Marketing'
  | 'Product'
  | 'Research'
  | 'Automation'
  | 'Artifacts'
  | 'Platform'
  | 'Uncategorized';

export const skillCategories = [
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
] as const satisfies readonly SkillCategory[];

const categoryBySkillName: Record<string, SkillCategory> = {
  'accessibility-excellence': 'Interface',
  analysis: 'Architecture',
  'animation-gen': 'Implementation',
  'bloating-analysis': 'Writing',
  'brand-voice': 'Writing',
  browser: 'Automation',
  chrome: 'Automation',
  'color-system': 'Interface',
  'component-architecture': 'Implementation',
  'copy-rhythm': 'Writing',
  copywriting: 'Writing',
  'corpus-data-extraction': 'Research',
  'decision-os-start-doc-server': 'Automation',
  'decision-os-treat-open-notes': 'Automation',
  'design-foundation': 'Interface',
  'direct-response-copy': 'Writing',
  documents: 'Artifacts',
  'error-handling-recovery': 'Interface',
  'executor-implement': 'Implementation',
  'executor-precheck': 'Architecture',
  'executor-spec': 'Architecture',
  'executor-stack': 'Architecture',
  'frontend-design': 'Implementation',
  'frontend-design-2': 'Implementation',
  'frontend-design-ultimate': 'Implementation',
  gpudebug: 'Implementation',
  'hierarchy-of-engagement': 'Product',
  'hooked-model': 'Product',
  'human-context-synthesis': 'Research',
  imagegen: 'Artifacts',
  improveticket: 'Writing',
  'interaction-physics': 'Interface',
  'jobs-to-be-done': 'Product',
  'kit3c-process-register': 'Automation',
  'layout-system': 'Interface',
  'loading-states': 'Interface',
  'marketing-mode': 'Marketing',
  'message-architecture': 'Marketing',
  'offer-testing': 'Marketing',
  'openai-docs': 'Platform',
  openticket: 'Writing',
  'over-engineering-analysis': 'Architecture',
  'page-cro': 'Marketing',
  'plugin-creator': 'Platform',
  'positioning-angles': 'Marketing',
  'positioning-canvas': 'Marketing',
  presentations: 'Artifacts',
  'skill-creator': 'Platform',
  'skill-installer': 'Platform',
  spreadsheets: 'Artifacts',
  'strategic-narrative': 'Marketing',
  'ticket-solver': 'Implementation',
  'typography-system': 'Interface',
  'ui-audit': 'Interface',
  'ui-designer-skill': 'Interface',
  'value-messaging': 'Marketing',
  'visual-hierarchy-refactoring': 'Interface',
  'web-design-guidelines': 'Interface',
};

export function categoryForSkill(skillName: string): SkillCategory {
  return categoryBySkillName[skillName.trim()] ?? 'Uncategorized';
}
