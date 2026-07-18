import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const application = readFileSync(new URL('../../src/app/responsive/application.js', import.meta.url), 'utf8');

test('commits the Control Room shell before awaiting its task projection', () => {
  const routeBlock = application.match(/if \(owner\.route\.pathname === '\/'\) \{[\s\S]*?subscribeControlRoomEvents\(\);[\s\S]*?return;/)?.[0] ?? '';
  assert.ok(routeBlock, 'Control Room route block is present');
  assert.match(routeBlock, /controlRoomHydrating = true;\s*controlRoomHydrationGeneration = owner\.generation;\s*renderControlRoom\(\);\s*try \{\s*await loadControlRoom/);
  assert.match(routeBlock, /finally \{\s*if \(controlRoomHydrationGeneration === owner\.generation\) controlRoomHydrating = false;/);
  assert.match(application, /empty\.textContent = controlRoomHydrating\s*\? 'Synchronizing tasks…'/);
  assert.match(application, /setAttribute\('aria-busy', String\(controlRoomHydrating\)\)/);
});
