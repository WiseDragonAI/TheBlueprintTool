import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync(new URL('../src/mobile.js', import.meta.url), 'utf8');

test('project color owns zone creation and task hierarchy accents', () => {
  assert.match(mobile, /document\.documentElement\.style\.setProperty\('--accent', project\.color \|\| defaultAccent\)/);
  assert.match(mobile, /if \(kind === 'zone'\) document\.querySelector\('#creation-color'\)\.value = state\.projects\.find/);
  assert.match(mobile, /const zone = \{ id: objectId\('zone'\), \.\.\.rect, color: projectColor, label: 'New task intake'/);
  assert.match(mobile, /article\.style\.setProperty\('--accent', task\.projectColor \|\| defaultAccent\)/);
  assert.match(mobile, /elements\['card-view'\]\.style\.setProperty\('--accent', state\.activeZoneColor \|\| defaultAccent\)/);
  assert.doesNotMatch(mobile, /color: '#38d9e8', label: 'New task intake'/);
});
