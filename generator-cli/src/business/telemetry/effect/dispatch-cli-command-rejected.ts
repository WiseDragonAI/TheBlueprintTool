/**
 * WHAT: Emits unsupported CLI command telemetry.
 * WHY: dispatch rejection branches must be observable.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function dispatchCliCommandRejected(input: unknown = {}): void {
  telemetry('effect:dispatch-cli-command-rejected -> rejected unsupported cli command', { functionName: 'dispatch-cli-command-rejected', phase: 'event', arguments: input });
}
