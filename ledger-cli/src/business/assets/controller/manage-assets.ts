import { resolve } from 'node:path';
import type { AssetGcReport, AssetOperation, Result } from '../../../lib/types.js';
import { applyAssetGcPlan } from '../effect/apply-asset-gc-plan.js';
import { pruneJsonImageSizeReferences } from '../effect/prune-json-image-size-references.js';
import { stageReferencedAssets } from '../effect/stage-referenced-assets.js';
import { writeAssetGcPlan } from '../effect/write-asset-gc-plan.js';
import { buildAssetGcPlan } from '../helper/build-asset-gc-plan.js';
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
  if (operation.action === 'stage-referenced' && !operation.domain) {
    return { ok: false, error: 'assets stage-referenced requires --domain <name>.' };
  }
  if (operation.action === 'apply-gc-plan' && !operation.planFile) {
    return { ok: false, error: 'assets apply-gc-plan requires --plan <file>.' };
  }

  const workspaceRoot = resolve(operation.root ?? process.cwd());
  if (operation.action === 'apply-gc-plan') {
    const applied = await applyAssetGcPlan({
      planFile: operation.planFile ?? '',
      workspaceRoot,
    });
    const output = operation.json
      ? JSON.stringify(applied, null, 2)
      : [
        `Applied asset GC plan ${applied.planFile}`,
        `Deleted files: ${applied.deletedFiles.length}`,
        ...applied.deletedFiles.map((path) => `  ${path}`),
        `Removed empty directories: ${applied.removedDirectories.length}`,
        ...applied.removedDirectories.map((path) => `  ${path}`),
        `Skipped missing files: ${applied.skippedMissingFiles.length}`,
        ...applied.skippedMissingFiles.map((path) => `  ${path}`),
      ].join('\n');
    return { ok: true, value: output };
  }

  const report = await buildAssetGcReport({
    domain: operation.action === 'stage-referenced' ? operation.domain : undefined,
    includeRisky: operation.includeRisky,
    workspaceRoot,
  });

  if (operation.action === 'gc' && operation.writePlanFile) {
    const plan = buildAssetGcPlan(report);
    await writeAssetGcPlan({
      plan,
      planFile: operation.writePlanFile,
      workspaceRoot,
    });
    const output = operation.json
      ? JSON.stringify(plan, null, 2)
      : [
        `Wrote asset GC plan ${operation.writePlanFile}`,
        `Files to delete: ${plan.summary.deleteFiles}`,
        `Bytes to delete: ${plan.summary.deleteBytes}`,
      ].join('\n');
    return { ok: true, value: output };
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
    return { ok: true, value: output };
  }

  return { ok: true, value: commandOutput(operation, report) };
}
