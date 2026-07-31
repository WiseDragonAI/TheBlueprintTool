/** WHAT: Projects runtime diagnostics into concise project and grouped incident status rows. */

const asArray = (value) => Array.isArray(value) ? value : [];
const asSet = (value) => new Set(asArray(value).map(String));
const severityRank = { warning: 1, error: 2, fatal: 3 };
const incidentHistoryWindowMs = 24 * 60 * 60 * 1_000;

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

function parsedTimestamp(value) {
  const timestamp = Date.parse(String(value || ''));
  // WHAT: Reject timestamps that cannot participate in numeric window comparisons.
  // WHY: Invalid incident evidence must be skipped instead of relying on lexicographic date ordering.
  if (!Number.isFinite(timestamp)) return null;
  return timestamp;
}

function rollingWindow(diagnostics) {
  const observedAt = parsedTimestamp(diagnostics?.observedAt);
  // WHAT: Refuse to evaluate rolling incident history without the server-provided observation anchor.
  // WHY: Client wall clocks and request completion times cannot define a consistent 24-hour boundary.
  if (observedAt === null) return null;
  return { observedAt, cutoff: observedAt - incidentHistoryWindowMs };
}

function timestampInWindow(value, window) {
  const timestamp = parsedTimestamp(value);
  return timestamp !== null && window !== null && timestamp >= window.cutoff && timestamp <= window.observedAt;
}

function incidentObservations(incident, window) {
  const observations = asArray(incident?.observations)
    .map(String)
    .filter((observedAt) => timestampInWindow(observedAt, window))
    .sort();
  // WHAT: Use persisted version-2 observations whenever that dated evidence exists.
  // WHY: Current ledgers already contain one actual timestamp per occurrence and need no compatibility fallback.
  if (Array.isArray(incident?.observations)) return observations;
  const lastObservedAt = String(incident?.lastObservedAt || '');
  // WHAT: Preserve the one dated event actually known for a readable legacy incident.
  // WHY: Its lifetime occurrence count cannot be expanded into a fabricated event timeline.
  if (timestampInWindow(lastObservedAt, window)) return [lastObservedAt];
  return [];
}

function incidentLegacyHistory(incident, diagnostics, observations, window) {
  const legacyHistoryBefore = String(incident?.legacyHistoryBefore || '');
  // WHAT: Honor the owner-scoped legacy loss marker persisted during a version-1 upgrade.
  // WHY: The retained observation count remains a lower bound while that marker intersects the window.
  if (timestampInWindow(legacyHistoryBefore, window)) return true;
  // WHAT: Treat an un-upgraded incident as incomplete only when its lifetime count exceeds its known dated evidence.
  // WHY: A single legacy occurrence with one valid last timestamp is exact and must not receive a false partial label.
  if (Number(diagnostics?.incidentHistoryVersion) === 1 || !Array.isArray(incident?.observations)) {
    return Math.max(0, Number(incident?.occurrences) || 0) > observations.length
      && timestampInWindow(incident?.lastObservedAt, window);
  }
  return false;
}

function documentHistoryTruncated(diagnostics, window) {
  return timestampInWindow(diagnostics?.historyTruncatedBefore, window);
}

function incidentEvent(incident, observedAt) {
  let status = 'resolved';
  // WHAT: Preserve paused status only for an incident that is currently active.
  // WHY: Event history must distinguish current evidence from retained resolved evidence.
  if (incident?.status === 'paused') status = 'paused';
  let context = {};
  // WHAT: Retain structured source context when the incident supplied it.
  // WHY: Operators need project, run, path, and operation evidence for each dated occurrence.
  if (incident?.context && typeof incident.context === 'object') context = incident.context;
  return {
    incidentId: String(incident?.id || ''),
    observedAt,
    message: String(incident?.message || incident?.code || 'Runtime error'),
    component: String(incident?.component || ''),
    scope: String(incident?.scope || ''),
    severity: normalizedSeverity(incident?.severity),
    status,
    context,
  };
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
  const window = rollingWindow(diagnostics);
  const truncatedHistory = documentHistoryTruncated(diagnostics, window);
  const rows = catalogProjects.map((project) => {
    const projectId = String(project?.id || '');
    const replicas = asArray(project?.replicas);
    const availableReplicas = replicas.filter((replica) => replica?.available !== false && replica?.online !== false);
    const pauseReasons = projectPauseReasons(projectId, diagnostics);
    const available = project?.available !== false && (replicas.length === 0 || availableReplicas.length > 0);
    const status = pauseReasons.length > 0 ? 'paused' : available ? 'available' : 'unavailable';
    const incidents = incidentsByOwner.get(projectId) ?? [];
    const legacyHistory = incidents.some((incident) => incident.legacyHistory);
    const occurrences = incidents.reduce((total, incident) => total + incident.occurrences, 0);
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
      occurrences,
      occurrencesPartial: window === null || truncatedHistory || legacyHistory,
      legacyHistory,
      truncatedHistory,
      incidents,
    };
  }).sort((left, right) => {
    const rank = { paused: 0, unavailable: 1, available: 2 };
    return rank[left.status] - rank[right.status] || left.name.localeCompare(right.name);
  });
  const systemIncidents = incidentsByOwner.get('') ?? [];
  // WHAT: Append one System disclosure for retained unowned history or an unowned active incident.
  // WHY: Resolved evidence remains relevant to the rolling total without becoming a current interruption.
  if (systemIncidents.length > 0) {
    const interrupting = systemIncidents.some((incident) => incident.interrupting);
    const active = systemIncidents.some((incident) => incident.activeIncidentCount > 0);
    const legacyHistory = systemIncidents.some((incident) => incident.legacyHistory);
    const occurrences = systemIncidents.reduce((total, incident) => total + incident.occurrences, 0);
    let status = 'available';
    let label = 'History';
    // WHAT: Present an active unowned failure as an unavailable System error.
    // WHY: Active unowned evidence has no project row whose availability status could disclose it.
    if (active) {
      status = 'unavailable';
      label = 'Error';
    }
    // WHAT: Elevate an interruption-scoped System failure above a non-interrupting active error.
    // WHY: A matching pause registry is the authoritative evidence that work is interrupted.
    if (interrupting) {
      status = 'paused';
      label = 'Interruption';
    }
    let occurrenceNoun = 'occurrences';
    // WHAT: Use the singular occurrence label for an exact count of one.
    // WHY: The System disclosure must remain grammatically precise without changing its numeric evidence.
    if (occurrences === 1) occurrenceNoun = 'occurrence';
    rows.push({
      kind: 'system',
      id: 'system',
      name: 'System',
      color: '#ffbd57',
      status,
      label,
      detail: `${occurrences} failure ${occurrenceNoun} in 24 hours`,
      occurrences,
      occurrencesPartial: window === null || truncatedHistory || legacyHistory,
      legacyHistory,
      truncatedHistory,
      incidents: systemIncidents,
    });
  }
  return rows;
}

export function groupedActiveIncidents(diagnostics, projects = []) {
  const interruptionScopeSet = interruptionScopes(diagnostics);
  const projectIds = new Set(asArray(projects).map((project) => String(project?.id || '')).filter(Boolean));
  const window = rollingWindow(diagnostics);
  const truncatedHistory = documentHistoryTruncated(diagnostics, window);
  const groups = new Map();
  // WHAT: Aggregate retained paused and resolved evidence after resolving its single verified catalog owner.
  // WHY: Rolling failure history is broader than the active incidents that independently govern availability.
  for (const incident of asArray(diagnostics?.incidents)) {
    const ownerId = incidentOwnerId(incident, projectIds);
    const code = String(incident?.code || 'runtime_error');
    const key = `${ownerId}\u0000${code}`;
    const observations = incidentObservations(incident, window);
    const active = incident?.status === 'paused';
    // WHAT: Exclude a settled incident when it has no valid observation inside the rolling window.
    // WHY: Resolved lifetime records must not inflate current 24-hour totals after their dated evidence expires.
    if (!active && observations.length === 0) continue;
    const incidentSeverity = normalizedSeverity(incident?.severity);
    const current = groups.get(key) ?? {
      ownerId,
      code,
      message: '',
      severity: incidentSeverity,
      components: new Set(),
      scopes: new Set(),
      incidentCount: 0,
      activeIncidentCount: 0,
      occurrences: 0,
      interrupting: false,
      firstObservedAt: '',
      lastObservedAt: '',
      legacyHistory: false,
      truncatedHistory,
      occurrencesPartial: window === null || truncatedHistory,
      events: [],
    };
    const scope = String(incident?.scope || '');
    if (incident?.component) current.components.add(String(incident.component));
    if (scope) current.scopes.add(scope);
    // WHAT: Retain an active incident message even when all of its dated observations have expired.
    // WHY: Availability evidence remains actionable independently of a zero rolling occurrence total.
    if (!current.message) current.message = String(incident?.message || code);
    current.incidentCount += 1;
    current.activeIncidentCount += Number(active);
    current.interrupting ||= active && interruptionScopeSet.has(scope);
    const legacyHistory = incidentLegacyHistory(incident, diagnostics, observations, window);
    current.legacyHistory ||= legacyHistory;
    current.occurrencesPartial ||= legacyHistory;
    // WHAT: Retain one source-complete event record for every dated occurrence inside the window.
    // WHY: Equal owner-and-code failures can have different messages and context that must remain independently visible.
    for (const observedAt of observations) current.events.push(incidentEvent(incident, observedAt));
    current.occurrences += observations.length;
    // WHAT: Retain the highest supported severity across every incident in this owner-scoped group.
    // WHY: fatal must outrank error and warning independently of durable incident order.
    if (severityRank[incidentSeverity] > severityRank[current.severity]) current.severity = incidentSeverity;
    const firstObservedAt = observations.at(0) ?? '';
    const lastObservedAt = observations.at(-1) ?? '';
    // WHAT: Keep the earliest non-empty first-observation timestamp for the aggregate.
    // WHY: The grouped row must retain the complete rolling interval rather than whichever incident was visited last.
    if (firstObservedAt && (!current.firstObservedAt || firstObservedAt < current.firstObservedAt)) current.firstObservedAt = firstObservedAt;
    // WHAT: Keep the latest last-observation timestamp for the aggregate.
    // WHY: Status rendering must identify the newest retained event across every owner-and-code record.
    if (lastObservedAt > current.lastObservedAt) current.lastObservedAt = lastObservedAt;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => {
    const events = group.events.sort((left, right) => (
      right.observedAt.localeCompare(left.observedAt)
      || left.message.localeCompare(right.message)
      || left.incidentId.localeCompare(right.incidentId)
    ));
    return {
      ...group,
      message: events[0]?.message ?? group.message,
      components: [...group.components].sort(),
      scopes: [...group.scopes].sort(),
      events,
    };
  }).sort((left, right) => (
    left.ownerId.localeCompare(right.ownerId)
    || Number(right.interrupting) - Number(left.interrupting)
    || right.lastObservedAt.localeCompare(left.lastObservedAt)
    || left.code.localeCompare(right.code)
  ));
}
