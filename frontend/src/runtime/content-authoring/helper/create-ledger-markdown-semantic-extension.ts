/**
 * WHAT: Decorates canonical Markdown syntax ranges inside the active CodeMirror document.
 * WHY: Semantic presentation must remain source-positioned and must never replace authored bytes.
 */
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
      create(state: unknown): T;
      update(value: T, transaction: { docChanged: boolean; state: unknown }): T;
      provide(field: unknown): unknown;
    }): unknown;
  };
  syntaxTree(state: unknown): {
    iterate(spec: { enter(node: { name: string; from: number; to: number }): void }): void;
  };
};

const semanticClassByNode: Record<string, string> = {
  ATXHeading1: 'cm-ledger-heading',
  ATXHeading2: 'cm-ledger-heading',
  ATXHeading3: 'cm-ledger-heading',
  ATXHeading4: 'cm-ledger-heading',
  ATXHeading5: 'cm-ledger-heading',
  ATXHeading6: 'cm-ledger-heading',
  StrongEmphasis: 'cm-ledger-strong',
  Emphasis: 'cm-ledger-emphasis',
  InlineCode: 'cm-ledger-code',
  Link: 'cm-ledger-link',
  Image: 'cm-ledger-image',
  Blockquote: 'cm-ledger-quote',
  FencedCode: 'cm-ledger-code-block',
};

export function createLedgerMarkdownSemanticExtension(cm: SemanticCodeMirrorModule): unknown {
  const semanticDecorations = (state: unknown): unknown => {
    const ranges: unknown[] = [];
    cm.syntaxTree(state).iterate({
      enter: (node) => {
        const className = semanticClassByNode[node.name];
        if (!className || node.to <= node.from) return;
        ranges.push(cm.Decoration.mark({
          class: className,
          attributes: { 'data-ledger-semantic': node.name },
        }).range(node.from, node.to));
      },
    });
    return cm.Decoration.set(ranges, true);
  };
  return cm.StateField.define<unknown>({
    create: semanticDecorations,
    update: (value, transaction) => transaction.docChanged
      ? semanticDecorations(transaction.state)
      : value,
    provide: (field) => cm.EditorView.decorations.from(field),
  });
}
