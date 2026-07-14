import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultProjectColor, projectSettingsValues, saveProjectSettingsRequest } from '../src/mobile-project-settings.js';

test('derives complete project settings fields', () => {
  assert.deepEqual(
    projectSettingsValues({ name: 'Project A', description: 'Description', color: '#123456' }),
    { name: 'Project A', description: 'Description', color: '#123456' },
  );
  assert.deepEqual(projectSettingsValues({ name: 'Project B' }, () => 0), { name: 'Project B', description: '', color: '#cc3d3d' });
});

test('hydrates valid saved colors and replaces unusable color values with visible HSV defaults', () => {
  assert.equal(projectSettingsValues({ color: '#Ab12Ef' }, () => 0.5).color, '#Ab12Ef');
  assert.equal(projectSettingsValues({ color: '' }, () => 0).color, '#cc3d3d');
  assert.equal(projectSettingsValues({ color: 'black' }, () => 0.5).color, '#3dcccc');
  assert.equal(defaultProjectColor(() => 1 / 3), '#3dcc3d');
});

test('sends complete settings and reconciles only the updated project', async () => {
  const projects = [
    { id: 'a', name: 'Project A', description: '', color: '#111111' },
    { id: 'b', name: 'Project B', description: '', color: '#222222' },
  ];
  const updated = { ...projects[1], name: 'Project Beta', description: 'Delivery', color: '#abcdef' };
  let request;
  const result = await saveProjectSettingsRequest({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true, project: updated }) };
    },
    projects,
    projectId: 'b',
    values: { name: updated.name, description: updated.description, color: updated.color },
  });

  assert.equal(request.url, '/decision-os/projects/b');
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Project Beta', description: 'Delivery', color: '#abcdef' });
  assert.equal(result.projects[0], projects[0]);
  assert.deepEqual(result.projects[1], updated);
  assert.deepEqual(projects[1], { id: 'b', name: 'Project B', description: '', color: '#222222' });
});

test('preserves server-confirmed project state when an update is rejected', async () => {
  const projects = [{ id: 'a', name: 'Project A', description: '', color: '#111111' }];
  await assert.rejects(
    saveProjectSettingsRequest({
      fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ ok: false, error: 'Project name is required.' }) }),
      projects,
      projectId: 'a',
      values: { name: '', description: 'Changed', color: '#abcdef' },
    }),
    /Project name is required/,
  );
  assert.deepEqual(projects, [{ id: 'a', name: 'Project A', description: '', color: '#111111' }]);
});
