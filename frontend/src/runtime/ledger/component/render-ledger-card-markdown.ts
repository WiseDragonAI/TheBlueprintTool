/**
 * WHAT: Renders the shared markdown body used by cards and thread notes.
 * WHY: Markdown display must stay canonical across the canvas and the conversation ledger.
 */
import { appendInlineNodes } from './append-inline-nodes.js';
import { parseLedgerCardMarkdown } from '../helper/parse-ledger-card-markdown.js';
import { renderLedgerCardCodeBlock } from './render-ledger-card-code-block.js';
import { renderLedgerCardHtmlEmbeds } from './render-ledger-card-html-embeds.js';
import { renderLedgerCardMedia, type LedgerCardImageSizes } from './render-ledger-card-media.js';
import { renderLedgerCardTable } from './render-ledger-card-table.js';
import { renderLedgerCardGitDiff, type GitReviewNotesChangeHandler } from './render-ledger-card-git-diff.js';
import { renderLedgerCardQuestions, type QuestionnairesChangeHandler } from './render-ledger-card-questions.js';
import type { LedgerMarkdownChangeProjection } from '../../content-authoring/helper/create-ledger-markdown-presentation-extension.js';

export type LedgerCardMarkdownOptions = {
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
  source?: string;
  changeProjection?: LedgerMarkdownChangeProjection;
};

function intersectsAddition(
  options: LedgerCardMarkdownOptions,
  from: number | undefined,
  to: number | undefined,
): boolean {
  // WHAT: Reject semantic nodes without an exact non-empty source span.
  // WHY: Git identity must never be inferred from rendered text.
  if (typeof from !== 'number' || typeof to !== 'number' || to <= from) return false;
  return options.changeProjection?.additions.some((addition) => addition.from < to && addition.to > from) ?? false;
}

function markProjectedAddition<T extends HTMLElement>(
  element: T,
  options: LedgerCardMarkdownOptions,
  from: number | undefined,
  to: number | undefined,
): T {
  // WHAT: Mark canonical DOM only when its exact authored range intersects an admitted addition.
  // WHY: Unchanged context inside a multi-line canonical block must remain visually unmarked.
  if (intersectsAddition(options, from, to)) {
    element.classList.add('cm-authored-addition');
    element.setAttribute('data-change', 'added');
    element.setAttribute('aria-label', 'Added Markdown');
  }
  return element;
}

function inlineRange(nodes: Array<{ from?: number; to?: number }>): { from?: number; to?: number } {
  const starts = nodes.flatMap((node) => typeof node.from === 'number' ? [node.from] : []);
  const ends = nodes.flatMap((node) => typeof node.to === 'number' ? [node.to] : []);
  return {
    from: starts.length > 0 ? Math.min(...starts) : undefined,
    to: ends.length > 0 ? Math.max(...ends) : undefined,
  };
}

export function renderLedgerMarkdownBlock(
  block: ReturnType<typeof parseLedgerCardMarkdown>[number],
  options: LedgerCardMarkdownOptions = {},
): HTMLElement {
  // WHAT: Render canonical heading blocks with their semantic heading level.
  // WHY: Every presentation surface must preserve the shared Markdown hierarchy.
  if (block.kind === 'heading') {
    const heading = document.createElement(`h${Math.min(6, Math.max(1, block.level))}`);
    heading.className = `ledger-card-heading ledger-card-heading-${block.level}`;
    appendInlineNodes(heading, block.children, options);
    return markProjectedAddition(heading, options, block.from, block.to);
  }
  // WHAT: Render canonical ordered and unordered list structures.
  // WHY: List markers and indentation require real list DOM rather than decorated source bytes.
  if (block.kind === 'list') {
    const list = document.createElement(block.ordered ? 'ol' : 'ul');
    // WHAT: Preserve a non-default authored ordered-list start.
    // WHY: Canonical list numbering must match the exact Markdown meaning.
    if (block.ordered && block.start !== 1) list.setAttribute('start', String(block.start));
    for (const item of block.items) {
      const li = document.createElement('li');
      appendInlineNodes(li, item, options);
      const range = inlineRange(item);
      list.appendChild(markProjectedAddition(li, options, range.from, range.to));
    }
    return list;
  }
  // WHAT: Delegate canonical table blocks to the shared table renderer.
  // WHY: Table structure, overflow, and cell semantics already have one owner.
  if (block.kind === 'table') return markProjectedAddition(renderLedgerCardTable(block, options), options, block.from, block.to);
  // WHAT: Delegate canonical media blocks to the shared media renderer.
  // WHY: Image grouping, sizing, and carousel structure already have one owner.
  if (block.kind === 'images') return markProjectedAddition(renderLedgerCardMedia(block, options), options, block.from, block.to);
  // WHAT: Delegate canonical HTML directives to the shared embed renderer.
  // WHY: Decision OS directives must not be reimplemented by the editor.
  if (block.kind === 'htmlEmbeds') return markProjectedAddition(renderLedgerCardHtmlEmbeds(block, options), options, block.from, block.to);
  // WHAT: Delegate canonical Git review directives to the shared Git renderer.
  // WHY: The directive structure and bounded cleanup lifecycle already have one owner.
  if (block.kind === 'gitDiff') return markProjectedAddition(renderLedgerCardGitDiff(block, options), options, block.from, block.to);
  // WHAT: Delegate canonical questionnaire directives to the shared question renderer.
  // WHY: Questionnaire structure and unavailable-state semantics already have one owner.
  if (block.kind === 'questions') return markProjectedAddition(renderLedgerCardQuestions(block, options), options, block.from, block.to);
  // WHAT: Delegate canonical fenced code blocks to the shared code renderer.
  // WHY: Language labels and highlighted code structure must remain identical across surfaces.
  if (block.kind === 'code') return renderLedgerCardCodeBlock(block, {
    source: options.source,
    changeProjection: options.changeProjection,
  });
  // WHAT: Render canonical horizontal rules as semantic rule elements.
  // WHY: A source delimiter cannot reproduce the shared rule geometry.
  if (block.kind === 'hr') {
    const rule = document.createElement('hr');
    rule.className = 'ledger-card-hr';
    return markProjectedAddition(rule, options, block.from, block.to);
  }
  const paragraph = document.createElement('p');
  appendInlineNodes(paragraph, block.children, options);
  return markProjectedAddition(paragraph, options, block.from, block.to);
}

export function renderLedgerCardMarkdown(markdown: string, options: LedgerCardMarkdownOptions = {}): HTMLElement {
  const body = document.createElement('div');
  body.className = 'ledger-card-body';

  for (const block of parseLedgerCardMarkdown(markdown)) {
    body.appendChild(renderLedgerMarkdownBlock(block, options));
  }

  return body;
}
