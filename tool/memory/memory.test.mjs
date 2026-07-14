import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { addMemory, ensureMemoryStore, memoryDatabasePath, migrateMemories, readMemories } from './memory-store.mjs';

function root(name) {
  return mkdtempSync(join(tmpdir(), `decision-os-memory-${name}-`));
}

const cliPath = fileURLToPath(new URL('./memory.mjs', import.meta.url));

test('CLI adds, lists, and searches project memories', () => {
  const workspace = root('cli');
  const run = (...argumentsList) => spawnSync(process.execPath, [cliPath, ...argumentsList], { encoding: 'utf8' });
  try {
    const add = run('add', '--root', workspace, '--project', 'project-a', '--type', 'code', '--title', 'CLI lesson', '--body', 'Searchable body', '--tag', 'engineering', '--subtag', 'rule');
    assert.equal(add.status, 0, add.stderr);
    const list = run('list', '--root', workspace, '--project', 'project-a', '--type', 'code');
    assert.equal(list.status, 0, list.stderr);
    assert.equal(JSON.parse(list.stdout)[0].title, 'CLI lesson');
    const search = run('search', '--root', workspace, '--project', 'project-a', '--type', 'code', '--query', 'Searchable');
    assert.equal(search.status, 0, search.stderr);
    assert.equal(JSON.parse(search.stdout)[0].body, 'Searchable body');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('memory store filters project and type while including global lessons', () => {
  const workspace = root('filters');
  try {
    addMemory(workspace, { title: 'Code rule', body: 'Code body', tag: 'engineering', subtag: 'rule', projectId: 'project-a', type: 'code' });
    addMemory(workspace, { title: 'Copy rule', body: 'Copy body', tag: 'writing', subtag: 'rule', projectId: 'project-b', type: 'copywriting' });
    addMemory(workspace, { title: 'Global rule', body: 'Global body', tag: 'shared', subtag: 'rule', projectId: 'global', type: 'code' });
    assert.deepEqual(readMemories(workspace, { projectId: 'project-a' }).map((row) => row.title).sort(), ['Code rule', 'Global rule']);
    assert.deepEqual(readMemories(workspace, { projectId: 'project-b', type: 'copywriting' }).map((row) => row.title), ['Copy rule']);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('memory store upserts on title, tag, subtag, project, and type', () => {
  const workspace = root('upsert');
  try {
    const identity = { title: 'Stable title', tag: 'engineering', subtag: 'bug', projectId: 'project-a', type: 'code' };
    addMemory(workspace, { ...identity, body: 'Before' });
    addMemory(workspace, { ...identity, body: 'After' });
    const rows = readMemories(workspace, { projectId: 'project-a', type: 'code' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].body, 'After');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('legacy migration is idempotent and preserves content and timestamps', () => {
  const workspace = root('migration');
  const sourcePath = join(workspace, 'legacy.sqlite3');
  const destinationRoot = join(workspace, 'catalog');
  try {
    const source = new DatabaseSync(sourcePath);
    source.exec(`CREATE TABLE memories (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, tag TEXT NOT NULL, subtag TEXT NOT NULL, source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(title, tag, subtag));`);
    source.prepare('INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(1, 'Legacy', 'Preserved', 'engineering', 'bug', 'commit abc', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    source.close();
    const first = migrateMemories({ root: destinationRoot, source: sourcePath, projectId: 'project-a', type: 'code' });
    const second = migrateMemories({ root: destinationRoot, source: sourcePath, projectId: 'project-a', type: 'code' });
    assert.equal(first.quickCheck, 'ok');
    assert.equal(second.destinationRows, 1);
    const [row] = readMemories(destinationRoot, { projectId: 'project-a', type: 'code' });
    assert.equal(row.body, 'Preserved');
    assert.equal(row.created_at, '2026-01-01T00:00:00.000Z');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('ensureMemoryStore provisions the launch-root database once', () => {
  const workspace = root('provision');
  try {
    assert.equal(ensureMemoryStore(workspace), memoryDatabasePath(workspace));
    assert.equal(ensureMemoryStore(workspace), memoryDatabasePath(workspace));
    const database = new DatabaseSync(memoryDatabasePath(workspace), { readOnly: true });
    assert.equal(database.prepare('PRAGMA quick_check').get().quick_check, 'ok');
    database.close();
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
