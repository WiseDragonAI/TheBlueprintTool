import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { AppliedAssetGcPlan, AssetGcPlan } from '../../../lib/types.js';
import { isInsideWorkspace, resolveWorkspacePath, workspaceRelativePath } from '../helper/workspace-paths.js';

function isPlan(value: unknown): value is AssetGcPlan {
  return Boolean(
    value
      && typeof value === 'object'
      && 'kind' in value
      && value.kind === 'corev2.asset-gc-plan'
      && 'version' in value
      && value.version === 1
      && 'deleteFiles' in value
      && Array.isArray(value.deleteFiles),
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function removeEmptyAncestors(input: { filePath: string; stopRoot: string; workspaceRoot: string }): Promise<string[]> {
  const removed: string[] = [];
  let current = dirname(input.filePath);
  while (isInsideWorkspace(input.stopRoot, current)) {
    try {
      await fs.rmdir(current);
      removed.push(workspaceRelativePath(input.workspaceRoot, current));
      current = dirname(current);
    } catch {
      break;
    }
  }
  return removed;
}

async function readPlan(input: { planFile: string; workspaceRoot: string }): Promise<AssetGcPlan> {
  const resolvedPlanFile = resolve(input.workspaceRoot, input.planFile);
  const parsed: unknown = JSON.parse(await fs.readFile(resolvedPlanFile, 'utf8'));
  if (!isPlan(parsed)) throw new Error(`Invalid asset GC plan: ${input.planFile}`);
  if (resolve(parsed.root) !== input.workspaceRoot) {
    throw new Error(`Refusing to apply GC plan for ${parsed.root} to ${input.workspaceRoot}`);
  }
  return parsed;
}

export async function applyAssetGcPlan(input: { planFile: string; workspaceRoot: string }): Promise<AppliedAssetGcPlan> {
  const plan = await readPlan(input);
  const blueprinttoolRoot = resolve(input.workspaceRoot, '.blueprinttool');
  const deletedFiles: string[] = [];
  const removedDirectories = new Set<string>();
  const skippedMissingFiles: string[] = [];

  for (const file of plan.deleteFiles) {
    const resolved = resolveWorkspacePath(input.workspaceRoot, file.path);
    if (!resolved || !isInsideWorkspace(blueprinttoolRoot, resolved)) {
      throw new Error(`Refusing to delete file outside .blueprinttool: ${file.path}`);
    }
    if (!await exists(resolved)) {
      skippedMissingFiles.push(file.path);
      continue;
    }
    const stat = await fs.lstat(resolved);
    if (!stat.isFile()) throw new Error(`Refusing to delete non-file path from GC plan: ${file.path}`);
    await fs.rm(resolved);
    deletedFiles.push(file.path);
    for (const directory of await removeEmptyAncestors({ filePath: resolved, stopRoot: blueprinttoolRoot, workspaceRoot: input.workspaceRoot })) {
      removedDirectories.add(directory);
    }
  }

  return {
    planFile: input.planFile,
    root: input.workspaceRoot,
    deletedFiles,
    removedDirectories: Array.from(removedDirectories).sort(),
    skippedMissingFiles,
  };
}
