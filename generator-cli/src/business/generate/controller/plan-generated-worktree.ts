/**
 * WHAT: Generated controller function plan-generated-worktree.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { createWorktreePlan } from '../helper/create-worktree-plan.js';
import { deriveComponentOutputContract } from '../helper/derive-component-output-contract.js';
import { deriveIntegrationTestSuitePath } from '../helper/derive-integration-test-suite-path.js';
import { deriveSourceFilePath } from '../helper/derive-source-file-path.js';
import { deriveUnitTestFilePath } from '../helper/derive-unit-test-file-path.js';
import { emitDryRunOutput } from '../effect/emit-dry-run-output.js';
import { enumerateGeneratedFunctions } from '../helper/enumerate-generated-functions.js';
import { loadAndValidateMasterLedgerController } from '../../master-ledger/controller/load-and-validate-master-ledger.js';


export async function planGeneratedWorktreeController({
  action_payload,
}: {
  action_payload: {
    mode: 'dry-run' | 'apply'
    master_ledger_file: string
  }
}) {
  telemetry('controller:plan-generated-worktree -> start', { functionName: 'plan-generated-worktree', arguments: { action_payload }, phase: 'started' });
  telemetry('controller:plan-generated-worktree -> read-master-ledger', { functionName: 'read-master-ledger', arguments: { action_payload }, phase: 'event' })

  // WHAT: plan generated output.
  // WHY: dry-run mode must show planned files without writes.
  // HOW: validate MasterLedger, enumerate functions, derive paths, then optionally print.
  await loadAndValidateMasterLedgerController({ action_payload })

  const functions = enumerateGeneratedFunctions(action_payload.master_ledger_file)
  telemetry('controller:plan-generated-worktree -> enumerate-generated-functions', { functionName: 'enumerate-generated-functions', arguments: { action_payload }, phase: 'event' })

  const plan = createWorktreePlan(functions)
  telemetry('controller:plan-generated-worktree -> create-worktree-plan', { functionName: 'create-worktree-plan', arguments: { action_payload }, phase: 'event' })

  deriveSourceFilePath(plan)
  telemetry('controller:plan-generated-worktree -> derive-source-file-path', { functionName: 'derive-source-file-path', arguments: { action_payload }, phase: 'event' })

  deriveUnitTestFilePath(plan)
  telemetry('controller:plan-generated-worktree -> derive-unit-test-file-path', { functionName: 'derive-unit-test-file-path', arguments: { action_payload }, phase: 'event' })

  deriveIntegrationTestSuitePath(plan)
  telemetry('controller:plan-generated-worktree -> derive-integration-test-suite-path', { functionName: 'derive-integration-test-suite-path', arguments: { action_payload }, phase: 'event' })

  deriveComponentOutputContract(plan)
  telemetry('controller:plan-generated-worktree -> derive-component-output-contract', { functionName: 'derive-component-output-contract', arguments: { action_payload }, phase: 'event' })

  if (action_payload.mode === 'dry-run') {
    emitDryRunOutput(plan)
    telemetry('controller:plan-generated-worktree -> emit-dry-run-output', { functionName: 'emit-dry-run-output', arguments: { action_payload }, phase: 'event' })
  }
  telemetry('controller:plan-generated-worktree -> complete', { functionName: 'plan-generated-worktree', arguments: { action_payload }, phase: 'completed' });
}
