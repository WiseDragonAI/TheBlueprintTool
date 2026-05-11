/**
 * WHAT: Emits rejected TypeScript project verification telemetry.
 * WHY: failed project checks must be observable.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function verifyTypescriptProjectRejected(input: unknown = {}): void {
  telemetry('effect:verify-typescript-project-rejected -> typescript project verification rejected', { functionName: 'verify-typescript-project-rejected', phase: 'failed', arguments: input });
}
