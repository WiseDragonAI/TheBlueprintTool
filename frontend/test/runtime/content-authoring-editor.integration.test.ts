/**
 * WHAT: Verifies the reusable file editor, clickable skill file, and Pierre revision presentation boundaries.
 * WHY: Authoring interactions must own dirty state, keyboard-reachable tools, disposal, and non-color diff semantics.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mountCodeMirrorFileEditor } from '../../src/runtime/codex/component/codemirror-file-editor.js';
import { renderEditableSkillDocument } from '../../src/runtime/codex/component/render-editable-skill-document.js';
import { renderSkillRevisionDiff } from '../../src/runtime/codex/component/render-skill-revision-diff.js';
import { createLedgerCardRevisionDiffOwner } from '../../src/runtime/content-authoring/controller/ledger-card-editor.js';
import { createTextFileEditorSession } from '../../src/runtime/content-authoring/controller/text-file-editor-session.js';
import { renderAuthoredFileRevision } from '../../src/runtime/content-authoring/component/render-authored-file-revision.js';

const root = new URL('../../../', import.meta.url);
const ledgerCardEditorSource = readFileSync(
  new URL('frontend/src/runtime/content-authoring/controller/ledger-card-editor.ts', root),
  'utf8',
);
type Listener = () => void;

class TestStyle {
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string): void { this.values.set(name, value); }
}

class TestClassList {
  constructor(private readonly owner: TestElement) {}
  toggle(name: string, force?: boolean): void {
    const names = new Set(this.owner.className.split(/\s+/).filter(Boolean));
    const active = force ?? !names.has(name);
    if (active) names.add(name); else names.delete(name);
    this.owner.className = [...names].join(' ');
  }
}

class TestElement {
  readonly children: TestElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  readonly dataset: Record<string, string> = {};
  readonly style = new TestStyle();
  readonly classList = new TestClassList(this);
  parentElement: TestElement | null = null;
  className = '';
  type = '';
  title = '';
  disabled = false;
  hidden = false;
  isConnected = true;
  private ownText = '';

  constructor(readonly tagName: string) {}
  get textContent(): string { return this.ownText + this.children.map((child) => child.textContent).join(''); }
  set textContent(value: string) { this.ownText = String(value ?? ''); this.children.splice(0); }
  append(...children: TestElement[]): void {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
  }
  replaceChildren(...children: TestElement[]): void {
    this.children.splice(0).forEach((child) => { child.parentElement = null; });
    this.ownText = '';
    this.append(...children);
  }
  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }
  setAttribute(name: string, value: string): void { this.attributes.set(name, String(value)); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  click(): void { for (const listener of this.listeners.get('click') ?? []) listener(); }
  focus(): void {}
  querySelectorAll(selector: string): TestElement[] {
    const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return descendants;
    return descendants.filter((child) => child.tagName === selector.toUpperCase());
  }
}

const testDocument = {
  createElement: (tagName: string) => new TestElement(tagName.toUpperCase()),
};

function buttonByText(rootElement: TestElement, label: string): TestElement {
  const button = rootElement.querySelectorAll('button').find((candidate) => candidate.textContent === label);
  assert.ok(button, `Missing ${label} button`);
  return button;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settleAsyncDiff(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test('Task-card editor closes its modal before restoring focus to the route owner', () => {
  const finishClose = ledgerCardEditorSource.slice(
    ledgerCardEditorSource.indexOf('function finishClose(): void {'),
    ledgerCardEditorSource.indexOf('export function requestActiveLedgerCardEditorClose'),
  );
  const closeIndex = finishClose.indexOf('dialog?.close();');
  const disposeIndex = finishClose.indexOf('session?.dispose();');
  assert.notEqual(closeIndex, -1);
  assert.notEqual(disposeIndex, -1);
  assert.ok(closeIndex < disposeIndex);
});

function revisionDetail(commit: string, patch: string) {
  return {
    commit,
    authoredAt: '2026-07-28T00:00:00.000Z',
    subject: commit,
    markdown: `# ${commit}`,
    patch,
  };
}

function pierreModule(input: {
  name: string;
  onParse?: () => void;
  onRender?: () => void;
  onCleanup?: () => void;
}) {
  class FileDiff {
    render(renderInput: { fileDiff: { name: string }; fileContainer: TestElement }): void {
      input.onRender?.();
      renderInput.fileContainer.setAttribute('data-rendered-revision', renderInput.fileDiff.name);
    }
    cleanUp(): void { input.onCleanup?.(); }
  }
  return {
    DIFFS_TAG_NAME: 'PIERRE-DIFF',
    parsePatchFiles: () => {
      input.onParse?.();
      return [{ files: [{ name: input.name }] }];
    },
    FileDiff,
  };
}

test('CodeMirror adapter owns Markdown, wrapping, dirty state, toolbox actions, focus, and disposal', async () => {
  const previousDocument = globalThis.document;
  const commands = { markdown: 0, undo: 0, redo: 0, find: 0, focus: 0, destroy: 0 };
  let editorExtensions: unknown[] = [];
  let themeSpec: Record<string, Record<string, string>> | null = null;
  let themeOptions: { dark?: boolean } | null = null;
  let highlightSpecs: Array<{ tag: unknown; [property: string]: unknown }> = [];
  let updateListener: ((update: { docChanged: boolean; state: { doc: { toString(): string } } }) => void) | null = null;
  let view: MockEditorView | null = null;
  class MockCompartment {
    of(extension: unknown): unknown { return { kind: 'compartment', extension }; }
    reconfigure(extension: unknown): unknown { return { kind: 'reconfigure', extension }; }
  }
  class MockEditorView {
    static lineWrapping = { kind: 'line-wrapping' };
    static updateListener = { of: (listener: typeof updateListener) => { updateListener = listener; return { kind: 'update-listener' }; } };
    static editable = { of: (editable: boolean) => ({ kind: 'editable', editable }) };
    static theme = (spec: Record<string, Record<string, string>>, options?: { dark?: boolean }) => {
      themeSpec = spec;
      themeOptions = options ?? null;
      return { kind: 'decision-os-theme' };
    };
    state: { doc: { length: number; toString(): string } };
    readonly dispatches: unknown[] = [];
    constructor(input: { state: { doc: { length: number; toString(): string } } }) { this.state = input.state; view = this; }
    dispatch(spec: unknown): void { this.dispatches.push(spec); }
    focus(): void { commands.focus += 1; }
    destroy(): void { commands.destroy += 1; }
  }
  const initial = '# Skill\n\nlowercase remains lowercase';
  const cm = {
    basicSetup: { kind: 'basic' },
    Compartment: MockCompartment,
    EditorState: {
      create: ({ doc, extensions }: { doc: string; extensions: unknown[] }) => {
        editorExtensions = extensions;
        return { doc: { length: doc.length, toString: () => doc } };
      },
      readOnly: { of: (readOnly: boolean) => ({ kind: 'read-only', readOnly }) },
    },
    Transaction: { addToHistory: { of: (value: boolean) => ({ kind: 'history-annotation', value }) } },
    EditorView: MockEditorView,
    HighlightStyle: {
      define: (specs: Array<{ tag: unknown; [property: string]: unknown }>) => {
        highlightSpecs = specs;
        return { kind: 'decision-os-highlighting' };
      },
    },
    syntaxHighlighting: (style: unknown) => ({ kind: 'syntax-highlighting', style }),
    tags: {
      heading: 'heading',
      link: 'link',
      url: 'url',
      emphasis: 'emphasis',
      strong: 'strong',
      monospace: 'monospace',
      meta: 'meta',
      processingInstruction: 'processingInstruction',
      punctuation: 'punctuation',
      list: 'list',
      quote: 'quote',
      strikethrough: 'strikethrough',
      invalid: 'invalid',
    },
    keymap: { of: (bindings: unknown[]) => ({ kind: 'keymap', bindings }) },
    markdown: () => { commands.markdown += 1; return { kind: 'markdown' }; },
    defaultKeymap: [{}],
    historyKeymap: [{}],
    searchKeymap: [{}],
    undo: () => { commands.undo += 1; return true; },
    redo: () => { commands.redo += 1; return true; },
    openSearchPanel: () => { commands.find += 1; return true; },
  };
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const parent = new TestElement('DIV');
    const changes: string[] = [];
    const dirty: boolean[] = [];
    const editor = await mountCodeMirrorFileEditor({
      parent: parent as unknown as HTMLElement,
      filename: 'SKILL.md',
      language: 'markdown',
      markdown: initial,
      readOnly: false,
      revision: 'abcdef1234567890',
      onChange: (markdown) => { changes.push(markdown); },
      onDirtyChange: (value) => { dirty.push(value); },
    }, async () => cm as never);
    assert.equal(commands.markdown, 1);
    assert.ok(editorExtensions.some((extension) => (
      typeof extension === 'object'
      && extension !== null
      && (extension as { kind?: string }).kind === 'decision-os-theme'
    )));
    assert.ok(editorExtensions.some((extension) => (
      typeof extension === 'object'
      && extension !== null
      && (extension as { kind?: string }).kind === 'syntax-highlighting'
    )));
    assert.deepEqual(themeOptions, { dark: true });
    assert.equal(themeSpec?.['&']?.textTransform, 'none');
    assert.equal(themeSpec?.['&']?.fontWeight, '400');
    assert.equal(themeSpec?.['&']?.letterSpacing, 'normal');
    assert.equal(themeSpec?.['.cm-content']?.textTransform, 'none');
    assert.equal(themeSpec?.['.cm-gutters']?.textTransform, 'none');
    assert.ok(highlightSpecs.some((spec) => spec.tag === 'heading' && spec.color === 'var(--accent)'));
    assert.ok(highlightSpecs.some((spec) => (
      Array.isArray(spec.tag)
      && spec.tag.includes('link')
      && spec.tag.includes('url')
      && spec.textDecoration === 'underline'
    )));
    assert.equal(view?.state.doc.toString(), initial);
    assert.match(parent.textContent, /SKILL\.md · abcdef123456/);
    assert.deepEqual(parent.querySelectorAll('button').map((button) => button.textContent), ['Undo', 'Redo', 'Find', 'Wrap lines']);
    assert.equal(buttonByText(parent, 'Wrap lines').getAttribute('aria-pressed'), 'true');

    assert.ok(view);
    view.state = { doc: { length: 9, toString: () => '# Changed' } };
    assert.ok(updateListener);
    updateListener({ docChanged: true, state: view.state });
    assert.deepEqual(changes, ['# Changed']);
    assert.deepEqual(dirty, [true]);
    assert.equal(editor.isDirty(), true);
    editor.markSaved();
    assert.equal(editor.isDirty(), false);
    assert.deepEqual(dirty, [true, false]);

    buttonByText(parent, 'Undo').click();
    buttonByText(parent, 'Redo').click();
    buttonByText(parent, 'Find').click();
    buttonByText(parent, 'Wrap lines').click();
    assert.deepEqual({ undo: commands.undo, redo: commands.redo, find: commands.find }, { undo: 1, redo: 1, find: 1 });
    assert.equal(buttonByText(parent, 'Wrap lines').getAttribute('aria-pressed'), 'false');
    assert.equal(view.dispatches.length, 1);
    editor.focus();
    assert.equal(commands.focus, 1);
    editor.setAuthoredFileDiffStatus('timeout');
    const diffStatus = parent.querySelectorAll('*').find((element) => element.className === 'authored-file-diff-status');
    assert.equal(diffStatus?.dataset.status, 'timeout');
    assert.match(diffStatus?.textContent ?? '', /comparison timed out/);
    assert.equal(diffStatus?.hidden, false);
    editor.destroy();
    editor.destroy();
    assert.equal(commands.destroy, 1);
    assert.equal(parent.children.length, 0);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('read-only CodeMirror retains Find, Wrap, selection focus, and copy-safe navigation while mutation controls stay disabled', async () => {
  const previousDocument = globalThis.document;
  let find = 0;
  let focus = 0;
  let dispatches = 0;
  class Compartment {
    of(extension: unknown): unknown { return extension; }
    reconfigure(extension: unknown): unknown { return extension; }
  }
  class View {
    static lineWrapping = {};
    static updateListener = { of: () => ({}) };
    static editable = { of: (editable: boolean) => ({ editable }) };
    static theme = () => ({});
    state = { doc: { length: 4, toString: () => 'read' } };
    dispatch(): void { dispatches += 1; }
    focus(): void { focus += 1; }
    destroy(): void {}
  }
  const cm = {
    basicSetup: {},
    Compartment,
    EditorState: { create: () => ({ doc: { length: 4, toString: () => 'read' } }), readOnly: { of: (value: boolean) => ({ value }) } },
    Transaction: { addToHistory: { of: () => ({}) } },
    EditorView: View,
    HighlightStyle: { define: () => ({}) },
    syntaxHighlighting: () => ({}),
    tags: {
      heading: {},
      link: {},
      url: {},
      emphasis: {},
      strong: {},
      monospace: {},
      meta: {},
      processingInstruction: {},
      punctuation: {},
      list: {},
      quote: {},
      strikethrough: {},
      invalid: {},
    },
    keymap: { of: () => ({}) },
    markdown: () => ({}),
    defaultKeymap: [],
    historyKeymap: [],
    searchKeymap: [],
    undo: () => { throw new Error('read-only undo must not run'); },
    redo: () => { throw new Error('read-only redo must not run'); },
    openSearchPanel: () => { find += 1; return true; },
  };
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const parent = new TestElement('DIV');
    const editor = await mountCodeMirrorFileEditor({
      parent: parent as unknown as HTMLElement,
      filename: 'history.md',
      language: 'markdown',
      markdown: 'read',
      readOnly: true,
      onChange: () => {},
    }, async () => cm as never);
    assert.equal(buttonByText(parent, 'Undo').disabled, true);
    assert.equal(buttonByText(parent, 'Redo').disabled, true);
    assert.equal(buttonByText(parent, 'Find').disabled, false);
    assert.equal(buttonByText(parent, 'Wrap lines').disabled, false);
    buttonByText(parent, 'Find').click();
    buttonByText(parent, 'Wrap lines').click();
    editor.undo();
    editor.redo();
    editor.focus();
    assert.equal(find, 1);
    assert.equal(focus, 1);
    assert.equal(dispatches, 1);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('text-file session mounts one editable view, retains draft state across status, isolates preview disposal, and closes exactly once', async () => {
  const previousConfirm = globalThis.confirm;
  const mounts: Array<{ readOnly: boolean; destroyed: number; markdown: string; setDirty(dirty: boolean): void }> = [];
  const listeners = new Map<string, (event: Event) => void>();
  let returnedFocus = 0;
  let closeRequests = 0;
  let confirm = false;
  globalThis.confirm = () => confirm;
  const mountEditor = async (input: {
    markdown: string;
    readOnly: boolean;
    onChange: (markdown: string) => void;
    onDirtyChange?: (dirty: boolean) => void;
  }) => {
    const record = {
      readOnly: input.readOnly,
      destroyed: 0,
      markdown: input.markdown,
      setDirty: (dirty: boolean) => input.onDirtyChange?.(dirty),
    };
    mounts.push(record);
    return {
      value: () => record.markdown,
      isDirty: () => record.markdown !== input.markdown,
      markSaved: (markdown?: string) => { if (markdown !== undefined) record.markdown = markdown; input.onDirtyChange?.(false); },
      focus() {},
      undo() {},
      redo() {},
      search() {},
      setReadOnly(readOnly: boolean) { record.readOnly = readOnly; },
      setAuthoredFileDiffStatus() {},
      installAuthoredFileDiff() {},
      clearAuthoredFileDiff() {},
      replaceDocument(markdown: string) { record.markdown = markdown; input.onDirtyChange?.(false); },
      setIdentity() {},
      destroy() { record.destroyed += 1; },
    };
  };
  try {
    const session = await createTextFileEditorSession({
      parent: new TestElement('DIV') as unknown as HTMLElement,
      filename: 'SKILL.md',
      markdown: 'initial',
      loadedRevision: 'revision-a',
      readOnly: false,
      returnFocusTo: { isConnected: true, focus: () => { returnedFocus += 1; } } as unknown as HTMLElement,
      onCloseRequested: () => { closeRequests += 1; },
      events: {
        addEventListener: (type, listener) => { listeners.set(type, listener); },
        removeEventListener: (type) => { listeners.delete(type); },
      },
      mountEditor: mountEditor as never,
    });
    assert.equal(mounts.length, 1);
    mounts[0].markdown = 'draft';
    mounts[0].setDirty(true);
    session.setSaving(true);
    session.setSaving(false);
    session.setRecovery({ recoveryToken: 'token', contentRevision: 'revision-b', message: 'pending' });
    assert.equal(mounts.length, 1);
    await session.mountPreview({
      parent: new TestElement('DIV') as unknown as HTMLElement,
      filename: 'SKILL.md',
      markdown: 'historical',
    });
    assert.equal(mounts.length, 2);
    session.closePreview();
    assert.equal(mounts[1].destroyed, 1);
    assert.equal(mounts[0].destroyed, 0);
    assert.equal(session.requestClose('close'), false);
    assert.equal(closeRequests, 0);
    confirm = true;
    assert.equal(session.requestClose('close'), true);
    assert.equal(closeRequests, 1);
    session.dispose();
    session.dispose();
    assert.equal(mounts[0].destroyed, 1);
    assert.equal(returnedFocus, 1);
    assert.equal(listeners.size, 0);
  } finally {
    globalThis.confirm = previousConfirm;
  }
});

test('text-file session rejects stale diff settlement, exposes timeout and conflict states, and disposes pending work once', async () => {
  type DeferredDiff = {
    resolve(value: { generation: number; identity: string; hunks: [] }): void;
    reject(error: Error): void;
  };
  const pending: DeferredDiff[] = [];
  const statuses: string[] = [];
  const installed: string[] = [];
  let cleared = 0;
  let destroyed = 0;
  let onChange: ((markdown: string) => void) | null = null;
  let markdown = 'base\ncurrent\n';
  const mountEditor = async (input: {
    markdown: string;
    onChange: (markdown: string) => void;
  }) => {
    markdown = input.markdown;
    onChange = input.onChange;
    return {
      value: () => markdown,
      isDirty: () => false,
      markSaved: () => {},
      focus() {},
      undo() {},
      redo() {},
      search() {},
      setReadOnly() {},
      setAuthoredFileDiffStatus: (status: string) => { statuses.push(status); },
      installAuthoredFileDiff: (diff: { identity: string }) => { installed.push(diff.identity); },
      clearAuthoredFileDiff: () => { cleared += 1; },
      replaceDocument: (nextMarkdown: string) => { markdown = nextMarkdown; },
      setIdentity() {},
      destroy: () => { destroyed += 1; },
    };
  };
  const deriveDiff = () => new Promise((resolve, reject) => {
    pending.push({ resolve: resolve as DeferredDiff['resolve'], reject });
  });
  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const snapshot = {
    contentRevision: 'a'.repeat(64),
    commit: 'b'.repeat(40),
    olderCommit: 'c'.repeat(40),
    baselineAvailability: 'available',
    baseMarkdown: 'base\nold\n',
    markdown,
  } as const;
  const session = await createTextFileEditorSession({
    parent: new TestElement('DIV') as unknown as HTMLElement,
    filename: 'GateTest.md',
    markdown,
    loadedRevision: snapshot.contentRevision,
    snapshot,
    readOnly: false,
    events: null,
    mountEditor: mountEditor as never,
    deriveDiff: deriveDiff as never,
    diffDebounceMs: 0,
  });
  await flush();
  assert.equal(pending.length, 1);
  markdown = 'base\ncurrent edited\n';
  onChange?.(markdown);
  await flush();
  assert.equal(pending.length, 2);
  pending[1].resolve({
    generation: 2,
    identity: `${snapshot.commit}:${snapshot.olderCommit}:${snapshot.contentRevision}`,
    hunks: [],
  });
  await flush();
  assert.equal(installed.length, 1);
  assert.equal(statuses.at(-1), 'available');
  pending[0].resolve({
    generation: 1,
    identity: `${snapshot.commit}:${snapshot.olderCommit}:${snapshot.contentRevision}`,
    hunks: [],
  });
  await flush();
  assert.equal(installed.length, 1);

  markdown = 'base\ncurrent timeout\n';
  onChange?.(markdown);
  await flush();
  pending[2].reject(new DOMException('deadline', 'TimeoutError'));
  await flush();
  assert.equal(statuses.at(-1), 'timeout');

  session.setConflictSnapshot({ ...snapshot, markdown: 'server\n' });
  assert.equal(session.state().conflictSnapshot?.markdown, 'server\n');
  assert.equal(statuses.at(-1), 'conflict');
  assert.ok(cleared >= 2);
  session.dispose();
  session.dispose();
  assert.equal(destroyed, 1);
});

test('generic revision browser exposes full Markdown preview and older-page navigation independently of its diff', () => {
  const previousDocument = globalThis.document;
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const host = new TestElement('DIV');
    let previewMarkdown = '';
    let diffPatch = '';
    let olderPages = 0;
    renderAuthoredFileRevision({
      host: host as unknown as HTMLElement,
      revisions: [{ commit: 'a'.repeat(40), authoredAt: '2026-07-28T00:00:00.000Z', subject: 'Revision' }],
      selectedIndex: 0,
      selectedDetail: {
        commit: 'a'.repeat(40),
        authoredAt: '2026-07-28T00:00:00.000Z',
        subject: 'Revision',
        markdown: '# Full historical Markdown',
        patch: '@@ -1 +1 @@\n-old\n+new',
      },
      loading: false,
      hasOlderPage: true,
      filename: 'SKILL.md',
      onSelect: () => {},
      onRequestOlderPage: () => { olderPages += 1; },
      mountPreview: (_host, detail) => { previewMarkdown = detail.markdown; },
      mountDiff: (_host, detail) => { diffPatch = detail.patch; },
    });
    buttonByText(host, 'Older').click();
    assert.equal(olderPages, 1);
    assert.equal(previewMarkdown, '# Full historical Markdown');
    assert.match(diffPatch, /-old/);
    assert.ok(host.querySelectorAll('*').some((element) => /minus means removed in red/.test(element.getAttribute('aria-label') ?? '')));
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('clicking an editable skill filename activates the editor and read-only files stay inert', () => {
  const previousDocument = globalThis.document;
  let edits = 0;
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const rendered = renderEditableSkillDocument({
      filename: 'SKILL.md',
      markdown: 'Instructions',
      editable: true,
      renderMarkdown: (markdown) => {
        const body = testDocument.createElement('div');
        body.textContent = markdown;
        return body as unknown as HTMLElement;
      },
      onEdit: () => { edits += 1; },
    }) as unknown as TestElement;
    const activation = buttonByText(rendered, 'SKILL.md');
    assert.equal(activation.getAttribute('aria-label'), 'Edit SKILL.md');
    activation.click();
    assert.equal(edits, 1);

    const protectedFile = renderEditableSkillDocument({
      filename: 'SKILL.md',
      markdown: 'Protected',
      editable: false,
      readOnlyReason: 'Managed by Codex.',
      renderMarkdown: (markdown) => {
        const body = testDocument.createElement('div');
        body.textContent = markdown;
        return body as unknown as HTMLElement;
      },
      onEdit: () => { edits += 1; },
    }) as unknown as TestElement;
    assert.equal(protectedFile.querySelectorAll('button').length, 0);
    assert.equal(protectedFile.children[0].title, 'Managed by Codex.');
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('Pierre 1.2.12 receives the adjacent patch and exposes red-blue non-color semantics', async () => {
  const previousDocument = globalThis.document;
  let parsed: unknown[] = [];
  let renderInput: unknown = null;
  let cleaned = 0;
  class FileDiff {
    constructor(readonly options: unknown) {}
    render(input: unknown): void { renderInput = { options: this.options, input }; }
    cleanUp(): void { cleaned += 1; }
  }
  const pierre = {
    DIFFS_TAG_NAME: 'PIERRE-DIFF',
    parsePatchFiles: (...input: unknown[]) => {
      parsed = input;
      return [{ files: [{ name: 'SKILL.md' }] }];
    },
    FileDiff,
  };
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const host = new TestElement('DIV');
    const dispose = await renderSkillRevisionDiff({
      host: host as unknown as HTMLElement,
      patch: '@@ -1 +1 @@\n-old\n+new',
      commit: 'commit-a',
    }, async () => pierre as never);
    assert.deepEqual(parsed, ['@@ -1 +1 @@\n-old\n+new', 'commit-a', true]);
    assert.ok(renderInput);
    const container = host.children[0];
    assert.equal(container.style.values.get('--diffs-addition-color'), '#38d9e8');
    assert.equal(container.style.values.get('--diffs-addition-color-override'), '#38d9e8');
    assert.equal(container.style.values.get('--diffs-deletion-color'), '#ff5f6d');
    assert.match(container.getAttribute('aria-label') ?? '', /minus sign and red/);
    assert.match(container.getAttribute('aria-label') ?? '', /plus sign and blue/);
    dispose();
    assert.equal(cleaned, 1);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('Task-card diff contains rejected deferred Pierre loading and reports the owned error', async () => {
  const previousDocument = globalThis.document;
  const module = deferred<never>();
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const host = new TestElement('DIV');
    const owner = createLedgerCardRevisionDiffOwner(
      (input) => renderSkillRevisionDiff(input, () => module.promise),
      () => 1,
    );
    owner.mount(
      host as unknown as HTMLElement,
      revisionDetail('revision-a', '@@ -1 +1 @@\n-old\n+new'),
    );
    module.reject(new Error('Pierre module unavailable'));
    await settleAsyncDiff();
    assert.equal(host.textContent, 'Pierre module unavailable');
    owner.dispose();
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('Task-card diff ignores rapid out-of-order deferred revision modules', async () => {
  const previousDocument = globalThis.document;
  const modules = [deferred<never>(), deferred<never>()];
  let loadIndex = 0;
  let firstParses = 0;
  let secondParses = 0;
  let secondCleanups = 0;
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const host = new TestElement('DIV');
    const owner = createLedgerCardRevisionDiffOwner(
      (input) => renderSkillRevisionDiff(input, () => modules[loadIndex++].promise),
      () => 1,
    );
    owner.mount(host as unknown as HTMLElement, revisionDetail('revision-a', 'first patch'));
    owner.mount(host as unknown as HTMLElement, revisionDetail('revision-b', 'second patch'));
    modules[1].resolve(pierreModule({
      name: 'revision-b',
      onParse: () => { secondParses += 1; },
      onCleanup: () => { secondCleanups += 1; },
    }) as never);
    await settleAsyncDiff();
    assert.equal(host.children[0]?.getAttribute('data-rendered-revision'), 'revision-b');
    modules[0].resolve(pierreModule({
      name: 'revision-a',
      onParse: () => { firstParses += 1; },
    }) as never);
    await settleAsyncDiff();
    assert.equal(host.children[0]?.getAttribute('data-rendered-revision'), 'revision-b');
    assert.deepEqual({ firstParses, secondParses }, { firstParses: 0, secondParses: 1 });
    owner.dispose();
    assert.equal(secondCleanups, 1);
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('Task-card diff does not render a deferred Pierre module into a disconnected host', async () => {
  const previousDocument = globalThis.document;
  const module = deferred<never>();
  let parses = 0;
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const host = new TestElement('DIV');
    const owner = createLedgerCardRevisionDiffOwner(
      (input) => renderSkillRevisionDiff(input, () => module.promise),
      () => 1,
    );
    owner.mount(host as unknown as HTMLElement, revisionDetail('revision-a', 'patch'));
    host.isConnected = false;
    module.resolve(pierreModule({
      name: 'revision-a',
      onParse: () => { parses += 1; },
    }) as never);
    await settleAsyncDiff();
    assert.equal(parses, 0);
    assert.equal(host.children.length, 0);
    owner.dispose();
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('Task-card diff disposal cleans the mounted Pierre renderer exactly once', async () => {
  const previousDocument = globalThis.document;
  const module = deferred<never>();
  let renders = 0;
  let cleanups = 0;
  try {
    (globalThis as unknown as { document: unknown }).document = testDocument;
    const host = new TestElement('DIV');
    const owner = createLedgerCardRevisionDiffOwner(
      (input) => renderSkillRevisionDiff(input, () => module.promise),
      () => 1,
    );
    owner.mount(host as unknown as HTMLElement, revisionDetail('revision-a', 'patch'));
    module.resolve(pierreModule({
      name: 'revision-a',
      onRender: () => { renders += 1; },
      onCleanup: () => { cleanups += 1; },
    }) as never);
    await settleAsyncDiff();
    owner.dispose();
    owner.dispose();
    assert.deepEqual({ renders, cleanups }, { renders: 1, cleanups: 1 });
  } finally {
    (globalThis as unknown as { document: unknown }).document = previousDocument;
  }
});

test('authoring dependencies, local assets, modal geometry, and responsive entry actions are pinned', () => {
  const packageJson = JSON.parse(readFileSync(new URL('frontend/package.json', root), 'utf8')) as { dependencies: Record<string, string> };
  const css = readFileSync(new URL('frontend/assets/canvas/dialogs.css', root), 'utf8');
  const responsive = readFileSync(new URL('frontend/src/app/responsive/codex.js', root), 'utf8');
  const responsiveBoot = readFileSync(new URL('frontend/src/app/controller/boot-application.ts', root), 'utf8');
  const sharedAuthoringCss = readFileSync(new URL('frontend/assets/shared/content-authoring.css', root), 'utf8');
  const html = readFileSync(new URL('frontend/index.html', root), 'utf8');
  const vendorScript = readFileSync(new URL('frontend/scripts/build-editor-vendors.mjs', root), 'utf8');
  assert.equal(packageJson.dependencies.codemirror, '6.0.2');
  assert.equal(packageJson.dependencies['@codemirror/lang-markdown'], '6.5.1');
  assert.equal(packageJson.dependencies['@pierre/diffs'], '1.2.12');
  assert.match(vendorScript, /pierre-diffs-1\.2\.12\.js/);
  assert.match(vendorScript, /codemirror-6\.0\.2\.js/);
  assert.match(readFileSync(new URL('frontend/assets/vendor/codemirror-6.0.2.LICENSE', root), 'utf8'), /MIT License/);
  assert.match(readFileSync(new URL('frontend/assets/vendor/pierre-diffs-1.2.12.LICENSE', root), 'utf8'), /Apache License/);
  assert.match(css, /\.skill-library-editor-modal\s*\{[^}]*width:\s*min\(900px, calc\(100vw - 48px\)\);[^}]*max-width:\s*min\(900px, calc\(100vw - 48px\)\);[^}]*height:\s*95vh;/s);
  assert.match(css, /\.codex-editor-modal \.skill-editor-tag-choice\s*\{[^}]*border:\s*1px solid color-mix\(in srgb, var\(--skill-category-color\), white 24%\);[^}]*background:\s*color-mix\(in srgb, var\(--skill-category-color\), transparent 82%\);/s);
  assert.match(css, /\.codex-editor-modal \.skill-editor-tag-choice\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--skill-category-color\);/s);
  assert.match(css, /--diffs-addition-color:\s*#38d9e8/);
  assert.match(css, /\.authored-revision-content\.is-single-column\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(css, /\.skill-library-editor-body\s*\{[^}]*grid-template-rows:\s*max-content max-content minmax\(280px, 1fr\)/s);
  assert.match(css, /\.skill-editor-owner-controls\s*\{[^}]*min-height:\s*max-content/s);
  assert.match(css, /--diffs-deletion-color:\s*#ff5f6d/);
  assert.match(responsiveBoot, /responsive-content-authoring-styles[^]*\/assets\/shared\/content-authoring\.css/);
  assert.match(sharedAuthoringCss, /@import url\('\.\.\/canvas\/dialogs\.css'\)/);
  assert.equal(html.match(/class="skill-library-editor-modal codex-editor-modal"/g)?.length, 2);
  assert.match(html, /class="primary-button skill-new"[^>]*>New skill<\/button>/);
  assert.match(responsive, /openSkillLibraryCreator\(\{/);
  assert.match(responsive, /openSkillLibraryEditor\(\{/);
  assert.match(responsive, /renderEditableSkillDocument\(\{/);
  assert.match(readFileSync(new URL('frontend/src/runtime/codex/effect/render-skill-library-editor-modal.ts', root), 'utf8'), /decorateSkillCategoryLabel\(choice, tag\)/);
});
