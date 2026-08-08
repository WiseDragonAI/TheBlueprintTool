/**
 * WHAT: Replaces inactive authored Markdown blocks with canonical Decision OS block widgets.
 * WHY: Skill authoring must retain exact CodeMirror bytes while presenting the same DOM and styles as rendered cards.
 */
import { renderLedgerMarkdownBlock } from '../../ledger/component/render-ledger-card-markdown.js';
import {
  parseLedgerCardMarkdown,
  type LedgerMarkdownBlock,
} from '../../ledger/helper/parse-ledger-card-markdown.js';
import type { NormalizedAuthoredFileDiff } from './normalize-authored-file-diff.js';

export type LedgerMarkdownSelectionRange = { from: number; to: number; head: number; empty: boolean };
export type LedgerMarkdownChangeProjection = {
  additions: Array<{ from: number; to: number }>;
  deletions: Array<{ anchor: number; text: string }>;
};

type PresentationRecord = {
  block: LedgerMarkdownBlock;
  from: number;
  to: number;
  source: string;
  changes: LedgerMarkdownChangeProjection;
};

type ParsedPresentationBlock = { block: LedgerMarkdownBlock; from: number; to: number };

type PresentationFieldValue = {
  parsed: ParsedPresentationBlock[];
  decorations: unknown;
  activeKey: string;
};

const MAX_LIST_ITEMS_PER_WIDGET = 32;
const ESTIMATED_LIST_ITEM_HEIGHT = 29;

type PresentationCodeMirrorModule = {
  Decoration: {
    replace(spec: Record<string, unknown>): { range(from: number, to: number): unknown };
    set(ranges: unknown[], sort?: boolean): unknown;
  };
  EditorView: {
    decorations: { from<T>(field: unknown, getter?: (value: T) => unknown): unknown };
    atomicRanges: { from<T>(field: unknown, getter?: (value: T) => unknown): unknown };
  };
  StateField: {
    define<T>(spec: {
      create(state: PresentationState): T;
      update(value: T, transaction: { docChanged: boolean; selection: boolean; state: PresentationState }): T;
      provide(field: unknown): unknown;
    }): unknown;
  };
  ViewPlugin: {
    fromClass(plugin: new (view: PresentationView) => {
      update(update: { view: PresentationView }): void;
    }): unknown;
  };
};

type PresentationState = {
  doc: { length: number; toString(): string };
  selection: { main: LedgerMarkdownSelectionRange };
  field<T>(field: unknown, require?: boolean): T | undefined;
};

type PresentationView = {
  state?: PresentationState;
  dom?: HTMLElement;
  dispatch(spec: { selection: { anchor: number } }): void;
  focus(): void;
};

const widgetByElement = new WeakMap<object, LedgerMarkdownBlockWidget>();

function exactBlockRange(block: LedgerMarkdownBlock, length: number): { from: number; to: number } | null {
  // WHAT: Admit only exact non-empty parser ranges inside the current document.
  // WHY: Replacement widgets must never clamp or infer authored-byte ownership.
  if (
    !Number.isInteger(block.from)
    || !Number.isInteger(block.to)
    || (block.from ?? -1) < 0
    || (block.to ?? 0) <= (block.from ?? 0)
    || (block.to ?? length + 1) > length
  ) return null;
  return { from: block.from as number, to: block.to as number };
}

function selectionTouchesBlock(selection: LedgerMarkdownSelectionRange, block: { from: number; to: number }): boolean {
  // WHAT: Treat a point cursor inside either block edge as an active authored block.
  // WHY: Clicking a replacement boundary must reveal the exact bytes needed for direct editing.
  if (selection.empty) return selection.head >= block.from && selection.head <= block.to;
  return selection.from < block.to && selection.to > block.from;
}

function parsePresentationBlocks(markdown: string): ParsedPresentationBlock[] {
  return parseLedgerCardMarkdown(markdown).flatMap((block) => {
    const range = exactBlockRange(block, markdown.length);
    return range ? [{ block, ...range }] : [];
  });
}

function ledgerMarkdownBlockSelection(
  markdown: string,
  selection: LedgerMarkdownSelectionRange,
  parsed = parsePresentationBlocks(markdown),
): {
  parsed: ParsedPresentationBlock[];
  active: ParsedPresentationBlock[];
} {
  const active = parsed.filter((entry) => selectionTouchesBlock(selection, entry));
  // WHAT: Keep the nearest authored block active when a point cursor sits in parser whitespace.
  // WHY: A newly inserted blank line must retain an editable DOM boundary for the next typed character.
  if (selection.empty && active.length === 0) {
    const fallback = parsed.filter((entry) => entry.to <= selection.head).at(-1)
      ?? parsed.find((entry) => entry.from >= selection.head)
      ?? null;
    // WHAT: Admit only the exact fallback selected from the parsed block set.
    // WHY: An empty document has no source block to reveal.
    if (fallback) active.push(fallback);
  }
  return { parsed, active };
}

function withSourceSpan<T extends LedgerMarkdownBlock>(block: T, from: number, to: number): T {
  Object.defineProperties(block, {
    from: { value: from, enumerable: false, configurable: true },
    to: { value: to, enumerable: false, configurable: true },
  });
  return block;
}

function chunkListBlock(
  markdown: string,
  entry: ParsedPresentationBlock,
): ParsedPresentationBlock[] {
  const block = entry.block;
  // WHAT: Preserve the canonical record when the block is not an oversized list.
  // WHY: Only a list whose single widget defeats CodeMirror virtualization needs a bounded projection.
  if (block.kind !== 'list' || block.items.length <= MAX_LIST_ITEMS_PER_WIDGET) return [entry];
  const source = markdown.slice(entry.from, entry.to);
  // WHAT: Preserve escaped-newline lists as one canonical record.
  // WHY: Their normalized line boundaries do not correspond to literal source newlines and cannot be split exactly here.
  if (source.includes('\\n')) return [entry];
  const chunks: ParsedPresentationBlock[] = [];
  for (let start = 0; start < block.items.length; start += MAX_LIST_ITEMS_PER_WIDGET) {
    const end = Math.min(start + MAX_LIST_ITEMS_PER_WIDGET, block.items.length);
    const firstInlineFrom = block.items[start]?.find((node) => typeof node.from === 'number')?.from;
    const lastInlineTo = [...(block.items[end - 1] ?? [])].reverse()
      .find((node) => typeof node.to === 'number')?.to;
    // WHAT: Fall back to the unsplit canonical block when exact item source boundaries are unavailable.
    // WHY: Widget virtualization must never infer byte ownership from rendered list text.
    if (typeof firstInlineFrom !== 'number' || typeof lastInlineTo !== 'number') return [entry];
    const from = start === 0 ? entry.from : markdown.lastIndexOf('\n', firstInlineFrom - 1) + 1;
    const nextLineBreak = markdown.indexOf('\n', lastInlineTo);
    const to = end === block.items.length || nextLineBreak < 0 ? entry.to : nextLineBreak + 1;
    // WHAT: Fall back when a candidate chunk does not own a strict contiguous source range.
    // WHY: Replacement decorations require exact ordered non-overlapping byte ranges.
    if (from < entry.from || to <= from || to > entry.to) return [entry];
    chunks.push({
      block: withSourceSpan({
        ...block,
        start: block.ordered ? block.start + start : block.start,
        items: block.items.slice(start, end),
      }, from, to),
      from,
      to,
    });
  }
  return chunks;
}

function presentationSelectionKey(active: ParsedPresentationBlock[]): string {
  return active.map(({ from, to }) => `${from}:${to}`).join('|');
}

export function ledgerMarkdownSourceRanges(
  markdown: string,
  selection: LedgerMarkdownSelectionRange,
): Array<{ from: number; to: number }> {
  return ledgerMarkdownBlockSelection(markdown, selection).active
    .map(({ from, to }) => ({ from, to }));
}

export function ledgerMarkdownPresentationRecords(
  markdown: string,
  selection: LedgerMarkdownSelectionRange,
  diff: NormalizedAuthoredFileDiff | null = null,
  parsed = parsePresentationBlocks(markdown),
): PresentationRecord[] {
  const { active } = ledgerMarkdownBlockSelection(markdown, selection, parsed);
  const records: PresentationRecord[] = [];
  for (const original of parsed) {
    // WHAT: Keep every block intersecting the main selection as literal editable source.
    // WHY: CodeMirror must remain the sole cursor, transaction, history, and byte owner.
    if (active.includes(original)) continue;
    for (const entry of chunkListBlock(markdown, original)) {
      const { block, ...range } = entry;
      records.push({
        block,
        ...range,
        source: markdown.slice(range.from, range.to),
        changes: projectedChanges(diff, range, markdown.length),
      });
    }
  }
  return records;
}

function projectedChanges(
  diff: NormalizedAuthoredFileDiff | null,
  range: { from: number; to: number },
  documentLength: number,
): LedgerMarkdownChangeProjection {
  const additions = diff?.hunks.flatMap((hunk) => hunk.additions)
    .filter((addition) => addition.from < range.to && addition.to > range.from) ?? [];
  const deletions = diff?.hunks.flatMap((hunk) => hunk.deletions)
    .filter((deletion) => (
      deletion.anchor >= range.from
      && (deletion.anchor < range.to || (range.to === documentLength && deletion.anchor === range.to))
    )) ?? [];
  return {
    additions,
    deletions: deletions.map(({ anchor, text }) => ({ anchor, text })),
  };
}

function renderProjectedDeletion(deletion: { anchor: number; text: string }): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'cm-authored-deletion cm-ledger-projected-deletion';
  wrapper.dataset.sourceAnchor = String(deletion.anchor);
  wrapper.setAttribute('role', 'group');
  wrapper.setAttribute('aria-label', `− Removed Markdown: ${deletion.text || 'blank line'}`);
  const label = document.createElement('span');
  label.className = 'cm-authored-deletion-label';
  label.textContent = '− Removed';
  const content = document.createElement('span');
  content.className = 'cm-authored-deletion-content';
  content.textContent = deletion.text || ' ';
  wrapper.append(label, content);
  return wrapper;
}

export class LedgerMarkdownBlockWidget {
  private renderedChanges = new WeakMap<object, string>();

  constructor(
    readonly record: PresentationRecord,
    private readonly readDiff?: (state: PresentationState) => NormalizedAuthoredFileDiff | null,
  ) {}

  eq(other: LedgerMarkdownBlockWidget): boolean {
    return other.record.block.kind === this.record.block.kind
      && other.record.from === this.record.from
      && other.record.to === this.record.to
      && other.record.source === this.record.source
      && JSON.stringify(other.record.changes) === JSON.stringify(this.record.changes);
  }

  compare(other: unknown): boolean {
    return other instanceof LedgerMarkdownBlockWidget && this.eq(other);
  }

  updateDOM(): boolean { return false; }
  get estimatedHeight(): number {
    // WHAT: Give CodeMirror a bounded height estimate for virtualized list chunks.
    // WHY: Measuring every canonical list item would recreate the whole-document layout stall.
    if (this.record.block.kind === 'list') {
      return this.record.block.items.length * ESTIMATED_LIST_ITEM_HEIGHT;
    }
    return -1;
  }
  get lineBreaks(): number { return 0; }
  get isHidden(): boolean { return false; }
  get editable(): boolean { return false; }

  private runtimeRecord(view?: PresentationView): PresentationRecord {
    const diff = view?.state && this.readDiff ? this.readDiff(view.state) : null;
    // WHAT: Preserve the record's explicit projection when no editor-owned diff reader is available.
    // WHY: Standalone renderer tests and card consumers must retain their supplied exact changes.
    if (!this.readDiff || !view?.state) return this.record;
    return {
      ...this.record,
      changes: projectedChanges(diff, this.record, view.state.doc.length),
    };
  }

  private renderInto(wrapper: HTMLElement, view?: PresentationView): void {
    const record = this.runtimeRecord(view);
    const message = document.createElement('div');
    message.className = 'thread-note-message ledger-card-body';
    // WHAT: Keep non-code deletion anchors in the same canonical widget flow as their surviving block.
    // WHY: Replacement decorations otherwise hide the separate CodeMirror deletion widget at an interior anchor.
    if (record.block.kind !== 'code') {
      for (const deletion of record.changes.deletions) {
        message.appendChild(renderProjectedDeletion(deletion));
      }
    }
    message.appendChild(renderLedgerMarkdownBlock(record.block, {
      mediaSurface: 'thread',
      source: record.source,
      changeProjection: record.changes,
    }));
    wrapper.replaceChildren(message);
    this.renderedChanges.set(wrapper, JSON.stringify(record.changes));
  }

  refreshDOM(wrapper: HTMLElement, view: PresentationView): void {
    const nextChanges = this.runtimeRecord(view).changes;
    // WHAT: Preserve mounted canonical DOM when its exact projected Git changes are unchanged.
    // WHY: Offscreen hunks must not trigger visible widget reconstruction or browser layout work.
    if (this.renderedChanges.get(wrapper) === JSON.stringify(nextChanges)) return;
    this.renderInto(wrapper, view);
  }

  toDOM(view?: PresentationView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-ledger-block-widget thread-note is-agent';
    wrapper.dataset.ledgerBlockKind = this.record.block.kind;
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.tabIndex = -1;
    wrapper.style.setProperty(
      '--cm-ledger-estimated-height',
      `${Math.max(1, this.estimatedHeight)}px`,
    );
    widgetByElement.set(wrapper, this);
    // WHAT: Let a canonical replacement widget own pointer activation when CodeMirror supplies its view.
    // WHY: Clicking rendered Markdown must reveal that exact source block and return focus to the sole editor owner.
    if (view) {
      wrapper.addEventListener('mousedown', (event) => {
        event.preventDefault();
        view.dispatch({ selection: { anchor: this.record.from } });
        view.focus();
      });
    }
    this.renderInto(wrapper, view);
    return wrapper;
  }

  ignoreEvent(): boolean { return true; }
  coordsAt(): null { return null; }
  destroy(): void {}
}

export function createLedgerMarkdownPresentationExtension(
  cm: PresentationCodeMirrorModule,
  readDiff: (state: PresentationState) => NormalizedAuthoredFileDiff | null = () => null,
): unknown {
  const presentationDecorations = (
    state: PresentationState,
    parsed: ParsedPresentationBlock[],
  ): unknown => cm.Decoration.set(
    ledgerMarkdownPresentationRecords(
      state.doc.toString(),
      state.selection.main,
      null,
      parsed,
    ).map((record) => (
      cm.Decoration.replace({
        widget: new LedgerMarkdownBlockWidget(record, readDiff),
        block: true,
      }).range(record.from, record.to)
    )),
    true,
  );
  const field = cm.StateField.define<PresentationFieldValue>({
    create: (state) => {
      const markdown = state.doc.toString();
      const parsed = parsePresentationBlocks(markdown);
      const activeKey = presentationSelectionKey(
        ledgerMarkdownBlockSelection(markdown, state.selection.main, parsed).active,
      );
      return { parsed, activeKey, decorations: presentationDecorations(state, parsed) };
    },
    update: (value, transaction) => {
      const markdown = transaction.state.doc.toString();
      const parsed = transaction.docChanged ? parsePresentationBlocks(markdown) : value.parsed;
      const activeKey = presentationSelectionKey(
        ledgerMarkdownBlockSelection(markdown, transaction.state.selection.main, parsed).active,
      );
      // WHAT: Preserve the existing range set when neither document nor active source block changed.
      // WHY: Git projection and cursor movement inside one block must not rebuild whole-document replacements.
      if (!transaction.docChanged && activeKey === value.activeKey) return value;
      return {
        parsed,
        activeKey,
        decorations: presentationDecorations(transaction.state, parsed),
      };
    },
    provide: (field) => [
      cm.EditorView.decorations.from<PresentationFieldValue>(field, (value) => value.decorations),
      cm.EditorView.atomicRanges.from<PresentationFieldValue>(field, (value) => () => value.decorations),
    ],
  });
  const projectionRefresh = cm.ViewPlugin.fromClass(class {
    private diff: NormalizedAuthoredFileDiff | null;

    constructor(view: PresentationView) {
      this.diff = view.state ? readDiff(view.state) : null;
    }

    update(update: { view: PresentationView }): void {
      const next = update.view.state ? readDiff(update.view.state) : null;
      // WHAT: Skip DOM inspection when the identity-bound Git projection did not change.
      // WHY: Ordinary editor transactions already have a separate replacement-range owner.
      if (next === this.diff) return;
      this.diff = next;
      // WHAT: Skip mounted-widget refresh when CodeMirror has no connected DOM surface.
      // WHY: View teardown must not manufacture a replacement lifecycle after disposal.
      if (!update.view.dom) return;
      for (const element of update.view.dom.querySelectorAll<HTMLElement>('.cm-ledger-block-widget')) {
        widgetByElement.get(element)?.refreshDOM(element, update.view);
      }
    }
  });
  return [field, projectionRefresh];
}
