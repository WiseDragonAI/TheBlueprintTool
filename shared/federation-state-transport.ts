/**
 * WHAT: Defines the shared count and byte ceilings for one epoch-4 state transaction.
 * WHY: Nodes and relays must emit and admit the same bounded unit of durable repair work.
 */
export const federationStateEntityBatchSize = 16;
export const federationMaximumStateFrameBytes = 512 * 1024;

export type FederationStateRejection = {
  key: string;
  stateHash: string;
  relayStateHash?: string;
  collisions?: Array<{ path: string; replicaId: string; counter: number }>;
  code: 'task_current_dot_collision';
};

export function federationStateRejectionCode(error: unknown): FederationStateRejection['code'] | null {
  const message = error instanceof Error ? error.message : String(error);
  // WHAT: Classify only the irreconcilable same-dot conflict as a terminal entity rejection.
  // WHY: Malformed input and transient storage failures must keep their existing whole-frame failure boundary.
  if (message.startsWith('task_current_dot_collision:')) return 'task_current_dot_collision';
  return null;
}
