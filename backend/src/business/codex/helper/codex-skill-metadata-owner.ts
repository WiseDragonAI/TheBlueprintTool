/**
 * WHAT: Owns server-wide favorite and tag metadata while leaving run defaults project-scoped.
 * WHY: Skills Library and Process Card must hydrate the same user metadata after reload.
 */
import type { CodexSkillLibraryRecord } from '../../../../../shared/schemas/codex-pipeline-types.js';
import {
  assertCodexPipelineStoreAvailable,
  mutateCodexPipelineStore,
  readCodexPipelineStore,
} from './codex-pipeline-store.js';

type SkillWithMetadata = { name: string; favorite?: boolean; tags?: string[] };

function newer(left: CodexSkillLibraryRecord | undefined, right: CodexSkillLibraryRecord): CodexSkillLibraryRecord {
  if (!left) return right;
  return right.updatedAt.localeCompare(left.updatedAt) > 0 ? right : left;
}

export function migrateCodexSkillMetadataOwner(input: {
  ownerDecisionOsRoot: string;
  sourceDecisionOsRoots: readonly string[];
  availableSkillNames: readonly string[];
}): boolean {
  const owner = readCodexPipelineStore({
    decisionOsRoot: input.ownerDecisionOsRoot,
    availableSkillNames: input.availableSkillNames,
  });
  assertCodexPipelineStoreAvailable(owner);
  const ownerByName = new Map(owner.store.skillLibrary.map((record) => [record.skillName, record]));
  const selected = new Map(owner.store.skillLibrary.map((record) => [record.skillName, record]));
  for (const decisionOsRoot of input.sourceDecisionOsRoots) {
    if (decisionOsRoot === input.ownerDecisionOsRoot) continue;
    const source = readCodexPipelineStore({ decisionOsRoot, availableSkillNames: input.availableSkillNames });
    assertCodexPipelineStoreAvailable(source);
    for (const record of source.store.skillLibrary) selected.set(record.skillName, newer(selected.get(record.skillName), record));
  }
  const skillLibrary = [...selected.values()]
    .map((record) => ({
      skillName: record.skillName,
      favorite: record.favorite,
      tags: [...record.tags],
      defaultCodexModel: ownerByName.get(record.skillName)?.defaultCodexModel ?? null,
      defaultCodexEffort: ownerByName.get(record.skillName)?.defaultCodexEffort ?? null,
      updatedAt: record.updatedAt,
    }))
    .sort((left, right) => left.skillName.localeCompare(right.skillName));
  if (JSON.stringify(skillLibrary) === JSON.stringify([...owner.store.skillLibrary].sort((left, right) => left.skillName.localeCompare(right.skillName)))) return false;
  let changed = false;
  mutateCodexPipelineStore({
    decisionOsRoot: input.ownerDecisionOsRoot,
    availableSkillNames: input.availableSkillNames,
    mutate: (store) => {
      const currentByName = new Map(store.skillLibrary.map((record) => [record.skillName, record]));
      const merged = new Map(store.skillLibrary.map((record) => [record.skillName, record]));
      for (const record of selected.values()) merged.set(record.skillName, newer(merged.get(record.skillName), record));
      const next = [...merged.values()].map((record) => ({
        skillName: record.skillName,
        favorite: record.favorite,
        tags: [...record.tags],
        defaultCodexModel: currentByName.get(record.skillName)?.defaultCodexModel ?? null,
        defaultCodexEffort: currentByName.get(record.skillName)?.defaultCodexEffort ?? null,
        updatedAt: record.updatedAt,
      })).sort((left, right) => left.skillName.localeCompare(right.skillName));
      changed = JSON.stringify(next) !== JSON.stringify([...store.skillLibrary].sort((left, right) => left.skillName.localeCompare(right.skillName)));
      return changed ? { ...store, skillLibrary: next } : store;
    },
  });
  return changed;
}

export function applyCodexSkillMetadataOwner<T extends SkillWithMetadata>(
  skill: T,
  metadata: ReadonlyMap<string, Pick<CodexSkillLibraryRecord, 'favorite' | 'tags'>>,
): T {
  const owned = metadata.get(skill.name);
  return owned ? { ...skill, favorite: owned.favorite, tags: [...owned.tags] } : skill;
}
