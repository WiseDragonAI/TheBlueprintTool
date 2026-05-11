/**
 * WHAT: Verifies generated source files carry telemetry instrumentation.
 * WHY: generated tests and reports need observable controller/helper/effect calls.
 */
import type { OutputFile, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { injectTelemetryCalls } from '../../generate/helper/inject-telemetry-calls.js';

export async function attachGeneratedTelemetryController(input: { sourceFiles: OutputFile[] }): Promise<Result<OutputFile[]>> {
  const checked = injectTelemetryCalls(input.sourceFiles);
  telemetry('inject-telemetry-calls', { files: input.sourceFiles.length });

  if (!checked.ok) {
    return checked;
  }

  telemetry('attach-generated-telemetry', { files: checked.value.length });
  return checked;
}
