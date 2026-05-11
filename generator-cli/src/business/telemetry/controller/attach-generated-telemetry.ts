/**
 * WHAT: Generated controller function attach-generated-telemetry.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { captureExecutionStackTrace } from '../helper/capture-execution-stack-trace.js';
import { injectTelemetryCalls } from '../../generate/helper/inject-telemetry-calls.js';
import { writeTelemetryHarness } from '../../generate/effect/write-telemetry-harness.js';


export async function attachGeneratedTelemetryController({
  action_payload,
}: {
  action_payload: {
    master_ledger_file: string
  }
}) {
  telemetry('controller:attach-generated-telemetry -> start', { functionName: 'attach-generated-telemetry', arguments: { action_payload }, phase: 'started' });
  // WHAT: attach telemetry to generated files and tests.
  // WHY: tests and reports need execution evidence.
  // HOW: inject telemetry calls, write harness, and capture stack traces.
  const telemetry_plan = injectTelemetryCalls(action_payload.master_ledger_file)
  telemetry('controller:attach-generated-telemetry -> inject-telemetry-calls', { functionName: 'inject-telemetry-calls', arguments: { action_payload }, phase: 'event' })

  writeTelemetryHarness(telemetry_plan)
  telemetry('controller:attach-generated-telemetry -> write-telemetry-harness', { functionName: 'write-telemetry-harness', arguments: { action_payload }, phase: 'event' })

  captureExecutionStackTrace(telemetry_plan)
  telemetry('controller:attach-generated-telemetry -> capture-execution-stack-trace', { functionName: 'capture-execution-stack-trace', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:attach-generated-telemetry -> complete', { functionName: 'attach-generated-telemetry', arguments: { action_payload }, phase: 'completed' });
}
