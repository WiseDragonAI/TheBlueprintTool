/**
 * WHAT: Owns one editable text-file EditorView and its independent historical preview.
 * WHY: Owner metadata and request state may rerender without losing the draft, undo stack, selection, search, wrapping, scroll, or focus.
 */
import {
  mountCodeMirrorFileEditor,
  type CodeMirrorFileEditor,
} from '../../codex/component/codemirror-file-editor.js';

export type TextFileEditorRecovery = {
  recoveryToken: string;
  contentRevision: string;
  message: string;
} | null;

export type TextFileEditorSessionState = {
  draft: string;
  loadedRevision: string;
  dirty: boolean;
  saving: boolean;
  readOnly: boolean;
  recovery: TextFileEditorRecovery;
  selectedRevision: string | null;
};

export type TextFileEditorSession = {
  state(): Readonly<TextFileEditorSessionState>;
  value(): string;
  focus(): void;
  setIdentity(filename: string, revision?: string): void;
  setSaving(saving: boolean): void;
  setReadOnly(readOnly: boolean): void;
  setRecovery(recovery: TextFileEditorRecovery): void;
  setSelectedRevision(commit: string | null): void;
  markSaved(markdown: string, revision: string): void;
  reloadAuthoritative(markdown: string, revision: string): void;
  mountPreview(input: {
    parent: HTMLElement;
    filename: string;
    markdown: string;
    revision?: string;
  }): Promise<void>;
  closePreview(): void;
  requestClose(reason: 'close' | 'escape' | 'back' | 'route'): boolean;
  dispose(): void;
};

type WindowEvents = {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
};

function defaultConfirmDiscard(): boolean {
  return typeof globalThis.confirm !== 'function' || globalThis.confirm('Discard unsaved changes?');
}

export async function createTextFileEditorSession(input: {
  parent: HTMLElement;
  filename: string;
  markdown: string;
  loadedRevision: string;
  readOnly: boolean;
  returnFocusTo?: HTMLElement | null;
  onChange?: (markdown: string) => void;
  onStateChange?: (state: Readonly<TextFileEditorSessionState>) => void;
  onCloseRequested?: (reason: 'close' | 'escape' | 'back' | 'route') => void;
  isOwnerDirty?: () => boolean;
  confirmDiscard?: () => boolean;
  restoreBackNavigation?: () => void;
  events?: WindowEvents | null;
  mountEditor?: typeof mountCodeMirrorFileEditor;
}): Promise<TextFileEditorSession> {
  const mountEditor = input.mountEditor ?? mountCodeMirrorFileEditor;
  const state: TextFileEditorSessionState = {
    draft: input.markdown,
    loadedRevision: input.loadedRevision,
    dirty: false,
    saving: false,
    readOnly: input.readOnly,
    recovery: null,
    selectedRevision: null,
  };
  let disposed = false;
  let previewGeneration = 0;
  let preview: CodeMirrorFileEditor | null = null;
  const emit = (): void => input.onStateChange?.({ ...state });
  const editable = await mountEditor({
    parent: input.parent,
    filename: input.filename,
    language: 'markdown',
    markdown: input.markdown,
    readOnly: input.readOnly,
    revision: input.loadedRevision,
    onChange: (markdown) => {
      state.draft = markdown;
      input.onChange?.(markdown);
    },
    onDirtyChange: (dirty) => {
      state.dirty = dirty;
      emit();
    },
  });
  const events = input.events === undefined
    ? ((globalThis.window && typeof globalThis.window.addEventListener === 'function') ? globalThis.window : null)
    : input.events;
  const isDirty = (): boolean => state.dirty || Boolean(input.isOwnerDirty?.());
  const beforeUnload = (event: Event): void => {
    if (!isDirty()) return;
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = '';
  };
  const requestClose = (reason: 'close' | 'escape' | 'back' | 'route'): boolean => {
    if (disposed) return true;
    if (isDirty() && !(input.confirmDiscard ?? defaultConfirmDiscard)()) {
      if (reason === 'back') input.restoreBackNavigation?.();
      return false;
    }
    input.onCloseRequested?.(reason);
    return true;
  };
  const popState = (): void => { requestClose('back'); };
  events?.addEventListener('beforeunload', beforeUnload);
  events?.addEventListener('popstate', popState);

  return {
    state: () => ({ ...state }),
    value: () => editable.value(),
    focus: () => editable.focus(),
    setIdentity: (filename, revision) => editable.setIdentity(filename, revision),
    setSaving: (saving) => {
      state.saving = saving;
      editable.setReadOnly(state.readOnly || saving);
      emit();
    },
    setReadOnly: (readOnly) => {
      state.readOnly = readOnly;
      editable.setReadOnly(readOnly || state.saving);
      emit();
    },
    setRecovery: (recovery) => {
      state.recovery = recovery;
      emit();
    },
    setSelectedRevision: (commit) => {
      state.selectedRevision = commit;
      emit();
    },
    markSaved: (markdown, revision) => {
      state.draft = markdown;
      state.loadedRevision = revision;
      state.recovery = null;
      editable.markSaved(markdown);
      editable.setIdentity(input.filename, revision);
      emit();
    },
    reloadAuthoritative: (markdown, revision) => {
      state.draft = markdown;
      state.loadedRevision = revision;
      state.recovery = null;
      editable.replaceDocument(markdown, revision);
      input.onChange?.(markdown);
      emit();
    },
    mountPreview: async (previewInput) => {
      const generation = ++previewGeneration;
      preview?.destroy();
      preview = null;
      const mounted = await mountEditor({
        ...previewInput,
        language: 'markdown',
        readOnly: true,
        onChange: () => {},
      });
      if (disposed || generation !== previewGeneration || !previewInput.parent.isConnected) {
        mounted.destroy();
        return;
      }
      preview = mounted;
    },
    closePreview: () => {
      previewGeneration += 1;
      preview?.destroy();
      preview = null;
    },
    requestClose,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      previewGeneration += 1;
      events?.removeEventListener('beforeunload', beforeUnload);
      events?.removeEventListener('popstate', popState);
      preview?.destroy();
      preview = null;
      editable.destroy();
      if (input.returnFocusTo?.isConnected) input.returnFocusTo.focus();
    },
  };
}
