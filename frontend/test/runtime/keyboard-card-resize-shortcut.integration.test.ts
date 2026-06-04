import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resizeZoneGeometryToContainedCards } from '../../src/runtime/card/effect/resize-selected-cards-to-content.js';

const root = new URL('../../../', import.meta.url);

test('ctrl-d routes selected card resize through the same controller as the toolbar command', () => {
  const keyboard = readFileSync(new URL('frontend/src/runtime/input/controller/handle-keyboard.ts', root), 'utf8');
  const actionClick = readFileSync(new URL('frontend/src/runtime/input/controller/handle-action-click.ts', root), 'utf8');
  const resizeController = readFileSync(new URL('frontend/src/runtime/card/controller/resize-selected-cards-controller.ts', root), 'utf8');
  const resizeEffect = readFileSync(new URL('frontend/src/runtime/card/effect/resize-selected-cards-to-content.ts', root), 'utf8');
  const index = readFileSync(new URL('frontend/index.html', root), 'utf8');

  assert.match(keyboard, /resizeSelectedCardsController/);
  assert.match(keyboard, /event\.ctrlKey && key === 'd'/);
  assert.match(keyboard, /event\.preventDefault\(\);\s*\n\s*await resizeSelectedCardsController\(\);/);
  assert.match(actionClick, /action === 'resize'[\s\S]*await resizeSelectedCardsController\(\);/);
  assert.match(resizeController, /commitActiveLedgerMutation\(\{ action: 'patch-geometry', geometry \}/);
  assert.match(resizeEffect, /expandSelectedZonesToCards/);
  assert.match(resizeEffect, /const zoneFitPadding = 96;/);
  assert.match(resizeEffect, /const zoneSourceCards = cards\.length > 0 \? cards : allCardElements\(\);/);
  assert.match(resizeEffect, /zone\.style\.height = `\$\{next\.height\}px`/);
  assert.match(resizeEffect, /renderZoneLabelOverlay\(\)/);
  assert.match(actionClick, /shortcuts:\s*\['A', 'X', 'Escape', 'Delete', 'Ctrl\+C', 'Ctrl\+V', 'Ctrl\+D'\]/);
  assert.match(index, /<dt>Ctrl\+D<\/dt><dd>Resize selected cards to their content\.<\/dd>/);
  assert.match(index, /data-action="toggle-rail"[^>]*aria-expanded="true"/);
});

test('ctrl-d zone fit can shrink a selected zone down to smaller card bounds', () => {
  const geometry = resizeZoneGeometryToContainedCards([
    { x: 260, y: 190, width: 140, height: 90 },
    { x: 440, y: 210, width: 150, height: 110 }
  ], { padding: 18, minWidth: 180, minHeight: 140 });

  assert.deepEqual(geometry, {
    x: 164,
    y: 94,
    width: 522,
    height: 322
  });
});

test('runbook button opens current workspace, image, and voice configuration notes', () => {
  const dom = readFileSync(new URL('frontend/src/runtime/dom.ts', root), 'utf8');
  const actionClick = readFileSync(new URL('frontend/src/runtime/input/controller/handle-action-click.ts', root), 'utf8');
  const index = readFileSync(new URL('frontend/index.html', root), 'utf8');
  const css = readFileSync(new URL('frontend/assets/canvas/dialogs.css', root), 'utf8');

  assert.match(dom, /runbookModal/);
  assert.match(actionClick, /action === 'runbook'[\s\S]*runbookModal\.showModal/);
  assert.match(actionClick, /action === 'close-runbook'[\s\S]*runbookModal\.close/);
  assert.match(index, /class="runbook-modal"/);
  assert.match(index, /card\.imageSizes\[src\]/);
  assert.match(index, /\.blueprinttool\/voice-uploads\//);
  assert.match(css, /\.runbook-modal/);
});
