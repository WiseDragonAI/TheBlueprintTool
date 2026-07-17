export const protocolVersion = 1;
export const chunkBytes = 64 * 1024;
export const creditWindowBytes = 1024 * 1024;
export const maximumBodyBytes = 25 * 1024 * 1024;
export const maximumStreamsPerNode = 32;

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
  replicaVersion?: 1;
  projectId?: string;
  resource?: string;
  revision?: string;
};

export function parseFrame(value: string): RelayFrame {
  const frame = JSON.parse(value) as RelayFrame;
  if (frame.version !== protocolVersion || typeof frame.type !== 'string') throw new Error('invalid_frame');
  return frame;
}

export function encodedByteLength(value: string): number {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor(value.length * 3 / 4) - padding;
}
