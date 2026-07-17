import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadFederationSettings, saveFederationSettings } from '../src/app/responsive/federation-settings.js';
import { hydrateFederationForm } from '../src/app/responsive/federation-form-hydration.js';

const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../assets/application.css', import.meta.url), 'utf8');

test('settings exposes the redacted federation connection and peer inventory', async () => {
  assert.match(markup, /class="federation-settings-form settings-panel"/);
  assert.match(markup, /id="federation-node-credential"[^>]+type="password"/);
  assert.match(markup, /id="federation-peer-list"/);
  assert.match(markup, /id="federation-state-duration"/);
  assert.match(markup, /id="federation-attempt-timeout"/);
  assert.match(markup, /id="federation-last-issue"/);
  assert.match(source, /Online for \$\{duration\}/);
  assert.match(source, /retry in \$\{retryIn\}/);
  assert.match(styles, /@keyframes federation-sonar/);
  assert.match(styles, /data-state="connected"/);
  assert.match(styles, /data-state="disconnected"/);
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

test('status refresh cannot overwrite an edited federation form', () => {
  const field = (value) => ({ value });
  const form = { elements: {
    relayUrl: field('operator relay'),
    federationId: field('operator federation'),
    nodeId: field('operator node'),
    nodeLabel: field('operator label'),
    nodeCredential: field('operator credential'),
  } };
  const server = { relayUrl: 'server relay', federationId: 'server federation', nodeId: 'server node', nodeLabel: 'server label' };

  assert.equal(hydrateFederationForm(form, server, { dirty: true }), false);
  assert.deepEqual(Object.fromEntries(Object.entries(form.elements).map(([key, value]) => [key, value.value])), {
    relayUrl: 'operator relay', federationId: 'operator federation', nodeId: 'operator node', nodeLabel: 'operator label', nodeCredential: 'operator credential',
  });
  assert.equal(hydrateFederationForm(form, server, { dirty: true, force: true }), true);
  assert.equal(form.elements.relayUrl.value, 'server relay');
  assert.equal(form.elements.nodeCredential.value, '');
  assert.match(source, /loadFederationConnectionSettings\(\{ generation \}\)/);
});
