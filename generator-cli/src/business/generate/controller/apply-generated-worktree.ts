/**
 * WHAT: generated worktree apply controller.
 * WHY: apply mode materializes source, tests, telemetry harness, graph, report configuration, and run results.
 */
import { join, resolve } from 'node:path';
import type { FileSystemPort, OutputFile, ProcessPort, Result, WorktreePlan } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { nodeProcess } from '../../../lib/node-test/node-process.js';
import { stringifyJson } from '../../../lib/json/json.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { buildTestStateContracts } from '../helper/build-test-state-contracts.js';
import { injectTelemetryCalls } from '../helper/inject-telemetry-calls.js';
import { checkMasterLedgerController } from '../../report/controller/check-master-ledger.js';
import { analyzeGeneratedSuiteTelemetry } from '../../report/helper/analyze-generated-suite-telemetry.js';
import { planGeneratedWorktreeController } from './plan-generated-worktree.js';
import { createGitWorktree } from '../effect/create-git-worktree.js';
import { writeSourceFile } from '../effect/write-source-file.js';
import { writeUnitTestFile } from '../effect/write-unit-test-file.js';
import { writeIntegrationTestFile } from '../effect/write-integration-test-file.js';
import { writeTelemetryHarness } from '../effect/write-telemetry-harness.js';
import { writeDependencyGraphOutput } from '../effect/write-dependency-graph-output.js';

async function writeOutputFiles(worktreePath: string, files: OutputFile[], fs: FileSystemPort): Promise<void> {
  for (const file of files) {
    await fs.writeFile(join(worktreePath, file.path), file.content);
  }
}

export async function applyGeneratedWorktreeController(
  input: {
    masterLedgerFile: string;
    specsLedgerFile: string;
    output: string;
  },
  ports: { fs?: FileSystemPort; process?: ProcessPort; cwd?: string } = {},
): Promise<Result<WorktreePlan>> {
  const fs = ports.fs ?? nodeFileSystem;
  const processPort = ports.process ?? nodeProcess;
  const rootDir = ports.cwd ?? process.cwd();
  const checked = await checkMasterLedgerController({
    masterLedgerFile: input.masterLedgerFile,
    specsLedgerFile: input.specsLedgerFile,
  }, fs);

  // WHY: generation must stop before writing when the MasterLedger and SpecsLedger do not match.
  // WHAT: return the checker failure or its blocking report.
  if (!checked.ok) {
    return checked;
  }

  if (!checked.value.ok) {
    return { ok: false, error: stringifyJson(checked.value) };
  }

  const planned = await planGeneratedWorktreeController({ mode: 'apply', masterLedgerFile: input.masterLedgerFile, specsLedgerFile: input.specsLedgerFile, output: input.output }, fs);

  // WHY: apply cannot continue without a valid generation plan.
  // WHAT: return the planning failure.
  if (!planned.ok) {
    return planned;
  }

  const worktree = await createGitWorktree(planned.value.worktreePath, ports);
  telemetry('create-git-worktree', worktree);

  // WHY: generated files must be written inside a real git worktree.
  // WHAT: stop when worktree creation fails.
  if (!worktree.ok) {
    return { ok: false, error: worktree.error };
  }

  buildTestStateContracts(planned.value.functions);
  telemetry('build-test-state-contracts');
  const injected = injectTelemetryCalls(planned.value.sourceFiles);
  telemetry('inject-telemetry-calls');

  // WHY: generated source files without telemetry cannot prove execution.
  // WHAT: stop before writing invalid generated files.
  if (!injected.ok) {
    return injected;
  }

  await fs.rm(join(planned.value.worktreePath, planned.value.rootBlockPath));
  await writeOutputFiles(planned.value.worktreePath, planned.value.supportFiles, fs);
  await writeSourceFile(planned.value.worktreePath, planned.value.sourceFiles, fs);
  await writeUnitTestFile(planned.value.worktreePath, planned.value.unitTestFiles, fs);
  await writeIntegrationTestFile(planned.value.worktreePath, planned.value.integrationTestFiles, fs);
  await writeTelemetryHarness(planned.value.worktreePath, planned.value.telemetryHarness, fs);
  await writeDependencyGraphOutput(planned.value.worktreePath, planned.value.graphOutput, fs);
  await writeOutputFiles(planned.value.worktreePath, [planned.value.reportConfig, planned.value.testResults], fs);
  telemetry('write-source-file', { count: planned.value.sourceFiles.length });
  telemetry('write-unit-test-file', { count: planned.value.unitTestFiles.length });
  telemetry('write-integration-test-file', { count: planned.value.integrationTestFiles.length });
  telemetry('write-telemetry-harness');
  telemetry('write-dependency-graph-output');

  const generatedRoot = join(planned.value.worktreePath, planned.value.rootBlockPath);
  const tscBinary = resolve(rootDir, 'generator-cli/node_modules/.bin/tsc');
  const typeRoots = resolve(rootDir, 'generator-cli/node_modules/@types');
  const importCheckCommand = `"${tscBinary}" -p "${planned.value.rootBlockPath}/tsconfig.json" --noEmit --typeRoots "${typeRoots}"`;
  const importCheck = await processPort.exec(importCheckCommand, planned.value.worktreePath);
  const integrationFiles = planned.value.integrationTestFiles.map((file) => `"${file.path.replace(`${planned.value.rootBlockPath}/`, '')}"`).join(' ');
  const tsxLoader = resolve(rootDir, 'generator-cli/node_modules/tsx/dist/esm/index.mjs');
  const testCommand = `node --test --import "${tsxLoader}" ${integrationFiles}`;
  const testRun = importCheck.exitCode === 0
    ? await processPort.exec(testCommand, generatedRoot)
    : { exitCode: 1, stdout: '', stderr: 'Skipped because generated import check failed.' };
  const suiteTelemetryAnalysis = analyzeGeneratedSuiteTelemetry(testRun.stdout, planned.value.suites);

  await fs.writeFile(join(planned.value.worktreePath, planned.value.testResults.path), stringifyJson({
    generatedRoot,
    importCheck: {
      command: importCheckCommand,
      exitCode: importCheck.exitCode,
      stdout: importCheck.stdout,
      stderr: importCheck.stderr,
    },
    testRun: {
      command: testCommand,
      exitCode: testRun.exitCode,
      stdout: testRun.stdout,
      stderr: testRun.stderr,
    },
    integrationTestFiles: planned.value.integrationTestFiles.map((file) => file.path),
    suiteTelemetryAnalysis,
  }));

  if (importCheck.exitCode !== 0) {
    return { ok: false, error: `Generated import check failed. See ${planned.value.testResults.path}.` };
  }

  if (testRun.exitCode !== 0) {
    return { ok: false, error: `Generated integration suites failed. See ${planned.value.testResults.path}.` };
  }

  return planned;
}
