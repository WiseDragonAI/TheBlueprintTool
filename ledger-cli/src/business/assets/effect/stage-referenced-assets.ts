import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import type { AssetGcReport } from '../../../lib/types.js';

const execFileAsync = promisify(execFile);

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function gitAdd(workspaceRoot: string, paths: string[]): Promise<void> {
  const chunkSize = 200;
  for (let index = 0; index < paths.length; index += chunkSize) {
    const chunk = paths.slice(index, index + chunkSize);
    if (chunk.length === 0) continue;
    await execFileAsync('git', ['-C', workspaceRoot, 'add', '--', ...chunk]);
  }
}

export async function stageReferencedAssets(input: { domain: string; report: AssetGcReport; workspaceRoot: string }): Promise<string[]> {
  const textPaths = [
    `.blueprinttool/cards/${input.domain}`,
    `.blueprinttool/threads/${input.domain}`,
    `.blueprinttool/${input.domain}.json`,
  ];
  const existingTextPaths: string[] = [];
  for (const path of textPaths) {
    if (await exists(`${input.workspaceRoot}/${path}`)) existingTextPaths.push(path);
  }

  const assetPaths = [
    ...input.report.referencedAssets.map((asset) => asset.path),
    ...input.report.pinnedAssets.map((asset) => asset.path),
  ];
  const paths = Array.from(new Set([...existingTextPaths, ...assetPaths])).sort();
  await gitAdd(input.workspaceRoot, paths);
  return paths;
}
