/**
 * WHAT: generated worktree planning controller.
 * WHY: dry-run and apply must derive the same planned files before any writes.
 */
import type { FileSystemPort, Result, WorktreePlan } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { loadAndValidateMasterLedgerController } from '../../master-ledger/controller/load-and-validate-master-ledger.js';
import { enumerateGeneratedFunctions } from '../helper/enumerate-generated-functions.js';
import { classifyGeneratedFunctions } from '../helper/classify-generated-functions.js';
import { deriveComponentOutputContract } from '../helper/derive-component-output-contract.js';
import { createWorktreePlan } from '../helper/create-worktree-plan.js';
import { emitDryRunOutput } from '../effect/emit-dry-run-output.js';

export async function planGeneratedWorktreeController(
  input: {
    mode: 'dry-run' | 'apply';
    masterLedgerFile: string;
    specsLedgerFile?: string;
    output: string;
    emit?: (message: string) => void;
  },
  fs?: FileSystemPort,
): Promise<Result<WorktreePlan>> {
  const loaded = await loadAndValidateMasterLedgerController(input.masterLedgerFile, fs);

  // WHY: invalid ledgers cannot produce safe plans.
  // WHAT: return the validation failure.
  if (!loaded.ok) {
    return loaded;
  }

  let functions = enumerateGeneratedFunctions(loaded.value);
  telemetry('enumerate-generated-functions', { count: functions.length });
  functions = classifyGeneratedFunctions(functions);
  telemetry('classify-generated-functions', { count: functions.length });
  functions = deriveComponentOutputContract(functions);
  telemetry('derive-component-output-contract');
  const plan = createWorktreePlan({
    output: input.output,
    functions,
    suites: loaded.value.suites,
  });
  telemetry('create-worktree-plan', { files: plan.sourceFiles.length + plan.unitTestFiles.length + plan.integrationTestFiles.length });

  // WHY: dry-run must print planned output without writing files.
  // WHAT: emit the dry-run plan when requested.
  if (input.mode === 'dry-run') {
    emitDryRunOutput(plan, input.emit);
    telemetry('emit-dry-run-output');
  }

  return { ok: true, value: plan };
}
