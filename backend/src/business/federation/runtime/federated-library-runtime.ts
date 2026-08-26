/**
 * WHAT: Owns the server-authored skill catalog and bounded peer library synchronization.
 * WHY: Library indexing, retries, metadata ownership, and publication form one federation capability lifecycle.
 */
import {
  importFederatedPipelineSnapshot,
  importFederatedSkillSnapshot,
  federatedSkillReceipt,
  type FederatedPipelineSnapshot,
  type FederatedSkillExportIndex,
  type FederatedSkillManifest,
  type FederatedSkillSnapshot,
  type FederatedSkillReceipt,
} from '../helper/federated-library-cache.js';
import type {
  FederationInternalResponse,
  createFederationNodeConnector,
} from '../helper/federation-node-connector.js';
import type { createRuntimeIncidentLedger } from '../../server/helper/runtime-incident-ledger.js';
import { createFederatedLibraryCatalog } from './federated-library-catalog.js';
import { telemetry } from '@backend/telemetry/harness.js';

type AnyRecord = Record<string, unknown>;
type Skill = { name: string; favorite?: boolean; tags?: string[] };
const requestTimeoutMs = 60_000;
const retryDelaysMs = [1_000, 3_000] as const;
const recoveryDelayMs = 30_000;
const maximumConcurrentPublicationFlights = 2;

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
  preparedCatalog?: { availableSkillNames: string[] };
  paused: (component: string) => boolean;
  recordBackgroundFailure: (component: string, operation: string, error: unknown, context?: AnyRecord) => unknown;
  recordIncident: (input: AnyRecord) => { id: string };
  runtime: AnyRecord;
}): {
  applyOwnedDetail: (result: AnyRecord) => AnyRecord;
  applyOwnedMetadata: <T extends Skill>(skills: T[]) => T[];
  initialize: () => void;
  invalidateIndex: () => void;
  publishAuthoredSkill: (skillName: string, operation: 'create' | 'save' | 'retry') => void;
  receivePublishedSkill: (sourceNodeId: string, skillName: string, revision: string) => Promise<FederatedSkillReceipt>;
  readSkillIndex: () => Promise<FederatedSkillExportIndex>;
  stop: () => void;
  synchronize: (forceRefresh?: boolean) => Promise<void>;
} {
  // WHAT: Transfer the prepared catalog only when startup supplied its one-shot receipt.
  // WHY: Ordinary construction still owns full catalog initialization for non-server callers.
  const catalog = createFederatedLibraryCatalog({
    localDecisionOsRoots: input.localDecisionOsRoots,
    localWorkspaceRoots: input.localWorkspaceRoots,
    masterDecisionOsRoot: input.masterDecisionOsRoot,
    masterRoot: input.masterRoot,
    ...(input.preparedCatalog ? { preparedCatalog: input.preparedCatalog } : {}),
    runtime: input.runtime,
  });
  let requested = false;
  let forceRefreshRequested = false;
  let synchronization: Promise<void> | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  const publicationFlights = new Map<string, Promise<void>>();
  const latestPublicationRevision = new Map<string, string>();
  const acknowledgedPublicationRevision = new Map<string, string>();
  const publicationControllers = new Set<AbortController>();
  const publicationQueue: Array<{
    run: (signal: AbortSignal) => Promise<'acknowledged' | 'pending' | 'failed'>;
    resolve: (outcome: 'acknowledged' | 'pending' | 'failed') => void;
    skillName: string;
    revision: string;
  }> = [];
  let activePublicationFlights = 0;
  let stopped = false;

  const abortableDelay = (delayMs: number, signal: AbortSignal): Promise<void> => new Promise((resolveDelay, rejectDelay) => {
    let timer: NodeJS.Timeout | null = null;
    const settle = (): void => {
      // WHAT: Clear the retry timer and cancellation listener through one settlement owner.
      // WHY: Publication shutdown must not leave timers or abort listeners attached after a delay completes.
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = (): void => {
      settle();
      rejectDelay(signal.reason instanceof Error ? signal.reason : new Error('federated_skill_publication_stopped'));
    };
    // WHAT: Reject before installing a retry timer when shutdown already owns cancellation.
    // WHY: A stopped runtime must not create new asynchronous work.
    if (signal.aborted) {
      abort();
      return;
    }
    timer = setTimeout(() => {
      settle();
      resolveDelay();
    }, delayMs);
    timer.unref?.();
    signal.addEventListener('abort', abort, { once: true });
  });

  const drainPublicationQueue = (): void => {
    // WHAT: Admit at most the configured runtime-wide number of publication flights.
    // WHY: Per-revision deduplication cannot prevent many distinct skills from flooding the relay concurrently.
    while (!stopped && activePublicationFlights < maximumConcurrentPublicationFlights && publicationQueue.length > 0) {
      const queued = publicationQueue.shift()!;
      const controller = new AbortController();
      publicationControllers.add(controller);
      activePublicationFlights += 1;
      telemetry('federated-skill-publication-admitted', {
        skillName: queued.skillName,
        revision: queued.revision,
        activePublicationFlights,
        maximumConcurrentPublicationFlights,
      });
      void queued.run(controller.signal).then(queued.resolve, () => queued.resolve('pending')).finally(() => {
        publicationControllers.delete(controller);
        activePublicationFlights -= 1;
        telemetry('federated-skill-publication-settled', {
          skillName: queued.skillName,
          revision: queued.revision,
          activePublicationFlights,
        });
        drainPublicationQueue();
      });
    }
  };

  const enqueuePublication = (
    skillName: string,
    revision: string,
    run: (signal: AbortSignal) => Promise<'acknowledged' | 'pending' | 'failed'>,
  ): Promise<'acknowledged' | 'pending' | 'failed'> => new Promise((resolvePublication) => {
    // WHAT: Settle new publication admission immediately after runtime shutdown.
    // WHY: Callers must never retain a promise that no queue owner can execute.
    if (stopped) {
      resolvePublication('pending');
      return;
    }
    publicationQueue.push({ run, resolve: resolvePublication, skillName, revision });
    drainPublicationQueue();
  });
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
  const receivePublishedSkill = async (
    sourceNodeId: string,
    skillName: string,
    revision: string,
  ): Promise<FederatedSkillReceipt> => {
    const peer = input.federation()?.nodes().find((node) => node.nodeId === sourceNodeId && node.online);
    // WHAT: Reject a receipt request whose authenticated source is no longer an online federation peer.
    // WHY: A public local HTTP caller must not be able to trigger an arbitrary federation pull.
    if (!peer) throw new Error('federated_skill_receipt_source_unavailable');
    const snapshot = await request<FederatedSkillSnapshot>(
      peer,
      `/api/federation/skills-snapshot?name=${encodeURIComponent(skillName)}`,
    );
    const published = snapshot.skills.find((skill) => skill.name === skillName);
    // WHAT: Import only the exact revision named by the publisher's receipt request.
    // WHY: A stale or substituted snapshot cannot acknowledge the authored revision being settled.
    if (!published || published.revision !== revision) {
      return { version: 1, name: skillName, revision, acknowledged: false };
    }
    importFederatedSkillSnapshot({ serverRoot: input.masterRoot, snapshot: { version: 1, skills: [published] } });
    catalog.invalidate();
    return federatedSkillReceipt(input.masterRoot, skillName, revision);
  };
  const acknowledgePublishedRevision = async (
    skillName: string,
    revision: string,
    signal: AbortSignal,
  ): Promise<'acknowledged' | 'pending' | 'failed'> => {
    const peers = input.federation()?.nodes().filter((node) => node.online) ?? [];
    // WHAT: Keep publication pending without creating an incident when no peer is currently available.
    // WHY: Ordinary peer absence is federation status, while an incident requires a failed attempted acknowledgement.
    if (peers.length === 0) return 'pending';
    for (let attempt = 0; attempt < retryDelaysMs.length + 1; attempt += 1) {
      const peer = peers[attempt % peers.length];
      try {
        const body = Buffer.from(JSON.stringify({ skillName, revision }));
        const startedAt = Date.now();
        const result = await input.federation()!.request(peer.nodeId, '/api/federation/skills-receipt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          timeoutMs: requestTimeoutMs,
          signal,
        });
        const receipt = parseResponse<FederatedSkillReceipt>({
          result,
          nodeId: peer.nodeId,
          nodeLabel: peer.nodeLabel,
          path: '/api/federation/skills-receipt',
          startedAt,
        });
        // WHAT: Accept only an exact imported-revision acknowledgement from the selected peer.
        // WHY: HTTP success without identity and revision equality does not prove publication convergence.
        if (receipt.acknowledged && receipt.name === skillName && receipt.revision === revision) return 'acknowledged';
      } catch {
        // The bounded acknowledgement loop owns final incident classification after all attempts settle.
      }
      const delayMs = retryDelaysMs[attempt];
      // WHAT: Delay only between the three bounded sequential receipt attempts.
      // WHY: Sequential retries prevent publication bursts against the relay and give the selected peer time to import.
      if (delayMs !== undefined) await abortableDelay(delayMs, signal);
    }
    return 'failed';
  };
  const publishAuthoredSkill = (
    skillName: string,
    operation: 'create' | 'save' | 'retry',
  ): void => {
    const failed = (error: unknown): void => {
      input.recordIncident({
        severity: 'warning',
        scope: `federated-skill-publication:${skillName}`,
        component: 'federated-library-sync',
        operation: 'publish-authored-federated-skill',
        code: 'federated_skill_publication_failed',
        error,
        context: { skillName, operation },
      });
    };
    const publish = async (): Promise<void> => {
      try {
        catalog.invalidate();
        const revision = (await catalog.readIndex()).manifest.skills
          .find((skill) => skill.name === skillName)?.revision ?? '';
        // WHAT: Reject publication when the just-authored package is absent from the export authority.
        // WHY: No peer can acknowledge a revision that local committed-content admission excluded.
        if (!revision) {
          failed(new Error('The authored skill is not available in the federated export index.'));
          return;
        }
        latestPublicationRevision.set(skillName, revision);
        input.federation()?.publishManifest();
        // WHAT: Keep disconnected publication pending without classifying ordinary relay state as an incident.
        // WHY: The local commit remains authoritative and a later explicit retry can republish it.
        if (input.federation()?.status().phase !== 'connected') {
          return;
        }
        const flightKey = `${skillName}\0${revision}`;
        // WHAT: Treat a revision already acknowledged during this runtime as settled without opening another peer request.
        // WHY: A duplicate callback can finish Git indexing after the original flight has settled and left the in-flight map.
        if (acknowledgedPublicationRevision.get(skillName) === revision) return;
        let flight = publicationFlights.get(flightKey);
        // WHAT: Create one acknowledgement flight per exact skill revision.
        // WHY: Repeated save and retry callbacks must not multiply relay requests for identical content.
        if (!flight) {
          flight = enqueuePublication(
            skillName,
            revision,
            (signal) => acknowledgePublishedRevision(skillName, revision, signal),
          ).then((outcome) => {
            // WHAT: Ignore a superseded revision after a newer authored revision owns publication.
            // WHY: A late older flight must neither resolve nor create an incident for current content.
            if (latestPublicationRevision.get(skillName) !== revision) return;
            // WHAT: Resolve publication only after one peer acknowledges the exact imported revision.
            // WHY: Local pull synchronization is not evidence that another node received authored content.
            if (outcome === 'acknowledged') {
              acknowledgedPublicationRevision.set(skillName, revision);
              input.incidentLedger.resolveScope(
                `federated-skill-publication:${skillName}`,
                `Peer acknowledged federated skill revision ${revision}.`,
              );
              return;
            }
            // WHAT: Record failure only after at least one online peer exhausted the bounded receipt attempts.
            // WHY: No-peer and disconnected states remain status, not incidents.
            if (outcome === 'failed') failed(new Error(`No peer acknowledged federated skill revision ${revision}.`));
          }).finally(() => publicationFlights.delete(flightKey));
          publicationFlights.set(flightKey, flight);
        }
        await flight;
      } catch (error) {
        failed(error);
      }
    };
    // WHAT: Detach federation convergence from the completed local authoring response.
    // WHY: A slow or unavailable peer must never retain the operator's save request.
    void publish().catch(() => undefined);
  };
  return {
    applyOwnedDetail: catalog.applyOwnedDetail,
    applyOwnedMetadata: catalog.applyOwnedMetadata,
    initialize: catalog.initialize,
    invalidateIndex: catalog.invalidate,
    publishAuthoredSkill,
    receivePublishedSkill,
    readSkillIndex: catalog.readIndex,
    stop: () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      // WHAT: Settle queued publication work without admitting it after shutdown begins.
      // WHY: The stopped runtime no longer owns relay capacity for queued revisions.
      while (publicationQueue.length > 0) publicationQueue.shift()!.resolve('pending');
      // WHAT: Abort every active publication request and retry delay through its owning signal.
      // WHY: Server shutdown must propagate cancellation and force detached publication promises to settle.
      for (const controller of publicationControllers) controller.abort(new Error('federated_skill_publication_stopped'));
    },
    synchronize,
  };
}
