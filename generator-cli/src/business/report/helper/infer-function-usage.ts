/**
 * WHAT: Function usage inference helper.
 * WHY: specs require usage to come from integration-test telemetry, not unit-test calls.
 */
import type { TelemetryTrace } from '../../../lib/types.js';

export function inferFunctionUsage(traces: TelemetryTrace[]): string[] {
  const used = new Set<string>();

  for (const trace of traces) {
    const args = trace.args as { functionName?: string; testKind?: string } | undefined;

    // WHY: unit-test calls do not count as runtime function usage.
    // WHAT: only accept traces not marked as unit tests.
    if (args?.functionName && args.testKind !== 'unit') {
      used.add(args.functionName);
    }
  }

  return [...used].sort();
}
