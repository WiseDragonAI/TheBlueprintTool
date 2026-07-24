/**
 * WHAT: Defines and validates the federation transport and epoch-4 state admission contract.
 * WHY: Incompatible nodes must be rejected before they participate in replicated state.
 */
import { taskCurrentBaselineEpoch, taskCurrentStateVersion, taskStateProtocol } from '../../shared/task-current-state-core';

export const protocolVersion = 1;
export const stateProtocol = taskStateProtocol;
export const stateSchema = taskCurrentStateVersion;
export const stateBaselineEpoch = taskCurrentBaselineEpoch;
export const maximumStateFrameBytes = 512 * 1024;
export const chunkBytes = 64 * 1024;
export const creditWindowBytes = 1024 * 1024;
export const maximumBodyBytes = 25 * 1024 * 1024;
export const maximumStreamsPerNode = 32;

export const priorityStateFrameTypes = new Set([
  'state-entity-batch',
  'state-relay-ack',
  'state-ack',
  'state-summary-request',
  'state-bucket-summary',
  'state-missing-request',
  'state-converged',
  'state-subscribe',
  'state-execution-observation',
]);

export type ProjectManifest = {
  id: string;
  name: string;
  description: string;
  color: string;
  ledgers: Array<{ id: string; title: string; ledgerFile: string }>;
};

export type RelayFrame = {
  version: 1;
  type: string;
  requestId?: string;
  to?: string;
  from?: string;
  direction?: 'request' | 'response';
  bytes?: number;
  data?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  status?: number;
  nodeLabel?: string;
  projects?: ProjectManifest[];
  nodes?: Array<{ nodeId: string; nodeLabel: string; online: boolean; projects: ProjectManifest[] }>;
  code?: string;
  message?: string;
  projectId?: string;
  stateVersion?: typeof taskCurrentStateVersion;
  stateProtocol?: typeof stateProtocol;
  stateSchema?: typeof stateSchema;
  baselineEpoch?: typeof stateBaselineEpoch;
  payload?: unknown;
};

export function parseFrame(value: string): RelayFrame {
  const frame = JSON.parse(value) as RelayFrame;
  if (frame.version !== protocolVersion || typeof frame.type !== 'string') throw new Error('invalid_frame');
  return frame;
}

export function assertStateManifest(frame: RelayFrame): void {
  if (frame.stateProtocol !== stateProtocol || frame.stateSchema !== stateSchema || frame.baselineEpoch !== stateBaselineEpoch) throw new Error('incompatible_state_protocol');
}

export function encodedByteLength(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}
