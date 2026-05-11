/**
 * WHAT: Telemetry injection verifier.
 * WHY: generated files must include default telemetry for function name, arguments, and execution phase.
 */
import type { OutputFile, Result } from '../../../lib/types.js';

export function injectTelemetryCalls(files: OutputFile[]): Result<OutputFile[]> {
  const missing = files.find((file) => !file.content.includes('telemetry(') || !file.content.includes('functionName') || !file.content.includes('arguments'));

  // WHY: generated functions without telemetry cannot prove execution.
  // WHAT: reject the first file that lacks the telemetry contract.
  if (missing) {
    return { ok: false, error: `Missing telemetry contract in ${missing.path}` };
  }

  return { ok: true, value: files };
}
