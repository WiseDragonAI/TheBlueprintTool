/**
 * WHAT: Generated file write effects for source, tests, telemetry, graph, and report config.
 * WHY: apply mode must commit visible generated artifacts to the worktree.
 */
import { join } from 'node:path';
import type { FileSystemPort, OutputFile, WorktreePlan } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';

export async function writeSourceFile(worktreePath: string, files: OutputFile[], fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await writeOutputFiles(worktreePath, files, fs);
}

export async function writeUnitTestFile(worktreePath: string, files: OutputFile[], fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await writeOutputFiles(worktreePath, files, fs);
}

export async function writeIntegrationTestFile(worktreePath: string, files: OutputFile[], fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await writeOutputFiles(worktreePath, files, fs);
}

export async function writeTelemetryHarness(worktreePath: string, file: OutputFile, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await writeOutputFiles(worktreePath, [file], fs);
}

export async function writeDependencyGraphOutput(worktreePath: string, file: OutputFile, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await writeOutputFiles(worktreePath, [file], fs);
}

export async function writeReportConfig(worktreePath: string, file: OutputFile, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await writeOutputFiles(worktreePath, [file], fs);
}

export async function writePlanFiles(plan: WorktreePlan, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await fs.rm(join(plan.worktreePath, plan.rootBlockPath));
  await writeOutputFiles(plan.worktreePath, plan.supportFiles, fs);
  await writeSourceFile(plan.worktreePath, plan.sourceFiles, fs);
  await writeUnitTestFile(plan.worktreePath, plan.unitTestFiles, fs);
  await writeIntegrationTestFile(plan.worktreePath, plan.integrationTestFiles, fs);
  await writeTelemetryHarness(plan.worktreePath, plan.telemetryHarness, fs);
  await writeDependencyGraphOutput(plan.worktreePath, plan.graphOutput, fs);
  await writeReportConfig(plan.worktreePath, plan.reportConfig, fs);
  await writeOutputFiles(plan.worktreePath, [plan.testResults], fs);
}

async function writeOutputFiles(worktreePath: string, files: OutputFile[], fs: FileSystemPort): Promise<void> {
  for (const file of files) {
    await fs.writeFile(join(worktreePath, file.path), file.content);
  }
}
