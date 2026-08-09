/**
 * WHAT: Proves bounded project dependency watching and missed-event recovery.
 * WHY: Registered project views must reconstruct without recursive catalog scans.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watchCardContentFiles } from '@backend/business/refresh/helper/watch-card-content-files.js';
import { watchProjectFiles, type ProjectFileChange } from '@backend/business/refresh/helper/watch-project-files.js';

function waitForChange(changes: ProjectFileChange[], predicate: (change: ProjectFileChange) => boolean): Promise<ProjectFileChange> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 2_000;
    const poll = (): void => {
      const change = changes.find(predicate);
      // WHAT: Resolve only after the expected scoped event arrives.
      // WHY: Native filesystem delivery is asynchronous.
      if (change) {
        resolve(change);
        return;
      }
      // WHAT: Fail with bounded timing evidence.
      // WHY: Watcher regressions must not leave the test process hanging.
      if (Date.now() >= deadline) {
        reject(new Error('Timed out waiting for project file change.'));
        return;
      }
      setTimeout(poll, 20);
    };
    poll();
  });
}

test('watches state, registered ledgers, and ledgers canvas for one project', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-project-watch-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  mkdirSync(join(decisionOsRoot, 'cards'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  const stateFile = join(decisionOsRoot, 'state.json');
  const ledgerFile = join(decisionOsRoot, 'specs.json');
  const canvasFile = join(decisionOsRoot, 'ledgers-canvas.json');
  writeFileSync(stateFile, JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(ledgerFile, JSON.stringify({ cards: [] }));
  writeFileSync(canvasFile, JSON.stringify({ cards: [] }));
  const changes: ProjectFileChange[] = [];
  const watcher = watchProjectFiles({
    decisionOsRoot,
    onContentChange: () => undefined,
    onProjectChange: (change) => changes.push(change),
    auditIntervalMs: 10_000,
  });

  try {
    writeFileSync(ledgerFile, JSON.stringify({ cards: [{ id: 'changed' }] }));
    const ledgerChange = await waitForChange(changes, (change) => change.kind === 'ledger');
    assert.equal(ledgerChange.ledgerId, 'specs');

    writeFileSync(canvasFile, JSON.stringify({ cards: [{ id: 'ledger-card:specs' }] }));
    assert.equal((await waitForChange(changes, (change) => change.kind === 'ledgers-canvas')).file, canvasFile);

    writeFileSync(stateFile, JSON.stringify({ ledgers: [] }));
    assert.equal((await waitForChange(changes, (change) => change.kind === 'state')).file, stateFile);
  } finally {
    await watcher.close();
  }
});

test('suppresses marked server writes and audits only known dependencies', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-project-audit-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const stateFile = join(decisionOsRoot, 'state.json');
  const ledgerFile = join(decisionOsRoot, 'specs.json');
  writeFileSync(stateFile, JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(ledgerFile, JSON.stringify({ cards: [] }));
  const changes: ProjectFileChange[] = [];
  const watcher = watchProjectFiles({
    decisionOsRoot,
    onContentChange: () => undefined,
    onProjectChange: (change) => changes.push(change),
    auditIntervalMs: 30,
  });

  try {
    watcher.ignoreNext(ledgerFile);
    writeFileSync(ledgerFile, JSON.stringify({ cards: [{ id: 'internal' }] }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(changes.some((change) => change.kind === 'ledger'), false);
  } finally {
    await watcher.close();
  }
});

test('captures synchronous project callback failures without escaping the watcher timer', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-project-watch-error-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const stateFile = join(decisionOsRoot, 'state.json');
  const ledgerFile = join(decisionOsRoot, 'specs.json');
  writeFileSync(stateFile, JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(ledgerFile, JSON.stringify({ cards: [] }));
  const errors: Array<{ error: unknown; operation: string; file: string }> = [];
  const watcher = watchProjectFiles({
    decisionOsRoot,
    onContentChange: () => undefined,
    onProjectChange: () => { throw new Error('project-callback-failed'); },
    onError: (error, context) => errors.push({ error, ...context }),
    auditIntervalMs: 10_000,
  });

  try {
    writeFileSync(ledgerFile, JSON.stringify({ cards: [{ id: 'changed' }] }));
    const deadline = Date.now() + 2_000;
    while (errors.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(errors.length, 1);
    assert.match(String(errors[0].error), /project-callback-failed/);
    assert.equal(errors[0].operation, 'publish-project-change');
    assert.equal(errors[0].file, ledgerFile);
  } finally {
    await watcher.close();
  }
});

test('retries one failed content publication once without reporting a recovered failure', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-retry-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const contentFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }],
  }));
  writeFileSync(contentFile, '# Initial\n');
  let attempts = 0;
  const errors: unknown[] = [];
  const watcher = watchCardContentFiles({
    decisionOsRoot,
    onChange: () => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient-publication-failure');
    },
    onError: (error) => errors.push(error),
  });

  try {
    writeFileSync(contentFile, '# Changed\n');
    const deadline = Date.now() + 2_000;
    while (attempts < 2 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(attempts, 2);
    assert.deepEqual(errors, []);
  } finally {
    await watcher.close();
  }
});

test('flushes one exact pending content path without publishing unrelated editor work', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-exact-flush-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const firstFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  const secondFile = join(decisionOsRoot, 'cards', 'tasks', 'card-b.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [
      { id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } },
      { id: 'card-b', comment: { contentFile: '.decision-os/cards/tasks/card-b.md' } },
    ],
  }));
  writeFileSync(firstFile, '# Initial A\n');
  writeFileSync(secondFile, '# Initial B\n');
  const changes: string[] = [];
  const watcher = watchCardContentFiles({
    decisionOsRoot,
    onChange: (change) => { changes.push(change.file); },
  });

  try {
    writeFileSync(firstFile, '# Changed A\n');
    writeFileSync(secondFile, '# Changed B\n');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await watcher.flushFile(firstFile);
    assert.deepEqual(result, { observed: true, settled: true });
    assert.deepEqual(changes, [firstFile]);
    assert.deepEqual(await watcher.flushFile(join(decisionOsRoot, 'cards', 'tasks', 'missing.md')), {
      observed: false,
      settled: false,
    });
  } finally {
    await watcher.close();
  }
});

test('ownership refresh attaches a watcher to a newly committed content directory', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-new-directory-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const contentFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  mkdirSync(join(decisionOsRoot, 'cards'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
    ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }],
  }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [] }));
  let projection: Record<string, unknown> = { cards: [] };
  const changes: string[] = [];
  const watcher = watchCardContentFiles({
    decisionOsRoot,
    taskProjection: () => projection,
    onChange: (change) => { changes.push(change.file); },
  });

  try {
    mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
    writeFileSync(contentFile, '# Initial\n');
    projection = { cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }] };
    watcher.refreshOwnership();
    writeFileSync(contentFile, '# External edit\n');
    const deadline = Date.now() + 2_000;
    while (changes.length === 0 && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    assert.deepEqual(changes, [contentFile]);
  } finally {
    await watcher.close();
  }
});

test('watcher recovery audit reprocesses a preserved edit after task ownership becomes available', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-delayed-ownership-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const contentFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [] }));
  writeFileSync(contentFile, '# Initial\n');
  let projection: Record<string, unknown> = { cards: [] };
  const changes: string[] = [];
  const watcher = watchCardContentFiles({
    decisionOsRoot,
    taskProjection: () => projection,
    auditIntervalMs: 30,
    onChange: (change) => { changes.push(change.file); },
  });

  try {
    projection = { cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }] };
    writeFileSync(contentFile, '# Preserved delayed edit\n');
    const deadline = Date.now() + 2_000;
    while (changes.length === 0 && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    assert.deepEqual(changes, [contentFile]);
  } finally {
    await watcher.close();
  }
});

test('startup reconciliation defers an absent owned resource and observes its later materialization once', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-startup-absent-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const contentFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }],
  }));
  const changes: string[] = [];
  const errors: unknown[] = [];
  const watcher = watchCardContentFiles({
    decisionOsRoot,
    reconcileOnStart: () => true,
    auditIntervalMs: 30,
    onChange: (change) => { changes.push(change.file); },
    onError: (error) => { errors.push(error); },
  });

  try {
    assert.equal(await watcher.ready, true);
    await new Promise((resolveWait) => setTimeout(resolveWait, 90));
    assert.deepEqual(changes, []);
    assert.deepEqual(errors, []);
    writeFileSync(contentFile, '# Materialized\n');
    const deadline = Date.now() + 2_000;
    while (changes.length === 0 && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    await new Promise((resolveWait) => setTimeout(resolveWait, 90));
    assert.deepEqual(changes, [contentFile]);
    assert.deepEqual(errors, []);
    writeFileSync(contentFile, '# Second generation with distinct bytes\n');
    while (changes.length < 2 && Date.now() < deadline + 2_000) await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    await new Promise((resolveWait) => setTimeout(resolveWait, 90));
    assert.deepEqual(changes, [contentFile, contentFile]);
  } finally {
    await watcher.close();
  }
});

test('newly projected absent content is seeded without publication until materialized', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-projected-absent-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const contentFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({ cards: [] }));
  let projection: Record<string, unknown> = { cards: [] };
  const changes: string[] = [];
  const errors: unknown[] = [];
  const watcher = watchCardContentFiles({
    decisionOsRoot,
    taskProjection: () => projection,
    auditIntervalMs: 30,
    onChange: (change) => { changes.push(change.file); },
    onError: (error) => { errors.push(error); },
  });

  try {
    projection = { cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }] };
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    assert.deepEqual(changes, []);
    assert.deepEqual(errors, []);
    writeFileSync(contentFile, '# Materialized later\n');
    const deadline = Date.now() + 2_000;
    while (changes.length === 0 && Date.now() < deadline) await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    await new Promise((resolveWait) => setTimeout(resolveWait, 90));
    assert.deepEqual(changes, [contentFile]);
  } finally {
    await watcher.close();
  }
});

test('delete then editor rename within debounce publishes only the final replacement', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-content-watch-delete-rename-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const contentFile = join(decisionOsRoot, 'cards', 'tasks', 'card-a.md');
  const replacement = join(decisionOsRoot, 'cards', 'tasks', '.card-a.md.replacement');
  mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
  mkdirSync(join(decisionOsRoot, 'threads'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', ledgerFile: '.decision-os/tasks.json' }] }));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards: [{ id: 'card-a', comment: { contentFile: '.decision-os/cards/tasks/card-a.md' } }],
  }));
  writeFileSync(contentFile, '# Initial\n');
  const changes: string[] = [];
  const watcher = watchCardContentFiles({ decisionOsRoot, onChange: (change) => { changes.push(change.file); } });

  try {
    writeFileSync(replacement, '# Final replacement\n');
    rmSync(contentFile);
    renameSync(replacement, contentFile);
    await new Promise((resolveWait) => setTimeout(resolveWait, 90));
    await watcher.flush();
    assert.deepEqual(changes, [contentFile]);
  } finally {
    await watcher.close();
  }
});

test('close waits for an in-flight project publication to settle', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-project-watch-close-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const stateFile = join(decisionOsRoot, 'state.json');
  const ledgerFile = join(decisionOsRoot, 'specs.json');
  writeFileSync(stateFile, JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(ledgerFile, JSON.stringify({ cards: [] }));
  let releasePublication: (() => void) | undefined;
  let publicationStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { publicationStarted = resolve; });
  const release = new Promise<void>((resolve) => { releasePublication = resolve; });
  const watcher = watchProjectFiles({
    decisionOsRoot,
    onContentChange: () => undefined,
    onProjectChange: async () => {
      publicationStarted?.();
      await release;
    },
    auditIntervalMs: 10_000,
  });

  writeFileSync(ledgerFile, JSON.stringify({ cards: [{ id: 'changed' }] }));
  await started;
  let closed = false;
  const closing = watcher.close().then(() => { closed = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(closed, false);
  releasePublication?.();
  await closing;
  assert.equal(closed, true);
});

test('close has a finite deadline when a project publication does not settle', async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-project-watch-timeout-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const stateFile = join(decisionOsRoot, 'state.json');
  const ledgerFile = join(decisionOsRoot, 'specs.json');
  writeFileSync(stateFile, JSON.stringify({ ledgers: [{ id: 'specs', ledgerFile: '.decision-os/specs.json' }] }));
  writeFileSync(ledgerFile, JSON.stringify({ cards: [] }));
  let publicationStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { publicationStarted = resolve; });
  const errors: Array<{ operation: string }> = [];
  const watcher = watchProjectFiles({
    decisionOsRoot,
    onContentChange: () => undefined,
    onProjectChange: () => {
      publicationStarted?.();
      return new Promise(() => undefined);
    },
    onError: (_error, context) => errors.push(context),
    auditIntervalMs: 10_000,
  });

  writeFileSync(ledgerFile, JSON.stringify({ cards: [{ id: 'changed' }] }));
  await started;
  await watcher.close(25);
  assert.equal(errors.some((entry) => entry.operation === 'flush-project-changes'), true);
});
