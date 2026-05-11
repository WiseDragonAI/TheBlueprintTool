/**
 * WHAT: TelemetryTrace collector.
 * WHY: report mode infers function usage from integration-test telemetry evidence.
 */
import type { FileSystemPort, TelemetryTrace, TestRun } from '../../../lib/types.js';
import { parseJson } from '../../../lib/json/json.js';

export async function collectTelemetryTraces(testRun: TestRun, telemetryFile?: string, fs?: FileSystemPort): Promise<TelemetryTrace[]> {
  // WHY: explicit telemetry files are the durable source when provided.
  // WHAT: parse the file as JSON array evidence.
  if (telemetryFile && fs) {
    const parsed = parseJson<TelemetryTrace[]>(await fs.readFile(telemetryFile));
    return parsed.ok ? parsed.value : [];
  }

  return testRun.traces;
}
