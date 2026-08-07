import { decisionOsReleaseHealthIdentity } from '../../server/helper/read-decision-os-settings.js';
import { deliveryBlockingIncidents } from '../helper/delivery-incident-boundary.js';
import { pendingCodexProcessEntries } from '../../codex/helper/codex-process-scheduler.js';
import type { RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';

type AnyRecord = Record<string, unknown>;

export function buildDeliveryAdmissionState(input: {
  contentStatus: () => {
    queueDepth: number;
    resources: Array<{ state: string }>;
  };
  executionStates: Iterable<ProjectTaskState>;
  federationPhase: string;
  incidentLedger: RuntimeIncidentLedger;
  localNodeId: string;
  projectIds: string[];
  replicationStatus: () => {
    convergence: Array<{ peerId: string; projectId: string; converged: boolean }>;
    pendingDeliveryIds: unknown[];
    runtimeDirty: unknown[];
  };
  releaseSettings: unknown;
  schedulerContexts: Iterable<{ root: string; runtime: AnyRecord }>;
}) {
  const activePhases = new Set(['preparing', 'starting', 'running', 'cancelling']);
  const localExecutions = [...input.executionStates]
    .flatMap((state) => state.executions.all())
    .filter((execution) => execution.lifecycle.executorNodeId === input.localNodeId);
  const pendingProcessQueueDepth = [...input.schedulerContexts].reduce(
    (count, context) => count
      + pendingCodexProcessEntries(context.root, context.runtime).length,
    0,
  );
  const activeIncidents = input.incidentLedger.snapshot().incidents.filter((incident) => (
    incident.status === 'paused'
  ));
  const blockingIncidents = deliveryBlockingIncidents(activeIncidents);
  const stateStatus = input.replicationStatus();
  const contentStatus = input.contentStatus();
  const observedAt = new Date().toISOString();
  return {
    ok: true,
    nodeId: input.localNodeId,
    observedAt,
    projectIds: input.projectIds,
    release: {
      ok: true,
      status: blockingIncidents.length > 0 ? 'degraded' : 'ready',
      observedAt,
      ...decisionOsReleaseHealthIdentity(input.releaseSettings),
      activeIncidentCount: activeIncidents.length,
    },
    federationPhase: input.federationPhase,
    activeExecutionCount: localExecutions.filter((execution) => (
      activePhases.has(execution.lifecycle.phase)
    )).length,
    pendingExecutionCount: localExecutions.filter((execution) => (
      execution.lifecycle.phase === 'queued'
    )).length,
    pendingProcessQueueDepth,
    pausedScopeCount: blockingIncidents.length,
    diagnosticPausedScopeCount: activeIncidents.length,
    fatalIncidentCount: blockingIncidents.filter((incident) => (
      incident.scope === 'server-runtime' && incident.severity === 'fatal'
    )).length,
    stateRuntimeDirtyCount: stateStatus.runtimeDirty.length,
    statePendingDeliveryCount: stateStatus.pendingDeliveryIds.length,
    contentQueueDepth: contentStatus.queueDepth,
    unavailableContentResourceCount: contentStatus.resources.filter(
      (resource) => resource.state !== 'available',
    ).length,
    convergedProjectIds: input.projectIds.filter((projectId) => (
      stateStatus.convergence.some((entry) => (
        entry.peerId === 'relay'
        && entry.projectId === projectId
        && entry.converged
      ))
    )),
  };
}

export function buildDeliveryStatusEvidence(
  input: Parameters<typeof buildDeliveryAdmissionState>[0],
): Array<{ key: string; value: string | number | boolean }> {
  const state = buildDeliveryAdmissionState(input);
  const release = state.release;
  const projectIds = state.projectIds;
  const convergedProjectIds = state.convergedProjectIds;
  return [
    { key: 'observedAt', value: state.observedAt },
    { key: 'ready', value: Number(state.pausedScopeCount) === 0 },
    { key: 'catalogReady', value: projectIds.length > 0 },
    { key: 'projectCount', value: projectIds.length },
    { key: 'projectIds', value: projectIds.join(',') },
    { key: 'releaseSha', value: release.releaseSha },
    { key: 'processStartedAt', value: release.processStartedAt },
    { key: 'deliveryProtocol', value: release.deliveryProtocol },
    { key: 'activeReleasePointer', value: release.activeReleasePointer },
    { key: 'activeIncidentCount', value: release.activeIncidentCount },
    { key: 'federationPhase', value: state.federationPhase },
    { key: 'activeExecutionCount', value: state.activeExecutionCount },
    { key: 'pendingExecutionCount', value: state.pendingExecutionCount },
    { key: 'pendingProcessQueueDepth', value: state.pendingProcessQueueDepth },
    { key: 'pausedScopeCount', value: state.pausedScopeCount },
    { key: 'diagnosticPausedScopeCount', value: state.diagnosticPausedScopeCount },
    { key: 'fatalIncidentCount', value: state.fatalIncidentCount },
    { key: 'stateRuntimeDirtyCount', value: state.stateRuntimeDirtyCount },
    { key: 'statePendingDeliveryCount', value: state.statePendingDeliveryCount },
    { key: 'contentQueueDepth', value: state.contentQueueDepth },
    {
      key: 'unavailableContentResourceCount',
      value: state.unavailableContentResourceCount,
    },
    { key: 'convergedProjectIds', value: convergedProjectIds.join(',') },
    { key: 'converged', value: convergedProjectIds.length === projectIds.length },
  ];
}
