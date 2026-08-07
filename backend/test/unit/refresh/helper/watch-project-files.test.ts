/**
 * WHAT: Proves bounded project dependency watching and missed-event recovery.
 * WHY: Registered project views must reconstruct without recursive catalog scans.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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

async function awaitNonPersistentWatcher<T>(settlement: Promise<T>): Promise<T> {
  const testOwner = setInterval(() => undefined, 1_000);
  try {
    return await settlement;
  } finally {
    clearInterval(testOwner);
  }
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
  await awaitNonPersistentWatcher(started);
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
  await awaitNonPersistentWatcher(started);
  await watcher.close(25);
  assert.equal(errors.some((entry) => entry.operation === 'flush-project-changes'), true);
});
