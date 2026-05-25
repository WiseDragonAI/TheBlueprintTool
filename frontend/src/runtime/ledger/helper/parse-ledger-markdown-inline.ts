import { type LedgerMarkdownInline } from './parse-ledger-card-markdown.js';

export function parseLedgerMarkdownInline(text: string): LedgerMarkdownInline[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    if (part.startsWith('`') && part.endsWith('`')) return { kind: 'code', text: part.slice(1, -1) };
    if (part.startsWith('**') && part.endsWith('**')) return { kind: 'strong', text: part.slice(2, -2) };
    return { kind: 'text', text: part };
  });
}
