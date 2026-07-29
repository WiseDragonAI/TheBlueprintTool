/**
 * WHAT: Selects the retained runtime incidents that are allowed to block production delivery.
 * WHY: Unrelated contained incidents remain diagnostic evidence and must not become global delivery outages.
 */
import type { RuntimeIncident } from '../../server/helper/runtime-incident-ledger.js';

export function deliveryBlockingIncidents(incidents: readonly RuntimeIncident[]): RuntimeIncident[] {
  return incidents.filter((incident) => (
    incident.status === 'paused'
    && (
      (incident.scope === 'server-runtime' && incident.severity === 'fatal')
      || incident.scope.startsWith('delivery:')
      || incident.scope.startsWith('delivery-dependency:')
    )
  ));
}
