import type { AssetGcReport, ClassifiedAsset } from '../../../lib/types.js';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function assetLines(assets: ClassifiedAsset[]): string[] {
  return assets.map((asset) => `  ${asset.path} (${formatBytes(asset.bytes)})`);
}

export function formatAssetGcReport(report: AssetGcReport): string {
  const lines = [
    `Asset GC report for ${report.root}`,
    `Scanned source files: ${report.scannedSourceFiles.length}`,
    `Managed roots: ${report.managedRoots.join(', ')}`,
    '',
    `KEEP referenced: ${report.summary.referencedAssets} (${formatBytes(report.summary.referencedBytes)})`,
    ...assetLines(report.referencedAssets),
    '',
    `ORPHAN unreferenced: ${report.summary.orphanAssets} (${formatBytes(report.summary.orphanBytes)})`,
    ...assetLines(report.orphanAssets),
    '',
    `PINNED kept by policy: ${report.summary.pinnedAssets}`,
    ...assetLines(report.pinnedAssets),
  ];

  if (report.missingReferences.length > 0) {
    lines.push(
      '',
      `MISSING references: ${report.missingReferences.length}`,
      ...report.missingReferences.map((reference) => `  ${reference.path} <- ${reference.sources.join(', ')}`),
    );
  }
  if (report.softReferences.length > 0) {
    lines.push(
      '',
      `SOFT references not used for keeping assets: ${report.softReferences.length}`,
      ...report.softReferences.map((reference) => `  ${reference.path} <- ${reference.sources.join(', ')}`),
    );
  }
  if (report.movedAssets && report.movedAssets.length > 0) {
    lines.push(
      '',
      `MOVED orphan assets: ${report.movedAssets.length}`,
      ...report.movedAssets.map((asset) => `  ${asset.from} -> ${asset.to}`),
    );
  }

  return lines.join('\n');
}

export function formatAssetPathList(assets: ClassifiedAsset[]): string {
  return assets.map((asset) => asset.path).join('\n');
}
