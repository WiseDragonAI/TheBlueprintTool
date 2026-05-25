/**
 * WHAT: Starts the backend root block HTTP server.
 * WHY: Operators need a direct runtime entrypoint for the implemented server controller.
 */
import { startHttpServerController } from '@backend/business/server/controller/start-http-server-controller.js';
import { readBlueprinttoolSettings } from '@backend/business/server/helper/read-blueprinttool-settings.js';

const runtime_state: Record<string, unknown> = {};
const startupSettings = readBlueprinttoolSettings({ runtime_state });
const settings = startupSettings.settings as Record<string, unknown>;
const port = Number(process.env.PORT ?? settings.port ?? 4173);
const host = String(process.env.HOST ?? settings.host ?? '127.0.0.1');

const result = await startHttpServerController({
  action_payload: { mode: 'serve', port, host },
  runtime_state
});

console.log(JSON.stringify({ server: 'backend', ok: result.ok, url: `http://${host}:${port}` }));
