/** WHAT: Verifies owner-aware runtime incident projection and the unified project status shell. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { groupedActiveIncidents, loadRuntimeDiagnostics, projectRuntimeRows } from '../src/app/responsive/runtime-status.js';

test('projects every catalog project as paused, unavailable, or available', () => {
  const rows = projectRuntimeRows([
    { id: 'paused', name: 'Paused project', replicas: [{ online: true, available: true }] },
    { id: 'offline', name: 'Offline project', replicas: [{ online: false, available: false }] },
    { id: 'ready', name: 'Ready project', replicas: [{ online: true, available: true }] },
  ], {
    incidents: [],
    pausedTaskProjectIds: ['paused'],
  });
  assert.deepEqual(rows.map(({ id, status }) => ({ id, status })), [
    { id: 'paused', status: 'paused' },
    { id: 'offline', status: 'unavailable' },
    { id: 'ready', status: 'available' },
  ]);
  assert.equal(rows[0].detail, 'Task state');
  assert.deepEqual(rows.map((row) => row.incidents), [[], [], []]);
});

test('keeps a hosted project available when only its derived federation cache is paused', () => {
  const diagnostics = {
    pausedFederatedTaskProjectIds: ['hosted'],
    incidents: [{
      status: 'paused',
      code: 'unsupported_task_current_state_format',
      message: 'unsupported_task_current_state_format',
      component: 'federation-task-state',
      scope: 'federated-task-state:hosted',
      occurrences: 1,
      lastObservedAt: '2026-07-29T10:00:00.000Z',
    }],
  };
  const [row] = projectRuntimeRows([
    { id: 'hosted', name: 'Hosted project', available: true, replicas: [] },
  ], diagnostics);
  const [incident] = groupedActiveIncidents(diagnostics, [{ id: 'hosted' }]);
  assert.equal(row.status, 'available');
  assert.equal(row.detail, 'Local project available');
  assert.equal(row.incidents.length, 1);
  assert.equal(row.incidents[0].ownerId, 'hosted');
  assert.equal(incident.interrupting, true);
});

test('resolves exact owners, rejects false attribution, and retains complete owner-scoped aggregates', () => {
  const projects = [
    { id: 'alpha', name: 'Alpha' },
    { id: 'beta', name: 'Beta' },
  ];
  const incidents = [
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'fatal',
      component: 'alpha-worker',
      scope: 'http-request:/p/beta/ledgers/tasks',
      context: { projectId: 'alpha' },
      occurrences: 2,
      firstObservedAt: '2026-07-29T10:02:00.000Z',
      lastObservedAt: '2026-07-29T10:05:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'warning',
      component: 'alpha-runtime',
      scope: 'project-runtime:alpha',
      occurrences: 3,
      firstObservedAt: '2026-07-29T09:59:00.000Z',
      lastObservedAt: '2026-07-29T10:04:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'error',
      component: 'alpha-watcher',
      scope: 'project-watcher:alpha',
      occurrences: 1,
      firstObservedAt: '2026-07-29T10:01:00.000Z',
      lastObservedAt: '2026-07-29T10:07:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'warning',
      component: 'beta-http',
      scope: 'http-request:/p/beta/ledgers/tasks',
      occurrences: 4,
      firstObservedAt: '2026-07-29T10:00:00.000Z',
      lastObservedAt: '2026-07-29T10:03:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'error',
      component: 'beta-pipeline',
      scope: 'pipeline:beta:run-1',
      occurrences: 1,
      firstObservedAt: '2026-07-29T10:03:00.000Z',
      lastObservedAt: '2026-07-29T10:08:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'error',
      component: 'unknown-context',
      scope: 'project-runtime:unknown',
      context: { projectId: 'unknown' },
      occurrences: 2,
      firstObservedAt: '2026-07-29T10:00:00.000Z',
      lastObservedAt: '2026-07-29T10:06:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'warning',
      component: 'substring-scope',
      scope: 'background:prefix-alpha-suffix',
      occurrences: 1,
      firstObservedAt: '2026-07-29T10:00:00.000Z',
      lastObservedAt: '2026-07-29T10:04:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'warning',
      component: 'substring-path',
      scope: 'http-request:/p/alpha-extra/ledgers/tasks',
      occurrences: 1,
      firstObservedAt: '2026-07-29T10:00:00.000Z',
      lastObservedAt: '2026-07-29T10:05:00.000Z',
    },
    {
      status: 'paused',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'fatal',
      component: 'conflicting-scope',
      scope: 'relay:alpha:beta',
      occurrences: 1,
      firstObservedAt: '2026-07-29T09:58:00.000Z',
      lastObservedAt: '2026-07-29T10:09:00.000Z',
    },
    {
      status: 'resolved',
      code: 'shared_failure',
      message: 'Shared failure.',
      severity: 'fatal',
      component: 'resolved-history',
      scope: 'project-runtime:alpha',
      context: { projectId: 'alpha' },
      occurrences: 99,
      firstObservedAt: '2026-07-28T10:00:00.000Z',
      lastObservedAt: '2026-07-30T10:00:00.000Z',
    },
  ];
  const diagnostics = {
    incidents,
    pausedProjectRuntimeIds: ['alpha'],
    pausedProjectWatcherIds: ['alpha'],
  };
  const groups = groupedActiveIncidents(diagnostics, projects);
  const alpha = groups.find((group) => group.ownerId === 'alpha');
  const beta = groups.find((group) => group.ownerId === 'beta');
  const system = groups.find((group) => group.ownerId === '');
  assert.equal(groups.length, 3);
  assert.equal(alpha.severity, 'fatal');
  assert.equal(alpha.incidentCount, 3);
  assert.equal(alpha.occurrences, 6);
  assert.equal(alpha.interrupting, true);
  assert.deepEqual(alpha.components, ['alpha-runtime', 'alpha-watcher', 'alpha-worker']);
  assert.deepEqual(alpha.scopes, [
    'http-request:/p/beta/ledgers/tasks',
    'project-runtime:alpha',
    'project-watcher:alpha',
  ]);
  assert.equal(alpha.firstObservedAt, '2026-07-29T09:59:00.000Z');
  assert.equal(alpha.lastObservedAt, '2026-07-29T10:07:00.000Z');
  assert.equal(beta.severity, 'error');
  assert.equal(beta.incidentCount, 2);
  assert.equal(beta.occurrences, 5);
  assert.deepEqual(beta.components, ['beta-http', 'beta-pipeline']);
  assert.equal(system.severity, 'fatal');
  assert.equal(system.incidentCount, 4);
  assert.equal(system.occurrences, 5);
  assert.deepEqual(system.components, [
    'conflicting-scope',
    'substring-path',
    'substring-scope',
    'unknown-context',
  ]);
  assert.equal(groupedActiveIncidents({ ...diagnostics, incidents: [...incidents].reverse() }, projects).find((group) => group.ownerId === 'alpha').severity, 'fatal');
  assert.equal(groupedActiveIncidents({ ...diagnostics, incidents: [...incidents].reverse() }, projects).find((group) => group.ownerId === 'beta').severity, 'error');
  const rows = projectRuntimeRows(projects, diagnostics);
  assert.deepEqual(rows.map(({ id, kind }) => ({ id, kind })), [
    { id: 'alpha', kind: 'project' },
    { id: 'beta', kind: 'project' },
    { id: 'system', kind: 'system' },
  ]);
  assert.equal(rows[0].incidents[0].ownerId, 'alpha');
  assert.equal(rows[1].incidents[0].ownerId, 'beta');
  assert.equal(rows[2].incidents[0].ownerId, '');
});

test('omits the System row when every active incident has one verified catalog owner', () => {
  const rows = projectRuntimeRows([{ id: 'known', name: 'Known project' }], {
    incidents: [{
      status: 'paused',
      code: 'known_failure',
      message: 'Known failure.',
      severity: 'error',
      component: 'project-runtime',
      scope: 'project-runtime:known',
      occurrences: 1,
      lastObservedAt: '2026-07-29T11:00:00.000Z',
    }],
  });
  assert.deepEqual(rows.map((row) => row.id), ['known']);
  assert.equal(rows[0].incidents.length, 1);
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

test('exposes one expandable project hierarchy without the standalone incident shell', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /destination\('System status', '\/status'/);
  assert.match(source, /owner\.route\.pathname === '\/status'/);
  assert.match(source, /document\.createElement\('details'\)/);
  assert.match(source, /document\.createElement\('summary'\)/);
  assert.match(source, /row\.open = project\.incidents\.length > 0/);
  assert.match(html, /id="runtime-status-view"/);
  assert.match(html, /id="runtime-project-list"/);
  assert.doesNotMatch(html, /Current interruptions and errors/);
  assert.doesNotMatch(html, /runtime-incident-status-summary/);
  assert.doesNotMatch(html, /runtime-incident-list/);
  assert.doesNotMatch(source, /'runtime-incident-status-summary'/);
  assert.doesNotMatch(source, /elements\['runtime-incident-list'\]/);
});
