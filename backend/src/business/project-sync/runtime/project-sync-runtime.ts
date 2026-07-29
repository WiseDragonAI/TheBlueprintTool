import { createProjectSyncController } from '../controller/start-project-sync.js';
import { createProjectSyncStore } from '../helper/project-sync-store.js';
import { projectSyncGitSshCommand } from '../helper/project-sync-git-ssh-command.js';
import type { createProjectCatalogStore } from '../../server/helper/project-catalog-store.js';
import type { createFederationNodeConnector } from '../../federation/helper/federation-node-connector.js';
import type { DecisionOsProject } from '../../server/helper/project-catalog.js';
import { readDecisionOsSettings } from '../../server/helper/read-decision-os-settings.js';
import { RuntimeScopePausedError } from '../../server/helper/runtime-incident-ledger.js';
import type { RuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';

type AnyRecord = Record<string, unknown>;

export function createProjectSyncRuntime(input: {
  catalog: ReturnType<typeof createProjectCatalogStore>;
  decisionOsRoot: string;
  federation: ReturnType<typeof createFederationNodeConnector>;
  incidentLedger: RuntimeIncidentLedger;
  masterRoot: string;
  onBackgroundFailure: (
    component: string,
    operation: string,
    error: unknown,
    context?: AnyRecord,
  ) => void;
  onRunChange: (run: {
    syncId: string;
    phase: string;
    preparationPhase: string;
  }) => void;
  projectRuntime: (project: DecisionOsProject) => AnyRecord;
  projects: () => DecisionOsProject[];
  paused: (component: string) => boolean;
}) {
  let store = createProjectSyncStore({ decisionOsRoot: input.decisionOsRoot });
  let controller: ReturnType<typeof createProjectSyncController> | null = null;

  const install = (
    nextStore = createProjectSyncStore({ decisionOsRoot: input.decisionOsRoot }),
  ): void => {
    if (nextStore.corruptionError) throw nextStore.corruptionError;
    const nextController = createProjectSyncController({
      masterRoot: input.masterRoot,
      localNodeId: () => input.federation.localOwner().ownerNodeId,
      projects: input.projects,
      catalog: input.catalog,
      federation: input.federation,
      store: nextStore,
      runtimeForProject: input.projectRuntime,
      gitSshCommand: () => projectSyncGitSshCommand(
        readDecisionOsSettings({
          action_payload: { decisionOsRoot: input.decisionOsRoot },
          runtime_state: {},
        }).settings,
      ),
      onRunChange: input.onRunChange,
      onBackgroundError: (error, context) => {
        controller = null;
        input.onBackgroundFailure(
          'project-sync-runtime',
          context.operation,
          error,
          context,
        );
      },
    });
    nextController.resume();
    store = nextStore;
    controller = nextController;
  };

  if (store.corruptionError) {
    input.onBackgroundFailure(
      'project-sync-store',
      'read-project-sync-store',
      store.corruptionError,
      { file: store.file },
    );
  } else if (!input.paused('project-sync-store')
    && !input.paused('project-sync-runtime')) {
    install(store);
  }

  return {
    controller: (): NonNullable<typeof controller> => {
      if (controller) return controller;
      const incident = input.incidentLedger.active('background:project-sync-store')[0]
        ?? input.incidentLedger.active('background:project-sync-runtime')[0];
      if (incident) throw new RuntimeScopePausedError(incident.scope, incident.id);
      throw new Error('Project synchronization runtime is unavailable.');
    },
    resume: () => install(),
    store: () => store,
  };
}
