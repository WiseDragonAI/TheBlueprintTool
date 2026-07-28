/**
 * WHAT: Defines the strict protocol-1 delivery journal, command, and receipt contracts.
 * WHY: Delivery recovery must reject ambiguous durable state before any external mutation.
 */
export const decisionOsDeliveryProtocol = 1 as const;
export const maximumDeliveryDocumentBytes = 1024 * 1024;
export const maximumDeliveryEvidenceEntries = 1_000;

export const deliveryNodeActions = [
  'preflight',
  'prepare',
  'activate',
  'status',
  'rollback',
] as const;
export type DeliveryNodeAction = typeof deliveryNodeActions[number];

export const deliveryPhases = [
  'created',
  'preflight',
  'admission',
  'main-promotion',
  'node-preparation',
  'relay-upload',
  'relay-activation',
  'node-activation',
  'final-verification',
  'compensation',
  'complete',
] as const;
export type DeliveryPhase = typeof deliveryPhases[number];

export const deliveryRunStatuses = [
  'running',
  'admission-rejected',
  'paused',
  'rolled-back-runtime',
  'partial',
  'compensation-failed',
  'complete',
] as const;
export type DeliveryRunStatus = typeof deliveryRunStatuses[number];
export type DeliveryTerminalStatus = Exclude<DeliveryRunStatus, 'running'>;
export type DeliveryExitCode = 0 | 2 | 3 | 4;

export const deliveryTerminalExitCodes: Readonly<Record<DeliveryTerminalStatus, DeliveryExitCode>> = Object.freeze({
  complete: 0,
  'admission-rejected': 2,
  paused: 3,
  'rolled-back-runtime': 3,
  partial: 3,
  'compensation-failed': 4,
});

export function deliveryExitCodeForStatus(status: DeliveryRunStatus): DeliveryExitCode | null {
  return status === 'running' ? null : deliveryTerminalExitCodes[status];
}

export type DeliveryNodeCommand = {
  deliveryId: string;
  action: DeliveryNodeAction;
  targetCommit: string;
  expectedCommit: string;
};

export type DeliveryCommandEvidence = {
  redactedArguments: string[];
  stdoutArtifact: string;
  stderrArtifact: string;
};

export type DeliveryEvidenceEntry = {
  key: string;
  value: string | number | boolean | null;
};

export type DeliveryPhaseReceipt = {
  receiptId: string;
  phase: DeliveryPhase;
  operation: string;
  status: 'started' | 'succeeded' | 'failed';
  nodeId: string;
  commitSha: string | null;
  startedAt: string;
  completedAt: string;
  command: DeliveryCommandEvidence | null;
  evidence: DeliveryEvidenceEntry[];
};

export type DeliveryNodeState = {
  nodeId: string;
  priorReleaseSha: string | null;
  stagedReleaseSha: string | null;
  activeReleaseSha: string | null;
  processIdentity: string;
  state: 'admitted' | 'prepared' | 'active' | 'rolled-back' | 'failed';
};

export type DeliveryRun = {
  protocol: typeof decisionOsDeliveryProtocol;
  deliveryId: string;
  admittedSha: string;
  priorMainSha: string | null;
  mainSha: string | null;
  phase: DeliveryPhase;
  status: DeliveryRunStatus;
  createdAt: string;
  updatedAt: string;
  topology: {
    capturedAt: string;
    fingerprint: string;
    admittedNodeIds: string[];
    zeroProjectNodeIds: string[];
  };
  relay: {
    priorDeploymentId: string;
    uploadedVersionId: string;
    activeVersionId: string;
  };
  nodes: DeliveryNodeState[];
  activationOrder: string[];
  phaseReceipts: DeliveryPhaseReceipt[];
  compensationReceipts: DeliveryPhaseReceipt[];
  artifactPaths: string[];
  deadlines: Array<{ operation: string; deadlineAt: string }>;
  retries: Array<{ operation: string; attempts: number; maximumAttempts: number }>;
  failure: {
    code: string;
    message: string;
    phase: DeliveryPhase;
    nodeId: string;
    observedAt: string;
  } | null;
};

export type DeliveryNodeReceipt = {
  protocol: typeof decisionOsDeliveryProtocol;
  receiptId: string;
  deliveryId: string;
  nodeId: string;
  action: DeliveryNodeAction;
  targetCommit: string;
  expectedCommit: string;
  status: 'accepted' | 'complete' | 'failed';
  attempt: number;
  startedAt: string;
  completedAt: string;
  previousCommit: string | null;
  activeCommit: string | null;
  processIdentity: string;
  command: DeliveryCommandEvidence | null;
  evidence: DeliveryEvidenceEntry[];
  error: { code: string; message: string } | null;
};

export class DeliverySchemaError extends Error {
  readonly code = 'delivery_schema_invalid';

  constructor(readonly field: string, message: string) {
    super(`${field}: ${message}`);
    this.name = 'DeliverySchemaError';
  }
}

type AnyRecord = Record<string, unknown>;

function record(value: unknown, field: string, keys: readonly string[]): AnyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new DeliverySchemaError(field, 'must be an object');
  }
  const actual = Object.keys(value as AnyRecord);
  const unknown = actual.find((key) => !keys.includes(key));
  if (unknown) throw new DeliverySchemaError(`${field}.${unknown}`, 'is not supported by protocol 1');
  const missing = keys.find((key) => !Object.hasOwn(value as AnyRecord, key));
  if (missing) throw new DeliverySchemaError(`${field}.${missing}`, 'is required');
  return value as AnyRecord;
}

function text(value: unknown, field: string, maximum = 2_000, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0) || value.includes('\0')) {
    throw new DeliverySchemaError(field, `must be ${allowEmpty ? 'a' : 'a non-empty'} string of at most ${maximum} characters`);
  }
  return value;
}

function identifier(value: unknown, field: string): string {
  const result = text(value, field, 240);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result)) {
    throw new DeliverySchemaError(field, 'must be a stable identifier');
  }
  return result;
}

function sha(value: unknown, field: string): string {
  const result = text(value, field, 40);
  if (!/^[a-f0-9]{40}$/.test(result)) throw new DeliverySchemaError(field, 'must be a lowercase 40-character Git SHA');
  return result;
}

function nullableSha(value: unknown, field: string): string | null {
  return value === null ? null : sha(value, field);
}

function timestamp(value: unknown, field: string, allowEmpty = false): string {
  const result = text(value, field, 64, allowEmpty);
  if (allowEmpty && result === '') return result;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new DeliverySchemaError(field, 'must be an ISO-8601 UTC timestamp');
  }
  return result;
}

function integer(value: unknown, field: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > maximum) {
    throw new DeliverySchemaError(field, `must be an integer between 0 and ${maximum}`);
  }
  return Number(value);
}

function enumeration<T extends string>(value: unknown, field: string, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new DeliverySchemaError(field, `must be one of ${values.join(', ')}`);
  }
  return value as T;
}

function array<T>(
  value: unknown,
  field: string,
  parser: (entry: unknown, entryField: string) => T,
  maximum = maximumDeliveryEvidenceEntries,
): T[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new DeliverySchemaError(field, `must be an array with at most ${maximum} entries`);
  }
  return value.map((entry, index) => parser(entry, `${field}[${index}]`));
}

function uniqueIdentifiers(value: unknown, field: string): string[] {
  const values = array(value, field, identifier);
  if (new Set(values).size !== values.length) throw new DeliverySchemaError(field, 'must not contain duplicate identifiers');
  return values;
}

const sensitiveArgument = /(?:authorization|cookie|private[_-]?key|api[_-]?token|access[_-]?token|bearer\s+|sk-[A-Za-z0-9])/i;
const sensitiveAssignment = /\b(authorization|cookie|private[_-]?key|api[_-]?token|access[_-]?token|cloudflare_api_token|cloudflare_account_id|token|secret|password)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi;
const bearer = /\bBearer\s+[A-Za-z0-9._~+/-]+/gi;
const openAiToken = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const credentialArgument = /(?:^|\s)(?:--?(?:token|key|password|secret|authorization|cookie|identity-file)|-i)(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)/gi;
const unixPath = /(?:^|[\s("'=:])\/(?:home|Users|data|tmp|var|etc|opt|srv|mnt|media|private)\/[^\s"',;)}\]]+/g;
const windowsPath = /\b[A-Za-z]:\\[^\s"',;)}\]]+/g;

export function redactDeliveryText(value: unknown, maximum = 4_000): string {
  const bounded = String(value ?? '').slice(0, Math.max(0, maximum));
  return bounded
    .replace(bearer, 'Bearer [REDACTED]')
    .replace(openAiToken, '[REDACTED]')
    .replace(sensitiveAssignment, (_match, name: string, separator: string) => `${name}${separator}[REDACTED]`)
    .replace(credentialArgument, ' [REDACTED_ARGUMENT]')
    .replace(unixPath, (match) => `${match[0] === '/' ? '' : match[0]}[REDACTED_PATH]`)
    .replace(windowsPath, '[REDACTED_PATH]');
}

export function redactDeliveryCommandArguments(arguments_: readonly string[]): string[] {
  return arguments_.slice(0, 128).map((argument) => {
    const bounded = redactDeliveryText(argument, 1_000);
    return sensitiveArgument.test(bounded) ? '[REDACTED]' : bounded;
  });
}

function commandEvidence(value: unknown, field: string): DeliveryCommandEvidence | null {
  if (value === null) return null;
  const input = record(value, field, ['redactedArguments', 'stdoutArtifact', 'stderrArtifact']);
  const redactedArguments = array(input.redactedArguments, `${field}.redactedArguments`, (entry, entryField) => {
    const argument = text(entry, entryField, 1_000, true);
    if (sensitiveArgument.test(argument)) throw new DeliverySchemaError(entryField, 'contains unredacted sensitive material');
    return argument;
  }, 128);
  return {
    redactedArguments,
    stdoutArtifact: text(input.stdoutArtifact, `${field}.stdoutArtifact`, 2_048, true),
    stderrArtifact: text(input.stderrArtifact, `${field}.stderrArtifact`, 2_048, true),
  };
}

function evidenceEntry(value: unknown, field: string): DeliveryEvidenceEntry {
  const input = record(value, field, ['key', 'value']);
  const evidenceValue = input.value;
  if (
    evidenceValue !== null
    && typeof evidenceValue !== 'string'
    && typeof evidenceValue !== 'number'
    && typeof evidenceValue !== 'boolean'
  ) throw new DeliverySchemaError(`${field}.value`, 'must be a scalar');
  if (typeof evidenceValue === 'string') text(evidenceValue, `${field}.value`, 4_000, true);
  if (typeof evidenceValue === 'number' && !Number.isFinite(evidenceValue)) {
    throw new DeliverySchemaError(`${field}.value`, 'must be finite');
  }
  return { key: identifier(input.key, `${field}.key`), value: evidenceValue as DeliveryEvidenceEntry['value'] };
}

function phaseReceipt(value: unknown, field: string): DeliveryPhaseReceipt {
  const input = record(value, field, [
    'receiptId', 'phase', 'operation', 'status', 'nodeId', 'commitSha',
    'startedAt', 'completedAt', 'command', 'evidence',
  ]);
  const status = enumeration(input.status, `${field}.status`, ['started', 'succeeded', 'failed'] as const);
  const completedAt = timestamp(input.completedAt, `${field}.completedAt`, true);
  if (status === 'started' && completedAt) {
    throw new DeliverySchemaError(`${field}.completedAt`, 'must be empty while the receipt is started');
  }
  if (status !== 'started' && !completedAt) {
    throw new DeliverySchemaError(`${field}.completedAt`, 'is required when the receipt is settled');
  }
  return {
    receiptId: identifier(input.receiptId, `${field}.receiptId`),
    phase: enumeration(input.phase, `${field}.phase`, deliveryPhases),
    operation: identifier(input.operation, `${field}.operation`),
    status,
    nodeId: text(input.nodeId, `${field}.nodeId`, 240, true),
    commitSha: nullableSha(input.commitSha, `${field}.commitSha`),
    startedAt: timestamp(input.startedAt, `${field}.startedAt`),
    completedAt,
    command: commandEvidence(input.command, `${field}.command`),
    evidence: array(input.evidence, `${field}.evidence`, evidenceEntry),
  };
}

function nodeState(value: unknown, field: string): DeliveryNodeState {
  const input = record(value, field, [
    'nodeId', 'priorReleaseSha', 'stagedReleaseSha', 'activeReleaseSha', 'processIdentity', 'state',
  ]);
  return {
    nodeId: identifier(input.nodeId, `${field}.nodeId`),
    priorReleaseSha: nullableSha(input.priorReleaseSha, `${field}.priorReleaseSha`),
    stagedReleaseSha: nullableSha(input.stagedReleaseSha, `${field}.stagedReleaseSha`),
    activeReleaseSha: nullableSha(input.activeReleaseSha, `${field}.activeReleaseSha`),
    processIdentity: text(input.processIdentity, `${field}.processIdentity`, 500, true),
    state: enumeration(input.state, `${field}.state`, ['admitted', 'prepared', 'active', 'rolled-back', 'failed'] as const),
  };
}

export function parseDeliveryNodeCommand(value: unknown): DeliveryNodeCommand {
  const input = record(value, 'deliveryNodeCommand', ['deliveryId', 'action', 'targetCommit', 'expectedCommit']);
  return {
    deliveryId: identifier(input.deliveryId, 'deliveryNodeCommand.deliveryId'),
    action: enumeration(input.action, 'deliveryNodeCommand.action', deliveryNodeActions),
    targetCommit: sha(input.targetCommit, 'deliveryNodeCommand.targetCommit'),
    expectedCommit: sha(input.expectedCommit, 'deliveryNodeCommand.expectedCommit'),
  };
}

export function parseDeliveryRun(value: unknown): DeliveryRun {
  const input = record(value, 'deliveryRun', [
    'protocol', 'deliveryId', 'admittedSha', 'priorMainSha', 'mainSha', 'phase', 'status',
    'createdAt', 'updatedAt', 'topology', 'relay', 'nodes', 'activationOrder',
    'phaseReceipts', 'compensationReceipts', 'artifactPaths', 'deadlines', 'retries', 'failure',
  ]);
  if (input.protocol !== decisionOsDeliveryProtocol) {
    throw new DeliverySchemaError('deliveryRun.protocol', 'must equal 1');
  }
  const topology = record(input.topology, 'deliveryRun.topology', [
    'capturedAt', 'fingerprint', 'admittedNodeIds', 'zeroProjectNodeIds',
  ]);
  const relay = record(input.relay, 'deliveryRun.relay', [
    'priorDeploymentId', 'uploadedVersionId', 'activeVersionId',
  ]);
  const nodes = array(input.nodes, 'deliveryRun.nodes', nodeState);
  const nodeIds = nodes.map((node) => node.nodeId);
  if (new Set(nodeIds).size !== nodeIds.length) throw new DeliverySchemaError('deliveryRun.nodes', 'must not repeat nodeId');
  const failure = input.failure === null ? null : (() => {
    const failed = record(input.failure, 'deliveryRun.failure', ['code', 'message', 'phase', 'nodeId', 'observedAt']);
    return {
      code: identifier(failed.code, 'deliveryRun.failure.code'),
      message: text(failed.message, 'deliveryRun.failure.message', 4_000),
      phase: enumeration(failed.phase, 'deliveryRun.failure.phase', deliveryPhases),
      nodeId: text(failed.nodeId, 'deliveryRun.failure.nodeId', 240, true),
      observedAt: timestamp(failed.observedAt, 'deliveryRun.failure.observedAt'),
    };
  })();
  const result: DeliveryRun = {
    protocol: decisionOsDeliveryProtocol,
    deliveryId: identifier(input.deliveryId, 'deliveryRun.deliveryId'),
    admittedSha: sha(input.admittedSha, 'deliveryRun.admittedSha'),
    priorMainSha: nullableSha(input.priorMainSha, 'deliveryRun.priorMainSha'),
    mainSha: nullableSha(input.mainSha, 'deliveryRun.mainSha'),
    phase: enumeration(input.phase, 'deliveryRun.phase', deliveryPhases),
    status: enumeration(input.status, 'deliveryRun.status', deliveryRunStatuses),
    createdAt: timestamp(input.createdAt, 'deliveryRun.createdAt'),
    updatedAt: timestamp(input.updatedAt, 'deliveryRun.updatedAt'),
    topology: {
      capturedAt: timestamp(topology.capturedAt, 'deliveryRun.topology.capturedAt', true),
      fingerprint: text(topology.fingerprint, 'deliveryRun.topology.fingerprint', 128, true),
      admittedNodeIds: uniqueIdentifiers(topology.admittedNodeIds, 'deliveryRun.topology.admittedNodeIds'),
      zeroProjectNodeIds: uniqueIdentifiers(topology.zeroProjectNodeIds, 'deliveryRun.topology.zeroProjectNodeIds'),
    },
    relay: {
      priorDeploymentId: text(relay.priorDeploymentId, 'deliveryRun.relay.priorDeploymentId', 500, true),
      uploadedVersionId: text(relay.uploadedVersionId, 'deliveryRun.relay.uploadedVersionId', 500, true),
      activeVersionId: text(relay.activeVersionId, 'deliveryRun.relay.activeVersionId', 500, true),
    },
    nodes,
    activationOrder: uniqueIdentifiers(input.activationOrder, 'deliveryRun.activationOrder'),
    phaseReceipts: array(input.phaseReceipts, 'deliveryRun.phaseReceipts', phaseReceipt),
    compensationReceipts: array(input.compensationReceipts, 'deliveryRun.compensationReceipts', phaseReceipt),
    artifactPaths: array(input.artifactPaths, 'deliveryRun.artifactPaths', (entry, field) => text(entry, field, 2_048), 256),
    deadlines: array(input.deadlines, 'deliveryRun.deadlines', (entry, field) => {
      const deadline = record(entry, field, ['operation', 'deadlineAt']);
      return {
        operation: identifier(deadline.operation, `${field}.operation`),
        deadlineAt: timestamp(deadline.deadlineAt, `${field}.deadlineAt`),
      };
    }, 256),
    retries: array(input.retries, 'deliveryRun.retries', (entry, field) => {
      const retry = record(entry, field, ['operation', 'attempts', 'maximumAttempts']);
      const attempts = integer(retry.attempts, `${field}.attempts`, 10_000);
      const maximumAttempts = integer(retry.maximumAttempts, `${field}.maximumAttempts`, 10_000);
      if (attempts > maximumAttempts) throw new DeliverySchemaError(field, 'attempts must not exceed maximumAttempts');
      return { operation: identifier(retry.operation, `${field}.operation`), attempts, maximumAttempts };
    }, 256),
    failure,
  };
  if (result.status === 'complete' && result.phase !== 'complete') {
    throw new DeliverySchemaError('deliveryRun.phase', 'must be complete when status is complete');
  }
  if (result.status !== 'running' && result.status !== 'complete' && !result.failure) {
    throw new DeliverySchemaError('deliveryRun.failure', 'is required for a non-success terminal status');
  }
  const admittedNodes = new Set(result.topology.admittedNodeIds);
  if (result.topology.zeroProjectNodeIds.some((nodeId) => admittedNodes.has(nodeId))) {
    throw new DeliverySchemaError('deliveryRun.topology', 'active and zero-project node identities must be disjoint');
  }
  if (
    result.topology.fingerprint
    && (
      result.nodes.length !== admittedNodes.size
      || result.nodes.some((node) => !admittedNodes.has(node.nodeId))
    )
  ) throw new DeliverySchemaError('deliveryRun.nodes', 'must exactly represent the frozen admitted topology');
  if (result.activationOrder.some((nodeId) => !admittedNodes.has(nodeId))) {
    throw new DeliverySchemaError('deliveryRun.activationOrder', 'must contain only admitted node identities');
  }
  return result;
}

export function parseDeliveryNodeReceipt(value: unknown): DeliveryNodeReceipt {
  const input = record(value, 'deliveryNodeReceipt', [
    'protocol', 'receiptId', 'deliveryId', 'nodeId', 'action', 'targetCommit',
    'expectedCommit', 'status', 'attempt', 'startedAt', 'completedAt', 'previousCommit',
    'activeCommit', 'processIdentity', 'command', 'evidence', 'error',
  ]);
  if (input.protocol !== decisionOsDeliveryProtocol) {
    throw new DeliverySchemaError('deliveryNodeReceipt.protocol', 'must equal 1');
  }
  const error = input.error === null ? null : (() => {
    const failed = record(input.error, 'deliveryNodeReceipt.error', ['code', 'message']);
    return {
      code: identifier(failed.code, 'deliveryNodeReceipt.error.code'),
      message: text(failed.message, 'deliveryNodeReceipt.error.message', 4_000),
    };
  })();
  const status = enumeration(input.status, 'deliveryNodeReceipt.status', ['accepted', 'complete', 'failed'] as const);
  if (status === 'failed' && !error) throw new DeliverySchemaError('deliveryNodeReceipt.error', 'is required for failed status');
  if (status !== 'failed' && error) throw new DeliverySchemaError('deliveryNodeReceipt.error', 'is allowed only for failed status');
  return {
    protocol: decisionOsDeliveryProtocol,
    receiptId: identifier(input.receiptId, 'deliveryNodeReceipt.receiptId'),
    deliveryId: identifier(input.deliveryId, 'deliveryNodeReceipt.deliveryId'),
    nodeId: identifier(input.nodeId, 'deliveryNodeReceipt.nodeId'),
    action: enumeration(input.action, 'deliveryNodeReceipt.action', deliveryNodeActions),
    targetCommit: sha(input.targetCommit, 'deliveryNodeReceipt.targetCommit'),
    expectedCommit: sha(input.expectedCommit, 'deliveryNodeReceipt.expectedCommit'),
    status,
    attempt: integer(input.attempt, 'deliveryNodeReceipt.attempt', 10_000),
    startedAt: timestamp(input.startedAt, 'deliveryNodeReceipt.startedAt'),
    completedAt: timestamp(input.completedAt, 'deliveryNodeReceipt.completedAt', true),
    previousCommit: nullableSha(input.previousCommit, 'deliveryNodeReceipt.previousCommit'),
    activeCommit: nullableSha(input.activeCommit, 'deliveryNodeReceipt.activeCommit'),
    processIdentity: text(input.processIdentity, 'deliveryNodeReceipt.processIdentity', 500, true),
    command: commandEvidence(input.command, 'deliveryNodeReceipt.command'),
    evidence: array(input.evidence, 'deliveryNodeReceipt.evidence', evidenceEntry),
    error,
  };
}
