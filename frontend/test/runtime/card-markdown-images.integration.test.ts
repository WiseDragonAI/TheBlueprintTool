import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('card markdown images render as resizeable aspect-preserving media and adjacent images become a carousel', () => {
  const parser = source('frontend/src/runtime/ledger/helper/parse-ledger-card-markdown.ts');
  const inlineParser = source('frontend/src/runtime/ledger/helper/parse-ledger-markdown-inline.ts');
  const renderer = source('frontend/src/runtime/ledger/component/render-ledger-card-markdown.ts');
  const mediaRenderer = source('frontend/src/runtime/ledger/component/render-ledger-card-media.ts');
  const titleRenderer = source('frontend/src/runtime/ledger/component/append-title-text.ts');
  const doubleClick = source('frontend/src/runtime/input/controller/handle-card-double-click.ts');
  const wheel = source('frontend/src/runtime/gesture/controller/handle-wheel.ts');
  const css = source('frontend/assets/canvas/objects.css');

  assert.match(inlineParser, /text\.startsWith\('!\[', start\)/);
  assert.match(inlineParser, /kind:\s*'image'/);
  assert.match(parser, /kind:\s*'images'/);
  assert.match(parser, /standaloneImagesFromLine/);
  assert.match(parser, /if \(!line\) \{\s*list = null;\s*continue;\s*\}/);
  assert.match(parser, /images\.images\.push\(\.\.\.standaloneImages\)/);
  assert.match(renderer, /renderLedgerCardMedia/);
  assert.match(mediaRenderer, /ledger-card-media-carousel/);
  assert.match(mediaRenderer, /dataset\.wheelCapture = 'true'/);
  assert.match(mediaRenderer, /dataset\.imageSizeId = sizeSource/);
  assert.match(mediaRenderer, /--ledger-card-media-aspect-ratio/);
  assert.match(mediaRenderer, /naturalWidth/);
  assert.match(mediaRenderer, /imageSizes\[source\] = \{ width, height \}/);
  assert.match(mediaRenderer, /Math\.round\(element\.offsetWidth\)/);
  assert.match(mediaRenderer, /Math\.round\(element\.offsetHeight\)/);
  assert.doesNotMatch(mediaRenderer, /getBoundingClientRect\(\)\.(width|height)/);
  assert.match(mediaRenderer, /commitActiveLedgerMutation\(\{ action: 'patch-card', cardPatch: \{ id: options\.cardId/);
  assert.match(mediaRenderer, /const slideCount = track\.children\.length/);
  assert.match(mediaRenderer, /const nextIndex = \(currentIndex \+ direction \+ slideCount\) % slideCount/);
  assert.match(mediaRenderer, /track\.scrollTo\(\{ left: nextIndex \* slideWidth, behavior: 'smooth' \}\)/);
  assert.match(renderer, /renderLedgerCardMarkdown\(markdown: string, options/);
  assert.match(doubleClick, /target\.closest\('\[data-ledger-card-media\]'\)/);
  assert.match(wheel, /advanceCarouselFromWheel\(event\)/);
  assert.match(wheel, /event\.ctrlKey/);
  assert.match(wheel, /\.ledger-card-media-carousel/);
  assert.match(wheel, /event\.preventDefault\(\)/);
  assert.match(wheel, /track\.scrollTo\(\{ left: nextIndex \* slideWidth, behavior: 'smooth' \}\)/);
  assert.match(titleRenderer, /node\.kind === 'image'/);
  assert.match(source('frontend/src/runtime/ledger/component/append-inline-nodes.ts'), /Math\.round\(frame\.offsetWidth\)/);
  assert.doesNotMatch(source('frontend/src/runtime/ledger/component/append-inline-nodes.ts'), /getBoundingClientRect\(\)\.(width|height)/);
  assert.match(css, /\.ledger-card-media-shell\s*{[^}]*max-width:\s*100%;[^}]*aspect-ratio:\s*var\(--ledger-card-media-aspect-ratio, 4 \/ 3\);[^}]*resize:\s*horizontal;/s);
  assert.match(css, /\.ledger-card-media-track\s*{[^}]*scroll-snap-type:\s*x mandatory;/s);
  assert.match(css, /\.ledger-card-media-image\s*{[^}]*object-fit:\s*contain;[^}]*object-position:\s*center;/s);
  assert.match(css, /\.ledger-card-inline-image-frame\s*{[^}]*aspect-ratio:\s*var\(--ledger-card-inline-image-aspect-ratio, 3 \/ 2\);[^}]*resize:\s*horizontal;/s);
  assert.match(css, /\.ledger-card-inline-image\s*{[^}]*object-fit:\s*contain;/s);
});
