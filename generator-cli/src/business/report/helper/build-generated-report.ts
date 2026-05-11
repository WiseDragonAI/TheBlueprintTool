/**
 * WHAT: GeneratedReport builder.
 * WHY: report mode must write one report containing tests, telemetry, stack traces, graph, and unused functions.
 */
import type { DependencyGraph, GeneratedReport, GeneratedFunction, TelemetryTrace, TestRun } from '../../../lib/types.js';
import { captureExecutionStackTrace } from '../../telemetry/helper/capture-execution-stack-trace.js';
import { detectUnusedFunctions } from './detect-unused-functions.js';
import { inferFunctionUsage } from './infer-function-usage.js';

export function buildGeneratedReport(input: {
  testRun: TestRun;
  telemetry: TelemetryTrace[];
  graph: DependencyGraph;
  functions: GeneratedFunction[];
}): GeneratedReport {
  const usedFunctions = inferFunctionUsage(input.telemetry);
  const unusedFunctions = detectUnusedFunctions(input.functions, usedFunctions);
  return {
    testRun: {
      command: input.testRun.command,
      exitCode: input.testRun.exitCode,
      stdout: input.testRun.stdout,
      stderr: input.testRun.stderr,
    },
    telemetry: input.telemetry,
    stackTrace: captureExecutionStackTrace(input.testRun),
    graph: input.graph,
    usedFunctions,
    unusedFunctions,
  };
}
