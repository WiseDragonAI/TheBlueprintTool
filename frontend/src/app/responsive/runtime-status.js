/** WHAT: Projects runtime diagnostics into concise project and grouped incident status rows. */

const asArray = (value) => Array.isArray(value) ? value : [];
const asSet = (value) => new Set(asArray(value).map(String));
const severityRank = { warning: 1, error: 2, fatal: 3 };

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

function normalizedSeverity(value) {
  const severity = String(value || 'error');
  // WHAT: Preserve the three supported incident severity labels and normalize every unknown value to error.
  // WHY: Aggregation needs a deterministic rank even when an older or malformed incident omits a supported label.
  if (severity === 'fatal' || severity === 'warning') return severity;
  return 'error';
}

function scopeProjectOwners(scope, projectIds) {
  const owners = new Set();
  const value = String(scope || '');
  const pathMatches = value.matchAll(/(?:^|:)\/p\/([^/?#:\s]+)(?=\/|[?#:]|$)/g);
  // WHAT: Inspect every project route segment embedded in the incident scope.
  // WHY: Request scopes may contain more than one path fragment and conflicting verified owners must remain unowned.
  for (const match of pathMatches) {
    let pathProjectId = match[1];
    try {
      pathProjectId = decodeURIComponent(pathProjectId);
    } catch {
      // WHAT: Keep an invalid encoded path segment unmatched instead of failing the status projection.
      // WHY: Runtime diagnostics are evidence and one malformed scope must not hide unrelated project status rows.
    }
    // WHAT: Accept a request-path owner only when the complete decoded project segment exists in the catalog.
    // WHY: Substring and unknown path segments must remain System-owned.
    if (projectIds.has(pathProjectId)) owners.add(pathProjectId);
  }
  // WHAT: Inspect every complete colon-delimited scope token for a catalog identity.
  // WHY: Component scopes encode project ownership as exact tokens rather than path segments.
  for (const token of value.split(':')) {
    // WHAT: Accept a colon-delimited owner only when the complete token exists in the catalog.
    // WHY: Exact token comparison prevents similarly named projects from claiming each other's incidents.
    if (projectIds.has(token)) owners.add(token);
  }
  return owners;
}

function incidentOwnerId(incident, projectIds) {
  const contextProjectId = String(incident?.context?.projectId || '');
  // WHAT: Give an exact catalog project in incident context precedence over every scope-derived owner.
  // WHY: The producer-provided project identity is more specific than transport and component scope text.
  if (projectIds.has(contextProjectId)) return contextProjectId;
  const scopeOwners = scopeProjectOwners(incident?.scope, projectIds);
  // WHAT: Attribute a scope-derived incident only when its lower-priority evidence names one catalog owner.
  // WHY: Unknown, substring-only, and conflicting scope owners must remain in the System row.
  if (scopeOwners.size === 1) return [...scopeOwners][0];
  return '';
}

export async function loadRuntimeDiagnostics(fetchImpl, options = {}) {
  const response = await fetchImpl('/api/diagnostics/incidents', { cache: 'no-store', ...options });
  if (!response.ok) throw new Error(`Could not load runtime diagnostics (${response.status}).`);
  return response.json();
}

export function projectRuntimeRows(projects, diagnostics) {
  const catalogProjects = asArray(projects);
  const incidentGroups = groupedActiveIncidents(diagnostics, catalogProjects);
  const incidentsByOwner = Map.groupBy(incidentGroups, (incident) => incident.ownerId);
  const rows = catalogProjects.map((project) => {
    const projectId = String(project?.id || '');
    const replicas = asArray(project?.replicas);
    const availableReplicas = replicas.filter((replica) => replica?.available !== false && replica?.online !== false);
    const pauseReasons = projectPauseReasons(projectId, diagnostics);
    const available = project?.available !== false && (replicas.length === 0 || availableReplicas.length > 0);
    const status = pauseReasons.length > 0 ? 'paused' : available ? 'available' : 'unavailable';
    return {
      kind: 'project',
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
      incidents: incidentsByOwner.get(projectId) ?? [],
    };
  }).sort((left, right) => {
    const rank = { paused: 0, unavailable: 1, available: 2 };
    return rank[left.status] - rank[right.status] || left.name.localeCompare(right.name);
  });
  const systemIncidents = incidentsByOwner.get('') ?? [];
  // WHAT: Append one System disclosure only when active incidents have no verified catalog owner.
  // WHY: Unowned evidence must stay visible without creating an empty permanent pseudo-project.
  if (systemIncidents.length > 0) {
    const interrupting = systemIncidents.some((incident) => incident.interrupting);
    rows.push({
      kind: 'system',
      id: 'system',
      name: 'System',
      color: '#ffbd57',
      status: interrupting ? 'paused' : 'unavailable',
      label: interrupting ? 'Interruption' : 'Error',
      detail: `${systemIncidents.length} active incident group${systemIncidents.length === 1 ? '' : 's'}`,
      incidents: systemIncidents,
    });
  }
  return rows;
}

export function groupedActiveIncidents(diagnostics, projects = []) {
  const interruptionScopeSet = interruptionScopes(diagnostics);
  const projectIds = new Set(asArray(projects).map((project) => String(project?.id || '')).filter(Boolean));
  const groups = new Map();
  // WHAT: Aggregate every active incident after resolving its single verified catalog owner.
  // WHY: Ownership must participate in the grouping key before equal code-and-message evidence can merge.
  for (const incident of activeIncidents(diagnostics)) {
    const ownerId = incidentOwnerId(incident, projectIds);
    const code = String(incident?.code || 'runtime_error');
    const message = String(incident?.message || code);
    const key = `${ownerId}\u0000${code}\u0000${message}`;
    const incidentSeverity = normalizedSeverity(incident?.severity);
    const current = groups.get(key) ?? {
      ownerId,
      code,
      message,
      severity: incidentSeverity,
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
    // WHAT: Retain the highest supported severity across every incident in this owner-scoped group.
    // WHY: fatal must outrank error and warning independently of durable incident order.
    if (severityRank[incidentSeverity] > severityRank[current.severity]) current.severity = incidentSeverity;
    const firstObservedAt = String(incident?.firstObservedAt || '');
    const lastObservedAt = String(incident?.lastObservedAt || '');
    // WHAT: Keep the earliest non-empty first-observation timestamp for the aggregate.
    // WHY: The grouped row must retain the complete observed lifetime rather than whichever record was visited last.
    if (firstObservedAt && (!current.firstObservedAt || firstObservedAt < current.firstObservedAt)) current.firstObservedAt = firstObservedAt;
    // WHAT: Keep the latest last-observation timestamp for the aggregate.
    // WHY: Status rendering must identify the newest evidence across every grouped record.
    if (lastObservedAt > current.lastObservedAt) current.lastObservedAt = lastObservedAt;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    components: [...group.components].sort(),
    scopes: [...group.scopes].sort(),
  })).sort((left, right) => (
    left.ownerId.localeCompare(right.ownerId)
    || Number(right.interrupting) - Number(left.interrupting)
    || right.lastObservedAt.localeCompare(left.lastObservedAt)
    || left.code.localeCompare(right.code)
  ));
}
