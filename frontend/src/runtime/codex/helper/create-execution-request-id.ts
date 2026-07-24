/** WHAT: Creates the client-owned idempotency identity before execution admission. */
export function createExecutionRequestId(prefix = 'execution'): string {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${suffix}`;
}
