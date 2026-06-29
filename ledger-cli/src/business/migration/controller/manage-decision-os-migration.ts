import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { DecisionOsMigrationReport, MigrationOperation, Result } from '../../../lib/types.js';

const execFileAsync = promisify(execFile);

const oldNamespacePattern = /CoreV2|corev2|COREV2|Blueprinttool|BlueprintTool|Blueprint Tool|blueprinttool|blueprint-tool|blueprint_tool|\.blueprinttool|BLUEPRINTTOOL/g;

const replacements: Array<{ from: string; to: string }> = [
  { from: 'corev2FrontendRoot', to: 'decisionOsFrontendRoot' },
  { from: 'COREV2_', to: 'DECISION_OS_' },
  { from: 'COREV2', to: 'DECISION_OS' },
  { from: 'BLUEPRINTTOOL_ROOT', to: 'DECISION_OS_ROOT' },
  { from: 'CoreV2', to: 'decision-os' },
  { from: 'corev2:note', to: 'decision-os:note' },
  { from: 'corev2.asset-gc-plan', to: 'decision-os.asset-gc-plan' },
  { from: 'corev2', to: 'decision-os' },
  { from: 'BlueprintTool', to: 'decision-os' },
  { from: 'Blueprinttool', to: 'decision-os' },
  { from: 'Blueprint Tool', to: 'decision-os' },
  { from: 'blueprint-tool', to: 'decision-os' },
  { from: 'blueprint_tool', to: 'decision_os' },
  { from: 'blueprinttool', to: 'decision-os' },
  { from: '.blueprinttool', to: '.decision-os' },
];

function relativePath(root: string, path: string): string {
  return relative(root, path).split('\\').join('/');
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root: string, skipStorageRoots: boolean, workspaceRoot = root): Promise<string[]> {
  if (!await exists(root)) return [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      if (skipStorageRoots && (entry.name === '.blueprinttool' || entry.name === '.decision-os')) continue;
      files.push(...await walkFiles(path, skipStorageRoots, workspaceRoot));
      continue;
    }
    if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => relativePath(workspaceRoot, left).localeCompare(relativePath(workspaceRoot, right)));
}

function rewriteText(text: string, counts: Record<string, number>): { changed: boolean; text: string } {
  let next = text;
  for (const replacement of replacements) {
    const count = next.split(replacement.from).length - 1;
    if (count > 0) {
      counts[replacement.from] = (counts[replacement.from] ?? 0) + count;
      next = next.split(replacement.from).join(replacement.to);
    }
  }
  return { changed: next !== text, text: next };
}

function isBinary(buffer: Buffer): boolean {
  return buffer.includes(0);
}

async function rewriteStorageFiles(input: { dryRun: boolean; report: DecisionOsMigrationReport; storageRoot: string; workspaceRoot: string }): Promise<void> {
  const files = await walkFiles(input.storageRoot, false, input.workspaceRoot);
  for (const file of files) {
    const buffer = await fs.readFile(file);
    const rel = relativePath(input.workspaceRoot, file);
    if (isBinary(buffer)) {
      input.report.skippedBinaryFiles.push(rel);
      continue;
    }
    const rewritten = rewriteText(buffer.toString('utf8'), input.report.replacements);
    if (!rewritten.changed) continue;
    input.report.changedFiles.push(rel);
    if (!input.dryRun) await fs.writeFile(file, rewritten.text, 'utf8');
  }
}

async function collectManualFollowUps(workspaceRoot: string): Promise<string[]> {
  const files = await walkFiles(workspaceRoot, true, workspaceRoot);
  const matches: string[] = [];
  for (const file of files) {
    const buffer = await fs.readFile(file);
    if (isBinary(buffer)) continue;
    if (oldNamespacePattern.test(buffer.toString('utf8'))) matches.push(relativePath(workspaceRoot, file));
    oldNamespacePattern.lastIndex = 0;
  }
  return matches;
}

async function hasDirtyTrackedFiles(workspaceRoot: string): Promise<boolean> {
  try {
    const result = await execFileAsync('git', ['-C', workspaceRoot, 'status', '--porcelain', '--untracked-files=no']);
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function manageDecisionOsMigrationController(operation: MigrationOperation | undefined): Promise<Result<DecisionOsMigrationReport>> {
  const write = operation?.write === true;
  const dryRun = operation?.dryRun !== false || !write;
  const workspaceRoot = resolve(operation?.root ?? process.cwd());
  const legacyRoot = resolve(workspaceRoot, '.blueprinttool');
  const decisionOsRoot = resolve(workspaceRoot, '.decision-os');
  const hasLegacyRoot = await exists(legacyRoot);
  const hasDecisionOsRoot = await exists(decisionOsRoot);

  if (hasLegacyRoot && hasDecisionOsRoot) return { ok: false, error: 'Refusing to migrate a mixed workspace with both .blueprinttool and .decision-os.' };
  if (!hasLegacyRoot && !hasDecisionOsRoot) return { ok: false, error: 'No .blueprinttool or .decision-os directory found.' };
  if (write && !operation?.allowDirty && await hasDirtyTrackedFiles(workspaceRoot)) {
    return { ok: false, error: 'Refusing to migrate with dirty tracked files. Commit first or pass --allow-dirty.' };
  }

  const report: DecisionOsMigrationReport = {
    changedFiles: [],
    dryRun,
    manualFollowUpFiles: await collectManualFollowUps(workspaceRoot),
    movedDirectories: hasLegacyRoot ? [{ from: '.blueprinttool', to: '.decision-os' }] : [],
    replacements: {},
    root: workspaceRoot,
    skippedBinaryFiles: [],
    write,
  };

  const storageRoot = hasLegacyRoot ? legacyRoot : decisionOsRoot;
  if (write && hasLegacyRoot) await fs.rename(legacyRoot, decisionOsRoot);
  await rewriteStorageFiles({ dryRun, report, storageRoot: write && hasLegacyRoot ? decisionOsRoot : storageRoot, workspaceRoot });
  report.changedFiles = Array.from(new Set(report.changedFiles)).sort();
  report.manualFollowUpFiles = Array.from(new Set(report.manualFollowUpFiles)).sort();
  report.skippedBinaryFiles = Array.from(new Set(report.skippedBinaryFiles)).sort();
  return { ok: true, value: report };
}
