import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDecisionOsProject, discoverDecisionOsProjects, resolveCatalogProject, saveProjectMetadata } from '@backend/business/server/helper/project-catalog.js';

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

test('keeps a project URL identity when its directory moves', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-identity-'));
  project(root, 'before');
  const masterDecisionOsRoot = join(root, '.decision-os');
  const original = discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot })[0];
  renameSync(join(root, 'before'), join(root, 'after'));
  const moved = discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot })[0];

  assert.equal(moved.id, original.id);
  assert.equal(moved.relativePath, 'after');
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'after', '.decision-os', 'project.json'), 'utf8')), { id: original.id });
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

test('creates one initialized catalog project and persists its metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-create-'));
  const masterDecisionOsRoot = join(root, '.decision-os');
  const created = createDecisionOsProject({
    masterRoot: root,
    masterDecisionOsRoot,
    name: ' Project Alpha ',
    description: ' Primary workspace ',
  });

  assert.equal(created.relativePath, 'Project Alpha');
  assert.equal(created.name, 'Project Alpha');
  assert.equal(created.description, 'Primary workspace');
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'Project Alpha', '.decision-os', 'state.json'), 'utf8')), {
    ledgers: [{ id: 'tasks', title: 'tasks', ledgerFile: '.decision-os/tasks.json', cardId: 'ledger-card:tasks' }],
  });
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'Project Alpha', '.decision-os', 'tasks.json'), 'utf8')), {
    modelName: 'tasks',
    diagramSize: { width: 5200, height: 2600 },
    viewport: { x: 0, y: 0, scale: 1 },
    cards: [],
    annotations: [],
    relationships: [],
    notes: {},
  });
  const overview = JSON.parse(readFileSync(join(root, 'Project Alpha', '.decision-os', 'ledgers-canvas.json'), 'utf8')) as { cards: Array<Record<string, unknown>> };
  assert.equal(overview.cards.some((card) => card.id === 'ledger-card:tasks' && card.targetLedgerId === 'tasks'), true);
  assert.deepEqual(created.ledgers, [{ id: 'tasks', title: 'tasks', ledgerFile: '.decision-os/tasks.json' }]);
  assert.equal(JSON.parse(readFileSync(join(root, 'Project Alpha', '.decision-os', 'project.json'), 'utf8')).id, created.id);
  assert.equal(existsSync(join(root, 'Project Alpha', '.git')), true);
});

test('initializes an existing source directory without replacing its files', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-existing-project-create-'));
  const selected = join(root, 'existing-source');
  mkdirSync(selected);
  writeFileSync(join(selected, 'README.md'), '# Existing source\n');

  const created = createDecisionOsProject({
    masterRoot: root,
    masterDecisionOsRoot: join(root, '.decision-os'),
    name: 'Existing Source',
    description: 'Selected from the directory browser',
    directory: 'existing-source',
  });

  assert.equal(created.relativePath, 'existing-source');
  assert.equal(created.name, 'Existing Source');
  assert.equal(readFileSync(join(selected, 'README.md'), 'utf8'), '# Existing source\n');
  assert.equal(existsSync(join(selected, '.git')), true);
  assert.equal(existsSync(join(selected, '.decision-os', 'state.json')), true);
});

test('preserves existing Git metadata and Decision OS state', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-preserved-project-create-'));
  const selected = join(root, 'configured-source');
  mkdirSync(join(selected, '.git'), { recursive: true });
  writeFileSync(join(selected, '.git', 'sentinel'), 'keep');
  mkdirSync(join(selected, '.decision-os'), { recursive: true });
  const existingState = JSON.stringify({ ledgers: [{ id: 'specs', title: 'Specs', ledgerFile: '.decision-os/specs.json' }] });
  writeFileSync(join(selected, '.decision-os', 'state.json'), existingState);
  writeFileSync(join(selected, '.decision-os', 'project.json'), JSON.stringify({ id: 'preserved-id' }));

  const created = createDecisionOsProject({
    masterRoot: root,
    masterDecisionOsRoot: join(root, '.decision-os'),
    name: 'Configured Source',
    description: '',
    directory: 'configured-source',
  });

  assert.equal(created.id, 'preserved-id');
  assert.equal(readFileSync(join(selected, '.git', 'sentinel'), 'utf8'), 'keep');
  assert.equal(readFileSync(join(selected, '.decision-os', 'state.json'), 'utf8'), existingState);
  assert.equal(existsSync(join(selected, '.decision-os', 'tasks.json')), false);
});

test('rejects unsafe and colliding project names without creating partial directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-create-reject-'));
  const masterDecisionOsRoot = join(root, '.decision-os');
  mkdirSync(join(root, 'Existing'));
  const create = (name: string, description = '') => createDecisionOsProject({ masterRoot: root, masterDecisionOsRoot, name, description });

  assert.throws(() => create(''), /name is required/);
  assert.throws(() => create('../escape'), /safe directory name/);
  assert.throws(() => create('Existing'), /already exists/);
  assert.throws(() => create('x'.repeat(121)), /120 characters/);
  assert.throws(() => create('Valid name', 'x'.repeat(1001)), /1000 characters/);
  assert.equal(existsSync(join(root, 'escape')), false);
  assert.equal(existsSync(join(root, 'Valid name')), false);
});
