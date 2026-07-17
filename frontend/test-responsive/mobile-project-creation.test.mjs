/** WHAT: Preserves responsive project creation requests and errors. WHY: Project lifecycle behavior must remain complete in the unified frontend. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRequest, loadProjectDirectoryRequest } from '../src/app/responsive/project-creation.js';

test('loads one server directory by encoded relative path', async () => {
  let requestedUrl = '';
  const listing = await loadProjectDirectoryRequest({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ ok: true, listing: { path: 'dev/Project One', absolutePath: '/workspace/dev/Project One', directories: [] } }));
    },
    path: 'dev/Project One',
  });

  assert.equal(requestedUrl, '/decision-os/directories?path=dev%2FProject%20One');
  assert.equal(listing.absolutePath, '/workspace/dev/Project One');
});

test('submits trimmed project fields and returns the created project', async () => {
  let request;
  const project = await createProjectRequest({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ ok: true, project: { id: 'project-1', relativePath: 'Project One' } }), { status: 201 });
    },
    name: ' Project One ',
    description: ' Optional description ',
    directory: ' dev/Project One ',
  });

  assert.equal(request.url, '/decision-os/projects');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual(JSON.parse(request.options.body), { name: 'Project One', description: 'Optional description', directory: 'dev/Project One' });
  assert.equal(project.id, 'project-1');
});

test('surfaces the server validation error', async () => {
  await assert.rejects(
    createProjectRequest({
      fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'A file or directory already exists with this project name.' }), { status: 400 }),
      name: 'Existing',
      description: '',
      directory: 'Existing',
    }),
    /already exists/,
  );
});
