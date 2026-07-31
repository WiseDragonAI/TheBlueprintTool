/**
 * WHAT: Owns one editable text-file EditorView and its independent historical preview.
 * WHY: Owner metadata and request state may rerender without losing the draft, undo stack, selection, search, wrapping, scroll, or focus.
 */
import {
  mountCodeMirrorFileEditor,
  type AuthoredFileDiffStatus,
  type CodeMirrorFileEditor,
} from '../../codex/component/codemirror-file-editor.js';
import { deriveAuthoredFileDiff } from '../helper/derive-authored-file-diff.js';
import { normalizeAuthoredFileDiff } from '../helper/normalize-authored-file-diff.js';
import type { AuthoredFileRevisionSnapshot } from '../helper/authored-file-revision-snapshot.js';

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
  snapshot: AuthoredFileRevisionSnapshot | null;
  conflictSnapshot: AuthoredFileRevisionSnapshot | null;
  diffStatus: AuthoredFileDiffStatus;
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
  markSaved(markdown: string, revision: string, snapshot?: AuthoredFileRevisionSnapshot): void;
  reloadAuthoritative(markdown: string, revision: string, snapshot?: AuthoredFileRevisionSnapshot): void;
  setConflictSnapshot(snapshot: AuthoredFileRevisionSnapshot | null): void;
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
  snapshot?: AuthoredFileRevisionSnapshot | null;
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
  deriveDiff?: typeof deriveAuthoredFileDiff;
  diffDebounceMs?: number;
  diffDeadlineMs?: number;
}): Promise<TextFileEditorSession> {
  const mountEditor = input.mountEditor ?? mountCodeMirrorFileEditor;
  const deriveDiff = input.deriveDiff ?? deriveAuthoredFileDiff;
  const state: TextFileEditorSessionState = {
    draft: input.markdown,
    loadedRevision: input.loadedRevision,
    dirty: false,
    saving: false,
    readOnly: input.readOnly,
    recovery: null,
    selectedRevision: null,
    snapshot: input.snapshot ?? null,
    conflictSnapshot: null,
    diffStatus: 'idle',
  };
  let disposed = false;
  let previewGeneration = 0;
  let diffGeneration = 0;
  let diffTimer: ReturnType<typeof setTimeout> | null = null;
  let diffAbort: AbortController | null = null;
  let preview: CodeMirrorFileEditor | null = null;
  const emit = (): void => input.onStateChange?.({ ...state });
  let editable: CodeMirrorFileEditor;
  const setDiffStatus = (status: AuthoredFileDiffStatus): void => {
    state.diffStatus = status;
    editable.setAuthoredFileDiffStatus(status);
    emit();
  };
  const scheduleDiff = (markdown: string, immediate = false): void => {
    const snapshot = state.snapshot;
    // WHAT: Keep initialization-only authored history visually neutral.
    // WHY: An absent prior revision is not evidence that every current byte was newly added.
    if (snapshot?.baselineAvailability === 'no_prior_revision') {
      diffGeneration += 1;
      // WHAT: Cancel a pending debounce owned by the superseded baseline.
      // WHY: Initialization-only history must not later dispatch work from a previously admitted snapshot.
      if (diffTimer) clearTimeout(diffTimer);
      diffTimer = null;
      diffAbort?.abort();
      diffAbort = null;
      editable?.clearAuthoredFileDiff();
      setDiffStatus('no_prior_revision');
      return;
    }
    // WHAT: Skip derivation when no authoritative snapshot was admitted.
    // WHY: Transport failure and imported owners cannot safely manufacture Git change identity.
    if (!snapshot) {
      editable.clearAuthoredFileDiff();
      setDiffStatus('unavailable');
      return;
    }
    if (diffTimer) clearTimeout(diffTimer);
    diffAbort?.abort();
    const generation = ++diffGeneration;
    diffAbort = new AbortController();
    const identity = `${snapshot.commit}:${snapshot.olderCommit ?? 'root'}:${snapshot.contentRevision}`;
    setDiffStatus('deriving');
    const run = async (): Promise<void> => {
      diffTimer = null;
      try {
        const result = await deriveDiff({
          generation,
          identity,
          filename: input.filename,
          baseMarkdown: snapshot.baseMarkdown,
          draftMarkdown: markdown,
          baseKey: snapshot.olderCommit ?? 'root',
          draftKey: `${snapshot.contentRevision}:${generation}:${markdown.length}`,
          deadlineMs: input.diffDeadlineMs ?? 2_000,
          signal: diffAbort?.signal,
        });
        // WHAT: Discard results that no longer describe the active session bytes and immutable Git identity.
        // WHY: Superseded Worker messages must not install stale ranges into the current editor document.
        if (
          disposed
          || generation !== diffGeneration
          || result.identity !== identity
          || editable.value() !== markdown
        ) return;
        editable.installAuthoredFileDiff(normalizeAuthoredFileDiff({
          identity,
          document: markdown,
          metadata: result.metadata,
        }));
        setDiffStatus('available');
      } catch (error) {
        // WHAT: Contain only the active non-cancellation failure as visible diff-unavailable state.
        // WHY: Superseded and disposed generations already have a newer lifecycle owner and must not overwrite its status.
        if ((error as { name?: string }).name !== 'AbortError' && generation === diffGeneration) {
          const status = (error as { name?: string }).name === 'TimeoutError' ? 'timeout' : 'error';
          // WHAT: Record unexpected Worker failure details while treating the finite deadline as an expected unavailable state.
          // WHY: Timeout must keep the operator-facing route error-free, while implementation failures still require diagnostics.
          if (status === 'error') {
            console.error('Authored Markdown diff derivation failed.', {
              filename: input.filename,
              generation,
              identity,
              error,
            });
          }
          editable.clearAuthoredFileDiff(identity);
          setDiffStatus(status);
        }
      }
    };
    diffTimer = setTimeout(() => { void run(); }, immediate ? 0 : input.diffDebounceMs ?? 150);
  };
  editable = await mountEditor({
    parent: input.parent,
    filename: input.filename,
    language: 'markdown',
    markdown: input.markdown,
    readOnly: input.readOnly,
    revision: input.loadedRevision,
    onChange: (markdown) => {
      state.draft = markdown;
      scheduleDiff(markdown);
      input.onChange?.(markdown);
    },
    onDirtyChange: (dirty) => {
      state.dirty = dirty;
      emit();
    },
  });
  scheduleDiff(input.markdown, true);
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
    markSaved: (markdown, revision, snapshot) => {
      state.draft = markdown;
      state.loadedRevision = revision;
      state.recovery = null;
      state.snapshot = snapshot ?? state.snapshot;
      state.conflictSnapshot = null;
      input.markdown = markdown;
      input.loadedRevision = revision;
      editable.markSaved(markdown);
      editable.setIdentity(input.filename, revision);
      scheduleDiff(markdown, true);
      emit();
    },
    reloadAuthoritative: (markdown, revision, snapshot) => {
      state.draft = markdown;
      state.loadedRevision = revision;
      state.recovery = null;
      state.snapshot = snapshot ?? state.snapshot;
      state.conflictSnapshot = null;
      input.markdown = markdown;
      input.loadedRevision = revision;
      diffAbort?.abort();
      editable.clearAuthoredFileDiff();
      editable.replaceDocument(markdown, revision);
      scheduleDiff(markdown, true);
      input.onChange?.(markdown);
      emit();
    },
    setConflictSnapshot: (snapshot) => {
      state.conflictSnapshot = snapshot;
      // WHAT: Withdraw Git presentation when authoritative conflict evidence replaces the admitted baseline.
      // WHY: Ranges derived from the rejected save identity are no longer trustworthy against the preserved local draft.
      if (snapshot) {
        diffGeneration += 1;
        // WHAT: Cancel a pending debounce owned by the rejected baseline.
        // WHY: Conflict settlement must withdraw both visible ranges and scheduled derivation work.
        if (diffTimer) clearTimeout(diffTimer);
        diffTimer = null;
        diffAbort?.abort();
        diffAbort = null;
        editable.clearAuthoredFileDiff();
        setDiffStatus('conflict');
      }
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
      diffGeneration += 1;
      if (diffTimer) clearTimeout(diffTimer);
      diffTimer = null;
      diffAbort?.abort();
      diffAbort = null;
      events?.removeEventListener('beforeunload', beforeUnload);
      events?.removeEventListener('popstate', popState);
      preview?.destroy();
      preview = null;
      editable.destroy();
      if (input.returnFocusTo?.isConnected) input.returnFocusTo.focus();
    },
  };
}
