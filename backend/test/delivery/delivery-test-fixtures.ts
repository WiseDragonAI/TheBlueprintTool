import type {
  DeliveryNodeReceipt,
  DeliveryRun,
} from '../../../shared/schemas/decision-os-delivery-types.js';

export const admittedSha = 'a'.repeat(40);
export const priorSha = 'b'.repeat(40);

export function deliveryRun(overrides: Partial<DeliveryRun> = {}): DeliveryRun {
  return {
    protocol: 1,
    deliveryId: 'delivery-test-1',
    admittedSha,
    priorMainSha: priorSha,
    mainSha: null,
    phase: 'created',
    status: 'running',
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z',
    topology: {
      capturedAt: '',
      fingerprint: '',
      admittedNodeIds: [],
      zeroProjectNodeIds: [],
    },
    relay: {
      priorDeploymentId: '',
      uploadedVersionId: '',
      activeVersionId: '',
    },
    nodes: [],
    activationOrder: [],
    phaseReceipts: [],
    compensationReceipts: [],
    artifactPaths: [],
    deadlines: [],
    retries: [],
    failure: null,
    ...overrides,
  };
}

export function deliveryNodeReceipt(overrides: Partial<DeliveryNodeReceipt> = {}): DeliveryNodeReceipt {
  return {
    protocol: 1,
    receiptId: 'receipt-test-1',
    deliveryId: 'delivery-test-1',
    nodeId: 'workstation',
    action: 'preflight',
    targetCommit: admittedSha,
    expectedCommit: priorSha,
    status: 'accepted',
    attempt: 1,
    startedAt: '2026-07-28T00:00:00.000Z',
    completedAt: '',
    previousCommit: priorSha,
    activeCommit: priorSha,
    processIdentity: 'linux:123:456',
    command: null,
    evidence: [],
    error: null,
    ...overrides,
  };
}
