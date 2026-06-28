import type { ClassifiedAsset } from '../../../lib/types.js';
import { moveWorkspaceFiles } from './move-workspace-files.js';

export async function moveOrphanAssets(input: { assets: ClassifiedAsset[]; moveTo: string; workspaceRoot: string }): Promise<Array<{ from: string; to: string }>> {
  return moveWorkspaceFiles({ files: input.assets, moveTo: input.moveTo, workspaceRoot: input.workspaceRoot });
}
