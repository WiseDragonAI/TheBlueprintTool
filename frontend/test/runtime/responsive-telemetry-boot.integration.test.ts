/**
 * WHAT: Verifies that the responsive application installs the bounded diagnostic sender before asynchronous assets load.
 * WHY: Responsive-only task hydration failures must reach the server telemetry ledger without depending on the canvas boot path.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('responsive boot installs frontend telemetry before awaiting surface assets', async () => {
  const source = await readFile(new URL('../../src/app/controller/boot-application.ts', import.meta.url), 'utf8');
  const boot = source.match(/export async function bootApplication\(\): Promise<void> \{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(source, /import \{ installFrontendTelemetryWebSocket \} from '\.\.\/\.\.\/runtime\/telemetry\/effect\/frontend-telemetry-websocket\.js';/);
  assert.ok(boot.indexOf('void installFrontendTelemetryWebSocket();') < boot.indexOf('await Promise.all(['));
});
