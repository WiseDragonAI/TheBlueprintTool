import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetReference } from '../../../lib/types.js';
import { collectAssetReferences } from '../helper/collect-asset-references.js';
import { collectAssetSourceFiles } from '../helper/collect-asset-source-files.js';
import { isManagedMediaPath } from '../helper/asset-policy.js';
import { normalizeAssetReference, workspaceRelativePath } from '../helper/workspace-paths.js';

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function assetReference(path: string, sourceFile: string, workspaceRoot: string): AssetReference {
  return {
    path,
    exists: false,
    referenceKinds: ['json-key'],
    sources: [workspaceRelativePath(workspaceRoot, sourceFile)],
  };
}

function pruneImageSizes(input: {
  authoritativePaths: Set<string>;
  node: unknown;
  pruned: AssetReference[];
  sourceFile: string;
  workspaceRoot: string;
}): boolean {
  if (!isRecord(input.node) && !Array.isArray(input.node)) return false;
  let changed = false;

  if (Array.isArray(input.node)) {
    for (const entry of input.node) {
      changed = pruneImageSizes({ ...input, node: entry }) || changed;
    }
    return changed;
  }

  for (const [key, value] of Object.entries(input.node)) {
    if (key === 'imageSizes' && isRecord(value)) {
      for (const imageSource of Object.keys(value)) {
        const normalized = normalizeAssetReference({
          rawReference: imageSource,
          sourceFile: input.sourceFile,
          workspaceRoot: input.workspaceRoot,
        });
        if (!normalized || !isManagedMediaPath(normalized) || input.authoritativePaths.has(normalized)) continue;
        delete value[imageSource];
        input.pruned.push(assetReference(normalized, input.sourceFile, input.workspaceRoot));
        changed = true;
      }
      if (Object.keys(value).length === 0) {
        delete input.node[key];
        changed = true;
      }
      continue;
    }
    changed = pruneImageSizes({ ...input, node: value }) || changed;
  }

  return changed;
}

export async function pruneJsonImageSizeReferences(input: { domain?: string; workspaceRoot: string; write: boolean }): Promise<AssetReference[]> {
  const sourceFiles = await collectAssetSourceFiles({ domain: input.domain, workspaceRoot: input.workspaceRoot });
  const references = await collectAssetReferences({ domain: input.domain, workspaceRoot: input.workspaceRoot });
  const authoritativePaths = new Set(references.hardReferences.map((reference) => reference.path));
  const pruned: AssetReference[] = [];

  for (const sourceFile of sourceFiles.filter((file) => file.endsWith('.json'))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
    } catch {
      continue;
    }
    const changed = pruneImageSizes({
      authoritativePaths,
      node: parsed,
      pruned,
      sourceFile,
      workspaceRoot: input.workspaceRoot,
    });
    if (changed && input.write) {
      await fs.writeFile(resolve(sourceFile), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    }
  }

  for (const reference of pruned) {
    reference.exists = await exists(resolve(input.workspaceRoot, reference.path));
  }

  return pruned.sort((left, right) => left.path.localeCompare(right.path));
}
