/**
 * WHAT: Reconciles node-local project catalog rows into logical projects with replica addresses.
 * WHY: Node identity selects a route; it must never become part of persisted project identity.
 */
type AnyRecord = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function federatedProjectCatalog(input: {
  localProjects: AnyRecord[];
  remoteProjects: AnyRecord[];
  localNode: { nodeId: string; nodeLabel: string };
}): AnyRecord[] {
  const rows = [
    ...input.localProjects.map((project) => ({
      ...project,
      id: text(project.id),
      nodeId: input.localNode.nodeId,
      nodeLabel: input.localNode.nodeLabel,
      online: project.available !== false,
      local: true,
    })),
    ...input.remoteProjects.map((project) => ({
      ...project,
      id: text(project.localProjectId) || text(project.id),
      nodeId: text(project.ownerNodeId),
      nodeLabel: text(project.ownerNodeLabel),
      online: project.online !== false,
      local: false,
    })),
  ];
  const groups = new Map<string, AnyRecord[]>();
  for (const row of rows) {
    const projectId = text(row.id);
    if (!projectId) continue;
    groups.set(projectId, [...(groups.get(projectId) ?? []), row]);
  }
  return [...groups.entries()].map(([projectId, replicas]) => {
    const authority = [...replicas].sort((left, right) => text(left.nodeId).localeCompare(text(right.nodeId)))[0];
    const ledgers = new Map<string, unknown>();
    for (const replica of replicas) {
      for (const ledger of Array.isArray(replica.ledgers) ? replica.ledgers : []) {
        const ledgerId = text((ledger as AnyRecord)?.id);
        if (ledgerId && !ledgers.has(ledgerId)) ledgers.set(ledgerId, ledger);
      }
    }
    const project = {
      ...authority,
      id: projectId,
      ledgers: [...ledgers.values()],
      available: replicas.some((replica) => replica.online !== false || replica.local === true),
      replicaCount: replicas.length,
      replicas: [...replicas].sort((left, right) => text(left.nodeId).localeCompare(text(right.nodeId))).map((replica) => ({
        projectId,
        nodeId: replica.nodeId,
        nodeLabel: replica.nodeLabel,
        online: replica.online,
        local: replica.local,
        available: replica.available,
        replica: replica.replica,
      })),
    };
    for (const key of ['nodeId', 'nodeLabel', 'online', 'local', 'ownerNodeId', 'ownerNodeLabel', 'remote', 'localProjectId']) delete project[key];
    return project;
  });
}
