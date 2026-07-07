import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('card markdown html directives render as sandboxed ledger-scoped iframe media', () => {
  const parser = source('frontend/src/runtime/ledger/helper/parse-ledger-card-markdown.ts');
  const renderer = source('frontend/src/runtime/ledger/component/render-ledger-card-markdown.ts');
  const htmlRenderer = source('frontend/src/runtime/ledger/component/render-ledger-card-html-embeds.ts');
  const css = source('frontend/assets/canvas/objects.css');

  assert.match(parser, /kind:\s*'htmlEmbeds'/);
  assert.match(parser, /standaloneHtmlEmbedFromLine/);
  assert.match(parser, /::html\\\[/);
  assert.match(renderer, /renderLedgerCardHtmlEmbeds/);
  assert.match(renderer, /block\.kind === 'htmlEmbeds'/);
  assert.match(htmlRenderer, /ledger-card-html-shell/);
  assert.match(htmlRenderer, /ledger-card-html-frame/);
  assert.doesNotMatch(htmlRenderer, /dataset\.imageSizeId/);
  assert.match(htmlRenderer, /iframe\.sandbox\.add\('allow-scripts', 'allow-same-origin'\)/);
  assert.match(htmlRenderer, /allowedPrefix = `\.decision-os\/cards\/\$\{ledgerStem\}\/assets\/`/);
  assert.match(htmlRenderer, /normalized\.toLowerCase\(\)\.endsWith\('\.html'\)/);
  assert.match(htmlRenderer, /browserUrlForWorkspacePath\(normalizedSource\)/);
  assert.match(htmlRenderer, /ledgerCardMediaCarouselStateId/);
  assert.match(htmlRenderer, /Card HTML embed carousel/);
  assert.match(htmlRenderer, /HTML embed must live under the active ledger card assets directory\./);
  assert.match(css, /\.ledger-card-html-frame,[\s\S]*\.ledger-card-html-invalid\s*{/);
  assert.match(css, /\.ledger-card-html-invalid\s*{[\s\S]*overflow-wrap:\s*anywhere;/);
  assert.doesNotMatch(css, /\.ledger-card-html-shell\s*{[^}]*resize:\s*horizontal;/s);
  assert.doesNotMatch(css, /\.ledger-card-media-shell\s*{[^}]*resize:\s*horizontal;/s);
});
