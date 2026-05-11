/**
 * WHAT: Starts the backend root block HTTP server.
 * WHY: Operators need a direct runtime entrypoint for the implemented server controller.
 */
import { startHttpServerController } from '@backend/business/server/controller/start-http-server-controller.js';

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const runtime_state: Record<string, unknown> = {};

const result = await startHttpServerController({
  action_payload: { mode: 'serve', port, host },
  runtime_state
});

console.log(JSON.stringify({ server: 'backend', ok: result.ok, url: `http://${host}:${port}` }));
