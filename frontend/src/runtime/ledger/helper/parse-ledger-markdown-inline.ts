import { type LedgerMarkdownInline } from './parse-ledger-card-markdown.js';

function sourceSpan<T extends LedgerMarkdownInline>(node: T, from: number, to: number): T {
  Object.defineProperties(node, {
    from: { value: from, enumerable: false },
    to: { value: to, enumerable: false },
  });
  return node;
}

function parseDestination(destination: string): { url: string; title: string } | null {
  const match = destination.trim().match(/^<?([^<>"'\s]+)>?(?:\s+["']([^"']*)["'])?$/);
  return match ? { url: match[1], title: match[2] ?? '' } : null;
}

function parseImageAt(text: string, start: number, sourceOffset: number): { node: LedgerMarkdownInline; end: number } | null {
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
  const destination = parseDestination(text.slice(altEnd + 2, cursor));
  if (!destination) return null;
  return {
    node: sourceSpan({
      kind: 'image',
      alt: text.slice(start + 2, altEnd),
      src: destination.url,
      title: destination.title
    }, sourceOffset + start, sourceOffset + cursor + 1),
    end: cursor + 1
  };
}

function parseLinkAt(text: string, start: number, sourceOffset: number): { node: LedgerMarkdownInline; end: number } | null {
  if (!text.startsWith('[', start) || text.startsWith('![', start)) return null;
  const labelEnd = text.indexOf('](', start + 1);
  if (labelEnd === -1) return null;
  let cursor = labelEnd + 2;
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
  const destination = parseDestination(text.slice(labelEnd + 2, cursor));
  if (!destination) return null;
  return {
    node: sourceSpan({
      kind: 'link',
      text: text.slice(start + 1, labelEnd),
      href: destination.url,
      title: destination.title
    }, sourceOffset + start, sourceOffset + cursor + 1),
    end: cursor + 1
  };
}

function shouldTrimClosingParen(url: string): boolean {
  const opens = [...url].filter((character) => character === '(').length;
  const closes = [...url].filter((character) => character === ')').length;
  return closes > opens;
}

function trimBareUrlEnd(text: string, start: number, end: number): number {
  let cursor = end;
  while (cursor > start) {
    const character = text[cursor - 1];
    if (/[.,;:!?]/.test(character) || (character === ')' && shouldTrimClosingParen(text.slice(start, cursor)))) {
      cursor -= 1;
      continue;
    }
    break;
  }
  return cursor;
}

function parseBareUrlAt(text: string, start: number, sourceOffset: number): { node: LedgerMarkdownInline; end: number } | null {
  if (!text.startsWith('https://', start) && !text.startsWith('http://', start)) return null;
  let cursor = start;
  for (; cursor < text.length; cursor += 1) {
    if (/[\s<>"']/.test(text[cursor])) break;
  }
  const end = trimBareUrlEnd(text, start, cursor);
  if (end <= start) return null;
  const href = text.slice(start, end);
  return {
    node: sourceSpan({
      kind: 'link',
      text: href,
      href,
      title: ''
    }, sourceOffset + start, sourceOffset + end),
    end
  };
}

function nextInlineTokenIndex(text: string, start: number): number {
  const indexes = ['![', '[', 'https://', 'http://', '`', '**']
    .map((token) => text.indexOf(token, start))
    .filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

export function parseLedgerMarkdownInline(text: string, sourceOffset = 0): LedgerMarkdownInline[] {
  const nodes: LedgerMarkdownInline[] = [];
  let index = 0;
  while (index < text.length) {
    const image = parseImageAt(text, index, sourceOffset);
    if (image) {
      nodes.push(image.node);
      index = image.end;
      continue;
    }
    const link = parseLinkAt(text, index, sourceOffset);
    if (link) {
      nodes.push(link.node);
      index = link.end;
      continue;
    }
    const bareUrl = parseBareUrlAt(text, index, sourceOffset);
    if (bareUrl) {
      nodes.push(bareUrl.node);
      index = bareUrl.end;
      continue;
    }
    if (text[index] === '`') {
      const end = text.indexOf('`', index + 1);
      if (end > index + 1) {
        nodes.push(sourceSpan({ kind: 'code', text: text.slice(index + 1, end) }, sourceOffset + index, sourceOffset + end + 1));
        index = end + 1;
        continue;
      }
    }
    if (text.startsWith('**', index)) {
      const end = text.indexOf('**', index + 2);
      if (end > index + 2) {
        nodes.push(sourceSpan({ kind: 'strong', text: text.slice(index + 2, end) }, sourceOffset + index, sourceOffset + end + 2));
        index = end + 2;
        continue;
      }
    }
    const next = nextInlineTokenIndex(text, index + 1);
    const end = next >= 0 ? next : text.length;
    nodes.push(sourceSpan({ kind: 'text', text: text.slice(index, end) }, sourceOffset + index, sourceOffset + end));
    index = end;
  }
  return nodes.filter((node) => node.kind !== 'text' || node.text.length > 0);
}
