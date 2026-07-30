/**
 * WHAT: Adapts the pinned CodeMirror 6 bundle to a path-free Markdown file editor.
 * WHY: Skill authoring needs one robust editor boundary that can later open other server-owned files.
 *
 * Future use: a file attached to a Decision OS thread can call this same adapter after
 * the backend resolves attachment identity to an authorized file; the client must never
 * submit an arbitrary filesystem path.
 */
import { createAuthoredFileDiffExtension } from '../../content-authoring/helper/create-authored-file-diff-extension.js';
import { createLedgerMarkdownSemanticExtension } from '../../content-authoring/helper/create-ledger-markdown-semantic-extension.js';
import type { NormalizedAuthoredFileDiff } from '../../content-authoring/helper/normalize-authored-file-diff.js';

type CodeMirrorModule = {
  basicSetup: unknown;
  Compartment: new () => {
    of(extension: unknown): unknown;
    reconfigure(extension: unknown): unknown;
  };
  EditorState: {
    create(input: Record<string, unknown>): unknown;
    readOnly: { of(value: boolean): unknown };
  };
  StateEffect: { define<T>(): { of(value: T): unknown; is(effect: unknown): boolean } };
  StateField: { define<T>(spec: Record<string, unknown>): unknown };
  Decoration: {
    mark(spec: Record<string, unknown>): { range(from: number, to: number): unknown };
    widget(spec: Record<string, unknown>): { range(position: number): unknown };
    set(ranges: unknown[], sort?: boolean): unknown;
  };
  syntaxTree(state: unknown): { iterate(spec: Record<string, unknown>): void };
  Transaction: {
    addToHistory: { of(value: boolean): unknown };
  };
  EditorView: {
    new (input: Record<string, unknown>): {
      state: {
        doc: { length: number; toString(): string };
        selection?: { main?: { head?: number } };
      };
      scrollDOM?: { scrollTop: number; scrollLeft: number };
      hasFocus?: boolean;
      dispatch(spec: unknown): void;
      setState(state: unknown): void;
      focus(): void;
      destroy(): void;
    };
    decorations: {
      from<T>(field: unknown, getter?: (value: T) => unknown): unknown;
      of(value: unknown): unknown;
    };
    lineWrapping: unknown;
    theme(spec: Record<string, Record<string, string>>, options?: { dark?: boolean }): unknown;
  };
  HighlightStyle: {
    define(specs: Array<{ tag: unknown; [property: string]: unknown }>): unknown;
  };
  syntaxHighlighting(style: unknown): unknown;
  tags: Record<string, unknown>;
  keymap: { of(bindings: unknown[]): unknown };
  markdown(): unknown;
  defaultKeymap: unknown[];
  historyKeymap: unknown[];
  searchKeymap: unknown[];
  undo(view: unknown): boolean;
  redo(view: unknown): boolean;
  openSearchPanel(view: unknown): boolean;
};

/**
 * WHAT: Defines the shared Decision OS presentation for every CodeMirror-backed text file.
 * WHY: Editor content must not inherit owner-specific field casing, weight, or colors.
 */
function decisionOsCodeMirrorTheme(cm: CodeMirrorModule): unknown[] {
  const theme = cm.EditorView.theme({
    '&': {
      height: '100%',
      color: 'var(--text)',
      backgroundColor: 'var(--panel-3)',
      fontSize: '12px',
      fontWeight: '400',
      letterSpacing: 'normal',
      textTransform: 'none',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'var(--mono, "Ubuntu Mono", monospace)',
      lineHeight: '1.5',
      tabSize: '2',
      fontWeight: '400',
      letterSpacing: 'normal',
      textTransform: 'none',
    },
    '.cm-content': {
      minHeight: '100%',
      padding: '10px 0',
      caretColor: 'var(--accent)',
      fontWeight: '400',
      letterSpacing: 'normal',
      textTransform: 'none',
    },
    '.cm-line': {
      padding: '0 10px',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--accent), transparent 68%)',
    },
    '.cm-gutters': {
      color: 'var(--muted)',
      backgroundColor: 'var(--panel-3)',
      borderRight: '1px solid var(--line)',
      fontWeight: '400',
      letterSpacing: 'normal',
      textTransform: 'none',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'color-mix(in srgb, var(--accent), transparent 92%)',
    },
    '.cm-panels': {
      color: 'var(--text)',
      backgroundColor: 'var(--panel)',
      borderColor: 'var(--line)',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid var(--line)',
    },
    '.cm-textfield': {
      color: 'var(--text)',
      backgroundColor: 'var(--panel-3)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--control-radius)',
      fontFamily: 'var(--mono, "Ubuntu Mono", monospace)',
    },
    '.cm-button': {
      color: 'var(--text)',
      backgroundImage: 'none',
      backgroundColor: 'var(--panel-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--control-radius)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'color-mix(in srgb, var(--accent), transparent 76%)',
      outline: '1px solid color-mix(in srgb, var(--accent), transparent 38%)',
    },
    '.cm-searchMatch.cm-searchMatch-selected, .cm-selectionMatch': {
      backgroundColor: 'color-mix(in srgb, var(--accent), transparent 58%)',
    },
    '.cm-placeholder': {
      color: 'var(--muted)',
      fontStyle: 'italic',
    },
  }, { dark: true });
  const tags = cm.tags;
  const highlighting = cm.syntaxHighlighting(cm.HighlightStyle.define([
    { tag: tags.heading, color: 'var(--accent)', fontWeight: '700' },
    { tag: [tags.link, tags.url], color: 'color-mix(in srgb, var(--accent), white 24%)', textDecoration: 'underline' },
    { tag: tags.emphasis, color: 'var(--text)', fontStyle: 'italic' },
    { tag: tags.strong, color: 'var(--text)', fontWeight: '700' },
    { tag: tags.monospace, color: 'color-mix(in srgb, var(--text), var(--accent) 24%)' },
    { tag: [tags.meta, tags.processingInstruction, tags.punctuation], color: 'var(--muted)' },
    { tag: [tags.list, tags.quote], color: 'color-mix(in srgb, var(--muted), var(--text) 30%)' },
    { tag: tags.strikethrough, color: 'var(--muted)', textDecoration: 'line-through' },
    { tag: tags.invalid, color: 'var(--danger)', textDecoration: 'underline wavy' },
  ]));
  return [theme, highlighting];
}

export type CodeMirrorFileEditor = {
  value(): string;
  isDirty(): boolean;
  markSaved(markdown?: string): void;
  focus(): void;
  undo(): void;
  redo(): void;
  search(): void;
  setReadOnly(readOnly: boolean): void;
  installAuthoredFileDiff(diff: NormalizedAuthoredFileDiff): void;
  clearAuthoredFileDiff(identity?: string | null): void;
  replaceDocument(markdown: string, revision?: string): void;
  setIdentity(filename: string, revision?: string): void;
  destroy(): void;
};

let modulePromise: Promise<CodeMirrorModule> | null = null;

function loadCodeMirror(): Promise<CodeMirrorModule> {
  const load = new Function('path', 'return import(path)') as (path: string) => Promise<CodeMirrorModule>;
  modulePromise ??= load('/assets/vendor/codemirror-6.0.2.js');
  return modulePromise;
}

function toolbarButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost-button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

export async function mountCodeMirrorFileEditor(input: {
  parent: HTMLElement;
  filename: string;
  language: 'markdown';
  markdown: string;
  readOnly: boolean;
  revision?: string;
  onChange: (markdown: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}, loadModule: () => Promise<CodeMirrorModule> = loadCodeMirror): Promise<CodeMirrorFileEditor> {
  const cm = await loadModule();
  const root = document.createElement('section');
  root.className = 'text-file-editor';
  root.setAttribute('aria-label', `${input.filename} editor`);
  const toolbar = document.createElement('div');
  toolbar.className = 'text-file-editor-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', `${input.filename} editor tools`);
  const identity = document.createElement('span');
  identity.className = 'text-file-editor-identity';
  identity.textContent = input.revision ? `${input.filename} · ${input.revision.slice(0, 12)}` : input.filename;
  const actions = document.createElement('span');
  actions.className = 'text-file-editor-actions';
  const editorHost = document.createElement('div');
  editorHost.className = 'text-file-editor-surface';
  let savedMarkdown = input.markdown;
  let dirty = false;
  let destroyed = false;
  let view: InstanceType<CodeMirrorModule['EditorView']> | null = null;
  let wrapLines = true;
  let readOnly = input.readOnly;
  const wrapCompartment = new cm.Compartment();
  const readOnlyCompartment = new cm.Compartment();
  const supportsAuthoredDiff = Boolean(cm.StateEffect && cm.StateField && cm.Decoration && cm.syntaxTree);
  const diff = supportsAuthoredDiff ? createAuthoredFileDiffExtension(cm) : null;
  const updateDirty = (markdown: string): void => {
    const nextDirty = markdown !== savedMarkdown;
    if (nextDirty === dirty) return;
    dirty = nextDirty;
    root.classList.toggle('is-dirty', dirty);
    root.setAttribute('data-dirty', String(dirty));
    input.onDirtyChange?.(dirty);
  };
  const updateListener = (cm.EditorView as unknown as {
    updateListener: { of(callback: (update: { docChanged: boolean; state: { doc: { toString(): string } } }) => void): unknown };
  }).updateListener.of((update) => {
    if (!update.docChanged) return;
    const markdown = update.state.doc.toString();
    updateDirty(markdown);
    input.onChange(markdown);
  });
  const editableFacet = (value: boolean): unknown[] => [
    cm.EditorState.readOnly.of(value),
    (cm.EditorView as unknown as { editable: { of(editable: boolean): unknown } }).editable.of(!value),
  ];
  const editorExtensions = [
      cm.basicSetup,
      cm.markdown(),
      ...decisionOsCodeMirrorTheme(cm),
      ...(diff ? [diff.extension, createLedgerMarkdownSemanticExtension(cm)] : []),
      cm.keymap.of([...cm.defaultKeymap, ...cm.historyKeymap, ...cm.searchKeymap]),
      updateListener,
      readOnlyCompartment.of(editableFacet(readOnly)),
      wrapCompartment.of(cm.EditorView.lineWrapping),
  ];
  const createState = (doc: string, selection?: number): unknown => cm.EditorState.create({
    doc,
    ...(typeof selection === 'number' ? { selection: { anchor: Math.min(selection, doc.length) } } : {}),
    extensions: editorExtensions,
  });
  const state = createState(input.markdown);
  view = new cm.EditorView({ state, parent: editorHost });
  const wrap = toolbarButton('Wrap lines', () => {
    if (!view) return;
    wrapLines = !wrapLines;
    wrap.setAttribute('aria-pressed', String(wrapLines));
    view.dispatch({ effects: wrapCompartment.reconfigure(wrapLines ? cm.EditorView.lineWrapping : []) });
  });
  wrap.setAttribute('aria-pressed', 'true');
  const undo = toolbarButton('Undo', () => { if (view && !readOnly) cm.undo(view); });
  const redo = toolbarButton('Redo', () => { if (view && !readOnly) cm.redo(view); });
  const find = toolbarButton('Find', () => { if (view) cm.openSearchPanel(view); });
  actions.append(undo, redo, find, wrap);
  const updateMutationControls = (): void => {
    undo.disabled = readOnly;
    redo.disabled = readOnly;
    undo.setAttribute('aria-disabled', String(readOnly));
    redo.setAttribute('aria-disabled', String(readOnly));
  };
  updateMutationControls();
  toolbar.append(identity, actions);
  root.append(toolbar, editorHost);
  root.setAttribute('data-dirty', 'false');
  input.parent.replaceChildren(root);
  return {
    value: () => view?.state.doc.toString() ?? input.markdown,
    isDirty: () => dirty,
    markSaved: (markdown) => {
      savedMarkdown = markdown ?? view?.state.doc.toString() ?? savedMarkdown;
      updateDirty(view?.state.doc.toString() ?? savedMarkdown);
    },
    focus: () => { view?.focus(); },
    undo: () => { if (view && !readOnly) cm.undo(view); },
    redo: () => { if (view && !readOnly) cm.redo(view); },
    search: () => { if (view) cm.openSearchPanel(view); },
    setReadOnly: (value) => {
      if (!view || readOnly === value) return;
      readOnly = value;
      view.dispatch({ effects: readOnlyCompartment.reconfigure(editableFacet(readOnly)) });
      root.dataset.readOnly = String(readOnly);
      updateMutationControls();
    },
    installAuthoredFileDiff: (authoredDiff) => {
      if (!view || !diff || authoredDiff.document !== view.state.doc.toString()) return;
      view.dispatch({
        effects: diff.installAuthoredFileDiffEffect.of({
          identity: authoredDiff.identity,
          diff: authoredDiff,
        }),
        annotations: cm.Transaction.addToHistory.of(false),
      });
    },
    clearAuthoredFileDiff: (diffIdentity = null) => {
      if (!view || !diff) return;
      view.dispatch({
        effects: diff.clearAuthoredFileDiffEffect.of(diffIdentity),
        annotations: cm.Transaction.addToHistory.of(false),
      });
    },
    replaceDocument: (markdown, revision) => {
      if (!view) return;
      const selection = view.state.selection?.main?.head;
      const scrollTop = view.scrollDOM?.scrollTop ?? 0;
      const scrollLeft = view.scrollDOM?.scrollLeft ?? 0;
      const focused = Boolean(view.hasFocus);
      view.setState(createState(markdown, selection));
      if (view.scrollDOM) {
        view.scrollDOM.scrollTop = scrollTop;
        view.scrollDOM.scrollLeft = scrollLeft;
      }
      if (focused) view.focus();
      savedMarkdown = markdown;
      dirty = false;
      root.classList.toggle('is-dirty', false);
      root.setAttribute('data-dirty', 'false');
      input.onDirtyChange?.(false);
      identity.textContent = revision ? `${input.filename} · ${revision.slice(0, 12)}` : input.filename;
    },
    setIdentity: (filename, revision) => {
      input.filename = filename;
      identity.textContent = revision ? `${filename} · ${revision.slice(0, 12)}` : filename;
      root.setAttribute('aria-label', `${filename} editor`);
      toolbar.setAttribute('aria-label', `${filename} editor tools`);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      view?.destroy();
      view = null;
      root.remove();
    },
  };
}
