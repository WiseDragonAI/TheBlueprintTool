import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetGcReport, AssetReference, ClassifiedAsset } from '../../../lib/types.js';
import { isManagedMediaPath, managedAssetRoots } from './asset-policy.js';
import { collectAssetReferences } from './collect-asset-references.js';
import { collectBlueprinttoolTextState } from './collect-blueprinttool-text-state.js';
import { collectGitIgnoredPaths } from './collect-git-ignored-paths.js';
import { matchesKeepRule, readAssetsKeep } from './read-assets-keep.js';
import { walkFiles } from './walk-files.js';
import { workspaceRelativePath } from './workspace-paths.js';

async function managedAssets(input: { includeRisky: string[]; workspaceRoot: string }): Promise<ClassifiedAsset[]> {
  const roots = managedAssetRoots(input.includeRisky);
  const assets: ClassifiedAsset[] = [];
  for (const root of roots) {
    const files = await walkFiles(resolve(input.workspaceRoot, root), isManagedMediaPath);
    for (const file of files) {
      const stat = await fs.stat(file);
      assets.push({
        path: workspaceRelativePath(input.workspaceRoot, file),
        bytes: stat.size,
        root,
      });
    }
  }
  return assets.sort((left, right) => left.path.localeCompare(right.path));
}

function referenceByPath(references: AssetReference[]): Map<string, AssetReference> {
  return new Map(references.map((reference) => [reference.path, reference]));
}

function summarize(report: Omit<AssetGcReport, 'summary'>): AssetGcReport['summary'] {
  return {
    activeLedgers: report.activeLedgerFiles.length,
    jsonReferences: report.jsonReferences.length,
    managedAssets: report.referencedAssets.length + report.orphanAssets.length + report.pinnedAssets.length,
    missingReferences: report.missingReferences.length,
    orphanAssets: report.orphanAssets.length,
    orphanBytes: report.orphanAssets.reduce((sum, asset) => sum + asset.bytes, 0),
    pinnedAssets: report.pinnedAssets.length,
    prunedJsonReferences: report.prunedJsonReferences?.length,
    referencedAssets: report.referencedAssets.length,
    referencedBytes: report.referencedAssets.reduce((sum, asset) => sum + asset.bytes, 0),
    softReferences: report.softReferences.length,
    staleJsonReferences: report.staleJsonReferences.length,
    unusedTextBytes: report.unusedTextFiles.reduce((sum, file) => sum + file.bytes, 0),
    unusedTextFiles: report.unusedTextFiles.length,
  };
}

export async function buildAssetGcReport(input: { domain?: string; includeRisky?: string[]; workspaceRoot: string }): Promise<AssetGcReport> {
  const includeRisky = input.includeRisky ?? [];
  const roots = managedAssetRoots(includeRisky);
  const textState = await collectBlueprinttoolTextState({ domain: input.domain, workspaceRoot: input.workspaceRoot });
  const references = await collectAssetReferences({ domain: input.domain, workspaceRoot: input.workspaceRoot });
  const hardReferences = referenceByPath(references.hardReferences);
  const keepRules = await readAssetsKeep({ workspaceRoot: input.workspaceRoot });
  const candidateAssets = await managedAssets({ includeRisky, workspaceRoot: input.workspaceRoot });
  const gitIgnoredPaths = await collectGitIgnoredPaths({
    paths: [
      ...candidateAssets.map((asset) => asset.path),
      ...textState.unusedTextFiles.map((file) => file.path),
    ],
    workspaceRoot: input.workspaceRoot,
  });
  const referencedAssets: ClassifiedAsset[] = [];
  const orphanAssets: ClassifiedAsset[] = [];
  const pinnedAssets: ClassifiedAsset[] = [];

  for (const asset of candidateAssets) {
    if (gitIgnoredPaths.has(asset.path)) continue;
    const reference = hardReferences.get(asset.path);
    if (reference) {
      referencedAssets.push({ ...asset, referenceKinds: reference.referenceKinds, sources: reference.sources });
      continue;
    }
    if (matchesKeepRule(asset.path, keepRules)) {
      pinnedAssets.push(asset);
      continue;
    }
    orphanAssets.push(asset);
  }

  const reportWithoutSummary = {
    generatedAt: new Date().toISOString(),
    root: input.workspaceRoot,
    managedRoots: roots,
    scannedSourceFiles: references.scannedSourceFiles,
    activeLedgerFiles: textState.activeLedgerFiles,
    referencedAssets,
    referencedTextFiles: textState.referencedTextFiles,
    orphanAssets,
    unusedTextFiles: textState.unusedTextFiles.filter((file) => !gitIgnoredPaths.has(file.path)),
    pinnedAssets,
    missingReferences: references.hardReferences.filter((reference) => !reference.exists),
    jsonReferences: references.jsonReferences,
    softReferences: references.softReferences,
    staleJsonReferences: references.jsonReferences.filter((reference) => !hardReferences.has(reference.path)),
  };

  return {
    ...reportWithoutSummary,
    summary: summarize(reportWithoutSummary),
  };
}
