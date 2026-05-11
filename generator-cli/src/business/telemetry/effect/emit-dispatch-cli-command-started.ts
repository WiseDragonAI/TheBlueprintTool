/**
 * WHAT: Emits CLI dispatch start telemetry.
 * WHY: command runs need a visible first event.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function emitDispatchCliCommandStarted(input: unknown = {}): void {
  telemetry('effect:emit-dispatch-cli-command-started -> dispatch cli command started', { functionName: 'emit-dispatch-cli-command-started', phase: 'started', arguments: input });
}
