import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({
    main: './src/index.ts',
    wrangler: { configPath: './wrangler.toml' },
    miniflare: {
      bindings: {
        ADMIN_SECRET: 'test-admin-secret',
        DECISION_OS_RELEASE_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        FEDERATIONS_NAMESPACE: 'decision-os-federations-dev',
        RELAY_ENVIRONMENT: 'dev',
        RELAY_WORKER_NAME: 'decision-os-federation-relay-dev',
      },
    },
  })],
});
