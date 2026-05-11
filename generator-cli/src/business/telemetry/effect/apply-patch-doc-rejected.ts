/**
 * WHAT: Emits rejected patch-doc telemetry.
 * WHY: controller rejection branches must be observable.
 */
import { telemetry } from '../../../lib/telemetry/telemetry.js';

export function applyPatchDocRejected(input: unknown = {}): void {
  telemetry('effect:apply-patch-doc-rejected -> rejected patch-doc command', { functionName: 'apply-patch-doc-rejected', phase: 'event', arguments: input });
}
