import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { AssetReference, AssetReferenceKind } from '../../../lib/types.js';
import { collectAssetSourceFiles } from './collect-asset-source-files.js';
import { extractHardAssetReferences, extractSoftAssetReferences } from './extract-asset-references.js';
import { workspaceRelativePath } from './workspace-paths.js';

type MutableReference = {
  exists: boolean;
  kinds: Set<AssetReferenceKind>;
  sources: Set<string>;
};

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function addReference(
  references: Map<string, MutableReference>,
  input: { kind: AssetReferenceKind; path: string; sourceFile: string; workspaceRoot: string },
): void {
  const entry = references.get(input.path) ?? { exists: false, kinds: new Set<AssetReferenceKind>(), sources: new Set<string>() };
  entry.kinds.add(input.kind);
  entry.sources.add(workspaceRelativePath(input.workspaceRoot, input.sourceFile));
  references.set(input.path, entry);
}

function materializeReferences(references: Map<string, MutableReference>): AssetReference[] {
  return Array.from(references.entries())
    .map(([path, entry]) => ({
      path,
      exists: entry.exists,
      referenceKinds: Array.from(entry.kinds).sort(),
      sources: Array.from(entry.sources).sort(),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function collectAssetReferences(input: { domain?: string; workspaceRoot: string }): Promise<{
  hardReferences: AssetReference[];
  scannedSourceFiles: string[];
  softReferences: AssetReference[];
}> {
  const sourceFiles = await collectAssetSourceFiles(input);
  const hardReferences = new Map<string, MutableReference>();
  const softReferences = new Map<string, MutableReference>();

  for (const sourceFile of sourceFiles) {
    const content = await fs.readFile(sourceFile, 'utf8').catch(() => '');
    for (const reference of extractHardAssetReferences({ content, sourceFile, workspaceRoot: input.workspaceRoot })) {
      addReference(hardReferences, { ...reference, sourceFile, workspaceRoot: input.workspaceRoot });
    }
    for (const reference of extractSoftAssetReferences({ content, sourceFile, workspaceRoot: input.workspaceRoot })) {
      addReference(softReferences, { ...reference, sourceFile, workspaceRoot: input.workspaceRoot });
    }
  }

  for (const [path, entry] of hardReferences) {
    entry.exists = await exists(resolve(input.workspaceRoot, path));
  }
  for (const [path, entry] of softReferences) {
    entry.exists = await exists(resolve(input.workspaceRoot, path));
  }

  return {
    hardReferences: materializeReferences(hardReferences),
    scannedSourceFiles: sourceFiles.map((sourceFile) => workspaceRelativePath(input.workspaceRoot, sourceFile)).sort(),
    softReferences: materializeReferences(softReferences).filter((reference) => !hardReferences.has(reference.path)),
  };
}
