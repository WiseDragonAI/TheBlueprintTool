/**
 * WHAT: Proves explicit project catalog membership and lifecycle persistence.
 * WHY: Registered projects must replace repeated recursive discovery without risking project files.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectCatalogStore } from '@backend/business/server/helper/project-catalog-store.js';

function createProject(root: string, relativePath: string, id: string): void {
  const decisionOsRoot = join(root, relativePath, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id }));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
}

test('migrates once, then changes membership only through explicit lifecycle operations', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-registry-'));
  const masterDecisionOsRoot = join(root, '.decision-os');
  createProject(root, 'initial', 'initial-id');

  const store = createProjectCatalogStore({ masterRoot: root, masterDecisionOsRoot });
  const migrated = JSON.parse(readFileSync(join(masterDecisionOsRoot, 'projects.json'), 'utf8')) as { version: number; projects: Record<string, { relativePath: string }> };
  assert.equal(migrated.version, 2);
  assert.equal(migrated.projects['initial-id'].relativePath, 'initial');

  createProject(root, 'not-registered', 'second-id');
  assert.deepEqual(store.projects().map((project) => project.id), ['initial-id']);

  const registered = store.register('not-registered');
  assert.equal(registered.id, 'second-id');
  assert.deepEqual(store.projects().map((project) => project.id), ['initial-id', 'second-id']);

  renameSync(join(root, 'not-registered'), join(root, 'moved'));
  const relinked = store.relink('second-id', 'moved');
  assert.equal(relinked.relativePath, 'moved');

  const removed = store.unregister('second-id');
  assert.equal(removed.id, 'second-id');
  assert.equal(existsSync(join(root, 'moved', '.decision-os', 'state.json')), true);
  assert.deepEqual(store.projects().map((project) => project.id), ['initial-id']);
});

test('creates and updates projects without rediscovering unregistered directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-registry-create-'));
  const masterDecisionOsRoot = join(root, '.decision-os');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  writeFileSync(join(masterDecisionOsRoot, 'projects.json'), JSON.stringify({ version: 2, projects: {} }));
  createProject(root, 'unregistered', 'unregistered-id');
  const store = createProjectCatalogStore({ masterRoot: root, masterDecisionOsRoot });

  const created = store.create('Created', 'Created explicitly');
  const updated = store.update(created.id, 'Renamed', 'Updated metadata', '#123456');

  assert.equal(updated.name, 'Renamed');
  assert.equal(updated.description, 'Updated metadata');
  assert.equal(updated.color, '#123456');
  assert.equal(store.projects().some((project) => project.id === 'unregistered-id'), false);
});
