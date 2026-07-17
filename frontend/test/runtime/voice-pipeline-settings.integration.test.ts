import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCodexProcessSettings, saveCodexProcessSettings } from '../../src/app/responsive/codex-settings.js';

test('voice pipeline settings load and save through the Codex settings contract', async () => {
  const requests: Array<{ url: string; options?: RequestInit }> = [];
  const fetchImpl = async (url: string, options?: RequestInit): Promise<Response> => {
    requests.push({ url, options });
    return new Response(JSON.stringify({
      ok: true,
      maxConcurrentCodexProcesses: 3,
      voicePipelineId: 'pipeline-a',
      pipelines: [{ id: 'pipeline-a', name: 'Pipeline A' }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const loaded = await loadCodexProcessSettings(fetchImpl);
  assert.equal(loaded.voicePipelineId, 'pipeline-a');
  assert.deepEqual(loaded.pipelines, [{ id: 'pipeline-a', name: 'Pipeline A' }]);

  await saveCodexProcessSettings(fetchImpl, 3, 'pipeline-a');
  assert.equal(requests[1].url, '/api/settings/codex-processes');
  assert.deepEqual(JSON.parse(String(requests[1].options?.body)), {
    maxConcurrentCodexProcesses: 3,
    voicePipelineId: 'pipeline-a'
  });
});
