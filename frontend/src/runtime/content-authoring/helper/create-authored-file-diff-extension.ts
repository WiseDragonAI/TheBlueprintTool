/**
 * WHAT: Stores normalized authored diff hunks in CodeMirror state and renders additions plus accessible deletions.
 * WHY: The editor transaction must be the only owner of document mapping and touched-hunk withdrawal.
 */
import { mapAuthoredFileDiff } from './map-authored-file-diff.js';
import type { NormalizedAuthoredFileDiff } from './normalize-authored-file-diff.js';
import {
  ledgerMarkdownSourceRanges,
  type LedgerMarkdownSelectionRange,
} from './create-ledger-markdown-presentation-extension.js';

type EffectValue = { identity: string; diff: NormalizedAuthoredFileDiff };
type EffectType<T> = {
  of(value: T): unknown;
};
type FieldType<T> = unknown;

type CodeMirrorDiffModule = {
  StateEffect: { define<T>(): EffectType<T> };
  StateField: {
    define<T>(spec: {
      create(): T;
      update(value: T, transaction: {
        docChanged: boolean;
        changes: Parameters<typeof mapAuthoredFileDiff>[1];
        newDoc: { toString(): string };
        effects: Array<{ value: unknown; is(type: unknown): boolean }>;
        state: { selection: { main: LedgerMarkdownSelectionRange } };
      }): T;
      provide(field: FieldType<T>): unknown;
    }): FieldType<T>;
  };
  Decoration: {
    mark(spec: Record<string, unknown>): { range(from: number, to: number): unknown };
    widget(spec: Record<string, unknown>): { range(position: number): unknown };
    set(ranges: unknown[], sort?: boolean): unknown;
  };
  EditorView: {
    decorations: { from<T>(field: FieldType<T>, getter: (value: T) => unknown): unknown };
  };
};

export class AuthoredFileDeletionWidget {
  constructor(
    readonly hunkId: string,
    readonly deletionOrder: number,
    readonly deletedText: string,
  ) {}

  eq(other: AuthoredFileDeletionWidget): boolean {
    return other.hunkId === this.hunkId
      && other.deletionOrder === this.deletionOrder
      && other.deletedText === this.deletedText;
  }

  compare(other: unknown): boolean {
    return other instanceof AuthoredFileDeletionWidget && this.eq(other);
  }

  updateDOM(): boolean {
    return false;
  }

  get estimatedHeight(): number {
    return -1;
  }

  get lineBreaks(): number {
    return 0;
  }

  get isHidden(): boolean {
    return false;
  }

  get editable(): boolean {
    return false;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-authored-deletion';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', `− Removed Markdown: ${this.deletedText || 'blank line'}`);
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.tabIndex = -1;
    const label = document.createElement('span');
    label.className = 'cm-authored-deletion-label';
    label.textContent = '− Removed';
    const content = document.createElement('span');
    content.className = 'cm-authored-deletion-content';
    content.textContent = this.deletedText || ' ';
    wrapper.append(label, content);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }

  coordsAt(): null {
    return null;
  }

  destroy(): void {}
}

type DiffPresentationState = {
  diff: NormalizedAuthoredFileDiff | null;
  selection: LedgerMarkdownSelectionRange;
};

function decorations(cm: CodeMirrorDiffModule, state: DiffPresentationState): unknown {
  // WHAT: Render no raw Git decorations before an identity-bound snapshot is admitted.
  // WHY: Canonical widgets must never infer change ownership.
  if (!state.diff) return cm.Decoration.set([]);
  const visibleRanges = ledgerMarkdownSourceRanges(state.diff.document, state.selection);
  const ranges: unknown[] = [];
  for (const hunk of state.diff.hunks) {
    for (const addition of hunk.additions) {
      for (const visible of visibleRanges) {
        const from = Math.max(addition.from, visible.from);
        const to = Math.min(addition.to, visible.to);
        // WHAT: Project only the addition segment currently revealed as literal source.
        // WHY: Inactive ranges are owned exclusively by canonical replacement widgets.
        if (to > from) {
          ranges.push(cm.Decoration.mark({
            class: 'cm-authored-addition',
            attributes: { 'data-change': 'added', 'aria-label': 'Added Markdown' },
          }).range(from, to));
        }
      }
    }
    for (const deletion of hunk.deletions) {
      const sourceOwnsAnchor = visibleRanges.some((visible) => (
        deletion.anchor >= visible.from && deletion.anchor <= visible.to
      ));
      // WHAT: Suppress raw deletion widgets outside the revealed source block.
      // WHY: Canonical widgets already present those anchors and duplicate removals are false evidence.
      if (!sourceOwnsAnchor) continue;
      // WHAT: Render each canonical deletion segment at its own source-ordered anchor.
      // WHY: Aggregating a hunk's removals changes their relationship to surviving Markdown.
      ranges.push(cm.Decoration.widget({
        widget: new AuthoredFileDeletionWidget(hunk.id, deletion.order, deletion.text),
        side: -1,
        block: true,
      }).range(deletion.anchor));
    }
  }
  return cm.Decoration.set(ranges, true);
}

export function createAuthoredFileDiffExtension(cm: CodeMirrorDiffModule): {
  extension: unknown;
  installAuthoredFileDiffEffect: EffectType<EffectValue>;
  clearAuthoredFileDiffEffect: EffectType<string | null>;
  readAuthoredFileDiff(state: {
    field<T>(field: FieldType<T>, require?: boolean): T | undefined;
  }): NormalizedAuthoredFileDiff | null;
} {
  const installAuthoredFileDiffEffect = cm.StateEffect.define<EffectValue>();
  const clearAuthoredFileDiffEffect = cm.StateEffect.define<string | null>();
  const field = cm.StateField.define<DiffPresentationState>({
    create: () => ({
      diff: null,
      selection: { from: 0, to: 0, head: 0, empty: true },
    }),
    update: (value, transaction) => {
      let next = value.diff;
      if (next && transaction.docChanged) {
        next = mapAuthoredFileDiff(next, transaction.changes, transaction.newDoc.toString());
      }
      for (const effect of transaction.effects) {
        if (effect.is(installAuthoredFileDiffEffect)) {
          const candidate = effect.value as EffectValue;
          next = candidate.diff.document === transaction.newDoc.toString()
            && candidate.identity === candidate.diff.identity
            ? candidate.diff
            : next;
        }
        if (effect.is(clearAuthoredFileDiffEffect)) {
          const identity = effect.value as string | null;
          if (identity === null || next?.identity === identity) next = null;
        }
      }
      return { diff: next, selection: transaction.state.selection.main };
    },
    provide: (ownedField) => cm.EditorView.decorations.from<DiffPresentationState>(
      ownedField,
      (value) => decorations(cm, value),
    ),
  });
  return {
    extension: field,
    installAuthoredFileDiffEffect,
    clearAuthoredFileDiffEffect,
    readAuthoredFileDiff: (state) => state.field<DiffPresentationState>(field, false)?.diff ?? null,
  };
}
