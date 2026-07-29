/** WHAT: Preserves project-color propagation through responsive task and zone views. WHY: Project identity must remain visible throughout the shared application. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync(new URL('../src/app/responsive/application.js', import.meta.url), 'utf8');

test('project color owns zone creation and task hierarchy accents', () => {
  assert.match(mobile, /document\.documentElement\.style\.setProperty\('--accent', project\.color \|\| defaultAccent\)/);
  assert.match(mobile, /if \(kind === 'zone'\) document\.querySelector\('#creation-color'\)\.value = state\.projects\.find/);
  assert.match(mobile, /const zone = \{ id: objectId\('zone'\), \.\.\.rect, color: projectColor, label: 'New task intake'/);
  assert.match(mobile, /article\.style\.setProperty\('--accent', task\.projectColor \|\| defaultAccent\)/);
  assert.match(mobile, /taskFamilyCardAccent\(\{ ledger: state\.ledger, cardId: String\(card\?\.id \|\| ''\), projectColor, taskIds \}\)/);
  assert.match(mobile, /openMobileThread\(card, cardAccent\)/);
  assert.match(mobile, /elements\['card-view'\]\.style\.setProperty\('--zone-color', cardAccent\);\s*elements\['card-view'\]\.style\.setProperty\('--accent', cardAccent\);/);
  assert.match(mobile, /projectFetch\(`\/api\/ledgers\/\$\{encodeURIComponent\(ledgerId\)\}\/cards\/\$\{encodeURIComponent\(requestedCard\)\}`/);
  assert.match(mobile, /if \(card\) \{[\s\S]*const cardZone = zone \?\? zones\.find/);
  assert.match(mobile, /state\.activeZoneId = asText\(cardZone\?\.id \?\? 'ungrouped'\);\s*state\.activeZoneColor = asText\(cardZone\?\.color \?\? '#9ba3ad'\);[\s\S]*renderCard\(card\);/);
  assert.doesNotMatch(mobile, /color: '#38d9e8', label: 'New task intake'/);
});
