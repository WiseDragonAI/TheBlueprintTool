import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRuntimeIncidentLedger } from '@backend/business/server/helper/runtime-incident-ledger.js';

test('coalesces recurring incidents, bounds retention, and resolves one paused scope', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incidents-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let tick = 0;
  const ledger = createRuntimeIncidentLedger({
    decisionOsRoot: root,
    maxIncidents: 10,
    now: () => new Date(Date.UTC(2026, 6, 22, 0, 0, tick++)),
  });

  const first = ledger.record({ scope: 'project:a', component: 'task-state', operation: 'recover', error: new Error('collision') });
  const repeated = ledger.record({ scope: 'project:a', component: 'task-state', operation: 'recover', error: new Error('collision') });
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.occurrences, 2);

  for (let index = 0; index < 12; index += 1) {
    ledger.record({ scope: `project:${index}`, component: 'task-state', operation: 'recover', error: new Error(`failure-${index}`) });
  }
  assert.equal(ledger.snapshot().incidents.length, 10);
  const target = ledger.active('project:11');
  assert.equal(target.length, 1);
  assert.deepEqual(ledger.resolveScope('project:11', 'Recovered after inspection.').map((incident) => incident.id), [target[0].id]);
  assert.equal(ledger.active('project:11').length, 0);
});

test('preserves an invalid incident ledger and records the corruption before accepting new incidents', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incidents-corrupt-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'runtime-incidents.json');
  const corruptBytes = '{not-json';
  writeFileSync(file, corruptBytes);
  const ledger = createRuntimeIncidentLedger({
    decisionOsRoot: root,
    now: () => new Date('2026-07-22T00:00:00.000Z'),
  });

  const snapshot = ledger.snapshot();
  assert.equal(snapshot.incidents[0]?.code, 'runtime_incident_ledger_corrupt');
  const backup = readdirSync(root).find((entry) => entry.startsWith('runtime-incidents.json.corrupt-'));
  assert.ok(backup);
  assert.equal(readFileSync(join(root, backup), 'utf8'), corruptBytes);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).incidents[0].code, 'runtime_incident_ledger_corrupt');

  ledger.record({ scope: 'project:a', component: 'task-state', operation: 'recover', error: new Error('collision') });
  assert.deepEqual(ledger.active().map((incident) => incident.code), ['runtime_incident_ledger_corrupt', 'collision']);
});

test('retains incidents that own live pauses before newer diagnostic history', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incidents-protected-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let tick = 0;
  const protectedScopes = new Set(['project-task-state:protected']);
  const ledger = createRuntimeIncidentLedger({
    decisionOsRoot: root,
    maxIncidents: 10,
    protectedScopes: () => protectedScopes,
    now: () => new Date(Date.UTC(2026, 6, 22, 0, 0, tick++)),
  });
  const protectedIncident = ledger.record({
    scope: 'project-task-state:protected',
    component: 'task-state',
    operation: 'open',
    error: new Error('protected_failure'),
  });
  for (let index = 0; index < 20; index += 1) {
    ledger.record({
      scope: `http-request:${index}`,
      component: 'http-server',
      operation: 'handle',
      error: new Error(`request_failure_${index}`),
    });
  }
  const snapshot = ledger.snapshot();
  assert.equal(snapshot.incidents.length, 10);
  assert.equal(snapshot.incidents.some((incident) => incident.id === protectedIncident.id), true);
});
