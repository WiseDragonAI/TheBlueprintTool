import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.match(resizeEffect, /zone\.style\.height = `\$\{height\}px`/);
  assert.match(resizeEffect, /renderZoneLabelOverlay\(\)/);
  assert.match(actionClick, /shortcuts:\s*\['A', 'X', 'Escape', 'Delete', 'Ctrl\+C', 'Ctrl\+V', 'Ctrl\+D'\]/);
  assert.match(index, /<dt>Ctrl\+D<\/dt><dd>Resize selected cards to their content\.<\/dd>/);
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
