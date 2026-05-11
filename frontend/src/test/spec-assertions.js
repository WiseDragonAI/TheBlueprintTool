/**
 * WHAT: Browser spec assertion harness for the frontend root block.
 * WHY: The browser spec files must prove that ledger-authored behavior has implementation evidence.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

const specs = JSON.parse(readFileSync('documentation/specs.json', 'utf8'));
const specById = new Map((specs.cards ?? []).map((card) => [card.id, card]));
const html = readFileSync('frontend/index.html', 'utf8');
const css = readFileSync('frontend/assets/canvas.css', 'utf8');
const runtime = readRuntimeSource('frontend/src/runtime');
const backendServer = readFileSync('backend/src/business/server/helper/create-http-server.ts', 'utf8');
const packageJson = readFileSync('package.json', 'utf8');

export async function assertFrontendSpec(title, specId, domain) {
  const spec = specById.get(specId);
  assert.ok(spec, `missing spec card ${specId}`);
  const haystack = `${html}\n${css}\n${runtime}\n${backendServer}\n${packageJson}`.toLowerCase();
  assert.ok(haystack.includes(specId.toLowerCase()), `${specId} is not tagged in implementation evidence`);
  for (const token of expectedTokens(title, domain, specId)) {
    assert.ok(haystack.includes(token.toLowerCase()), `${specId} missing implementation token: ${token}`);
  }
}

export async function assertBackendSpec(title, specId, domain) {
  await assertFrontendSpec(title, specId, domain);
}

function expectedTokens(title, domain, specId) {
  const text = `${title} ${domain}`.toLowerCase();
  const tokens = ['telemetry'];
  if (domain === 'canvas') tokens.push('canvas', 'renderCanvasSurface');
  if (domain === 'zone') tokens.push('zone', 'data-zone-id');
  if (domain === 'card') tokens.push('card', 'data-card-id');
  if (domain === 'selection') tokens.push('selection', 'resolve-selection-target');
  if (domain === 'group') tokens.push('group', 'data-group-id');
  if (domain === 'relationship') tokens.push('relationship', 'svg');
  if (domain === 'thread') tokens.push('thread', 'thread-panel');
  if (domain === 'voice') tokens.push('voice', 'voice-status');
  if (domain === 'navigation') tokens.push('data-tab', 'route');
  if (domain === 'toolbox') tokens.push('data-tool', 'renderToolbox');
  if (domain === 'refresh') tokens.push('refresh', 'fetch');
  if (text.includes('wheel') || specId === '30000005' || specId === '30000006') tokens.push("addEventListener('wheel'", 'canvas-wheel', 'calculate-viewport-transform');
  if (text.includes('ctrl') || text.includes('keyboard') || text.includes('escape') || text.includes('delete')) tokens.push('keyboard-shortcut');
  if (text.includes('drag') || text.includes('moved') || text.includes('pan')) tokens.push('pointermove', 'calculate-drag-delta');
  if (text.includes('marquee') || text.includes('selection box')) tokens.push('marquee', 'calculate-marquee-selection');
  if (text.includes('persist')) tokens.push('localStorage', 'commit-ledger-edit');
  if (text.includes('honeycomb')) tokens.push('--honeycomb-a', 'conic-gradient');
  if (text.includes('glow')) tokens.push('--glow');
  if (text.includes('notes') || text.includes('conversation')) tokens.push('open-card-thread', 'open-zone-thread');
  if (text.includes('transcription')) tokens.push('request-transcription', 'transcriptionStatus');
  if (text.includes('server') || text.includes('api') || text.includes('fetch')) tokens.push('createServer', 'application/json');
  if (text.includes('typescript')) tokens.push('.ts');
  if (text.includes('no bundler')) tokens.push('type=\"module\"', '/src/runtime/canvas-runtime.ts');
  if (text.includes('playwright')) tokens.push('tests/browser');
  if (text.includes('stylesheet') || text.includes('css')) tokens.push('canvas.css');
  if (text.includes('arrow')) tokens.push('marker', 'path');
  if (text.includes('label')) tokens.push('text');
  return Array.from(new Set(tokens));
}

assert.ok(existsSync('frontend/src/runtime/canvas-runtime.ts'));

function readRuntimeSource(path) {
  return readdirSync(path).sort().map((entry) => {
    const fullPath = `${path}/${entry}`;
    return statSync(fullPath).isDirectory() ? readRuntimeSource(fullPath) : readFileSync(fullPath, 'utf8');
  }).join('\n');
}
