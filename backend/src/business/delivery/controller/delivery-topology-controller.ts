/**
 * WHAT: Resolves and freezes the exact relay-manifest project-owner topology admitted for delivery.
 * WHY: Promotion must not continue after an owner identity, project set, or repository origin changes.
 */
import { createHash } from 'node:crypto';

export type DeliveryTopologyProject = {
  projectId: string;
  originFingerprint: string;
};

export type DeliveryTopologyNodeInput = {
  nodeId: string;
  nodeLabel: string;
  online: boolean;
  projects: DeliveryTopologyProject[];
};

export type DeliveryTopologyNode = {
  nodeId: string;
  nodeLabel: string;
  projects: DeliveryTopologyProject[];
};

export type FrozenDeliveryTopology = {
  capturedAt: string;
  fingerprint: string;
  activeNodes: DeliveryTopologyNode[];
  zeroProjectNodes: DeliveryTopologyNode[];
};

export class DeliveryTopologyError extends Error {
  readonly exitCode = 2;

  constructor(
    readonly code: string,
    message: string,
    readonly context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DeliveryTopologyError';
  }
}

function stableIdentity(value: unknown, field: string): string {
  const identity = String(value ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(identity)) {
    throw new DeliveryTopologyError('delivery_topology_identity_invalid', `${field} is not a stable identity.`, { field });
  }
  return identity;
}

function capturedAt(value: unknown): string {
  const timestamp = String(value ?? '');
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new DeliveryTopologyError('delivery_topology_evidence_missing', 'Topology evidence requires a valid capturedAt timestamp.', {
      field: 'capturedAt',
    });
  }
  return new Date(Date.parse(timestamp)).toISOString();
}

function normalizeProjects(nodeId: string, projectsInput: unknown): DeliveryTopologyProject[] {
  if (!Array.isArray(projectsInput)) {
    throw new DeliveryTopologyError('delivery_topology_evidence_missing', 'Relay topology projects are missing.', { nodeId });
  }
  const projects = projectsInput.flatMap((projectInput, index) => {
    const project = projectInput && typeof projectInput === 'object'
      ? projectInput as Record<string, unknown>
      : {};
    const projectId = stableIdentity(project.projectId, `nodes.${nodeId}.projects[${index}].projectId`);
    const originFingerprint = String(project.originFingerprint ?? '').trim();
    // WHAT: Exclude node-local projects that have no repository origin from delivery topology.
    // WHY: Federation keeps them visible but cannot synchronize them, so they cannot be convergence requirements for a release.
    if (!/^[a-f0-9]{64}$/.test(originFingerprint)) return [];
    return [{ projectId, originFingerprint }];
  }).sort((left, right) => (
    left.projectId.localeCompare(right.projectId)
    || left.originFingerprint.localeCompare(right.originFingerprint)
  ));
  const duplicate = projects.find((project, index) => (
    index > 0 && project.projectId === projects[index - 1].projectId
  ));
  if (duplicate) {
    throw new DeliveryTopologyError(
      'delivery_topology_project_duplicated',
      `Node ${nodeId} published project ${duplicate.projectId} more than once.`,
      { nodeId, projectId: duplicate.projectId },
    );
  }
  return projects;
}

function normalizedNodes(nodesInput: unknown): Array<DeliveryTopologyNode & { online: boolean }> {
  if (!Array.isArray(nodesInput) || nodesInput.length === 0) {
    throw new DeliveryTopologyError('delivery_topology_evidence_missing', 'Relay topology contains no authenticated node identities.');
  }
  const nodes = nodesInput.map((nodeInput, index) => {
    const node = nodeInput && typeof nodeInput === 'object'
      ? nodeInput as Record<string, unknown>
      : {};
    const nodeId = stableIdentity(node.nodeId, `nodes[${index}].nodeId`);
    const nodeLabel = String(node.nodeLabel ?? nodeId).trim() || nodeId;
    if (typeof node.online !== 'boolean') {
      throw new DeliveryTopologyError('delivery_topology_evidence_missing', `Node ${nodeId} is missing online evidence.`, { nodeId });
    }
    return {
      nodeId,
      nodeLabel,
      online: node.online,
      projects: normalizeProjects(nodeId, node.projects),
    };
  }).sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const duplicate = nodes.find((node, index) => index > 0 && node.nodeId === nodes[index - 1].nodeId);
  if (duplicate) {
    throw new DeliveryTopologyError(
      'delivery_topology_node_duplicated',
      `Relay topology contains node ${duplicate.nodeId} more than once.`,
      { nodeId: duplicate.nodeId },
    );
  }
  return nodes;
}

function fingerprint(nodes: DeliveryTopologyNode[]): string {
  return createHash('sha256').update(JSON.stringify(nodes.map((node) => ({
    nodeId: node.nodeId,
    projects: node.projects,
  })))).digest('hex');
}

export function freezeDeliveryTopology(input: {
  capturedAt: string;
  nodes: DeliveryTopologyNodeInput[];
  targetNodeId?: string;
}): FrozenDeliveryTopology {
  let selected = input.nodes;
  // WHAT: Scope production delivery topology to the explicitly configured coordinator node.
  // WHY: Nodes outside the production deployment target must not participate in release admission.
  if (input.targetNodeId !== undefined) {
    selected = input.nodes.filter((node) => node.nodeId === input.targetNodeId);
    // WHAT: Reject admission when the configured production coordinator is absent.
    // WHY: Ignoring unrelated nodes must never permit a deployment with no actual target.
    if (selected.length !== 1) {
      throw new DeliveryTopologyError(
        'delivery_target_node_missing',
        `Configured delivery node ${input.targetNodeId} is absent from the relay topology.`,
        { nodeId: input.targetNodeId },
      );
    }
  }
  const nodes = normalizedNodes(selected);
  const offlineOwner = nodes.find((node) => node.projects.length > 0 && !node.online);
  if (offlineOwner) {
    throw new DeliveryTopologyError(
      'delivery_active_node_offline',
      `Project-owning node ${offlineOwner.nodeId} is offline.`,
      { nodeId: offlineOwner.nodeId, projectIds: offlineOwner.projects.map((project) => project.projectId) },
    );
  }
  const activeNodes = nodes
    .filter((node) => node.projects.length > 0)
    .map(({ online: _online, ...node }) => node);
  const zeroProjectNodes = nodes
    .filter((node) => node.projects.length === 0)
    .map(({ online: _online, ...node }) => node);
  return {
    capturedAt: capturedAt(input.capturedAt),
    fingerprint: fingerprint([...activeNodes, ...zeroProjectNodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId))),
    activeNodes,
    zeroProjectNodes,
  };
}

export function assertDeliveryTopologyUnchanged(
  frozen: FrozenDeliveryTopology,
  observed: FrozenDeliveryTopology,
): void {
  if (
    frozen.fingerprint !== observed.fingerprint
    || JSON.stringify(frozen.activeNodes) !== JSON.stringify(observed.activeNodes)
    || JSON.stringify(frozen.zeroProjectNodes) !== JSON.stringify(observed.zeroProjectNodes)
  ) {
    throw new DeliveryTopologyError(
      'delivery_topology_changed',
      'The relay project-owner topology changed after it was frozen.',
      {
        admittedFingerprint: frozen.fingerprint,
        observedFingerprint: observed.fingerprint,
      },
    );
  }
}
