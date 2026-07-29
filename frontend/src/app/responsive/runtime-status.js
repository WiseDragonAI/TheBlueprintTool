/** WHAT: Projects runtime diagnostics into concise project and grouped incident status rows. */

const asArray = (value) => Array.isArray(value) ? value : [];
const asSet = (value) => new Set(asArray(value).map(String));

function activeIncidents(diagnostics) {
  return asArray(diagnostics?.incidents).filter((incident) => incident?.status === 'paused');
}

function interruptionScopes(diagnostics) {
  const scopes = new Set();
  for (const projectId of asArray(diagnostics?.pausedTaskProjectIds)) scopes.add(`project-task-state:${projectId}`);
  for (const projectId of asArray(diagnostics?.pausedFederatedTaskProjectIds)) scopes.add(`federated-task-state:${projectId}`);
  for (const projectId of asArray(diagnostics?.pausedProjectWatcherIds)) scopes.add(`project-watcher:${projectId}`);
  for (const projectId of asArray(diagnostics?.pausedProjectRuntimeIds)) scopes.add(`project-runtime:${projectId}`);
  for (const component of asArray(diagnostics?.pausedBackgroundComponents)) scopes.add(`background:${component}`);
  if (activeIncidents(diagnostics).some((incident) => incident.scope === 'server-runtime')) scopes.add('server-runtime');
  return scopes;
}

function projectPauseReasons(projectId, diagnostics) {
  const reasons = [];
  if (activeIncidents(diagnostics).some((incident) => incident.scope === 'server-runtime')) reasons.push('Server runtime');
  if (asSet(diagnostics?.pausedTaskProjectIds).has(projectId)) reasons.push('Task state');
  if (asSet(diagnostics?.pausedProjectWatcherIds).has(projectId)) reasons.push('Project watcher');
  if (asSet(diagnostics?.pausedProjectRuntimeIds).has(projectId)) reasons.push('Project runtime');
  for (const component of asArray(diagnostics?.pausedBackgroundComponents).map(String)) {
    if (component.endsWith(`:${projectId}`)) reasons.push(component.slice(0, -(projectId.length + 1)).replaceAll('-', ' '));
  }
  return [...new Set(reasons)];
}

export async function loadRuntimeDiagnostics(fetchImpl, options = {}) {
  const response = await fetchImpl('/api/diagnostics/incidents', { cache: 'no-store', ...options });
  if (!response.ok) throw new Error(`Could not load runtime diagnostics (${response.status}).`);
  return response.json();
}

export function projectRuntimeRows(projects, diagnostics) {
  return asArray(projects).map((project) => {
    const projectId = String(project?.id || '');
    const replicas = asArray(project?.replicas);
    const availableReplicas = replicas.filter((replica) => replica?.available !== false && replica?.online !== false);
    const pauseReasons = projectPauseReasons(projectId, diagnostics);
    const available = project?.available !== false && (replicas.length === 0 || availableReplicas.length > 0);
    const status = pauseReasons.length > 0 ? 'paused' : available ? 'available' : 'unavailable';
    return {
      id: projectId,
      name: String(project?.name || projectId || 'Unknown project'),
      color: String(project?.color || '#38d9e8'),
      status,
      label: status === 'paused' ? 'Paused' : status === 'available' ? 'Available' : 'Unavailable',
      detail: pauseReasons.length > 0
        ? pauseReasons.join(', ')
        : replicas.length > 0
          ? `${availableReplicas.length}/${replicas.length} replicas available`
          : available ? 'Local project available' : 'Project unavailable',
    };
  }).sort((left, right) => {
    const rank = { paused: 0, unavailable: 1, available: 2 };
    return rank[left.status] - rank[right.status] || left.name.localeCompare(right.name);
  });
}

export function groupedActiveIncidents(diagnostics) {
  const interruptionScopeSet = interruptionScopes(diagnostics);
  const groups = new Map();
  for (const incident of activeIncidents(diagnostics)) {
    const code = String(incident?.code || 'runtime_error');
    const message = String(incident?.message || code);
    const key = `${code}\u0000${message}`;
    const current = groups.get(key) ?? {
      code,
      message,
      severity: String(incident?.severity || 'error'),
      components: new Set(),
      scopes: new Set(),
      incidentCount: 0,
      occurrences: 0,
      interrupting: false,
      firstObservedAt: '',
      lastObservedAt: '',
    };
    const scope = String(incident?.scope || '');
    if (incident?.component) current.components.add(String(incident.component));
    if (scope) current.scopes.add(scope);
    current.incidentCount += 1;
    current.occurrences += Math.max(1, Number(incident?.occurrences) || 1);
    current.interrupting ||= interruptionScopeSet.has(scope);
    if (incident?.severity === 'fatal') current.severity = 'fatal';
    const firstObservedAt = String(incident?.firstObservedAt || '');
    const lastObservedAt = String(incident?.lastObservedAt || '');
    if (firstObservedAt && (!current.firstObservedAt || firstObservedAt < current.firstObservedAt)) current.firstObservedAt = firstObservedAt;
    if (lastObservedAt > current.lastObservedAt) current.lastObservedAt = lastObservedAt;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    components: [...group.components].sort(),
    scopes: [...group.scopes].sort(),
  })).sort((left, right) => (
    Number(right.interrupting) - Number(left.interrupting)
    || right.lastObservedAt.localeCompare(left.lastObservedAt)
    || left.code.localeCompare(right.code)
  ));
}
