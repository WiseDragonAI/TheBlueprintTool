/** WHAT: Verifies runtime diagnostics grouping and project pause projection. */
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
});

test('groups active incidents by error and sums occurrences without retaining resolved history', () => {
  const groups = groupedActiveIncidents({
    pausedBackgroundComponents: ['scheduler'],
    incidents: [
      { status: 'paused', code: 'read_timeout', message: 'Read timed out.', component: 'scheduler', scope: 'background:scheduler', occurrences: 3, lastObservedAt: '2026-07-29T10:00:00.000Z' },
      { status: 'paused', code: 'read_timeout', message: 'Read timed out.', component: 'scheduler', scope: 'http-request:one', occurrences: 2, lastObservedAt: '2026-07-29T10:01:00.000Z' },
      { status: 'resolved', code: 'read_timeout', message: 'Read timed out.', component: 'scheduler', scope: 'http-request:old', occurrences: 8 },
    ],
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].occurrences, 5);
  assert.equal(groups[0].incidentCount, 2);
  assert.equal(groups[0].interrupting, true);
  assert.deepEqual(groups[0].scopes, ['background:scheduler', 'http-request:one']);
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

test('exposes the status route from the existing navigation and responsive shell', async () => {
  const [source, html] = await Promise.all([
    readFile(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /destination\('System status', '\/status'/);
  assert.match(source, /owner\.route\.pathname === '\/status'/);
  assert.match(html, /id="runtime-status-view"/);
  assert.match(html, /Current interruptions and errors/);
});
