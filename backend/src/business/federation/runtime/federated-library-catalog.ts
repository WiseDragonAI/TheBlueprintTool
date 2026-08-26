/**
 * WHAT: Owns the local skill export index and server-authored skill metadata projection.
 * WHY: Catalog invalidation and metadata ownership are independent from peer synchronization retries.
 */
import { createFederatedSkillExportIndex, type FederatedSkillExportIndex } from '../helper/federated-library-cache.js';
import { ensureServerPipelines } from '../../codex/helper/server-pipeline-catalog.js';
import {
  applyCodexSkillMetadataOwner,
  migrateCodexSkillMetadataOwner,
} from '../../codex/helper/codex-skill-metadata-owner.js';
import { readCodexPipelineStore } from '../../codex/helper/codex-pipeline-store.js';
import { availablePipelineContent } from '../../codex/helper/available-pipeline-content.js';
import { ensureMandatoryPipelinePrompts } from '../../codex/helper/mandatory-pipeline-prompts.js';

type AnyRecord = Record<string, unknown>;
type Skill = { name: string; favorite?: boolean; tags?: string[] };

export function createFederatedLibraryCatalog(input: {
  localDecisionOsRoots: () => string[];
  localWorkspaceRoots: () => string[];
  masterDecisionOsRoot: string;
  masterRoot: string;
  preparedCatalog?: { availableSkillNames: string[] };
  runtime: AnyRecord;
}): {
  applyOwnedDetail: (result: AnyRecord) => AnyRecord;
  applyOwnedMetadata: <T extends Skill>(skills: T[]) => T[];
  initialize: () => void;
  invalidate: () => void;
  readIndex: () => Promise<FederatedSkillExportIndex>;
} {
  let availableSkillNames: string[] = [];
  let exportIndex: FederatedSkillExportIndex | null = null;
  let exportIndexPromise: Promise<FederatedSkillExportIndex> | null = null;
  let generation = 0;
  // WHAT: Clone an optional worker-owned startup catalog for one main-thread installation.
  // WHY: Later invalidation must not mutate the structured-clone receipt retained by startup diagnostics.
  let preparedCatalog = input.preparedCatalog
    ? { availableSkillNames: [...input.preparedCatalog.availableSkillNames] }
    : null;
  const invalidate = (): void => {
    generation += 1;
    exportIndex = null;
    exportIndexPromise = null;
  };
  const readIndex = async (): Promise<FederatedSkillExportIndex> => {
    if (exportIndex) return exportIndex;
    if (exportIndexPromise) return await exportIndexPromise;
    const requestedGeneration = generation;
    const pending = createFederatedSkillExportIndex(input.masterRoot, input.localWorkspaceRoots());
    exportIndexPromise = pending;
    try {
      const index = await pending;
      if (requestedGeneration === generation) exportIndex = index;
      return index;
    } finally {
      if (exportIndexPromise === pending) exportIndexPromise = null;
    }
  };
  const initialize = (): void => {
    invalidate();
    // WHAT: Install the one-shot catalog receipt produced by the startup worker.
    // WHY: Main must not repeat prompt validation, skill scans, pipeline writes, or metadata migration.
    if (preparedCatalog) {
      availableSkillNames = preparedCatalog.availableSkillNames;
      preparedCatalog = null;
      return;
    }
    ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: input.masterDecisionOsRoot });
    const available = availablePipelineContent({
      decisionOsRoot: input.masterDecisionOsRoot,
      runtime: input.runtime,
    });
    availableSkillNames = available.names;
    ensureServerPipelines({
      serverDecisionOsRoot: input.masterDecisionOsRoot,
      availableSkillNames,
      availableContentKinds: available.kinds,
    });
    migrateCodexSkillMetadataOwner({
      ownerDecisionOsRoot: input.masterDecisionOsRoot,
      sourceDecisionOsRoots: input.localDecisionOsRoots(),
      availableSkillNames,
    });
  };
  const ownedMetadata = () => new Map(
    readCodexPipelineStore({
      decisionOsRoot: input.masterDecisionOsRoot,
      availableSkillNames,
    }).store.skillLibrary.map((record) => [record.skillName, record]),
  );
  return {
    applyOwnedDetail: (result) => {
      const skill = result.skill;
      return result.ok === true && skill && typeof skill === 'object'
        ? { ...result, skill: applyCodexSkillMetadataOwner(skill as Skill, ownedMetadata()) }
        : result;
    },
    applyOwnedMetadata: (skills) => {
      const metadata = ownedMetadata();
      return skills.map((skill) => applyCodexSkillMetadataOwner(skill, metadata));
    },
    initialize,
    invalidate,
    readIndex,
  };
}
