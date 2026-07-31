/** WHAT: Verifies owner-aware runtime incident projection and the unified project status shell. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { groupedActiveIncidents, loadRuntimeDiagnostics, projectRuntimeRows } from '../src/app/responsive/runtime-status.js';

const observedAt = '2026-07-31T12:00:00.000Z';
const projects = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
];

test('keeps availability authority separate from rolling occurrence history', () => {
  const rows = projectRuntimeRows([
    { id: 'paused', name: 'Paused project', replicas: [{ online: true, available: true }] },
    { id: 'offline', name: 'Offline project', replicas: [{ online: false, available: false }] },
    { id: 'ready', name: 'Ready project', replicas: [{ online: true, available: true }] },
  ], {
    observedAt,
    incidentHistoryVersion: 2,
    historyTruncatedBefore: '',
    incidents: [],
    pausedTaskProjectIds: ['paused'],
  });
  assert.deepEqual(rows.map(({ id, status, occurrences }) => ({ id, status, occurrences })), [
    { id: 'paused', status: 'paused', occurrences: 0 },
    { id: 'offline', status: 'unavailable', occurrences: 0 },
    { id: 'ready', status: 'available', occurrences: 0 },
  ]);
  assert.equal(rows[0].detail, 'Task state');
  assert.deepEqual(rows.map((row) => row.occurrencesPartial), [false, false, false]);
});

test('groups by verified owner plus code and retains distinct dated message evidence', () => {
  const incidents = [
    {
      id: 'alpha-paused',
      status: 'paused',
      code: 'shared_failure',
      message: 'First alpha message.',
      severity: 'warning',
      component: 'alpha-worker',
      scope: 'http-request:/p/beta/ledgers/tasks',
      context: { projectId: 'alpha', runId: 'run-alpha' },
      occurrences: 3,
      observations: [
        '2026-07-30T11:59:59.999Z',
        '2026-07-30T12:00:00.000Z',
        '2026-07-31T10:00:00.000Z',
      ],
      legacyHistoryBefore: '',
    },
    {
      id: 'alpha-resolved',
      status: 'resolved',
      code: 'shared_failure',
      message: 'Second alpha message.',
      severity: 'fatal',
      component: 'alpha-runtime',
      scope: 'project-runtime:alpha',
      context: { projectId: 'alpha', runId: 'run-resolved' },
      occurrences: 1,
      observations: ['2026-07-31T11:00:00.000Z'],
      legacyHistoryBefore: '',
    },
    {
      id: 'beta-resolved',
      status: 'resolved',
      code: 'shared_failure',
      message: 'Beta message.',
      severity: 'error',
      component: 'beta-runtime',
      scope: 'project-runtime:beta',
      context: {},
      occurrences: 1,
      observations: ['2026-07-31T09:00:00.000Z'],
      legacyHistoryBefore: '',
    },
    {
      id: 'system-resolved',
      status: 'resolved',
      code: 'system_history',
      message: 'Resolved System evidence.',
      severity: 'warning',
      component: 'catalog',
      scope: 'catalog:unknown',
      context: { source: 'catalog' },
      occurrences: 1,
      observations: ['2026-07-31T08:00:00.000Z'],
      legacyHistoryBefore: '',
    },
    {
      id: 'expired-resolved',
      status: 'resolved',
      code: 'expired_history',
      message: 'Expired.',
      severity: 'fatal',
      component: 'alpha-old',
      scope: 'project-runtime:alpha',
      context: { projectId: 'alpha' },
      occurrences: 1,
      observations: ['2026-07-30T11:59:59.999Z'],
      legacyHistoryBefore: '',
    },
  ];
  const diagnostics = {
    observedAt,
    incidentHistoryVersion: 2,
    historyTruncatedBefore: '',
    incidents,
    pausedProjectRuntimeIds: ['alpha'],
  };
  const groups = groupedActiveIncidents(diagnostics, projects);
  const alpha = groups.find((group) => group.ownerId === 'alpha' && group.code === 'shared_failure');
  const beta = groups.find((group) => group.ownerId === 'beta');
  const system = groups.find((group) => group.ownerId === '');
  assert.equal(groups.length, 3);
  assert.equal(alpha.incidentCount, 2);
  assert.equal(alpha.activeIncidentCount, 1);
  assert.equal(alpha.occurrences, 3);
  assert.equal(alpha.severity, 'fatal');
  assert.equal(alpha.interrupting, false);
  assert.equal(alpha.firstObservedAt, '2026-07-30T12:00:00.000Z');
  assert.equal(alpha.lastObservedAt, '2026-07-31T11:00:00.000Z');
  assert.deepEqual(alpha.components, ['alpha-runtime', 'alpha-worker']);
  assert.deepEqual(alpha.events.map(({ observedAt: date, message, status, context }) => ({ date, message, status, context })), [
    { date: '2026-07-31T11:00:00.000Z', message: 'Second alpha message.', status: 'resolved', context: { projectId: 'alpha', runId: 'run-resolved' } },
    { date: '2026-07-31T10:00:00.000Z', message: 'First alpha message.', status: 'paused', context: { projectId: 'alpha', runId: 'run-alpha' } },
    { date: '2026-07-30T12:00:00.000Z', message: 'First alpha message.', status: 'paused', context: { projectId: 'alpha', runId: 'run-alpha' } },
  ]);
  assert.equal(beta.occurrences, 1);
  assert.equal(system.occurrences, 1);
  assert.equal(system.interrupting, false);
  assert.equal(groupedActiveIncidents({ ...diagnostics, incidents: [...incidents].reverse() }, projects).find((group) => group.ownerId === 'alpha').severity, 'fatal');

  const rows = projectRuntimeRows(projects, diagnostics);
  assert.deepEqual(rows.map(({ id, status, occurrences }) => ({ id, status, occurrences })), [
    { id: 'alpha', status: 'paused', occurrences: 3 },
    { id: 'beta', status: 'available', occurrences: 1 },
    { id: 'system', status: 'available', occurrences: 1 },
  ]);
  assert.equal(rows[2].label, 'History');
  assert.equal(rows[2].incidents[0].activeIncidentCount, 0);
});

test('propagates owner-scoped legacy lower bounds and expires them after their boundary leaves the window', () => {
  const diagnostics = {
    observedAt,
    incidentHistoryVersion: 1,
    historyTruncatedBefore: '',
    incidents: [{
      id: 'legacy-alpha',
      status: 'resolved',
      code: 'legacy_failure',
      message: 'Legacy evidence.',
      severity: 'error',
      component: 'legacy-runtime',
      scope: 'project-runtime:alpha',
      context: { projectId: 'alpha' },
      occurrences: 5,
      lastObservedAt: '2026-07-30T12:00:00.000Z',
    }],
  };
  const [legacyGroup] = groupedActiveIncidents(diagnostics, projects);
  const [alpha] = projectRuntimeRows(projects, diagnostics);
  assert.equal(legacyGroup.occurrences, 1);
  assert.equal(legacyGroup.legacyHistory, true);
  assert.equal(legacyGroup.occurrencesPartial, true);
  assert.equal(alpha.occurrences, 1);
  assert.equal(alpha.occurrencesPartial, true);

  const exactRows = projectRuntimeRows(projects, {
    ...diagnostics,
    incidentHistoryVersion: 2,
    incidents: [{
      ...diagnostics.incidents[0],
      observations: ['2026-07-31T10:00:00.000Z'],
      legacyHistoryBefore: '2026-07-30T11:59:59.999Z',
    }],
  });
  assert.equal(exactRows[0].occurrences, 1);
  assert.equal(exactRows[0].legacyHistory, false);
  assert.equal(exactRows[0].occurrencesPartial, false);
});

test('keeps document truncation partial through the inclusive cutoff and ignores invalid event timestamps', () => {
  const diagnostics = {
    observedAt,
    incidentHistoryVersion: 2,
    historyTruncatedBefore: '2026-07-30T12:00:00.000Z',
    incidents: [{
      id: 'alpha-current',
      status: 'resolved',
      code: 'timestamp_filter',
      message: 'Timestamp evidence.',
      severity: 'error',
      component: 'alpha-runtime',
      scope: 'project-runtime:alpha',
      context: { projectId: 'alpha' },
      occurrences: 4,
      observations: [
        'invalid',
        '2026-07-30T11:59:59.999Z',
        '2026-07-31T12:00:00.000Z',
        '2026-07-31T12:00:00.001Z',
      ],
      legacyHistoryBefore: '',
    }],
  };
  const [group] = groupedActiveIncidents(diagnostics, projects);
  const rows = projectRuntimeRows(projects, diagnostics);
  assert.equal(group.occurrences, 1);
  assert.deepEqual(group.events.map((event) => event.observedAt), ['2026-07-31T12:00:00.000Z']);
  assert.equal(group.truncatedHistory, true);
  assert.equal(group.occurrencesPartial, true);
  assert.deepEqual(rows.map((row) => row.occurrencesPartial), [true, true]);

  const exactRows = projectRuntimeRows(projects, {
    ...diagnostics,
    historyTruncatedBefore: '2026-07-30T11:59:59.999Z',
  });
  assert.deepEqual(exactRows.map((row) => row.occurrencesPartial), [false, false]);
  assert.deepEqual(exactRows.map((row) => row.id), ['alpha', 'beta']);
});

test('keeps a hosted project available when only its derived federation cache is paused', () => {
  const diagnostics = {
    observedAt,
    incidentHistoryVersion: 2,
    historyTruncatedBefore: '',
    pausedFederatedTaskProjectIds: ['hosted'],
    incidents: [{
      id: 'hosted-federated',
      status: 'paused',
      code: 'unsupported_task_current_state_format',
      message: 'unsupported_task_current_state_format',
      component: 'federation-task-state',
      scope: 'federated-task-state:hosted',
      occurrences: 1,
      observations: ['2026-07-31T10:00:00.000Z'],
      legacyHistoryBefore: '',
    }],
  };
  const [row] = projectRuntimeRows([{ id: 'hosted', name: 'Hosted project', available: true, replicas: [] }], diagnostics);
  const [incident] = groupedActiveIncidents(diagnostics, [{ id: 'hosted' }]);
  assert.equal(row.status, 'available');
  assert.equal(row.detail, 'Local project available');
  assert.equal(row.occurrences, 1);
  assert.equal(incident.interrupting, true);
});

test('loads diagnostics from the current server without cache', async () => {
  let request;
  const diagnostics = await loadRuntimeDiagnostics(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ status: 'ready' }) };
  }, { signal: 'signal' });
  assert.deepEqual(diagnostics, { status: 'ready' });
  assert.deepEqual(request, {
    url: '/api/diagnostics/incidents',
    options: { cache: 'no-store', signal: 'signal' },
  });
});

test('exposes one initially collapsed project hierarchy with rolling dated evidence', async () => {
  const [source, html, css] = await Promise.all([
    readFile(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../assets/runtime-status.css', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /destination\('System status', '\/status'/);
  assert.match(source, /owner\.route\.pathname === '\/status'/);
  assert.match(source, /document\.createElement\('details'\)/);
  assert.match(source, /document\.createElement\('summary'\)/);
  assert.doesNotMatch(source, /row\.open\s*=/);
  assert.match(source, /formatOccurrenceTotal\(project\.occurrences, project\.occurrencesPartial\)/);
  assert.match(source, /for \(const event of incident\.events\)/);
  assert.match(source, /document\.createElement\('time'\)/);
  assert.match(source, /textContent: event\.message/);
  assert.match(source, /Lower bound:/);
  assert.match(css, /\.runtime-project-summary-state/);
  assert.match(css, /\.runtime-incident-event/);
  assert.match(css, /\.runtime-incident-source/);
  assert.match(html, /id="runtime-status-view"/);
  assert.match(html, /id="runtime-project-list"/);
  assert.doesNotMatch(html, /Current interruptions and errors/);
  assert.doesNotMatch(html, /runtime-incident-status-summary/);
  assert.doesNotMatch(html, /runtime-incident-list/);
  assert.doesNotMatch(source, /'runtime-incident-status-summary'/);
  assert.doesNotMatch(source, /elements\['runtime-incident-list'\]/);
});
