/**
 * WHAT: Identifies the temporary write gate used while task state converges with the relay.
 * WHY: Request and background boundaries must reject this expected condition without pausing healthy runtime scopes.
 */
export function isTaskStateBootstrapGate(error: unknown): boolean {
  return (error instanceof Error ? error.message : String(error)) === 'task_state_bootstrap_incomplete';
}
