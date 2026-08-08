/**
 * WHAT: Adapts one card Markdown owner to the shared stable editor session.
 * WHY: Saving, conflicts, history, and owner rerenders must preserve the active EditorView.
 */
import { ledgerCardBody } from '../../ledger/helper/ledger-card-body.js';
import { renderSkillRevisionDiff } from '../../codex/component/render-skill-revision-diff.js';
import {
  renderAuthoredFileRevision,
  type AuthoredFileRevisionDetail,
  type AuthoredFileRevisionSummary,
} from '../component/render-authored-file-revision.js';
import { createTextFileEditorSession, type TextFileEditorSession } from './text-file-editor-session.js';
import { loadLedgerCardRevision, loadLedgerCardRevisionHistory } from '../effect/load-ledger-card-revision.js';
import {
  loadLedgerCardContent,
  requestLedgerCardContentSave,
  requestLedgerCardRevisionRetry,
  type LedgerCardContentDetail,
} from '../effect/request-ledger-card-content-save.js';

type Identity = { projectId: string; ledgerId: string; cardId: string };
type OpenInput = Identity & {
  card?: LedgerCardContentDetail | Record<string, unknown>;
  returnFocusTo?: HTMLElement | null;
  onSaved?: (card: LedgerCardContentDetail) => void;
  onClosed?: () => void;
};
type RevisionDiffRenderer = typeof renderSkillRevisionDiff;
type RevisionDiffOwner = {
  mount(host: HTMLElement, detail: AuthoredFileRevisionDetail): void;
  clear(): void;
  dispose(): void;
};

let identity: Identity | null = null;
let input: OpenInput | null = null;
let dialog: HTMLDialogElement | null = null;
let editorHost: HTMLElement | null = null;
let historyHost: HTMLElement | null = null;
let message: HTMLElement | null = null;
let actions: HTMLElement | null = null;
let session: TextFileEditorSession | null = null;
let card: LedgerCardContentDetail | null = null;
let generation = 0;
let view: 'editor' | 'history' = 'editor';
let revisions: AuthoredFileRevisionSummary[] = [];
let nextCursor: string | null = null;
let selectedIndex = 0;
let selectedDetail: AuthoredFileRevisionDetail | null = null;
let historyLoading = false;
let conflictRevision = '';
let error = '';
let notice = '';

export function createLedgerCardRevisionDiffOwner(
  renderDiff: RevisionDiffRenderer = renderSkillRevisionDiff,
  editorGeneration: () => number = () => generation,
): RevisionDiffOwner {
  let requestGeneration = 0;
  let activeDispose: (() => void) | null = null;
  let disposed = false;

  const clear = (): void => {
    requestGeneration += 1;
    activeDispose?.();
    activeDispose = null;
  };

  return {
    mount: (host, detail) => {
      if (disposed) return;
      clear();
      const currentRequestGeneration = requestGeneration;
      const currentEditorGeneration = editorGeneration();
      const isCurrent = (): boolean => !disposed
        && currentRequestGeneration === requestGeneration
        && currentEditorGeneration === editorGeneration()
        && host.isConnected;
      void renderDiff({
        host,
        patch: detail.patch,
        commit: detail.commit,
        isCurrent,
      })
        .then((dispose) => {
          if (!isCurrent()) dispose();
          else activeDispose = dispose;
        })
        .catch((reason: unknown) => {
          if (isCurrent()) host.textContent = reason instanceof Error ? reason.message : String(reason);
        });
    },
    clear,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clear();
    },
  };
}

let diffOwner = createLedgerCardRevisionDiffOwner();

function sameIdentity(left: Identity | null, right: Identity): boolean {
  return Boolean(left
    && left.projectId === right.projectId
    && left.ledgerId === right.ledgerId
    && left.cardId === right.cardId);
}

function button(label: string, action: () => void, className = 'ghost-button'): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function disposeHistory(): void {
  diffOwner.clear();
  session?.closePreview();
}

function finishClose(): void {
  const closing = input;
  generation += 1;
  disposeHistory();
  diffOwner.dispose();
  diffOwner = createLedgerCardRevisionDiffOwner();
  dialog?.close();
  dialog?.remove();
  session?.dispose();
  session = null;
  dialog = null;
  editorHost = null;
  historyHost = null;
  message = null;
  actions = null;
  identity = null;
  input = null;
  card = null;
  closing?.onClosed?.();
}

export function requestActiveLedgerCardEditorClose(reason: 'close' | 'escape' | 'back' | 'route'): boolean {
  if (!dialog) return true;
  if (session) return session.requestClose(reason);
  finishClose();
  return true;
}

export function activeLedgerCardEditorIdentity(): Readonly<Identity> | null {
  return identity ? { ...identity } : null;
}

function buildShell(): void {
  dialog = document.createElement('dialog');
  dialog.className = 'ledger-card-editor-modal skill-library-editor-modal codex-editor-modal';
  dialog.setAttribute('aria-labelledby', 'ledger-card-editor-title');
  const head = document.createElement('header');
  head.className = 'codex-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Card Markdown';
  const title = document.createElement('h2');
  title.id = 'ledger-card-editor-title';
  title.textContent = String(card?.title ?? `Card ${identity?.cardId ?? ''}`);
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = `${identity?.ledgerId ?? ''} · ${identity?.cardId ?? ''}`;
  copy.append(kicker, title, subtitle);
  const close = button('×', () => requestActiveLedgerCardEditorClose('close'), 'plain-close');
  close.setAttribute('aria-label', 'Close card Markdown editor');
  head.append(copy, close);

  const body = document.createElement('section');
  body.className = 'skill-library-editor-body';
  const tabs = document.createElement('nav');
  tabs.className = 'skill-editor-view-tabs';
  tabs.setAttribute('aria-label', 'Card authored file views');
  tabs.append(
    button('Editor', () => { view = 'editor'; render(); }),
    button('History', () => { view = 'history'; void initializeHistory(); }),
  );
  const editorPane = document.createElement('section');
  editorPane.className = 'codex-field skill-markdown-field skill-editor-pane';
  editorHost = document.createElement('div');
  editorHost.className = 'skill-codemirror-host';
  editorPane.append(editorHost);
  historyHost = document.createElement('section');
  historyHost.className = 'skill-history-pane';
  body.append(tabs, editorPane, historyHost);

  const footer = document.createElement('footer');
  footer.className = 'codex-modal-actions';
  message = document.createElement('p');
  message.setAttribute('role', 'status');
  actions = document.createElement('div');
  actions.className = 'skill-editor-footer-actions';
  footer.append(message, actions);
  dialog.append(head, body, footer);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    requestActiveLedgerCardEditorClose('escape');
  });
  document.body.append(dialog);
  dialog.showModal();
}

async function selectRevision(index: number): Promise<void> {
  if (!identity || index < 0 || index >= revisions.length) return;
  const currentGeneration = generation;
  selectedIndex = index;
  selectedDetail = null;
  historyLoading = true;
  render();
  const result = await loadLedgerCardRevision({ ...identity, commit: revisions[index].commit });
  if (generation !== currentGeneration || selectedIndex !== index) return;
  selectedDetail = result.revision ?? null;
  historyLoading = false;
  error = result.ok ? '' : result.error ?? 'Could not load this revision.';
  render();
}

async function initializeHistory(cursor: string | null = null): Promise<void> {
  if (!identity || historyLoading) return;
  const currentGeneration = generation;
  view = 'history';
  historyLoading = true;
  render();
  const result = await loadLedgerCardRevisionHistory({ ...identity, cursor });
  if (generation !== currentGeneration) return;
  historyLoading = false;
  if (!result.ok) error = result.error ?? 'Could not load card history.';
  else {
    const known = new Set(revisions.map((entry) => entry.commit));
    revisions = [...revisions, ...result.revisions.filter((entry) => !known.has(entry.commit))];
    nextCursor = result.nextCursor;
    if (revisions.length) await selectRevision(cursor ? Math.max(0, revisions.length - result.revisions.length) : 0);
  }
  render();
}

async function reloadAuthoritative(): Promise<void> {
  if (!identity || !session) return;
  const result = await loadLedgerCardContent(identity.projectId, identity.ledgerId, identity.cardId);
  if (!result.ok || !result.card) {
    error = result.error ?? 'Could not reload the card.';
  } else {
    card = result.card;
    conflictRevision = '';
    error = '';
    notice = 'Reloaded the server-confirmed revision.';
    session.reloadAuthoritative(ledgerCardBody(card), String(card.contentRevision ?? ''));
  }
  render();
}

async function save(): Promise<void> {
  if (!identity || !card || !session || session.state().saving) return;
  session.setSaving(true);
  error = '';
  notice = '';
  conflictRevision = '';
  render();
  const result = await requestLedgerCardContentSave({
    ...identity,
    markdown: session.value(),
    expectedContentRevision: session.state().loadedRevision,
  });
  session.setSaving(false);
  if (result.ok && result.card && result.contentRevision) {
    card = result.card;
    session.markSaved(ledgerCardBody(result.card), result.contentRevision);
    notice = 'Saved as a focused Git revision.';
    input?.onSaved?.(result.card);
  } else if (result.statusCode === 409) {
    conflictRevision = result.currentRevision ?? '';
    error = result.error ?? 'The card changed after it was loaded.';
  } else if (result.recovery) {
    session.setRecovery({
      recoveryToken: result.recovery.recoveryToken,
      contentRevision: result.recovery.contentRevision,
      message: result.error ?? 'The Markdown was saved, but its Git revision still needs recovery.',
    });
    error = result.error ?? 'The Git revision is pending recovery.';
  } else error = result.error ?? 'Could not save the card.';
  render();
}

async function retryRevision(): Promise<void> {
  if (!identity || !session?.state().recovery || session.state().saving) return;
  const recovery = session.state().recovery;
  session.setSaving(true);
  render();
  const result = await requestLedgerCardRevisionRetry({ ...identity, ...recovery });
  session.setSaving(false);
  if (result.ok) {
    session.setRecovery(null);
    notice = 'The pending Git revision was created.';
    error = '';
  } else error = result.error ?? 'Could not retry the Git revision.';
  render();
}

function renderHistory(): void {
  if (!historyHost || !session) return;
  disposeHistory();
  renderAuthoredFileRevision({
    host: historyHost,
    revisions,
    selectedIndex,
    selectedDetail,
    loading: historyLoading,
    hasOlderPage: Boolean(nextCursor),
    filename: `card-${identity?.cardId ?? ''}.md`,
    onSelect: (index) => { void selectRevision(index); },
    onRequestOlderPage: () => { void initializeHistory(nextCursor); },
    mountPreview: (host, detail) => { void session?.mountPreview({ parent: host, filename: `card-${identity?.cardId ?? ''}.md`, markdown: detail.markdown, revision: detail.commit }); },
    mountDiff: (host, detail) => {
      diffOwner.mount(host, detail);
    },
  });
}

function render(): void {
  if (!dialog || !actions || !message) return;
  const editorPane = editorHost?.parentElement as HTMLElement | null;
  if (editorPane) editorPane.hidden = view !== 'editor';
  if (historyHost) historyHost.hidden = view !== 'history';
  message.textContent = error || notice;
  message.classList.toggle('is-error', Boolean(error));
  actions.replaceChildren();
  if (conflictRevision) actions.append(button('Reload server revision', () => { void reloadAuthoritative(); }));
  if (session?.state().recovery) actions.append(button('Retry Git revision', () => { void retryRevision(); }));
  if (view === 'editor') {
    const saveButton = button(session?.state().saving ? 'Saving…' : 'Save new revision', () => { void save(); }, 'primary-action');
    saveButton.disabled = !session || session.state().saving || !session.state().dirty;
    actions.append(saveButton);
  }
  actions.append(button('Close', () => requestActiveLedgerCardEditorClose('close')));
  if (view === 'history') renderHistory();
  else disposeHistory();
}

export async function openLedgerCardEditor(openInput: OpenInput): Promise<void> {
  if (dialog && sameIdentity(identity, openInput)) {
    session?.focus();
    return;
  }
  if (dialog && !requestActiveLedgerCardEditorClose('route')) return;
  const currentGeneration = ++generation;
  identity = { projectId: openInput.projectId, ledgerId: openInput.ledgerId, cardId: openInput.cardId };
  input = openInput;
  card = openInput.card as LedgerCardContentDetail | null ?? null;
  if (!card?.contentRevision) {
    const result = await loadLedgerCardContent(openInput.projectId, openInput.ledgerId, openInput.cardId);
    if (generation !== currentGeneration) return;
    if (!result.ok || !result.card) return;
    card = result.card;
  }
  buildShell();
  if (!editorHost || !card) return;
  session = await createTextFileEditorSession({
    parent: editorHost,
    filename: `card-${openInput.cardId}.md`,
    markdown: ledgerCardBody(card),
    loadedRevision: String(card.contentRevision ?? ''),
    readOnly: false,
    returnFocusTo: openInput.returnFocusTo,
    onCloseRequested: finishClose,
    restoreBackNavigation: () => globalThis.history?.forward?.(),
    onStateChange: render,
  });
  if (generation !== currentGeneration) {
    session.dispose();
    session = null;
    return;
  }
  render();
  session.focus();
}
