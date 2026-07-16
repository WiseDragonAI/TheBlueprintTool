/** WHAT: Preserves responsive project creation requests and errors. WHY: Project lifecycle behavior must remain complete in the unified frontend. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRequest } from '../src/app/responsive/project-creation.js';

test('submits trimmed project fields and returns the created project', async () => {
  let request;
  const project = await createProjectRequest({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ ok: true, project: { id: 'project-1', relativePath: 'Project One' } }), { status: 201 });
    },
    name: ' Project One ',
    description: ' Optional description ',
  });

  assert.equal(request.url, '/decision-os/projects');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Project One', description: 'Optional description' });
  assert.equal(project.id, 'project-1');
});

test('surfaces the server validation error', async () => {
  await assert.rejects(
    createProjectRequest({
      fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'A file or directory already exists with this project name.' }), { status: 400 }),
      name: 'Existing',
      description: '',
    }),
    /already exists/,
  );
});
