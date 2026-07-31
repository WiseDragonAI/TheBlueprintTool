import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createRuntimeIncidentLedger,
  type IncidentDocument,
} from '@backend/business/server/helper/runtime-incident-ledger.js';

type CurrentIncidentSnapshot = Extract<IncidentDocument, { version: 2 }>;

function legacyIncident(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'incident-legacy',
    fingerprint: 'legacy-fingerprint',
    status: 'resolved',
    severity: 'error',
    scope: 'project:legacy',
    component: 'task-state',
    operation: 'recover',
    code: 'legacy_failure',
    message: 'Legacy failure.',
    stack: '',
    context: { projectId: 'legacy' },
    firstObservedAt: '2026-07-30T10:00:00.000Z',
    lastObservedAt: '2026-07-30T11:00:00.000Z',
    occurrences: 3,
    resolvedAt: '2026-07-30T12:00:00.000Z',
    ...patch,
  };
}

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
  assert.deepEqual(repeated.observations, [
    '2026-07-22T00:00:00.000Z',
    '2026-07-22T00:00:01.000Z',
  ]);

  for (let index = 0; index < 12; index += 1) {
    ledger.record({ scope: `project:${index}`, component: 'task-state', operation: 'recover', error: new Error(`failure-${index}`) });
  }
  assert.equal(ledger.snapshot().incidents.length, 10);
  const target = ledger.active('project:11');
  assert.equal(target.length, 1);
  assert.deepEqual(ledger.resolveScope('project:11', 'Recovered after inspection.').map((incident) => incident.id), [target[0].id]);
  assert.equal(ledger.active('project:11').length, 0);
});

test('retains exact occurrence dates across reopen, prunes before the inclusive 24-hour cutoff, and preserves resolved history', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incident-history-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let observedAt = '2026-07-30T00:00:00.000Z';
  const ledger = createRuntimeIncidentLedger({ decisionOsRoot: root, now: () => new Date(observedAt) });
  const input = { scope: 'project:a', component: 'task-state', operation: 'recover', error: new Error('collision') };
  ledger.record(input);
  observedAt = '2026-07-30T00:30:00.000Z';
  ledger.record(input);

  observedAt = '2026-07-31T00:00:00.000Z';
  const reopened = createRuntimeIncidentLedger({ decisionOsRoot: root, now: () => new Date(observedAt) });
  const atInclusiveCutoff = reopened.record(input);
  assert.deepEqual(atInclusiveCutoff.observations, [
    '2026-07-30T00:00:00.000Z',
    '2026-07-30T00:30:00.000Z',
    '2026-07-31T00:00:00.000Z',
  ]);

  observedAt = '2026-07-31T00:00:00.001Z';
  const afterCutoff = reopened.record(input);
  assert.deepEqual(afterCutoff.observations, [
    '2026-07-30T00:30:00.000Z',
    '2026-07-31T00:00:00.000Z',
    '2026-07-31T00:00:00.001Z',
  ]);
  observedAt = '2026-07-31T00:01:00.000Z';
  reopened.resolveScope('project:a', 'Recovered.');
  const resolved = createRuntimeIncidentLedger({ decisionOsRoot: root }).snapshot().incidents[0];
  assert.equal(resolved?.status, 'resolved');
  assert.deepEqual(resolved?.observations, afterCutoff.observations);
});

test('keeps observation-cap loss partial through the inclusive cutoff and expires the watermark afterward', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incident-observation-cap-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let observedAt = '2026-07-30T00:00:00.000Z';
  const ledger = createRuntimeIncidentLedger({
    decisionOsRoot: root,
    maxObservationsPerIncident: 2,
    now: () => new Date(observedAt),
  });
  const repeated = { scope: 'project:a', component: 'task-state', operation: 'recover', error: new Error('collision') };
  ledger.record(repeated);
  observedAt = '2026-07-30T00:01:00.000Z';
  ledger.record(repeated);
  observedAt = '2026-07-30T00:02:00.000Z';
  ledger.record(repeated);
  const truncated = ledger.snapshot() as CurrentIncidentSnapshot;
  assert.equal(truncated.version, 2);
  assert.equal(truncated.historyTruncatedBefore, '2026-07-30T00:00:00.000Z');
  assert.deepEqual(truncated.incidents[0]?.observations, [
    '2026-07-30T00:01:00.000Z',
    '2026-07-30T00:02:00.000Z',
  ]);

  observedAt = '2026-07-31T00:00:00.000Z';
  ledger.record({ scope: 'project:b', component: 'task-state', operation: 'recover', error: new Error('other') });
  const inclusive = ledger.snapshot() as CurrentIncidentSnapshot;
  assert.equal(inclusive.historyTruncatedBefore, '2026-07-30T00:00:00.000Z');
  observedAt = '2026-07-31T00:00:00.001Z';
  ledger.record({ scope: 'project:c', component: 'task-state', operation: 'recover', error: new Error('third') });
  const exactAgain = ledger.snapshot() as CurrentIncidentSnapshot;
  assert.equal(exactAgain.historyTruncatedBefore, '');
});

test('marks recent whole-incident eviction and expires that global loss watermark after 24 hours', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incident-eviction-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  let observedAt = '2026-07-30T00:00:00.000Z';
  const ledger = createRuntimeIncidentLedger({ decisionOsRoot: root, maxIncidents: 10, now: () => new Date(observedAt) });
  // WHAT: Cross the ten-incident cap with deterministic minute-spaced observations.
  // WHY: The test must identify the exact newest timestamp lost through whole-incident eviction.
  for (let index = 0; index < 11; index += 1) {
    observedAt = new Date(Date.parse('2026-07-30T00:00:00.000Z') + index * 60_000).toISOString();
    ledger.record({ scope: `project:${index}`, component: 'task-state', operation: 'recover', error: new Error(`failure-${index}`) });
  }
  const truncated = ledger.snapshot() as CurrentIncidentSnapshot;
  assert.equal(truncated.incidents.length, 10);
  assert.equal(truncated.historyTruncatedBefore, '2026-07-30T00:00:00.000Z');

  observedAt = '2026-07-31T00:00:00.000Z';
  ledger.record({ scope: 'project:10', component: 'task-state', operation: 'recover', error: new Error('failure-10') });
  const inclusive = ledger.snapshot() as CurrentIncidentSnapshot;
  assert.equal(inclusive.historyTruncatedBefore, '2026-07-30T00:00:00.000Z');
  observedAt = '2026-07-31T00:00:00.001Z';
  ledger.record({ scope: 'project:10', component: 'task-state', operation: 'recover', error: new Error('failure-10') });
  const exactAgain = ledger.snapshot() as CurrentIncidentSnapshot;
  assert.equal(exactAgain.historyTruncatedBefore, '');
});

test('reads version 1 unchanged and upgrades on the next valid write without inventing its lifetime timeline', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incident-legacy-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'runtime-incidents.json');
  writeFileSync(file, `${JSON.stringify({ version: 1, updatedAt: '2026-07-30T12:00:00.000Z', incidents: [legacyIncident()] }, null, 2)}\n`);
  const ledger = createRuntimeIncidentLedger({
    decisionOsRoot: root,
    now: () => new Date('2026-07-30T13:00:00.000Z'),
  });
  const legacy = ledger.snapshot();
  assert.equal(legacy.version, 1);
  assert.equal(legacy.incidents[0]?.observations, undefined);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, 1);

  ledger.record({ scope: 'project:new', component: 'task-state', operation: 'recover', error: new Error('new failure') });
  const upgraded = ledger.snapshot();
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.incidents[0]?.observations, ['2026-07-30T11:00:00.000Z']);
  assert.equal(upgraded.incidents[0]?.legacyHistoryBefore, '2026-07-30T11:00:00.000Z');
  assert.deepEqual(upgraded.incidents[1]?.observations, ['2026-07-30T13:00:00.000Z']);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).version, 2);
});

test('rejects malformed version 2 while preserving its exact bytes', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incidents-malformed-v2-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'runtime-incidents.json');
  const malformedBytes = `${JSON.stringify({
    version: 2,
    updatedAt: '2026-07-30T12:00:00.000Z',
    historyTruncatedBefore: '',
    incidents: [{ ...legacyIncident(), observations: ['not-a-date'], legacyHistoryBefore: '' }],
  })}\n`;
  writeFileSync(file, malformedBytes);
  const ledger = createRuntimeIncidentLedger({ decisionOsRoot: root, now: () => new Date('2026-07-30T13:00:00.000Z') });
  assert.equal(ledger.snapshot().incidents[0]?.code, 'runtime_incident_ledger_corrupt');
  const backup = readdirSync(root).find((entry) => entry.startsWith('runtime-incidents.json.corrupt-'));
  assert.ok(backup);
  assert.equal(readFileSync(join(root, backup), 'utf8'), malformedBytes);
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

test('retains failed primary writes in the fallback ledger until explicit persistence recovery', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incidents-persistence-'));
  const primaryRoot = join(root, 'primary');
  const file = join(primaryRoot, 'runtime-incidents.json');
  context.after(() => {
    chmodSync(primaryRoot, 0o700);
    rmSync(root, { recursive: true, force: true });
  });
  mkdirSync(primaryRoot, { recursive: true });
  writeFileSync(file, `${JSON.stringify({ version: 2, updatedAt: '', historyTruncatedBefore: '', incidents: [] })}\n`);
  const originalBytes = readFileSync(file, 'utf8');
  const ledger = createRuntimeIncidentLedger({ decisionOsRoot: root, file, maxObservationsPerIncident: 2 });
  chmodSync(primaryRoot, 0o500);

  ledger.record({
    scope: 'background:proof',
    component: 'proof',
    operation: 'persist-proof',
    error: new Error('proof failure'),
  });
  ledger.record({ scope: 'background:proof', component: 'proof', operation: 'persist-proof', error: new Error('proof failure') });
  ledger.record({ scope: 'background:proof', component: 'proof', operation: 'persist-proof', error: new Error('proof failure') });

  assert.equal(readFileSync(file, 'utf8'), originalBytes);
  assert.deepEqual(
    ledger.active().map((incident) => incident.scope).sort(),
    ['background:proof', 'runtime-incident-ledger'],
  );
  assert.equal(
    ledger.active('runtime-incident-ledger')[0]?.observations?.length,
    2,
  );
  const pendingFile = join(root, 'runtime', 'runtime-incidents.pending.json');
  assert.equal(existsSync(pendingFile), true);
  const reopened = createRuntimeIncidentLedger({ decisionOsRoot: root, file });
  assert.deepEqual(
    reopened.active().map((incident) => incident.scope).sort(),
    ['background:proof', 'runtime-incident-ledger'],
  );

  chmodSync(primaryRoot, 0o700);
  const resolved = reopened.recoverPersistence('Primary incident persistence is writable again.');
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.scope, 'runtime-incident-ledger');
  assert.equal(existsSync(pendingFile), false);
  assert.deepEqual(reopened.active().map((incident) => incident.scope), ['background:proof']);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).incidents.length, 2);
});

test('preserves invalid pending-ledger bytes as an active blocker until explicit valid recovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-runtime-incidents-invalid-pending-'));
  const file = join(root, 'runtime-incidents.json');
  const pendingFile = join(root, 'runtime', 'runtime-incidents.pending.json');
  mkdirSync(join(root, 'runtime'), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ version: 2, updatedAt: '', historyTruncatedBefore: '', incidents: [] })}\n`);
  const invalid = '{"version":2,"incidents":';
  writeFileSync(pendingFile, invalid);
  try {
    const ledger = createRuntimeIncidentLedger({ decisionOsRoot: root, file });
    const blocker = ledger.active('runtime-incident-ledger')[0];
    assert.equal(blocker?.code, 'runtime_incident_ledger_pending_corrupt');
    assert.equal(blocker?.context.pendingFile, pendingFile);
    assert.equal(readFileSync(pendingFile, 'utf8'), invalid);
    ledger.record({
      scope: 'background:proof-during-pending-corruption',
      component: 'proof',
      operation: 'record-while-pending-invalid',
      error: new Error('Concurrent diagnostic evidence.'),
    });
    assert.equal(readFileSync(pendingFile, 'utf8'), invalid);
    assert.deepEqual(ledger.recoverPersistence('Still invalid.'), []);
    assert.equal(readFileSync(pendingFile, 'utf8'), invalid);

    writeFileSync(pendingFile, `${JSON.stringify({ version: 2, updatedAt: '', historyTruncatedBefore: '', incidents: [] })}\n`);
    const resolved = ledger.recoverPersistence('Pending evidence is structurally valid again.');
    assert.equal(resolved.some((incident) => incident.code === 'runtime_incident_ledger_pending_corrupt'), true);
    assert.equal(existsSync(pendingFile), false);
    assert.equal(ledger.active('runtime-incident-ledger').length, 0);
    assert.equal(ledger.active('background:proof-during-pending-corruption').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
