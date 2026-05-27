import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { highlightLedgerCode, highlightLedgerCodeHtml } from '../helper/highlight-ledger-code.js';

export function renderLedgerCardCodeBlock(block: Extract<LedgerMarkdownBlock, { kind: 'code' }>): HTMLElement {
  const pre = document.createElement('pre');
  pre.className = 'ledger-card-code-block';
  if (block.language) pre.dataset.language = block.language;
  const code = document.createElement('code');
  code.className = ['hljs', block.language ? `language-${block.language}` : ''].filter(Boolean).join(' ');
  const highlightedHtml = highlightLedgerCodeHtml(block.text, block.language);
  if (highlightedHtml !== null) {
    code.innerHTML = highlightedHtml;
    pre.appendChild(code);
    return pre;
  }
  for (const token of highlightLedgerCode(block.text, block.language)) {
    if (token.kind === 'plain') {
      code.appendChild(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = `syntax-${token.kind}`;
    span.textContent = token.text;
    code.appendChild(span);
  }
  pre.appendChild(code);
  return pre;
}
