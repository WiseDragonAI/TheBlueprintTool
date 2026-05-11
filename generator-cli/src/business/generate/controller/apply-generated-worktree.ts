/**
 * WHAT: Generated controller function apply-generated-worktree.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { buildTestStateContracts } from '../helper/build-test-state-contracts.js';
import { classifyGeneratedFunctions } from '../helper/classify-generated-functions.js';
import { createGitWorktree } from '../effect/create-git-worktree.js';
import { createWorktreePlan } from '../helper/create-worktree-plan.js';
import { enumerateGeneratedFunctions } from '../helper/enumerate-generated-functions.js';
import { injectTelemetryCalls } from '../helper/inject-telemetry-calls.js';
import { planGeneratedWorktreeController } from './plan-generated-worktree.js';
import { writeIntegrationTestFile } from '../effect/write-integration-test-file.js';
import { writeSourceFile } from '../effect/write-source-file.js';
import { writeTelemetryHarness } from '../effect/write-telemetry-harness.js';
import { writeUnitTestFile } from '../effect/write-unit-test-file.js';


export async function applyGeneratedWorktreeController({
  action_payload,
}: {
  action_payload: {
    apply_command: true
    master_ledger_file: string
  }
}) {
  telemetry('controller:apply-generated-worktree -> start', { functionName: 'apply-generated-worktree', arguments: { action_payload }, phase: 'started' });
  // WHAT: write complete generated worktree output.
  // WHY: apply mode materializes source, tests, telemetry, graph, and report setup.
  // HOW: plan first, create fresh worktree, then write each generated artifact.
  await planGeneratedWorktreeController({
    action_payload: {
      mode: 'apply',
      master_ledger_file: action_payload.master_ledger_file,
    },
  })

  const plan = createWorktreePlan(action_payload)
  telemetry('controller:apply-generated-worktree -> create-worktree-plan', { functionName: 'create-worktree-plan', arguments: { action_payload }, phase: 'event' })

  createGitWorktree(plan)
  telemetry('controller:apply-generated-worktree -> create-git-worktree', { functionName: 'create-git-worktree', arguments: { action_payload }, phase: 'event' })

  const functions = enumerateGeneratedFunctions(action_payload.master_ledger_file)
  telemetry('controller:apply-generated-worktree -> enumerate-generated-functions', { functionName: 'enumerate-generated-functions', arguments: { action_payload }, phase: 'event' })

  classifyGeneratedFunctions(functions)
  telemetry('controller:apply-generated-worktree -> classify-generated-functions', { functionName: 'classify-generated-functions', arguments: { action_payload }, phase: 'event' })

  buildTestStateContracts(functions)
  telemetry('controller:apply-generated-worktree -> build-test-state-contracts', { functionName: 'build-test-state-contracts', arguments: { action_payload }, phase: 'event' })

  injectTelemetryCalls(functions)
  telemetry('controller:apply-generated-worktree -> inject-telemetry-calls', { functionName: 'inject-telemetry-calls', arguments: { action_payload }, phase: 'event' })

  writeSourceFile(functions)
  telemetry('controller:apply-generated-worktree -> write-source-file', { functionName: 'write-source-file', arguments: { action_payload }, phase: 'event' })

  writeUnitTestFile(functions)
  telemetry('controller:apply-generated-worktree -> write-unit-test-file', { functionName: 'write-unit-test-file', arguments: { action_payload }, phase: 'event' })

  writeIntegrationTestFile(functions)
  telemetry('controller:apply-generated-worktree -> write-integration-test-file', { functionName: 'write-integration-test-file', arguments: { action_payload }, phase: 'event' })

  writeTelemetryHarness(functions)
  telemetry('controller:apply-generated-worktree -> write-telemetry-harness', { functionName: 'write-telemetry-harness', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:apply-generated-worktree -> complete', { functionName: 'apply-generated-worktree', arguments: { action_payload }, phase: 'completed' });
}
