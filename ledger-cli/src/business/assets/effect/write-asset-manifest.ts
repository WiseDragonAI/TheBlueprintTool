import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { AssetGcReport } from '../../../lib/types.js';
import { isInsideWorkspace } from '../helper/workspace-paths.js';

export async function writeAssetManifest(input: { manifestFile: string; report: AssetGcReport; workspaceRoot: string }): Promise<void> {
  const outputFile = resolve(input.workspaceRoot, input.manifestFile);
  if (!isInsideWorkspace(input.workspaceRoot, outputFile)) {
    throw new Error(`Refusing to write manifest outside workspace: ${input.manifestFile}`);
  }
  await fs.mkdir(dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(input.report, null, 2)}\n`, 'utf8');
}
