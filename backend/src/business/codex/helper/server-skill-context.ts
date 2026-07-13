/**
 * WHAT: Resolves the exact synchronized server skill selected for one managed-project run.
 * WHY: Codex does not natively scan a catalog-level .skills directory outside a child repository.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { scanCodexSkills } from './scan-codex-skills.js';

type AnyRecord = Record<string, unknown>;

export type ServerSkillContext = { markdown: string; packageRoot: string };

export function runtimeServerRoot(runtime: AnyRecord): string | undefined {
  const value = typeof runtime.serverRoot === 'string' ? runtime.serverRoot.trim() : '';
  return value ? resolve(value) : undefined;
}

export function resolveServerSkillContext(input: {
  decisionOsRoot: string;
  runtime: AnyRecord;
  skillName: string;
}): ServerSkillContext | null {
  const serverRoot = runtimeServerRoot(input.runtime);
  if (!serverRoot) return null;
  const skill = scanCodexSkills({ workspaceRoot: dirname(input.decisionOsRoot), serverRoot })
    .find((candidate) => candidate.name === input.skillName && candidate.source === 'server');
  if (!skill) return null;
  return { markdown: readFileSync(skill.skillFile, 'utf8'), packageRoot: resolve(skill.skillFile, '..') };
}
