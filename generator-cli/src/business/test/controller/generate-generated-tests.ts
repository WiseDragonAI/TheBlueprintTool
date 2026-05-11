/**
 * WHAT: Generates unit and integration test files from a loaded MasterLedger plan.
 * WHY: test generation is a distinct controller path in the ledger.
 */
import type { FileSystemPort, Result, WorktreePlan } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { loadAndValidateMasterLedgerController } from '../../master-ledger/controller/load-and-validate-master-ledger.js';
import { enumerateGeneratedFunctions } from '../../generate/helper/enumerate-generated-functions.js';
import { classifyGeneratedFunctions } from '../../generate/helper/classify-generated-functions.js';
import { createWorktreePlan } from '../../generate/helper/create-worktree-plan.js';
import { buildTestStateContracts } from '../../generate/helper/build-test-state-contracts.js';
import { writeUnitTestFile } from '../../generate/effect/write-unit-test-file.js';
import { writeIntegrationTestFile } from '../../generate/effect/write-integration-test-file.js';

export async function generateGeneratedTestsController(
  input: { masterLedgerFile: string; output: string },
  fs?: FileSystemPort,
): Promise<Result<Pick<WorktreePlan, 'unitTestFiles' | 'integrationTestFiles'>>> {
  const loaded = await loadAndValidateMasterLedgerController(input.masterLedgerFile, fs);

  if (!loaded.ok) {
    return loaded;
  }

  const functions = classifyGeneratedFunctions(enumerateGeneratedFunctions(loaded.value));
  telemetry('classify-generated-functions', { count: functions.length });
  buildTestStateContracts(functions);
  telemetry('build-test-state-contracts', { count: functions.length });
  const plan = createWorktreePlan({ output: input.output, functions, suites: loaded.value.suites });
  await writeUnitTestFile(plan.worktreePath, plan.unitTestFiles, fs);
  telemetry('write-unit-test-file', { count: plan.unitTestFiles.length });
  await writeIntegrationTestFile(plan.worktreePath, plan.integrationTestFiles, fs);
  telemetry('write-integration-test-file', { count: plan.integrationTestFiles.length });

  return { ok: true, value: { unitTestFiles: plan.unitTestFiles, integrationTestFiles: plan.integrationTestFiles } };
}
