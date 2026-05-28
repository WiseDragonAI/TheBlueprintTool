import { type LedgerMarkdownInline } from './parse-ledger-card-markdown.js';

function parseImageAt(text: string, start: number): { node: LedgerMarkdownInline; end: number } | null {
  if (!text.startsWith('![', start)) return null;
  const altEnd = text.indexOf('](', start + 2);
  if (altEnd === -1) return null;
  let cursor = altEnd + 2;
  let escaped = false;
  for (; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === ')') break;
  }
  if (cursor >= text.length) return null;
  const destination = text.slice(altEnd + 2, cursor).trim();
  const match = destination.match(/^<?([^<>"'\s]+)>?(?:\s+["']([^"']*)["'])?$/);
  if (!match) return null;
  return {
    node: {
      kind: 'image',
      alt: text.slice(start + 2, altEnd),
      src: match[1],
      title: match[2] ?? ''
    },
    end: cursor + 1
  };
}

function nextInlineTokenIndex(text: string, start: number): number {
  const indexes = ['![', '`', '**']
    .map((token) => text.indexOf(token, start))
    .filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

export function parseLedgerMarkdownInline(text: string): LedgerMarkdownInline[] {
  const nodes: LedgerMarkdownInline[] = [];
  let index = 0;
  while (index < text.length) {
    const image = parseImageAt(text, index);
    if (image) {
      nodes.push(image.node);
      index = image.end;
      continue;
    }
    if (text[index] === '`') {
      const end = text.indexOf('`', index + 1);
      if (end > index + 1) {
        nodes.push({ kind: 'code', text: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }
    if (text.startsWith('**', index)) {
      const end = text.indexOf('**', index + 2);
      if (end > index + 2) {
        nodes.push({ kind: 'strong', text: text.slice(index + 2, end) });
        index = end + 2;
        continue;
      }
    }
    const next = nextInlineTokenIndex(text, index + 1);
    const end = next >= 0 ? next : text.length;
    nodes.push({ kind: 'text', text: text.slice(index, end) });
    index = end;
  }
  return nodes.filter((node) => node.kind !== 'text' || node.text.length > 0);
}
