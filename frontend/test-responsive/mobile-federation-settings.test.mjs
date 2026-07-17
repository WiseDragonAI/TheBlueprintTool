import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFederationSettings, saveFederationSettings } from '../src/app/responsive/federation-settings.js';

const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('settings exposes the redacted federation connection and peer inventory', async () => {
  assert.match(markup, /class="federation-settings-form settings-panel"/);
  assert.match(markup, /id="federation-node-credential"[^>]+type="password"/);
  assert.match(markup, /id="federation-peer-list"/);
  const loaded = await loadFederationSettings(async () => new Response(JSON.stringify({ ok: true, connected: true, credentialConfigured: true })));
  assert.equal(loaded.connected, true);
  let request;
  await saveFederationSettings(async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ ok: true, connected: false }));
  }, { enabled: false });
  assert.equal(request.url, '/api/settings/federation');
  assert.equal(request.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(request.init.body), { enabled: false });
});
