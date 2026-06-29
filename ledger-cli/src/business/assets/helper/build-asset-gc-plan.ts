import type { AssetGcPlan, AssetGcReport } from '../../../lib/types.js';

export function buildAssetGcPlan(report: AssetGcReport): AssetGcPlan {
  const deleteFiles = [
    ...report.orphanAssets.map((asset) => ({
      path: asset.path,
      bytes: asset.bytes,
      category: 'orphan-asset' as const,
      detail: asset.root,
    })),
    ...report.unusedTextFiles.map((file) => ({
      path: file.path,
      bytes: file.bytes,
      category: 'unused-text' as const,
      detail: file.kind,
    })),
  ].sort((left, right) => left.path.localeCompare(right.path));

  return {
    kind: 'decision-os.asset-gc-plan',
    version: 1,
    generatedAt: report.generatedAt,
    root: report.root,
    activeLedgerFiles: report.activeLedgerFiles,
    deleteFiles,
    summary: {
      deleteBytes: deleteFiles.reduce((sum, file) => sum + file.bytes, 0),
      deleteFiles: deleteFiles.length,
      orphanAssets: report.orphanAssets.length,
      unusedTextFiles: report.unusedTextFiles.length,
    },
  };
}
