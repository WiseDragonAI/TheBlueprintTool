import { type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { highlightLedgerCode, highlightLedgerCodeHtml } from '../helper/highlight-ledger-code.js';
import type { LedgerMarkdownChangeProjection } from '../../content-authoring/helper/create-ledger-markdown-presentation-extension.js';

type CodeBlockProjectionOptions = {
  source?: string;
  changeProjection?: LedgerMarkdownChangeProjection;
};

function appendHighlightedCode(parent: HTMLElement, text: string, language: string): void {
  const highlightedHtml = highlightLedgerCodeHtml(text, language);
  // WHAT: Preserve the canonical highlighter output when the language renderer supports the line.
  // WHY: Diff projection changes line ownership, not syntax presentation.
  if (highlightedHtml !== null) {
    parent.innerHTML = highlightedHtml;
    return;
  }
  for (const token of highlightLedgerCode(text, language)) {
    // WHAT: Preserve plain syntax tokens as literal text nodes.
    // WHY: Adding wrapper elements to plain text would drift the canonical code DOM without semantic value.
    if (token.kind === 'plain') {
      parent.appendChild(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = `syntax-${token.kind}`;
    span.textContent = token.text;
    parent.appendChild(span);
  }
}

function intersects(from: number, to: number, addition: { from: number; to: number }): boolean {
  return addition.from < to && addition.to > from;
}

function projectedCodeBodyStart(
  block: Extract<LedgerMarkdownBlock, { kind: 'code' }>,
  source: string,
): number | null {
  const firstBreak = source.indexOf('\n');
  // WHAT: Reject code projection when the exact opening-fence boundary is unavailable.
  // WHY: Line-level Git identity cannot be guessed from highlighted output.
  if (typeof block.from !== 'number' || firstBreak < 0) return null;
  return block.from + firstBreak + 1;
}

function appendProjectedDeletion(parent: HTMLElement, deletion: { anchor: number; text: string }): void {
  const line = document.createElement('span');
  line.className = 'ledger-card-code-line cm-authored-deletion';
  line.dataset.sourceAnchor = String(deletion.anchor);
  line.setAttribute('role', 'group');
  line.setAttribute('aria-label', `− Removed Markdown: ${deletion.text || 'blank line'}`);
  const label = document.createElement('span');
  label.className = 'cm-authored-deletion-label';
  label.textContent = '− Removed';
  const content = document.createElement('span');
  content.className = 'cm-authored-deletion-content';
  content.textContent = deletion.text || ' ';
  line.append(label, content);
  parent.appendChild(line);
}

function appendProjectedCode(
  code: HTMLElement,
  block: Extract<LedgerMarkdownBlock, { kind: 'code' }>,
  options: CodeBlockProjectionOptions,
): boolean {
  const bodyStart = projectedCodeBodyStart(block, options.source ?? '');
  // WHAT: Keep the canonical whole-block renderer when no exact diff projection is admitted.
  // WHY: Card and non-diff editor rendering must retain the established DOM and syntax behavior.
  if (bodyStart === null || !options.changeProjection) return false;
  const lines = block.text.split('\n');
  let offset = bodyStart;
  for (const [index, text] of lines.entries()) {
    const from = offset;
    const to = from + text.length + (index < lines.length - 1 ? 1 : 0);
    for (const deletion of options.changeProjection.deletions.filter((entry) => entry.anchor === from)) {
      appendProjectedDeletion(code, deletion);
    }
    const line = document.createElement('span');
    line.className = 'ledger-card-code-line';
    line.dataset.sourceFrom = String(from);
    line.dataset.sourceTo = String(to);
    // WHAT: Mark only the current code line whose authored range intersects an admitted addition.
    // WHY: A multi-line fenced block can contain both changed lines and unchanged context.
    if (options.changeProjection.additions.some((addition) => intersects(from, to, addition))) {
      line.classList.add('cm-authored-addition');
      line.setAttribute('data-change', 'added');
      line.setAttribute('aria-label', 'Added Markdown');
    }
    appendHighlightedCode(line, text, block.language);
    code.appendChild(line);
    offset = to;
  }
  for (const deletion of options.changeProjection.deletions.filter((entry) => entry.anchor >= offset)) {
    appendProjectedDeletion(code, deletion);
  }
  return true;
}

export function renderLedgerCardCodeBlock(
  block: Extract<LedgerMarkdownBlock, { kind: 'code' }>,
  options: CodeBlockProjectionOptions = {},
): HTMLElement {
  const pre = document.createElement('pre');
  pre.className = 'ledger-card-code-block';
  // WHAT: Preserve the canonical language identity when the fence declares one.
  // WHY: Editor replacement widgets must expose the same code metadata as rendered cards.
  if (block.language) pre.dataset.language = block.language;
  const code = document.createElement('code');
  code.className = ['hljs', block.language ? `language-${block.language}` : ''].filter(Boolean).join(' ');
  // WHAT: Render exact line-level Git projection only for an identity-bound editor widget.
  // WHY: Canonical cards keep their established whole-block syntax DOM while the editor needs mixed changed and context lines.
  if (appendProjectedCode(code, block, options)) {
    pre.appendChild(code);
    return pre;
  }
  appendHighlightedCode(code, block.text, block.language);
  pre.appendChild(code);
  return pre;
}
