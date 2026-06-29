import { basename, resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { collectDecisionOsTextState } from './collect-decision-os-text-state.js';
import { walkFiles } from './walk-files.js';

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function durableCatalogFiles(decisionOsRoot: string): Promise<string[]> {
  const uiResearchRoot = resolve(decisionOsRoot, 'ui-research');
  const shaderCatalogs = await walkFiles(resolve(uiResearchRoot, 'shadered-runs'), (path) => /catalog.*\.json$/i.test(basename(path)));
  const pipelineCatalog = resolve(uiResearchRoot, 'ui-pipeline-catalog.json');
  const pipelineCatalogs = await exists(pipelineCatalog) ? [pipelineCatalog] : [];
  return [
    ...pipelineCatalogs,
    ...shaderCatalogs,
  ];
}

export async function collectAssetSourceFiles(input: { domain?: string; workspaceRoot: string }): Promise<string[]> {
  const decisionOsRoot = resolve(input.workspaceRoot, '.decision-os');
  const textState = await collectDecisionOsTextState(input);

  if (input.domain) {
    const catalogFiles = input.domain === 'ui-research' ? await durableCatalogFiles(decisionOsRoot) : [];
    return Array.from(new Set([
      ...textState.sourceFiles,
      ...catalogFiles,
    ])).sort();
  }

  return Array.from(new Set([
    ...textState.sourceFiles,
    ...await durableCatalogFiles(decisionOsRoot),
  ])).sort();
}
