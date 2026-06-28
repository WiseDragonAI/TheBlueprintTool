import { promises as fs } from 'node:fs';
import { basename, resolve } from 'node:path';
import { walkFiles } from './walk-files.js';

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function topLevelJsonFiles(blueprinttoolRoot: string): Promise<string[]> {
  if (!await exists(blueprinttoolRoot)) return [];
  const entries = await fs.readdir(blueprinttoolRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('.'))
    .map((entry) => resolve(blueprinttoolRoot, entry.name));
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
  const cardRoot = resolve(blueprinttoolRoot, 'cards', input.domain ?? '');
  const threadRoot = resolve(blueprinttoolRoot, 'threads', input.domain ?? '');
  const markdownFiles = [
    ...await walkFiles(cardRoot, (path) => path.endsWith('.md')),
    ...await walkFiles(threadRoot, (path) => path.endsWith('.md')),
  ];

  if (input.domain) {
    const ledgerFile = resolve(blueprinttoolRoot, `${input.domain}.json`);
    const ledgerFiles = await exists(ledgerFile) ? [ledgerFile] : [];
    const catalogFiles = input.domain === 'ui-research' ? await durableCatalogFiles(blueprinttoolRoot) : [];
    return Array.from(new Set([
      ...markdownFiles,
      ...ledgerFiles,
      ...catalogFiles,
    ])).sort();
  }

  return Array.from(new Set([
    ...markdownFiles,
    ...await topLevelJsonFiles(blueprinttoolRoot),
    ...await durableCatalogFiles(blueprinttoolRoot),
  ])).sort();
}
