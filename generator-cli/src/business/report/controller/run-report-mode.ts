/**
 * WHAT: Report mode controller.
 * WHY: report mode proves tests, telemetry, graph, stack traces, and unused functions in one file.
 */
import type { DependencyGraph, FileSystemPort, GeneratedFunction, ProcessPort } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { runNodeTest } from '../helper/run-node-test.js';
import { collectTelemetryTraces } from '../helper/collect-telemetry-traces.js';
import { captureExecutionStackTrace } from '../../telemetry/helper/capture-execution-stack-trace.js';
import { inferFunctionUsage } from '../helper/infer-function-usage.js';
import { detectUnusedFunctions } from '../helper/detect-unused-functions.js';
import { buildGeneratedReport } from '../helper/build-generated-report.js';
import { writeGeneratedReportFile } from '../effect/write-generated-report-file.js';

export async function runReportModeController(
  input: {
    testCommand: string;
    reportFile: string;
    functions: GeneratedFunction[];
    graph: DependencyGraph;
    telemetryFile?: string;
  },
  ports: { fs?: FileSystemPort; process?: ProcessPort; cwd?: string } = {},
): Promise<void> {
  const testRun = await runNodeTest(input.testCommand, ports.process, ports.cwd);
  telemetry('run-node-test', { exitCode: testRun.exitCode });
  const traces = await collectTelemetryTraces(testRun, input.telemetryFile, ports.fs);
  telemetry('collect-telemetry-traces', { count: traces.length });
  captureExecutionStackTrace(testRun);
  telemetry('capture-execution-stack-trace');
  const used = inferFunctionUsage(traces);
  telemetry('infer-function-usage', { count: used.length });
  detectUnusedFunctions(input.functions, used);
  telemetry('detect-unused-functions');
  const report = buildGeneratedReport({ testRun, telemetry: traces, graph: input.graph, functions: input.functions });
  telemetry('build-generated-report');
  await writeGeneratedReportFile(input.reportFile, report, ports.fs);
  telemetry('write-generated-report-file', { path: input.reportFile });
}
