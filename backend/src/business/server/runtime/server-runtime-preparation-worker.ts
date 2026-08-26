/**
 * WHAT: Performs one server-wide filesystem and pipeline admission outside the HTTP event loop.
 * WHY: Per-project Git checks and skill scans must not make a bound listener unresponsive.
 */
import { parentPort } from 'node:worker_threads';
import { availablePipelineContent } from '../../codex/helper/available-pipeline-content.js';
import { ensureLedgerCliShim } from '../../codex/helper/decision-os-codex-runtime.js';
import { ensureMandatoryPipelinePrompts } from '../../codex/helper/mandatory-pipeline-prompts.js';
import { migrateCodexSkillMetadataOwner } from '../../codex/helper/codex-skill-metadata-owner.js';
import { ensureServerPipelines, migrateLegacyProjectPipelines } from '../../codex/helper/server-pipeline-catalog.js';
import { ensureDecisionOsGitRepository } from '../helper/ensure-decision-os-git-repository.js';
import { createProjectCatalogStore } from '../helper/project-catalog-store.js';

type PreparationRequest = {
  ledgerLauncher: string;
  masterDecisionOsRoot: string;
  masterRoot: string;
  nodeExecutable: string;
  pausedBackgroundComponents: string[];
  webpageLauncher: string;
};

type PreparationFailure = {
  component: string;
  operation: string;
  error: string;
  stack: string;
};

// WHAT: Reject execution without the worker-owned message channel.
// WHY: This module has no safe standalone mutation contract.
if (!parentPort) throw new Error('server_runtime_preparation_worker_channel_missing');

parentPort.once('message', (request: PreparationRequest) => {
  void (async () => {
    const catalog = createProjectCatalogStore({
      masterDecisionOsRoot: request.masterDecisionOsRoot,
      masterRoot: request.masterRoot,
    });
    const projects = catalog.projects();
    const pausedBackgroundComponents = new Set(request.pausedBackgroundComponents);
    const localDecisionOsRoots = [
      request.masterDecisionOsRoot,
      ...projects
        .filter((project) => project.available)
        .map((project) => project.decisionOsRoot),
    ];
    const authoredRoots = [...new Set(localDecisionOsRoots)].sort();
    // WHAT: Admit every distinct authored repository once in deterministic path order.
    // WHY: Later main-thread construction trusts this receipt and skips all Git subprocess repetition.
    for (const decisionOsRoot of authoredRoots) ensureDecisionOsGitRepository(decisionOsRoot);
    const ledgerCliShimDirectory = ensureLedgerCliShim({
      masterDecisionOsRoot: request.masterDecisionOsRoot,
      launcher: request.ledgerLauncher,
      nodeExecutable: request.nodeExecutable,
      webpageLauncher: request.webpageLauncher,
    });

    const failures: PreparationFailure[] = [];
    const recordFailure = (component: string, operation: string, error: unknown): void => {
      // WHAT: Serialize either the exact Error evidence or a stable string representation.
      // WHY: Structured worker messages cannot transfer arbitrary thrown values safely.
      failures.push({
        component,
        operation,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? (error.stack ?? '') : '',
      });
    };
    let pipelineCatalogReady = !pausedBackgroundComponents.has('pipeline-catalog');
    // WHAT: Prepare mandatory prompts only while no retained catalog incident owns the scope.
    // WHY: Worker relocation must preserve the existing durable pause before any authored write.
    if (pipelineCatalogReady) {
      try {
        ensureMandatoryPipelinePrompts({ serverDecisionOsRoot: request.masterDecisionOsRoot });
      } catch (error) {
        pipelineCatalogReady = false;
        recordFailure('pipeline-catalog', 'initialize-mandatory-pipeline-prompts', error);
      }
    }
    // WHAT: Run legacy migration only while no retained migration incident owns the scope.
    // WHY: Moving work off-thread cannot reopen a durably paused mutation boundary.
    if (!pausedBackgroundComponents.has('pipeline-migration')) {
      try {
        migrateLegacyProjectPipelines({
          serverDecisionOsRoot: request.masterDecisionOsRoot,
          projectDecisionOsRoots: projects
            .filter((project) => project.available)
            .map((project) => project.decisionOsRoot),
        });
      } catch (error) {
        recordFailure('pipeline-migration', 'migrate-legacy-project-pipelines', error);
      }
    }
    let availableSkillNames: string[] = [];
    // WHAT: Continue pipeline catalog preparation only while mandatory prompt admission remains valid.
    // WHY: A contained prompt failure must stop later writes in the same owning scope.
    if (pipelineCatalogReady) {
      try {
        const available = availablePipelineContent({
          decisionOsRoot: request.masterDecisionOsRoot,
          runtime: { serverRoot: request.masterRoot },
        });
        availableSkillNames = available.names;
        ensureServerPipelines({
          serverDecisionOsRoot: request.masterDecisionOsRoot,
          availableSkillNames,
          availableContentKinds: available.kinds,
        });
        migrateCodexSkillMetadataOwner({
          ownerDecisionOsRoot: request.masterDecisionOsRoot,
          sourceDecisionOsRoots: authoredRoots,
          availableSkillNames,
        });
      } catch (error) {
        recordFailure('pipeline-catalog', 'initialize-pipeline-catalog', error);
      }
    }
    parentPort!.postMessage({
      ok: true,
      receipt: {
        version: 1,
        availableSkillNames,
        failures,
        ledgerCliShimDirectory,
        projectCount: projects.length,
        projects,
        repositoryCount: authoredRoots.length,
      },
    });
  })().catch((error: unknown) => {
    parentPort!.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack ?? '') : '',
    });
  });
});
