/**
 * WHAT: Decorates canonical Decision OS Markdown records inside the active CodeMirror document.
 * WHY: The editable surface must use the same parser authority as card rendering, including application directives.
 */
import {
  parseLedgerCardMarkdown,
  type LedgerMarkdownBlock,
  type LedgerMarkdownInline,
} from '../../ledger/helper/parse-ledger-card-markdown.js';

type SemanticCodeMirrorModule = {
  Decoration: {
    mark(spec: Record<string, unknown>): { range(from: number, to: number): unknown };
    set(ranges: unknown[], sort?: boolean): unknown;
  };
  EditorView: {
    decorations: { from<T>(field: unknown, getter?: (value: T) => unknown): unknown };
  };
  StateField: {
    define<T>(spec: {
      create(state: { doc: { toString(): string } }): T;
      update(value: T, transaction: {
        docChanged: boolean;
        state: { doc: { toString(): string } };
      }): T;
      provide(field: unknown): unknown;
    }): unknown;
  };
};

const blockClass: Record<LedgerMarkdownBlock['kind'], string> = {
  heading: 'cm-ledger-heading',
  paragraph: 'cm-ledger-paragraph',
  images: 'cm-ledger-images',
  htmlEmbeds: 'cm-ledger-directive cm-ledger-html',
  gitDiff: 'cm-ledger-directive cm-ledger-git-diff',
  questions: 'cm-ledger-directive cm-ledger-questions',
  list: 'cm-ledger-list',
  table: 'cm-ledger-table',
  hr: 'cm-ledger-rule',
  code: 'cm-ledger-code-block',
};

const inlineClass: Partial<Record<LedgerMarkdownInline['kind'], string>> = {
  strong: 'cm-ledger-strong',
  code: 'cm-ledger-code',
  link: 'cm-ledger-link',
  image: 'cm-ledger-image',
};

function inlineRecords(block: LedgerMarkdownBlock): LedgerMarkdownInline[] {
  // WHAT: Return the canonical inline records owned directly by text-bearing blocks.
  // WHY: Container-only directives and rules already expose their exact block source span.
  if (block.kind === 'heading' || block.kind === 'paragraph') return block.children;
  // WHAT: Flatten canonical list item records in authored source order.
  // WHY: Each item retains its own exact parser-owned source positions.
  if (block.kind === 'list') return block.items.flat();
  // WHAT: Return image records that already retain absolute source positions.
  // WHY: Grouped image blocks need both container and individual image semantics.
  if (block.kind === 'images') return block.images;
  return [];
}

function sourceRange(value: { readonly from?: number; readonly to?: number }, length: number): {
  from: number;
  to: number;
} | null {
  // WHAT: Admit only finite non-empty ranges contained by the exact current document.
  // WHY: Canonical semantic decorations must never clamp or guess source identity.
  if (
    !Number.isInteger(value.from)
    || !Number.isInteger(value.to)
    || (value.from ?? -1) < 0
    || (value.to ?? 0) <= (value.from ?? 0)
    || (value.to ?? length + 1) > length
  ) return null;
  return { from: value.from as number, to: value.to as number };
}

export function ledgerMarkdownSemanticRanges(markdown: string): Array<{
  kind: string;
  className: string;
  from: number;
  to: number;
}> {
  const ranges: Array<{ kind: string; className: string; from: number; to: number }> = [];
  for (const block of parseLedgerCardMarkdown(markdown)) {
    const blockRange = sourceRange(block, markdown.length);
    // WHAT: Publish the canonical block range exactly as parsed.
    // WHY: Every supported Decision OS block kind must be represented in the editable surface.
    if (blockRange) ranges.push({
      kind: block.kind,
      className: blockClass[block.kind],
      ...blockRange,
    });
    for (const inline of inlineRecords(block)) {
      const className = inlineClass[inline.kind];
      const inlineRange = sourceRange(inline, markdown.length);
      // WHAT: Publish canonical inline emphasis only when it has a styled semantic class.
      // WHY: Plain text remains literal editable context without redundant decorations.
      if (className && inlineRange) ranges.push({
        kind: inline.kind,
        className,
        ...inlineRange,
      });
    }
  }
  return ranges;
}

export function createLedgerMarkdownSemanticExtension(cm: SemanticCodeMirrorModule): unknown {
  const semanticDecorations = (markdown: string): unknown => cm.Decoration.set(
    ledgerMarkdownSemanticRanges(markdown).map((range) => cm.Decoration.mark({
      class: range.className,
      attributes: { 'data-ledger-semantic': range.kind },
    }).range(range.from, range.to)),
    true,
  );
  return cm.StateField.define<unknown>({
    create: (state) => semanticDecorations(state.doc.toString()),
    update: (value, transaction) => {
      // WHAT: Reparse canonical semantics only after document bytes change.
      // WHY: Selection and presentation transactions retain the same exact source identity.
      if (transaction.docChanged) return semanticDecorations(transaction.state.doc.toString());
      return value;
    },
    provide: (field) => cm.EditorView.decorations.from(field),
  });
}
