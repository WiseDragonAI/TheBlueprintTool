/**
 * WHAT: Generated controller function generate-generated-tests.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { buildTestStateContracts } from '../../generate/helper/build-test-state-contracts.js';
import { classifyGeneratedFunctions } from '../../generate/helper/classify-generated-functions.js';
import { deriveIntegrationTestSuitePath } from '../../generate/helper/derive-integration-test-suite-path.js';
import { deriveUnitTestFilePath } from '../../generate/helper/derive-unit-test-file-path.js';
import { enumerateGeneratedFunctions } from '../../generate/helper/enumerate-generated-functions.js';
import { writeIntegrationTestFile } from '../../generate/effect/write-integration-test-file.js';
import { writeUnitTestFile } from '../../generate/effect/write-unit-test-file.js';


export async function generateGeneratedTestsController({
  action_payload,
}: {
  action_payload: {
    master_ledger_file: string
  }
}) {
  telemetry('controller:generate-generated-tests -> start', { functionName: 'generate-generated-tests', arguments: { action_payload }, phase: 'started' });
  // WHAT: generate test files for generated functions and suites.
  // WHY: unit tests and integration suites prove separate behavior contracts.
  // HOW: enumerate functions, classify them, derive paths, attach state contracts, then write tests.
  const functions = enumerateGeneratedFunctions(action_payload.master_ledger_file)
  telemetry('controller:generate-generated-tests -> enumerate-generated-functions', { functionName: 'enumerate-generated-functions', arguments: { action_payload }, phase: 'event' })

  const classified = classifyGeneratedFunctions(functions)
  telemetry('controller:generate-generated-tests -> classify-generated-functions', { functionName: 'classify-generated-functions', arguments: { action_payload }, phase: 'event' })

  const unit_paths = deriveUnitTestFilePath(classified)
  telemetry('controller:generate-generated-tests -> derive-unit-test-file-path', { functionName: 'derive-unit-test-file-path', arguments: { action_payload }, phase: 'event' })

  const integration_paths = deriveIntegrationTestSuitePath(classified)
  telemetry('controller:generate-generated-tests -> derive-integration-test-suite-path', { functionName: 'derive-integration-test-suite-path', arguments: { action_payload }, phase: 'event' })

  buildTestStateContracts(classified)
  telemetry('controller:generate-generated-tests -> build-test-state-contracts', { functionName: 'build-test-state-contracts', arguments: { action_payload }, phase: 'event' })

  writeUnitTestFile(unit_paths)
  telemetry('controller:generate-generated-tests -> write-unit-test-file', { functionName: 'write-unit-test-file', arguments: { action_payload }, phase: 'event' })

  writeIntegrationTestFile(integration_paths)
  telemetry('controller:generate-generated-tests -> write-integration-test-file', { functionName: 'write-integration-test-file', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:generate-generated-tests -> complete', { functionName: 'generate-generated-tests', arguments: { action_payload }, phase: 'completed' });
}
