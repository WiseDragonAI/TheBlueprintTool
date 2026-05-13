export type LedgerMarkdownInline = {
  kind: 'text' | 'strong' | 'code';
  text: string;
};

export type LedgerMarkdownBlock =
  | { kind: 'paragraph'; children: LedgerMarkdownInline[] }
  | { kind: 'list'; items: LedgerMarkdownInline[][] };

export function parseLedgerCardMarkdown(markdown: string): LedgerMarkdownBlock[] {
  const blocks: LedgerMarkdownBlock[] = [];
  let list: Extract<LedgerMarkdownBlock, { kind: 'list' }> | null = null;

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      list = null;
      continue;
    }
    const item = line.match(/^[-*]\s+(.*)$/);
    if (item) {
      if (!list) {
        list = { kind: 'list', items: [] };
        blocks.push(list);
      }
      list.items.push(parseInlineMarkdown(item[1]));
      continue;
    }
    list = null;
    blocks.push({ kind: 'paragraph', children: parseInlineMarkdown(line.replace(/^#{1,6}\s+/, '')) });
  }

  return blocks;
}

function parseInlineMarkdown(text: string): LedgerMarkdownInline[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith('`') && part.endsWith('`')) return { kind: 'code', text: part.slice(1, -1) };
    if (part.startsWith('**') && part.endsWith('**')) return { kind: 'strong', text: part.slice(2, -2) };
    return { kind: 'text', text: part };
  });
}
