import { basename, resolve } from 'node:path';
import { promises as fs } from 'node:fs';
import { collectBlueprinttoolTextState } from './collect-blueprinttool-text-state.js';
import { walkFiles } from './walk-files.js';

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function durableCatalogFiles(blueprinttoolRoot: string): Promise<string[]> {
  const uiResearchRoot = resolve(blueprinttoolRoot, 'ui-research');
  const shaderCatalogs = await walkFiles(resolve(uiResearchRoot, 'shadered-runs'), (path) => /catalog.*\.json$/i.test(basename(path)));
  const pipelineCatalog = resolve(uiResearchRoot, 'ui-pipeline-catalog.json');
  const pipelineCatalogs = await exists(pipelineCatalog) ? [pipelineCatalog] : [];
  return [
    ...pipelineCatalogs,
    ...shaderCatalogs,
  ];
}

export async function collectAssetSourceFiles(input: { domain?: string; workspaceRoot: string }): Promise<string[]> {
  const blueprinttoolRoot = resolve(input.workspaceRoot, '.blueprinttool');
  const textState = await collectBlueprinttoolTextState(input);

  if (input.domain) {
    const catalogFiles = input.domain === 'ui-research' ? await durableCatalogFiles(blueprinttoolRoot) : [];
    return Array.from(new Set([
      ...textState.sourceFiles,
      ...catalogFiles,
    ])).sort();
  }

  return Array.from(new Set([
    ...textState.sourceFiles,
    ...await durableCatalogFiles(blueprinttoolRoot),
  ])).sort();
}
