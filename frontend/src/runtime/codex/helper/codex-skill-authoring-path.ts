/**
 * WHAT: Selects the server-owned or project-owned endpoint for one existing authored skill.
 * WHY: Federated skills have no project owner while workspace skills must retain their project boundary.
 */
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';

export type CodexAuthoredContentOwner = {
  contentKind?: string;
  source?: string;
};

export function codexSkillAuthoringProjectId(
  content: CodexAuthoredContentOwner,
  activeProjectId: string,
): string {
  return content.contentKind === 'workspace-skill' || content.source === 'workspace'
    ? activeProjectId
    : '';
}

export function codexSkillAuthoringPath(suffix: string, requestProjectId: string): string {
  const base = requestProjectId ? '/api/codex/skill-library' : '/api/codex/server-skills';
  return projectScopedRequestPath(`${base}${suffix}`, requestProjectId);
}
