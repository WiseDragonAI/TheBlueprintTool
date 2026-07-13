/**
 * WHAT: Coordinates server skill package validation, ledger projection, synchronization, and commit.
 * WHY: ledger-cli needs one create/update boundary with a complete result and no partial state.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Result, SkillOperation } from '../../../lib/types.js';
import { commitSkillTransaction } from '../effect/commit-skill-transaction.js';
import { projectSkillLedger } from '../helper/project-skill-ledger.js';
import { readOpenAiSkillPackage } from '../helper/read-openai-skill-package.js';

export type SkillSynchronizationResult = {
  commitSha: string;
  ledgerPath: string;
  operation: 'create' | 'update';
  packagePath: string;
  primaryCardId: string;
  referenceCardIds: string[];
  skillName: string;
  zoneId: string;
};

export async function synchronizeServerSkillController(
  operation?: SkillOperation,
  hooks: { afterWrites?: () => void } = {},
): Promise<Result<SkillSynchronizationResult>> {
  try {
    if (!operation?.root || !operation.source) throw new Error('skills create/update requires --root and --source.');
    const root = resolve(operation.root);
    const ledgerFile = resolve(root, '.decision-os', 'skills.json');
    if (!existsSync(ledgerFile)) throw new Error('Server Skills ledger does not exist at .decision-os/skills.json.');
    const skill = readOpenAiSkillPackage(operation.source);
    const destination = resolve(root, '.skills', skill.name);
    if (operation.action === 'create' && existsSync(destination)) throw new Error(`Skill package ${skill.name} already exists in server storage.`);
    if (operation.action === 'update' && !existsSync(destination)) throw new Error(`Skill package ${skill.name} is missing from server storage.`);
    const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8')) as Record<string, any>;
    const priorMappedFiles = (Array.isArray(ledger.cards) ? ledger.cards : [])
      .filter((card: Record<string, any>) => card.skillName === skill.name)
      .flatMap((card: Record<string, any>) => [String(card.comment?.contentFile ?? ''), String(ledger.threadFiles?.[`thread-${card.id}`] ?? '')])
      .filter(Boolean);
    const projection = projectSkillLedger({ ledger, operation: operation.action, skill });
    const commitSha = commitSkillTransaction({ ledgerFile, operation: operation.action, projection, root, skill, priorMappedFiles, afterWrites: hooks.afterWrites });
    return {
      ok: true,
      value: {
        commitSha, operation: operation.action, skillName: skill.name, zoneId: projection.zoneId,
        primaryCardId: projection.primaryCardId, referenceCardIds: projection.referenceCardIds,
        packagePath: `.skills/${skill.name}`, ledgerPath: '.decision-os/skills.json',
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
