import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clampCardCodeColor } from '../../src/runtime/card/effect/render-card-zone-colors.js';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('card markdown inline code and bold styling follow card color specs', () => {
  const specs = source('documentation/specs.json');
  const css = source('frontend/assets/canvas/objects.css');
  const colorRuntime = source('frontend/src/runtime/card/effect/render-card-zone-colors.ts');

  assert.match(specs, /f1c7a9d4/);
  assert.match(specs, /1e9b7c4f/);
  assert.match(specs, /2f9a6c8d/);
  assert.match(specs, /8b6e4d2a/);
  assert.equal(clampCardCodeColor('#3b0a0a'), '#d95d5d');
  assert.equal(clampCardCodeColor('rgb(0, 80, 80)'), '#00d9d9');
  assert.equal(clampCardCodeColor('#4b00ff'), '#8968d9');
  assert.match(colorRuntime, /const CODE_COLOR_VALUE = 0\.85;/);
  assert.match(colorRuntime, /function rgbToHsv/);
  assert.match(colorRuntime, /function hsvToRgb/);
  assert.match(colorRuntime, /MIN_READABLE_LUMINANCE/);
  assert.match(colorRuntime, /--card-code-color/);
  assert.match(css, /\.card\s*{[^}]*--card-readable-color:\s*color-mix\(in srgb, var\(--card-zone-color\), white 52%\);[^}]*--card-code-color:\s*var\(--card-readable-color\);/s);
  assert.match(css, /\.ledger-card-body code\s*{[^}]*color:\s*var\(--card-code-color\);/s);
  assert.match(css, /\.ledger-card-body strong\s*{[^}]*color:\s*var\(--text\);[^}]*font-weight:\s*800;/s);
});

test('low-detail mode switches card paint layers without threshold layout measurement', () => {
  const specs = source('documentation/specs.json');
  const css = source('frontend/assets/canvas/canvas-layer.css');
  const detailRuntime = source('frontend/src/runtime/canvas/effect/update-detail-mode.ts');
  const cardRenderer = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');

  assert.match(specs, /c4e8b2f9/);
  assert.match(specs, /4b7c1d9e/);
  assert.match(specs, /7e4b0a2c/);
  assert.match(specs, /9d5e0b7a/);
  assert.doesNotMatch(detailRuntime, /offsetWidth|offsetHeight|getBoundingClientRect|scrollHeight/);
  assert.doesNotMatch(detailRuntime, /cacheRenderedCardSizes/);
  assert.match(cardRenderer, /ledger-card-detail-layer/);
  assert.match(cardRenderer, /ledger-card-overview-layer/);
  assert.match(css, /\.canvas\.low-detail \.ledger-card-detail-layer\s*{[^}]*content-visibility:\s*hidden;/s);
  assert.match(css, /\.canvas\.low-detail \.ledger-card-overview-layer\s*{[^}]*visibility:\s*visible;[^}]*opacity:\s*1;/s);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-title\s*{[^}]*width:\s*calc\(100% \* var\(--viewport-scale, 1\)\);/s);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-title\s*{[^}]*padding:\s*calc/);
  assert.match(css, /\.canvas\.low-detail \.ledger-card-overview-title\s*{[^}]*white-space:\s*normal;[^}]*word-break:\s*break-word;/s);
  assert.doesNotMatch(css, /\.canvas\.low-detail \.ledger-card-overview-title\s*{[^}]*text-overflow:\s*ellipsis;/s);
});

test('card height normalization command backs up and migrates legacy natural-height cards', () => {
  const packageJson = source('package.json');
  const script = source('bin/normalize-card-heights.mjs');

  assert.match(packageJson, /"normalize-card-heights": "\.\/bin\/normalize-card-heights\.mjs"/);
  assert.match(script, /card-height-\$\{stamp\(\)\}/);
  assert.match(script, /typeof card\.h !== 'number' && typeof card\.height !== 'number'/);
  assert.match(script, /ledger-card-detail-layer/);
  assert.match(script, /card\.scrollHeight \|\| card\.getBoundingClientRect\(\)\.height/);
  assert.match(script, /await mkdir\(backupDir, \{ recursive: true \}\)/);
  assert.match(script, /await writeFile\(backupPath, originalText, 'utf8'\)/);
  assert.match(script, /await writeFile\(absoluteLedgerPath, `\$\{JSON\.stringify\(ledger, null, 2\)\}\\n`, 'utf8'\)/);
});

test('description editor preserves rendered body size and lets textarea own wheel scroll', () => {
  const specs = source('documentation/specs.json');
  const editorRuntime = source('frontend/src/runtime/card/effect/begin-ledger-card-edit.ts');
  const wheelRuntime = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const css = source('frontend/assets/canvas/objects.css');

  assert.match(specs, /9a7d3c5e/);
  assert.match(editorRuntime, /body\.offsetHeight \|\| body\.getBoundingClientRect\(\)\.height/);
  assert.match(editorRuntime, /textarea\.style\.minHeight = `\$\{bodyHeight\}px`;/);
  assert.match(editorRuntime, /textarea\.style\.height = `\$\{bodyHeight\}px`;/);
  assert.match(editorRuntime, /addEventListener\('wheel', \(event\) => \{\s*event\.stopPropagation\(\);/s);
  assert.match(wheelRuntime, /if \(shouldCaptureWheelTarget\(event\)\) return;/);
  assert.match(css, /\.ledger-card-description-editor\s*{[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain;/s);
});

test('local app and asset routes are served without browser cache ambiguity', () => {
  const specs = source('documentation/specs.json');
  const server = source('backend/src/business/server/helper/create-http-server.ts');

  assert.match(specs, /3c1d8f6b/);
  assert.match(server, /response\.setHeader\('cache-control', 'no-store'\)/);
});

test('card field tabs preserve measured description height and fade panel switches', () => {
  const specs = source('documentation/specs.json');
  const css = source('frontend/assets/canvas/objects.css');
  const component = source('frontend/src/runtime/ledger/component/patch-ledger-card.ts');
  const action = source('frontend/src/runtime/input/controller/handle-action-click.ts');
  const controller = source('frontend/src/runtime/card/controller/switch-card-tab-controller.ts');
  const sync = source('frontend/src/runtime/card/effect/sync-ledger-card-tab-frames.ts');
  const scheduledSync = source('frontend/src/runtime/card/effect/schedule-ledger-card-tab-frame-sync.ts');
  const sizeWatch = source('frontend/src/runtime/card/effect/watch-ledger-card-tab-frame-size.ts');
  const gesture = source('frontend/src/runtime/gesture/helper/is-gesture-control-target.ts');
  const renderSurface = source('frontend/src/runtime/ledger/effect/render-ledger-surface.ts');

  assert.match(specs, /a6f4c2e1/);
  assert.match(specs, /d0b7e3a9/);
  assert.match(specs, /e4c1b8f5/);
  assert.match(specs, /91f0c6a2/);
  assert.match(specs, /b0f6a1c3/);
  assert.match(specs, /c6e3b7d1/);
  assert.match(specs, /f8d2c4a7/);
  assert.match(specs, /6a2d9f0e/);
  assert.match(specs, /0d4c8b2f/);
  assert.match(specs, /7b0f2e6c/);
  assert.match(specs, /1a8d5f7b/);
  assert.match(specs, /2e7c9a1d/);
  assert.match(specs, /8c4e2b71/);
  assert.match(component, /renderLedgerCardTabs/);
  assert.match(component, /renderLedgerCardTabFrame/);
  assert.doesNotMatch(component, /function renderLedgerCardTabs/);
  assert.doesNotMatch(component, /function renderLedgerCardTabFrame/);
  assert.match(action, /switch-card-tab/);
  assert.match(action, /closest\('\.card\[data-card-id\]'\)/);
  assert.match(controller, /activeTabByCardId/);
  assert.match(sync, /--ledger-card-tab-height/);
  assert.match(sync, /rect\.bottom - descriptionTop/);
  assert.match(scheduledSync, /requestAnimationFrame/);
  assert.match(scheduledSync, /document\.fonts/);
  assert.match(sizeWatch, /ResizeObserver/);
  assert.match(renderSurface, /scheduleLedgerCardTabFrameSync\(content\)/);
  assert.match(renderSurface, /watchLedgerCardTabFrameSize\(content\)/);
  assert.match(gesture, /\[data-wheel-capture\]/);
  assert.match(css, /\.ledger-card-tabs\s*{[^}]*position:\s*absolute;[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;[^}]*transition:/s);
  assert.match(sync, /description\.children/);
  assert.match(css, /\.card:hover \.ledger-card-tabs,/);
  assert.match(css, /\.card:has\(\.ledger-card-tab:focus-visible\) \.ledger-card-tabs/);
  assert.doesNotMatch(css, /\.card:focus-within \.ledger-card-tabs/);
  assert.doesNotMatch(css, /\.card\.selected \.ledger-card-tabs/);
  assert.match(css, /\.ledger-card-tabs\s*{[^}]*drop-shadow\(0 16px 18px rgba\(0, 0, 0, 0\.94\)\)[^}]*drop-shadow\(0 4px 8px rgba\(0, 0, 0, 0\.9\)\)/s);
  assert.doesNotMatch(css, /\.ledger-card-tabs\s*{[^}]*filter:[^}]*var\(--card-zone-color\)/s);
  assert.match(css, /\.card \.ledger-card-tabs \.ledger-card-tab:hover,/);
  assert.match(css, /\.card \.ledger-card-tabs \.ledger-card-tab\s*{[^}]*border:\s*1px solid var\(--card-zone-color\);[^}]*background-color:\s*var\(--card-zone-color\);[^}]*background-image:[^}]*color-mix\(in srgb, var\(--card-zone-color\), #171a20 58%\)[^}]*box-shadow:/s);
  assert.match(css, /\.card \.ledger-card-tabs \.ledger-card-tab:hover,[^}]*{[^}]*border-color:\s*color-mix\(in srgb, var\(--card-zone-color\), #ffffff 14%\);[^}]*background-color:\s*var\(--card-zone-color\);[^}]*color:\s*#05070a;[^}]*box-shadow:/s);
  assert.match(css, /\.card \.ledger-card-tabs \.ledger-card-tab\.is-active\s*{[^}]*border-color:\s*color-mix\(in srgb, var\(--card-zone-color\), #ffffff 22%\);[^}]*background-color:\s*var\(--card-zone-color\);[^}]*color:\s*#05070a;[^}]*box-shadow:/s);
  assert.match(css, /\.card \.ledger-card-tabs \.ledger-card-tab\.is-active:hover,[^}]*{[^}]*border-color:\s*color-mix\(in srgb, var\(--card-zone-color\), #ffffff 32%\);[^}]*background-color:\s*var\(--card-zone-color\);[^}]*color:\s*#05070a;[^}]*box-shadow:/s);
  assert.match(css, /\.ledger-card-tab-frame\s*{[^}]*height:\s*var\(--ledger-card-tab-height, 120px\);[^}]*overflow:\s*hidden;/s);
  assert.match(css, /\.ledger-card-tab-frame\[data-active-card-tab="description"\]\s*{[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.ledger-card-panel\s*{[^}]*overflow:\s*visible;[^}]*transition:\s*opacity 150ms ease;/s);
  assert.match(css, /\.ledger-card-fields-panel\s*{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.ledger-card-panel\.is-active\s*{[^}]*opacity:\s*1;[^}]*pointer-events:\s*auto;/s);
  assert.doesNotMatch(sync, /description\.offsetHeight/);
});
