import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverDecisionOsProjects, resolveCatalogProject, saveProjectColor } from '@backend/business/server/helper/project-catalog.js';

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
  assert.equal(projects[1].ledgers.length, 2);
  assert.equal(resolveCatalogProject({ projects, projectId: projects[1].id, fallbackDecisionOsRoot: join(root, '.decision-os') })?.root, join(root, 'dev/project-a'));
  assert.equal(resolveCatalogProject({ projects, projectId: 'invalid', fallbackDecisionOsRoot: join(root, '.decision-os') }), null);
});

test('persists project colors at master scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-project-colors-'));
  project(root, 'dev/project-a');
  const masterDecisionOsRoot = join(root, '.decision-os');
  const projects = discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot });

  saveProjectColor({ masterDecisionOsRoot, projects, projectId: projects[0].id, color: '#ABCDEF' });

  assert.equal(JSON.parse(readFileSync(join(masterDecisionOsRoot, 'projects.json'), 'utf8')).colors[projects[0].id], '#abcdef');
  assert.equal(discoverDecisionOsProjects({ masterRoot: root, masterDecisionOsRoot })[0].color, '#abcdef');
});
