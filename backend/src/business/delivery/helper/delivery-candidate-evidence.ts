/**
 * WHAT: Strictly validates and atomically writes candidate verification evidence.
 * WHY: T53 preparation must create ignored admission evidence without creating a delivery run, lease, or journal authority.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { atomicWriteDeliveryJson, type DeliveryPersistenceHooks } from './delivery-durable-json.js';
import {
  decisionOsDeliveryProtocol,
  maximumDeliveryDocumentBytes,
} from '../../../../../shared/schemas/decision-os-delivery-types.js';
import {
  deliveryAdmissionProofNames,
  type DeliveryAdmissionProof,
  type DeliveryNodeAdmissionEvidence,
  type DeliveryRelayConfigurationEvidence,
} from '../controller/delivery-admission-controller.js';

export type DeliveryCandidateEvidenceDocument = {
  protocol: 1;
  releaseSha: string;
  relayConfiguration: DeliveryRelayConfigurationEvidence;
  nodeEvidence: DeliveryNodeAdmissionEvidence[];
  proofs: DeliveryAdmissionProof[];
};

export function writeDeliveryCandidateReleaseIdentity(input: {
  candidateWorktree: string;
  currentPointer: string;
  releaseSha: string;
}): { marker: string; currentPointer: string; releaseSha: string } {
  const candidateWorktree = resolve(input.candidateWorktree);
  const currentPointer = resolve(input.currentPointer);
  const releaseSha = sha(input.releaseSha, 'candidateRelease.releaseSha');
  const marker = resolve(candidateWorktree, '.decision-os-release.json');
  const markerDocument = {
    protocol: decisionOsDeliveryProtocol,
    releaseSha,
    launcher: 'bin/decision-os-server.mjs',
  };
  if (existsSync(marker)) {
    let existing: unknown;
    try {
      existing = JSON.parse(readFileSync(marker, 'utf8')) as unknown;
    } catch {
      throw Object.assign(new Error('The candidate release marker is invalid.'), { code: 'delivery_candidate_release_marker_invalid' });
    }
    if (JSON.stringify(existing) !== JSON.stringify(markerDocument)) {
      throw Object.assign(new Error('The candidate release marker does not match the exact candidate.'), { code: 'delivery_candidate_release_marker_mismatch' });
    }
  } else {
    atomicWriteDeliveryJson({ file: marker, value: markerDocument });
  }
  if (existsSync(currentPointer) || lstatExists(currentPointer)) {
    if (!lstatSync(currentPointer).isSymbolicLink()) {
      throw Object.assign(new Error('The candidate current pointer is not a symbolic link.'), { code: 'delivery_candidate_pointer_invalid' });
    }
    const target = resolve(dirname(currentPointer), readlinkSync(currentPointer));
    if (target !== candidateWorktree) {
      throw Object.assign(new Error('The candidate current pointer names another worktree.'), { code: 'delivery_candidate_pointer_mismatch' });
    }
  } else {
    mkdirSync(dirname(currentPointer), { recursive: true });
    const temporary = `${currentPointer}.tmp-${process.pid}`;
    rmSync(temporary, { force: true });
    symlinkSync(relative(dirname(currentPointer), candidateWorktree), temporary);
    renameSync(temporary, currentPointer);
  }
  return { marker, currentPointer, releaseSha };
}

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function exactObject(value: unknown, field: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw Object.assign(new Error(`${field} must be an object.`), { code: 'delivery_candidate_evidence_invalid' });
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(input, key))) {
    throw Object.assign(new Error(`${field} has an invalid shape.`), { code: 'delivery_candidate_evidence_invalid' });
  }
  return input;
}

function timestamp(value: unknown, field: string): string {
  const text = String(value ?? '');
  if (!Number.isFinite(Date.parse(text))) {
    throw Object.assign(new Error(`${field} must be an ISO timestamp.`), { code: 'delivery_candidate_evidence_invalid' });
  }
  return new Date(Date.parse(text)).toISOString();
}

function sha(value: unknown, field: string): string {
  const text = String(value ?? '');
  if (!/^[a-f0-9]{40}$/.test(text)) {
    throw Object.assign(new Error(`${field} must be a lowercase 40-character Git SHA.`), { code: 'delivery_candidate_evidence_invalid' });
  }
  return text;
}

export function validateDeliveryCandidateEvidence(value: unknown): DeliveryCandidateEvidenceDocument {
  const input = exactObject(value, 'candidateEvidence', [
    'protocol', 'releaseSha', 'relayConfiguration', 'nodeEvidence', 'proofs',
  ]);
  if (input.protocol !== decisionOsDeliveryProtocol) {
    throw Object.assign(new Error('candidateEvidence.protocol must equal 1.'), { code: 'delivery_candidate_evidence_invalid' });
  }
  const releaseSha = sha(input.releaseSha, 'candidateEvidence.releaseSha');
  const relay = exactObject(input.relayConfiguration, 'candidateEvidence.relayConfiguration', [
    'observedAt', 'configurationHash', 'wranglerVersion', 'productionWorkerName', 'devWorkerName',
    'productionDurableObjectNamespace', 'devDurableObjectNamespace',
  ]);
  if (
    !/^[a-f0-9]{64}$/.test(String(relay.configurationHash ?? ''))
    || relay.wranglerVersion !== '4.111.0'
  ) throw Object.assign(new Error('candidateEvidence.relayConfiguration is invalid.'), { code: 'delivery_candidate_evidence_invalid' });
  const relayConfiguration: DeliveryRelayConfigurationEvidence = {
    observedAt: timestamp(relay.observedAt, 'candidateEvidence.relayConfiguration.observedAt'),
    configurationHash: String(relay.configurationHash),
    wranglerVersion: '4.111.0',
    productionWorkerName: String(relay.productionWorkerName ?? ''),
    devWorkerName: String(relay.devWorkerName ?? ''),
    productionDurableObjectNamespace: String(relay.productionDurableObjectNamespace ?? ''),
    devDurableObjectNamespace: String(relay.devDurableObjectNamespace ?? ''),
  };
  if (Object.values(relayConfiguration).some((entry) => entry === '')) {
    throw Object.assign(new Error('candidateEvidence.relayConfiguration contains an empty identity.'), { code: 'delivery_candidate_evidence_invalid' });
  }
  if (!Array.isArray(input.nodeEvidence) || !Array.isArray(input.proofs)) {
    throw Object.assign(new Error('candidateEvidence nodeEvidence and proofs must be arrays.'), { code: 'delivery_candidate_evidence_invalid' });
  }
  const nodeEvidence = input.nodeEvidence.map((entryValue, index) => {
    const entry = exactObject(entryValue, `candidateEvidence.nodeEvidence[${index}]`, [
      'nodeId', 'observedAt', 'projectIds', 'release', 'federationPhase', 'activeExecutionCount',
      'pendingExecutionCount', 'pendingProcessQueueDepth', 'pausedScopeCount', 'fatalIncidentCount',
      'stateRuntimeDirtyCount', 'statePendingDeliveryCount', 'contentQueueDepth',
      'unavailableContentResourceCount', 'convergedProjectIds',
    ]);
    const release = exactObject(entry.release, `candidateEvidence.nodeEvidence[${index}].release`, [
      'ok', 'status', 'observedAt', 'releaseSha', 'processStartedAt', 'deliveryProtocol',
      'activeReleasePointer', 'activeIncidentCount',
    ]);
    const identifiers = (value: unknown, field: string): string[] => {
      if (!Array.isArray(value)) throw Object.assign(new Error(`${field} must be an array.`), { code: 'delivery_candidate_evidence_invalid' });
      const result = value.map((item) => String(item ?? '')).sort();
      if (
        result.some((item) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(item))
        || new Set(result).size !== result.length
      ) throw Object.assign(new Error(`${field} contains an invalid identity.`), { code: 'delivery_candidate_evidence_invalid' });
      return result;
    };
    const count = (field: string): number => {
      const value = entry[field];
      if (!Number.isSafeInteger(value) || Number(value) < 0) {
        throw Object.assign(new Error(`candidateEvidence.nodeEvidence[${index}].${field} must be a non-negative integer.`), {
          code: 'delivery_candidate_evidence_invalid',
        });
      }
      return Number(value);
    };
    if (
      release.ok !== true
      || release.status !== 'ready'
      || release.deliveryProtocol !== decisionOsDeliveryProtocol
      || !Number.isSafeInteger(release.activeIncidentCount)
      || Number(release.activeIncidentCount) < 0
    ) throw Object.assign(new Error(`candidateEvidence.nodeEvidence[${index}].release is invalid.`), { code: 'delivery_candidate_evidence_invalid' });
    const releaseSha = sha(release.releaseSha, `candidateEvidence.nodeEvidence[${index}].release.releaseSha`);
    const processStartedAt = timestamp(release.processStartedAt, `candidateEvidence.nodeEvidence[${index}].release.processStartedAt`);
    return {
      nodeId: String(entry.nodeId ?? ''),
      observedAt: timestamp(entry.observedAt, `candidateEvidence.nodeEvidence[${index}].observedAt`),
      projectIds: identifiers(entry.projectIds, `candidateEvidence.nodeEvidence[${index}].projectIds`),
      release: {
        ok: true,
        status: 'ready',
        observedAt: timestamp(release.observedAt, `candidateEvidence.nodeEvidence[${index}].release.observedAt`),
        releaseSha,
        processStartedAt,
        deliveryProtocol: decisionOsDeliveryProtocol,
        activeReleasePointer: String(release.activeReleasePointer ?? ''),
        activeIncidentCount: Number(release.activeIncidentCount),
      },
      federationPhase: String(entry.federationPhase ?? ''),
      activeExecutionCount: count('activeExecutionCount'),
      pendingExecutionCount: count('pendingExecutionCount'),
      pendingProcessQueueDepth: count('pendingProcessQueueDepth'),
      pausedScopeCount: count('pausedScopeCount'),
      fatalIncidentCount: count('fatalIncidentCount'),
      stateRuntimeDirtyCount: count('stateRuntimeDirtyCount'),
      statePendingDeliveryCount: count('statePendingDeliveryCount'),
      contentQueueDepth: count('contentQueueDepth'),
      unavailableContentResourceCount: count('unavailableContentResourceCount'),
      convergedProjectIds: identifiers(entry.convergedProjectIds, `candidateEvidence.nodeEvidence[${index}].convergedProjectIds`),
    } satisfies DeliveryNodeAdmissionEvidence;
  });
  const nodeIds = nodeEvidence.map((entry) => entry.nodeId);
  if (
    nodeIds.some((nodeId) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(nodeId))
    || new Set(nodeIds).size !== nodeIds.length
    || nodeEvidence.some((entry) => !Number.isFinite(Date.parse(String(entry?.observedAt ?? ''))))
  ) throw Object.assign(new Error('candidateEvidence.nodeEvidence identities are invalid.'), { code: 'delivery_candidate_evidence_invalid' });
  const proofs = input.proofs.map((proofValue, index) => {
    const proof = exactObject(proofValue, `candidateEvidence.proofs[${index}]`, [
      'proof', 'status', 'releaseSha', 'observedAt', 'receiptId',
    ]);
    return {
      proof: String(proof.proof ?? '') as DeliveryAdmissionProof['proof'],
      status: proof.status as 'passed',
      releaseSha: String(proof.releaseSha ?? ''),
      observedAt: String(proof.observedAt ?? ''),
      receiptId: String(proof.receiptId ?? ''),
    };
  });
  const proofNames = proofs.map((proof) => proof?.proof);
  if (
    proofs.length !== deliveryAdmissionProofNames.length
    || deliveryAdmissionProofNames.some((name) => !proofNames.includes(name))
    || new Set(proofNames).size !== proofNames.length
    || proofs.some((proof) => (
      proof.status !== 'passed'
      || sha(proof.releaseSha, `candidateEvidence.proofs.${proof.proof}.releaseSha`) !== releaseSha
      || !proof.receiptId
      || !Number.isFinite(Date.parse(proof.observedAt))
    ))
  ) throw Object.assign(new Error('candidateEvidence.proofs are invalid.'), { code: 'delivery_candidate_evidence_invalid' });
  const document = {
    protocol: decisionOsDeliveryProtocol,
    releaseSha,
    relayConfiguration,
    nodeEvidence,
    proofs,
  } satisfies DeliveryCandidateEvidenceDocument;
  if (Buffer.byteLength(JSON.stringify(document), 'utf8') > maximumDeliveryDocumentBytes) {
    throw Object.assign(new Error('candidateEvidence exceeds the delivery document limit.'), { code: 'delivery_candidate_evidence_too_large' });
  }
  return document;
}

export function writeDeliveryCandidateEvidence(input: {
  catalogRoot: string;
  evidence: unknown;
  persistenceHooks?: DeliveryPersistenceHooks;
}): { file: string; evidence: DeliveryCandidateEvidenceDocument } {
  const evidence = validateDeliveryCandidateEvidence(input.evidence);
  const file = resolve(input.catalogRoot, '.decision-os', 'delivery', 'candidate-evidence.json');
  atomicWriteDeliveryJson({ file, value: evidence, hooks: input.persistenceHooks });
  return { file, evidence: structuredClone(evidence) };
}
