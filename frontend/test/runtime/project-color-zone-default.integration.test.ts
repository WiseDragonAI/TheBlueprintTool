/**
 * WHAT: Verifies project identity owns the default color for newly created zones.
 * WHY: Cards inherit their accents from zones, so a fixed zone default breaks project theming.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const source = (path: string): string => readFileSync(new URL(path, root), 'utf8');

test('project state becomes the default zone color used by zone creation', () => {
  const runtimeState = source('frontend/src/runtime/state.ts');
  const projectState = source('frontend/src/runtime/ledger/effect/load-decision-os-state.ts');
  const createZone = source('frontend/src/runtime/zone/effect/create-zone-from-rect.ts');

  assert.match(runtimeState, /projectColor:\s*'#38d9e8'/);
  assert.match(projectState, /projectColor\?: string/);
  assert.match(projectState, /state\.projectColor = projectColor/);
  assert.match(projectState, /state\.zoneColor = projectColor/);
  assert.match(createZone, /color:\s*state\.zoneColor/);
  assert.doesNotMatch(runtimeState, /zoneColor:\s*'#55b8ff'/);
});
