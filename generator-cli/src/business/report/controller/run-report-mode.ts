/**
 * WHAT: Generated controller function run-report-mode.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function with automatically resolved imports.
 */
import { telemetry } from '../../../telemetry/harness.js';
import { buildGeneratedReport } from '../helper/build-generated-report.js';
import { captureExecutionStackTrace } from '../../telemetry/helper/capture-execution-stack-trace.js';
import { collectTelemetryTraces } from '../helper/collect-telemetry-traces.js';
import { detectUnusedFunctions } from '../helper/detect-unused-functions.js';
import { inferFunctionUsage } from '../helper/infer-function-usage.js';
import { runNodeTest } from '../helper/run-node-test.js';
import { writeGeneratedReportFile } from '../effect/write-generated-report-file.js';


export async function runReportModeController({
  action_payload,
}: {
  action_payload: {
    report_command: true
    node_test_run: string
  }
}) {
  telemetry('controller:run-report-mode -> start', { functionName: 'run-report-mode', arguments: { action_payload }, phase: 'started' });
  // WHAT: run report mode.
  // WHY: one GeneratedReport must prove tests, telemetry, graph, stack traces, and unused functions.
  // HOW: execute node:test, gather telemetry, infer usage, build report, and write one file.
  const test_run = await runNodeTest(action_payload.node_test_run)
  telemetry('controller:run-report-mode -> run-node-test', { functionName: 'run-node-test', arguments: { action_payload }, phase: 'event' })

  const traces = collectTelemetryTraces(test_run)
  telemetry('controller:run-report-mode -> collect-telemetry-traces', { functionName: 'collect-telemetry-traces', arguments: { action_payload }, phase: 'event' })

  const stack = captureExecutionStackTrace(test_run)
  telemetry('controller:run-report-mode -> capture-execution-stack-trace', { functionName: 'capture-execution-stack-trace', arguments: { action_payload }, phase: 'event' })

  const usage = inferFunctionUsage(traces)
  telemetry('controller:run-report-mode -> infer-function-usage', { functionName: 'infer-function-usage', arguments: { action_payload }, phase: 'event' })

  const unused = detectUnusedFunctions(usage)
  telemetry('controller:run-report-mode -> detect-unused-functions', { functionName: 'detect-unused-functions', arguments: { action_payload }, phase: 'event' })

  const report = buildGeneratedReport({ test_run, traces, stack, usage, unused })
  telemetry('controller:run-report-mode -> build-generated-report', { functionName: 'build-generated-report', arguments: { action_payload }, phase: 'event' })

  writeGeneratedReportFile(report)
  telemetry('controller:run-report-mode -> write-generated-report-file', { functionName: 'write-generated-report-file', arguments: { action_payload }, phase: 'event' })
  telemetry('controller:run-report-mode -> complete', { functionName: 'run-report-mode', arguments: { action_payload }, phase: 'completed' });
}
