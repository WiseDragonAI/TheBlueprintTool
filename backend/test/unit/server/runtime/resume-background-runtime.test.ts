/**
 * WHAT: Proves explicit recovery accepts a background component that resolves its own incident.
 * WHY: Federated library synchronization must not be re-paused after successful convergence.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeBackgroundRuntime } from '../../../../src/business/server/runtime/resume-background-runtime.js';

test('federated library recovery remains resumed after synchronization resolves its incident', async () => {
  const pausedBackgroundComponents = new Set(['federated-library-sync']);
  let recordedFailure = false;
  let genericResolutionCalled = false;

  const result = await resumeBackgroundRuntime({
    activeIncidentIds: () => ['incident-library-sync'],
    codexCoordinator: {} as never,
    component: 'federated-library-sync',
    contentScheduler: () => null,
    federatedLibrary: {
      synchronize: async () => {
        pausedBackgroundComponents.delete('federated-library-sync');
      },
    } as never,
    incidentSupervisor: {
      pausedBackgroundComponents,
      recordBackgroundFailure: () => {
        recordedFailure = true;
      },
    } as never,
    initializePipelineCatalog: () => undefined,
    migrateProjectPipelines: () => undefined,
    projectRuntimeRegistry: { contexts: new Map() } as never,
    projectSyncRuntime: {} as never,
    resolution: 'Federated library synchronization completed.',
    resolveScope: () => {
      genericResolutionCalled = true;
      return [];
    },
    scope: 'background:federated-library-sync',
  });

  assert.deepEqual(result, ['incident-library-sync']);
  assert.equal(pausedBackgroundComponents.has('federated-library-sync'), false);
  assert.equal(genericResolutionCalled, false);
  assert.equal(recordedFailure, false);
});
