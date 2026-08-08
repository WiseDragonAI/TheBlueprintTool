/**
 * WHAT: Renders the shared markdown body used by cards and thread notes.
 * WHY: Markdown display must stay canonical across the canvas and the conversation ledger.
 */
import { appendInlineNodes } from './append-inline-nodes.js';
import { parseLedgerCardMarkdown, type LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { renderLedgerCardCodeBlock } from './render-ledger-card-code-block.js';
import { renderLedgerCardHtmlEmbeds } from './render-ledger-card-html-embeds.js';
import { renderLedgerCardMedia, type LedgerCardImageSizes } from './render-ledger-card-media.js';
import { renderLedgerCardTable } from './render-ledger-card-table.js';
import { renderLedgerCardGitDiff, type GitReviewNotesChangeHandler } from './render-ledger-card-git-diff.js';
import { renderLedgerCardQuestions, type QuestionnairesChangeHandler } from './render-ledger-card-questions.js';

type LedgerCardMarkdownOptions = {
  cardId?: string;
  questionnaireCardId?: string;
  carouselDriver?: 'internal' | 'external';
  imageSizes?: LedgerCardImageSizes;
  mediaSurface?: 'card' | 'detail' | 'thread';
  onImageResize?: (source: string, dimensions: { width: number; height: number }) => void;
  questionnaires?: unknown;
  onQuestionnairesChange?: QuestionnairesChangeHandler;
  gitReviewNotes?: unknown;
  onGitReviewNotesChange?: GitReviewNotesChangeHandler;
};

function appendLedgerMarkdownBlocks(
  parent: HTMLElement,
  blocks: LedgerMarkdownBlock[],
  options: LedgerCardMarkdownOptions,
): void {
  for (const block of blocks) {
    // WHAT: Render heading blocks with their parsed level and inline children.
    // WHY: Headings retain semantic hierarchy inside both root Markdown and nested quotes.
    if (block.kind === 'heading') {
      const heading = document.createElement(`h${Math.min(6, Math.max(1, block.level))}`);
      heading.className = `ledger-card-heading ledger-card-heading-${block.level}`;
      appendInlineNodes(heading, block.children, options);
      parent.appendChild(heading);
      continue;
    }
    // WHAT: Render list blocks with their ordered or unordered native element.
    // WHY: Nested quote content must preserve the same list semantics as root Markdown.
    if (block.kind === 'list') {
      const list = document.createElement(block.ordered ? 'ol' : 'ul');
      // WHAT: Preserve an authored ordered-list start when it differs from the HTML default.
      // WHY: Numbered Markdown can intentionally continue a sequence inside any rendering boundary.
      if (block.ordered && block.start !== 1) list.setAttribute('start', String(block.start));
      for (const item of block.items) {
        const li = document.createElement('li');
        appendInlineNodes(li, item, options);
        list.appendChild(li);
      }
      parent.appendChild(list);
      continue;
    }
    // WHAT: Delegate table blocks to the canonical table component.
    // WHY: Table structure and scrolling behavior must remain shared across nesting levels.
    if (block.kind === 'table') {
      parent.appendChild(renderLedgerCardTable(block, options));
      continue;
    }
    // WHAT: Delegate standalone image blocks to the canonical media component.
    // WHY: Media sizing and interaction options must survive inside quoted content.
    if (block.kind === 'images') {
      parent.appendChild(renderLedgerCardMedia(block, options));
      continue;
    }
    // WHAT: Delegate HTML embed directives to the authorized embed component.
    // WHY: Quote nesting must not create a second raw-HTML rendering path.
    if (block.kind === 'htmlEmbeds') {
      parent.appendChild(renderLedgerCardHtmlEmbeds(block, options));
      continue;
    }
    // WHAT: Delegate Git review directives to the canonical review component.
    // WHY: Repository and review state ownership must remain outside the generic Markdown renderer.
    if (block.kind === 'gitDiff') {
      parent.appendChild(renderLedgerCardGitDiff(block, options));
      continue;
    }
    // WHAT: Delegate questionnaire directives to the canonical questionnaire component.
    // WHY: Questionnaire identity and change handling must remain shared inside nested Markdown.
    if (block.kind === 'questions') {
      parent.appendChild(renderLedgerCardQuestions(block, options));
      continue;
    }
    // WHAT: Delegate fenced code blocks to the syntax-highlighted code component.
    // WHY: Quote nesting must preserve safe code rendering and language presentation.
    if (block.kind === 'code') {
      parent.appendChild(renderLedgerCardCodeBlock(block));
      continue;
    }
    // WHAT: Render horizontal-rule blocks as semantic separators.
    // WHY: Quoted Markdown can contain the same structural separators as root Markdown.
    if (block.kind === 'hr') {
      const rule = document.createElement('hr');
      rule.className = 'ledger-card-hr';
      parent.appendChild(rule);
      continue;
    }
    // WHAT: Render each parsed quote as a closed native disclosure with nested canonical Markdown.
    // WHY: Every shared Markdown consumer needs keyboard-operable expansion without custom state or raw HTML.
    if (block.kind === 'blockquote') {
      const disclosure = document.createElement('details');
      disclosure.className = 'ledger-card-blockquote';
      const summary = document.createElement('summary');
      summary.className = 'ledger-card-blockquote-summary';
      summary.textContent = 'Quoted content';
      const content = document.createElement('div');
      content.className = 'ledger-card-blockquote-content';
      appendLedgerMarkdownBlocks(content, block.blocks, options);
      disclosure.append(summary, content);
      parent.appendChild(disclosure);
      continue;
    }
    const paragraph = document.createElement('p');
    appendInlineNodes(paragraph, block.children, options);
    parent.appendChild(paragraph);
  }
}

export function renderLedgerCardMarkdown(markdown: string, options: LedgerCardMarkdownOptions = {}): HTMLElement {
  const body = document.createElement('div');
  body.className = 'ledger-card-body';
  appendLedgerMarkdownBlocks(body, parseLedgerCardMarkdown(markdown), options);

  return body;
}
