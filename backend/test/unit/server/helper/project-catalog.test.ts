import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverDecisionOsProjects, resolveCatalogProject, saveProjectMetadata } from '@backend/business/server/helper/project-catalog.js';

function project(root: string, relativePath: string, ledgers: Array<{ id: string; title: string }> = [{ id: 'specs', title: 'Specs' }]): string {
  const directory = join(root, relativePath);
  mkdirSync(join(directory, '.decision-os'), { recursive: true });
  writeFileSync(join(directory, '.decision-os', 'state.json'), JSON.stringify({
    ledgers: ledgers.map((ledger) => ({ ...ledger, ledgerFile: `.decision-os/${ledger.id}.json` })),
  }));
  return directory;
}

test('recursively discovers projects through intermediate directories and uses directory basenames', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-projects-'));
  project(root, 'admin');
  project(root, 'dev/project-a', [{ id: 'specs', title: 'Specs' }, { id: 'tasks', title: 'Tasks' }]);
  project(root, 'dev/project-b');

  const projects = discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot: join(root, '.decision-os') });

  assert.deepEqual(projects.map((entry) => entry.relativePath), ['admin', 'dev/project-a', 'dev/project-b']);
  assert.deepEqual(projects.map((entry) => entry.name), ['admin', 'project-a', 'project-b']);
  assert.deepEqual(projects.map((entry) => entry.description), ['', '', '']);
  assert.equal(projects[1].ledgers.length, 2);
  assert.equal(resolveCatalogProject({ projects, projectId: projects[1].id, fallbackDecisionOsRoot: join(root, '.decision-os') })?.root, join(root, 'dev/project-a'));
  assert.equal(resolveCatalogProject({ projects, projectId: 'invalid', fallbackDecisionOsRoot: join(root, '.decision-os') }), null);
});

test('persists validated project metadata at master scope and migrates legacy colors', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-colors-'));
  project(root, 'dev/project-a');
  const masterDecisionOsRoot = join(root, '.decision-os');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  writeFileSync(join(masterDecisionOsRoot, 'projects.json'), JSON.stringify({ colors: { legacy: '#123456', [Buffer.from('dev/project-a').toString('base64url')]: '#abcdef' } }));
  const projects = discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot });

  const updated = saveProjectMetadata({
    masterDecisionOsRoot,
    projects,
    projectId: projects[0].id,
    name: ' Project Alpha ',
    description: ' Primary workspace ',
    color: '#ABCDEF',
  });

  const settings = JSON.parse(readFileSync(join(masterDecisionOsRoot, 'projects.json'), 'utf8'));
  assert.equal(settings.colors, undefined);
  assert.equal(settings.projects.legacy.color, '#123456');
  assert.deepEqual(settings.projects[projects[0].id], { name: 'Project Alpha', description: 'Primary workspace', color: '#abcdef' });
  assert.deepEqual({ name: updated.name, description: updated.description, color: updated.color }, { name: 'Project Alpha', description: 'Primary workspace', color: '#abcdef' });
  assert.deepEqual(
    discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot }).map(({ name, description, color }) => ({ name, description, color })),
    [{ name: 'Project Alpha', description: 'Primary workspace', color: '#abcdef' }],
  );
});

test('rejects invalid metadata without partially changing persisted settings', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-validation-'));
  project(root, 'project-a');
  const masterDecisionOsRoot = join(root, '.decision-os');
  const projects = discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot });
  const input = { masterDecisionOsRoot, projects, projectId: projects[0].id, name: 'Project A', description: 'Description', color: '#123456' };
  saveProjectMetadata(input);
  const before = readFileSync(join(masterDecisionOsRoot, 'projects.json'), 'utf8');

  assert.throws(() => saveProjectMetadata({ ...input, name: '   ' }), /name is required/);
  assert.throws(() => saveProjectMetadata({ ...input, name: 'x'.repeat(121) }), /120 characters/);
  assert.throws(() => saveProjectMetadata({ ...input, description: 'x'.repeat(1001) }), /1000 characters/);
  assert.throws(() => saveProjectMetadata({ ...input, color: 'red' }), /six-digit hex/);
  assert.equal(readFileSync(join(masterDecisionOsRoot, 'projects.json'), 'utf8'), before);
});
