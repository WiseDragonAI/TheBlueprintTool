/**
 * WHAT: Owns the server-authored skill catalog and bounded peer library synchronization.
 * WHY: Library indexing, retries, metadata ownership, and publication form one federation capability lifecycle.
 */
import {
  importFederatedPipelineSnapshot,
  importFederatedSkillSnapshot,
  type FederatedPipelineSnapshot,
  type FederatedSkillExportIndex,
  type FederatedSkillManifest,
  type FederatedSkillSnapshot,
} from '../helper/federated-library-cache.js';
import type {
  FederationInternalResponse,
  createFederationNodeConnector,
} from '../helper/federation-node-connector.js';
import type { createRuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import { createFederatedLibraryCatalog } from './federated-library-catalog.js';

type AnyRecord = Record<string, unknown>;
type Skill = { name: string; favorite?: boolean; tags?: string[] };
const requestTimeoutMs = 60_000;
const retryDelaysMs = [1_000, 3_000] as const;
const recoveryDelayMs = 30_000;

class FederatedLibraryRequestError extends Error {
  constructor(readonly detail: {
    code: string;
    nodeId: string;
    nodeLabel: string;
    path: string;
    requestId: string;
    status: number;
    elapsedMs: number;
    deadlineMs: number;
    responseBytes: number;
  }, message: string) {
    super(message);
  }
}

export function createFederatedLibraryRuntime(input: {
  federation: () => ReturnType<typeof createFederationNodeConnector> | null;
  clearPaused: (component: string) => void;
  incidentLedger: ReturnType<typeof createRuntimeIncidentLedger>;
  localDecisionOsRoots: () => string[];
  localWorkspaceRoots: () => string[];
  masterDecisionOsRoot: string;
  masterRoot: string;
  paused: (component: string) => boolean;
  recordBackgroundFailure: (component: string, operation: string, error: unknown, context?: AnyRecord) => unknown;
  recordIncident: (input: AnyRecord) => { id: string };
  runtime: AnyRecord;
}): {
  applyOwnedDetail: (result: AnyRecord) => AnyRecord;
  applyOwnedMetadata: <T extends Skill>(skills: T[]) => T[];
  initialize: () => void;
  invalidateIndex: () => void;
  publishAuthoredSkill: (skillName: string, operation: 'create' | 'save' | 'retry') => Promise<AnyRecord>;
  readSkillIndex: () => Promise<FederatedSkillExportIndex>;
  stop: () => void;
  synchronize: (forceRefresh?: boolean) => Promise<void>;
} {
  const catalog = createFederatedLibraryCatalog({
    localDecisionOsRoots: input.localDecisionOsRoots,
    localWorkspaceRoots: input.localWorkspaceRoots,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    masterRoot: input.masterRoot,
    runtime: input.runtime,
  });
  let requested = false;
  let forceRefreshRequested = false;
  let synchronization: Promise<void> | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  const parseResponse = <T>(response: {
    result: FederationInternalResponse;
    nodeId: string;
    nodeLabel: string;
    path: string;
    startedAt: number;
  }): T => {
    const elapsedMs = Date.now() - response.startedAt;
    let payload: AnyRecord = {};
    try { payload = JSON.parse(response.result.body.toString('utf8')) as AnyRecord; } catch {}
    const detail = {
      code: String(payload.error ?? `federation_http_${response.result.status}`),
      nodeId: response.nodeId,
      nodeLabel: response.nodeLabel,
      path: response.path,
      requestId: response.result.requestId,
      status: response.result.status,
      elapsedMs,
      deadlineMs: requestTimeoutMs,
      responseBytes: response.result.body.byteLength,
    };
    if (response.result.status !== 200) {
      throw new FederatedLibraryRequestError(
        detail,
        `${response.nodeLabel} ${response.path} returned HTTP ${response.result.status}.`,
      );
    }
    try { return JSON.parse(response.result.body.toString('utf8')) as T; }
    catch {
      throw new FederatedLibraryRequestError(
        { ...detail, code: 'federation_invalid_json' },
        `${response.nodeLabel} ${response.path} returned invalid JSON.`,
      );
    }
  };
  const request = async <T>(peer: { nodeId: string; nodeLabel: string }, path: string): Promise<T> => {
    const startedAt = Date.now();
    const result = await input.federation()!.request(peer.nodeId, path, { timeoutMs: requestTimeoutMs });
    return parseResponse<T>({ result, nodeId: peer.nodeId, nodeLabel: peer.nodeLabel, path, startedAt });
  };
  const perform = async (forceRefresh: boolean): Promise<number> => {
    const peers = input.federation()?.nodes().filter((node) => node.online) ?? [];
    for (const peer of peers) {
      const manifest = await request<FederatedSkillManifest>(
        peer,
        forceRefresh ? '/api/federation/skills-manifest?refresh=1' : '/api/federation/skills-manifest',
      );
      const local = new Map((await catalog.readIndex()).manifest.skills.map((skill) => [skill.name, skill.revision]));
      for (const skill of manifest.skills) {
        if (local.get(skill.name) === skill.revision) continue;
        const snapshot = await request<FederatedSkillSnapshot>(
          peer,
          `/api/federation/skills-snapshot?name=${encodeURIComponent(skill.name)}`,
        );
        if (importFederatedSkillSnapshot({ serverRoot: input.masterRoot, snapshot }).imported.length > 0) {
          catalog.invalidate();
        }
      }
    }
    for (const peer of peers) {
      const snapshot = await request<FederatedPipelineSnapshot>(peer, '/api/federation/pipelines-snapshot');
      importFederatedPipelineSnapshot({ decisionOsRoot: input.masterDecisionOsRoot, snapshot });
    }
    return peers.length;
  };
  const scheduleRetry = (synchronize: () => Promise<void>): void => {
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!input.paused('federated-library-sync')) void synchronize().catch(() => undefined);
    }, recoveryDelayMs);
    retryTimer.unref?.();
  };
  const synchronize = (forceRefresh = false): Promise<void> => {
    requested = true;
    forceRefreshRequested ||= forceRefresh;
    if (synchronization) return synchronization;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    const run = (async () => {
      do {
        requested = false;
        const refresh = forceRefreshRequested;
        forceRefreshRequested = false;
        let synchronizedPeerCount = 0;
        for (let attempt = 1; attempt <= retryDelaysMs.length + 1; attempt += 1) {
          try {
            synchronizedPeerCount = await perform(refresh);
            break;
          } catch (error) {
            if (!(error instanceof FederatedLibraryRequestError)) {
              input.recordBackgroundFailure('federated-library-sync', 'synchronize-federated-libraries', error);
              throw error;
            }
            input.runtime.federatedLibrarySyncStatus = {
              phase: 'retrying',
              attempt,
              ...error.detail,
              observedAt: new Date().toISOString(),
            };
            input.recordIncident({
              severity: 'warning',
              scope: 'background:federated-library-sync',
              component: 'federated-library-sync',
              operation: 'synchronize-federated-libraries',
              code: 'federated_library_remote_unavailable',
              error,
              context: { ...error.detail, connectorCode: error.detail.code, attempt },
            });
            const delayMs = retryDelaysMs[attempt - 1];
            if (delayMs !== undefined) {
              await new Promise<void>((resolve) => {
                const timer = setTimeout(resolve, delayMs);
                timer.unref?.();
              });
              continue;
            }
            scheduleRetry(() => synchronize());
            return;
          }
        }
        if (synchronizedPeerCount === 0) {
          input.runtime.federatedLibrarySyncStatus = {
            phase: 'waiting-for-peer',
            observedAt: new Date().toISOString(),
          };
          scheduleRetry(() => synchronize());
          return;
        }
        input.runtime.federatedLibrarySyncStatus = {
          phase: 'synchronized',
          synchronizedPeerCount,
          observedAt: new Date().toISOString(),
        };
        input.incidentLedger.resolveScope(
          'background:federated-library-sync',
          'Complete skills-then-pipelines synchronization succeeded.',
        );
        input.clearPaused('federated-library-sync');
      } while (requested);
    })().finally(() => {
      if (synchronization === run) synchronization = null;
      if (requested && !input.paused('federated-library-sync')) void synchronize().catch(() => undefined);
    });
    synchronization = run;
    Object.defineProperty(input.runtime, 'federatedLibrarySyncPromise', {
      value: run,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    return run;
  };
  const publishAuthoredSkill = async (
    skillName: string,
    operation: 'create' | 'save' | 'retry',
  ): Promise<AnyRecord> => {
    catalog.invalidate();
    input.federation()?.publishManifest();
    const failed = (error: unknown): AnyRecord => {
      const incident = input.recordIncident({
        severity: 'warning',
        scope: `federated-skill-publication:${skillName}`,
        component: 'federated-library-sync',
        operation: 'publish-authored-federated-skill',
        code: 'federated_skill_publication_failed',
        error,
        context: { skillName, operation },
      });
      return {
        status: 'failed',
        retryable: true,
        retryPath: '/api/federation/libraries/synchronize',
        incidentId: incident.id,
      };
    };
    if (input.federation()?.status().phase !== 'connected') {
      return failed(new Error('The federation relay is not connected.'));
    }
    try {
      await synchronize(true);
      const status = input.runtime.federatedLibrarySyncStatus as AnyRecord | undefined;
      if (status?.phase !== 'synchronized') {
        return failed(new Error('Federated library synchronization did not reach synchronized state.'));
      }
      input.incidentLedger.resolveScope(
        `federated-skill-publication:${skillName}`,
        'Federated skill publication succeeded.',
      );
      return { status: 'published' };
    } catch (error) {
      return failed(error);
    }
  };
  return {
    applyOwnedDetail: catalog.applyOwnedDetail,
    applyOwnedMetadata: catalog.applyOwnedMetadata,
    initialize: catalog.initialize,
    invalidateIndex: catalog.invalidate,
    publishAuthoredSkill,
    readSkillIndex: catalog.readIndex,
    stop: () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
    },
    synchronize,
  };
}
