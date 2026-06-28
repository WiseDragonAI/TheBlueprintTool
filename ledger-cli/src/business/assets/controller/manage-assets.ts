import { resolve } from 'node:path';
import type { AssetGcReport, AssetOperation, Result } from '../../../lib/types.js';
import { moveOrphanAssets } from '../effect/move-orphan-assets.js';
import { pruneJsonImageSizeReferences } from '../effect/prune-json-image-size-references.js';
import { stageReferencedAssets } from '../effect/stage-referenced-assets.js';
import { writeAssetManifest } from '../effect/write-asset-manifest.js';
import { buildAssetGcReport } from '../helper/build-asset-gc-report.js';
import { formatAssetGcReport, formatAssetPathList } from '../helper/format-asset-gc-report.js';

function commandOutput(operation: AssetOperation, report: AssetGcReport): string {
  if (operation.json) return JSON.stringify(report, null, 2);
  if (operation.action === 'list-referenced') return formatAssetPathList(report.referencedAssets);
  if (operation.action === 'list-orphans') return formatAssetPathList(report.orphanAssets);
  return formatAssetGcReport(report);
}

export async function manageAssetsController(operation: AssetOperation | undefined): Promise<Result<string>> {
  if (!operation) return { ok: false, error: 'Assets command requires an action.' };
  if (operation.delete) return { ok: false, error: 'Asset hard-delete is not supported yet. Use --move-to first and inspect the trash manifest.' };
  if (operation.action === 'stage-referenced' && !operation.domain) {
    return { ok: false, error: 'assets stage-referenced requires --domain <name>.' };
  }

  const workspaceRoot = resolve(operation.root ?? process.cwd());
  const report = await buildAssetGcReport({
    domain: operation.action === 'stage-referenced' ? operation.domain : undefined,
    includeRisky: operation.includeRisky,
    workspaceRoot,
  });

  if (operation.action === 'gc' && operation.moveTo) {
    report.movedAssets = await moveOrphanAssets({
      assets: report.orphanAssets,
      moveTo: operation.moveTo,
      workspaceRoot,
    });
  }

  if (operation.action === 'prune-json') {
    report.prunedJsonReferences = await pruneJsonImageSizeReferences({
      domain: operation.domain,
      workspaceRoot,
      write: operation.write,
    });
    report.summary.prunedJsonReferences = report.prunedJsonReferences.length;
  }

  if (operation.action === 'stage-referenced') {
    const stagedPaths = await stageReferencedAssets({
      domain: operation.domain ?? '',
      report,
      workspaceRoot,
    });
    const output = operation.json
      ? JSON.stringify({ ...report, stagedPaths }, null, 2)
      : [`Staged referenced BlueprintTool assets for domain ${operation.domain}.`, ...stagedPaths.map((path) => `  ${path}`)].join('\n');
    if (operation.manifestFile) {
      await writeAssetManifest({ manifestFile: operation.manifestFile, report, workspaceRoot });
    }
    return { ok: true, value: output };
  }

  if (operation.manifestFile) {
    await writeAssetManifest({ manifestFile: operation.manifestFile, report, workspaceRoot });
  }

  return { ok: true, value: commandOutput(operation, report) };
}
