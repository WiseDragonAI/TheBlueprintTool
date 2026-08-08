/**
 * WHAT: Parses markdown blocks for ledger cards and thread conversation notes.
 * WHY: Card bodies and thread notes must share one block model so markdown behavior cannot drift.
 */
import { isLedgerMarkdownTableDivider } from './is-ledger-markdown-table-divider.js';
import { normalizeLedgerMarkdownWithSourceMap } from './normalize-ledger-markdown.js';
import { parseLedgerMarkdownInline } from './parse-ledger-markdown-inline.js';
import { parseLedgerMarkdownTableRow } from './parse-ledger-markdown-table-row.js';

export type LedgerMarkdownInline = ({
  kind: 'text' | 'strong' | 'code';
  text: string;
} | {
  kind: 'link';
  text: string;
  href: string;
  title: string;
} | {
  kind: 'image';
  alt: string;
  src: string;
  title: string;
}) & { readonly from?: number; readonly to?: number };

export type LedgerMarkdownBlock = (
  | { kind: 'heading'; level: number; children: LedgerMarkdownInline[] }
  | { kind: 'paragraph'; children: LedgerMarkdownInline[] }
  | { kind: 'blockquote'; blocks: LedgerMarkdownBlock[] }
  | { kind: 'images'; images: Extract<LedgerMarkdownInline, { kind: 'image' }>[] }
  | { kind: 'htmlEmbeds'; embeds: { title: string; src: string }[] }
  | { kind: 'gitDiff'; title: string; repository: string; target: string }
  | { kind: 'questions'; title: string; questionnaireId: string }
  | { kind: 'list'; ordered: boolean; start: number; items: LedgerMarkdownInline[][] }
  | { kind: 'table'; headers: LedgerMarkdownInline[][]; rows: LedgerMarkdownInline[][][] }
  | { kind: 'hr' }
  | { kind: 'code'; language: string; text: string }
) & { readonly from?: number; readonly to?: number };

function sourceSpan<T extends object>(value: T, from: number, to: number): T {
  Object.defineProperties(value, {
    from: { value: from, enumerable: false, configurable: true },
    to: { value: to, enumerable: false, configurable: true },
  });
  return value;
}

function standaloneImagesFromLine(
  line: string,
  baseOffset: number,
): Extract<LedgerMarkdownInline, { kind: 'image' }>[] {
  const inline = parseLedgerMarkdownInline(line, baseOffset);
  const images = inline.filter((node): node is Extract<LedgerMarkdownInline, { kind: 'image' }> => node.kind === 'image');
  if (images.length === 0) return [];
  const hasOnlyImagesAndSpacing = inline.every((node) => node.kind === 'image' || (node.kind === 'text' && node.text.trim() === ''));
  return hasOnlyImagesAndSpacing ? images : [];
}

function parseDestination(destination: string): { url: string; title: string } | null {
  const match = destination.trim().match(/^<?([^<>"'\s]+)>?(?:\s+["']([^"']*)["'])?$/);
  return match ? { url: match[1], title: match[2] ?? '' } : null;
}

function standaloneHtmlEmbedFromLine(line: string): { title: string; src: string } | null {
  const match = line.match(/^::html\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (!match) return null;
  const destination = parseDestination(match[2] ?? '');
  if (!destination) return null;
  return {
    title: (match[1] || destination.title).trim(),
    src: destination.url
  };
}

function standaloneGitDiffFromLine(line: string): Extract<LedgerMarkdownBlock, { kind: 'gitDiff' }> | null {
  const match = line.match(/^::git-diff\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (!match) return null;
  const destination = parseDestination(match[2] ?? '');
  if (!destination || !destination.url.startsWith('git-diff:?')) return null;
  const query = new URLSearchParams(destination.url.slice('git-diff:?'.length));
  const repository = String(query.get('repo') ?? '').trim();
  const target = String(query.get('path') ?? '').trim();
  if (!repository || !target) return null;
  return { kind: 'gitDiff', title: (match[1] || destination.title || 'Git review').trim(), repository, target };
}

function standaloneQuestionsFromLine(line: string): Extract<LedgerMarkdownBlock, { kind: 'questions' }> | null {
  const match = line.match(/^::questions\[([^\]\n]*)\]\(([^)\n]+)\)$/);
  if (!match) return null;
  const destination = parseDestination(match[2] ?? '');
  if (!destination || !destination.url.startsWith('questions:?')) return null;
  const query = new URLSearchParams(destination.url.slice('questions:?'.length));
  const questionnaireId = String(query.get('id') ?? '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(questionnaireId)) return null;
  return { kind: 'questions', title: (match[1] || destination.title || 'Questions').trim(), questionnaireId };
}

export function parseLedgerCardMarkdown(markdown: string): LedgerMarkdownBlock[] {
  const blocks: LedgerMarkdownBlock[] = [];
  let list: Extract<LedgerMarkdownBlock, { kind: 'list' }> | null = null;
  let images: Extract<LedgerMarkdownBlock, { kind: 'images' }> | null = null;
  let htmlEmbeds: Extract<LedgerMarkdownBlock, { kind: 'htmlEmbeds' }> | null = null;
  const normalized = normalizeLedgerMarkdownWithSourceMap(markdown);
  const lines = normalized.markdown.split('\n');
  const lineStarts: number[] = [];
  let nextLineStart = 0;
  for (const line of lines) {
    lineStarts.push(nextLineStart);
    nextLineStart += line.length + 1;
  }
  const append = <T extends LedgerMarkdownBlock>(block: T, from: number, to: number): T => {
    blocks.push(sourceSpan(block, normalized.sourceOffset(from), normalized.sourceOffset(to)));
    return block;
  };
  const extend = (block: LedgerMarkdownBlock, to: number): void => {
    Object.defineProperty(block, 'to', {
      value: normalized.sourceOffset(to),
      enumerable: false,
      configurable: true,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const rawLineStart = lineStarts[index];
    const fence = rawLine.match(/^```([A-Za-z0-9_+#.-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      for (; index < lines.length; index += 1) {
        if (/^```\s*$/.test(lines[index])) break;
        codeLines.push(lines[index]);
      }
      list = null;
      images = null;
      htmlEmbeds = null;
      const end = lineStarts[index] + lines[index].length;
      append({ kind: 'code', language: fence[1] ?? '', text: codeLines.join('\n') }, rawLineStart, end);
      continue;
    }
    const line = rawLine.trim();
    const trimmedStart = rawLineStart + rawLine.indexOf(line);
    const trimmedEnd = trimmedStart + line.length;
    if (!line) {
      list = null;
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      list = null;
      images = null;
      htmlEmbeds = null;
      append({ kind: 'hr' }, trimmedStart, trimmedEnd);
      continue;
    }
    const blockquote = rawLine.match(/^\s*>\s?(.*)$/);
    // WHAT: Collect one contiguous sequence of quote-prefixed Markdown lines into a blockquote.
    // WHY: Quote contents need one disclosure boundary while retaining the canonical nested block parser.
    if (blockquote) {
      const quoteLines: string[] = [];
      let quoteEnd = trimmedEnd;
      for (; index < lines.length; index += 1) {
        const quoteLine = lines[index].match(/^\s*>\s?(.*)$/);
        // WHAT: End the quote at the first line without a quote marker.
        // WHY: Following ordinary Markdown must render outside the disclosure boundary.
        if (!quoteLine) break;
        quoteLines.push(quoteLine[1] ?? '');
        quoteEnd = lineStarts[index] + lines[index].length;
      }
      index -= 1;
      list = null;
      images = null;
      htmlEmbeds = null;
      append({ kind: 'blockquote', blocks: parseLedgerCardMarkdown(quoteLines.join('\n')) }, rawLineStart, quoteEnd);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      list = null;
      images = null;
      htmlEmbeds = null;
      append({
        kind: 'heading',
        level: heading[1].length,
        children: parseLedgerMarkdownInline(heading[2], normalized.sourceOffset(trimmedStart + heading[1].length + 1))
      }, trimmedStart, trimmedEnd);
      continue;
    }
    const headerCells = parseLedgerMarkdownTableRow(line);
    if (headerCells.length >= 2 && isLedgerMarkdownTableDivider(lines[index + 1] ?? '', headerCells.length)) {
      const table: Extract<LedgerMarkdownBlock, { kind: 'table' }> = {
        kind: 'table',
        headers: headerCells.map(parseLedgerMarkdownInline),
        rows: []
      };
      index += 2;
      for (; index < lines.length; index += 1) {
        const rowLine = lines[index].trim();
        if (!rowLine || isLedgerMarkdownTableDivider(rowLine)) break;
        const rowCells = parseLedgerMarkdownTableRow(rowLine);
        if (rowCells.length !== headerCells.length) break;
        table.rows.push(rowCells.map(parseLedgerMarkdownInline));
      }
      index -= 1;
      list = null;
      images = null;
      htmlEmbeds = null;
      append(table, trimmedStart, lineStarts[Math.max(index, 0)] + (lines[Math.max(index, 0)]?.length ?? 0));
      continue;
    }
    const standaloneImages = standaloneImagesFromLine(line, normalized.sourceOffset(trimmedStart));
    if (standaloneImages.length > 0) {
      list = null;
      htmlEmbeds = null;
      if (!images) {
        images = { kind: 'images', images: [] };
        append(images, trimmedStart, trimmedEnd);
      }
      images.images.push(...standaloneImages);
      extend(images, trimmedEnd);
      continue;
    }
    const htmlEmbed = standaloneHtmlEmbedFromLine(line);
    if (htmlEmbed) {
      list = null;
      images = null;
      if (!htmlEmbeds) {
        htmlEmbeds = { kind: 'htmlEmbeds', embeds: [] };
        append(htmlEmbeds, trimmedStart, trimmedEnd);
      }
      htmlEmbeds.embeds.push(htmlEmbed);
      extend(htmlEmbeds, trimmedEnd);
      continue;
    }
    const gitDiff = standaloneGitDiffFromLine(line);
    if (gitDiff) {
      list = null;
      images = null;
      htmlEmbeds = null;
      append(gitDiff, trimmedStart, trimmedEnd);
      continue;
    }
    const questions = standaloneQuestionsFromLine(line);
    if (questions) {
      list = null;
      images = null;
      htmlEmbeds = null;
      append(questions, trimmedStart, trimmedEnd);
      continue;
    }
    const unorderedItem = line.match(/^[-*]\s+(.*)$/);
    const orderedItem = line.match(/^(\d+)\.\s+(.*)$/);
    const item = unorderedItem ?? orderedItem;
    if (item) {
      images = null;
      htmlEmbeds = null;
      const ordered = Boolean(orderedItem);
      if (!list || list.ordered !== ordered) {
        list = {
          kind: 'list',
          ordered,
          start: ordered ? Number(orderedItem?.[1] ?? 1) : 1,
          items: []
        };
        append(list, trimmedStart, trimmedEnd);
      }
      const itemText = ordered ? item[2] : item[1];
      list.items.push(parseLedgerMarkdownInline(
        itemText,
        normalized.sourceOffset(trimmedStart + line.indexOf(itemText)),
      ));
      extend(list, trimmedEnd);
      continue;
    }
    list = null;
    images = null;
    htmlEmbeds = null;
    append({
      kind: 'paragraph',
      children: parseLedgerMarkdownInline(line, normalized.sourceOffset(trimmedStart)),
    }, trimmedStart, trimmedEnd);
  }

  return blocks;
}
