import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { AssetGcPlan } from '../../../lib/types.js';

export async function writeAssetGcPlan(input: { plan: AssetGcPlan; planFile: string; workspaceRoot: string }): Promise<void> {
  const outputFile = resolve(input.workspaceRoot, input.planFile);
  await fs.mkdir(dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(input.plan, null, 2)}\n`, 'utf8');
}
