/**
 * WHAT: Previews or applies the one-time project registry migration for the current server root.
 * WHY: Operators need an inspectable manifest and a backed-up apply path without starting the server.
 */
import { resolve } from 'node:path';
import { migrateLegacyProjectRegistry } from './business/server/helper/project-catalog-store.js';

const masterRoot = resolve(process.cwd());
const result = migrateLegacyProjectRegistry({
  masterRoot,
  masterDecisionOsRoot: resolve(masterRoot, '.decision-os'),
  apply: process.argv.includes('--apply'),
});

console.log(JSON.stringify({
  mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
  applied: result.applied,
  backup: result.backup,
  projectCount: Object.keys(result.registry.projects).length,
  registry: result.registry,
}, null, 2));
