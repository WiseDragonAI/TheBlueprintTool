/**
 * WHAT: Mounts a native, project-scoped Git review widget declared by card Markdown.
 * WHY: Reviews need card-native staging and voice context without granting iframe assets repository authority.
 */
import { state } from '../../state.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import { voiceActionIcon } from '../../voice/component/control-dock.js';
import { waveSvg } from '../../voice/component/wave-svg.js';
import { commitActiveLedgerMutation } from '../effect/commit-active-ledger-mutation.js';
import { startGitReviewVoiceCapture, type GitReviewVoiceCapture } from '../helper/git-review-voice-capture.js';
import type { LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';
import { normalizeGitReviewNotes, type GitReviewNote } from '../../../../../shared/schemas/git-review-types.js';

type ReviewHunk = { id: string; header: string; patch: string };
type ReviewFile = { path: string; patch: string; hunks: ReviewHunk[] };
type ReviewResponse = { ok: boolean; error?: string; repository: string; target: string; patchHash: string; files: ReviewFile[]; stagedFiles: ReviewFile[] };
type PierreModule = typeof import('@pierre/diffs');
type ReviewSelection = { start: number; end?: number; side?: string; endSide?: string };
export type GitReviewNotesChangeHandler = (notes: GitReviewNote[]) => Promise<boolean>;

type GitDiffRendererOptions = {
  cardId?: string;
  mediaSurface?: 'card' | 'detail' | 'thread';
  gitReviewNotes?: unknown;
  onGitReviewNotesChange?: GitReviewNotesChangeHandler;
};

let pierreModule: Promise<PierreModule> | null = null;
function loadPierre(): Promise<PierreModule> {
  const loadModule = new Function('path', 'return import(path)') as (path: string) => Promise<PierreModule>;
  pierreModule ??= loadModule('/assets/vendor/pierre-diffs-1.2.12.js');
  return pierreModule;
}

const icons = {
  previous: '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  refresh: '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.5 7M17.9 15A7 7 0 0 1 5.5 17"/></svg>',
  stage: '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
  record: '<svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
};

function terminalButton(input: { label: string; icon: string; variant?: string; key?: string; title?: string }): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `terminal-button ${input.variant ?? 'terminal-button--neutral'}`;
  node.setAttribute('aria-label', input.title ?? input.label);
  node.innerHTML = `${input.key ? `<span class="terminal-button__key">${input.key}</span>` : ''}${input.icon}<span class="terminal-button__label"></span>`;
  node.querySelector('.terminal-button__label')!.textContent = input.label;
  return node;
}

export function createPierreDiffContainer(pierre: Pick<PierreModule, 'DIFFS_TAG_NAME'>, documentRef: Pick<Document, 'createElement'> = document): HTMLElement {
  return documentRef.createElement(pierre.DIFFS_TAG_NAME) as HTMLElement;
}

function selectionLabel(selection: ReviewSelection | null): string {
  if (!selection) return 'Select code lines to attach precise review context.';
  const end = selection.end ?? selection.start;
  return end === selection.start ? `Line ${selection.start} selected` : `Lines ${selection.start}–${end} selected`;
}

function reviewVoiceDock(): string {
  return `<div class="control-dock">
    <button class="terminal-button terminal-button--stop terminal-button--stack git-review-voice-cancel" type="button" data-git-review-voice="cancel"><span class="terminal-button__key">Esc</span><svg class="terminal-button__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg><span class="terminal-button__label">CANCEL</span></button>
    <section class="wave-panel"><div class="wave-timer">00:00</div>${waveSvg()}</section>
    <aside class="meter-panel"><div class="meter-track"><div class="meter-fill"></div></div></aside>
    <button class="terminal-button terminal-button--send terminal-button--stack git-review-voice-send" type="button" data-git-review-voice="send"><span class="terminal-button__key">X</span>${voiceActionIcon('send')}<span class="terminal-button__label">SEND</span></button>
  </div>`;
}

function formatRecordingDuration(durationMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

async function defaultPersistNotes(cardId: string, notes: GitReviewNote[]): Promise<boolean> {
  const card = state.activeLedger?.cards?.find((entry: Record<string, unknown>) => String(entry.id ?? '') === cardId) as Record<string, unknown> | undefined;
  const previous = card?.gitReviewNotes;
  if (card) card.gitReviewNotes = notes;
  const committed = await commitActiveLedgerMutation({ action: 'patch-card', cardPatch: { id: cardId, gitReviewNotes: notes } });
  if (!committed && card) card.gitReviewNotes = previous;
  return committed;
}

export function renderLedgerCardGitDiff(block: Extract<LedgerMarkdownBlock, { kind: 'gitDiff' }>, options: GitDiffRendererOptions = {}): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ledger-card-git-diff';
  root.dataset.repository = block.repository;
  root.dataset.target = block.target;

  const heading = document.createElement('header');
  heading.className = 'git-diff-heading';
  const identity = document.createElement('div');
  identity.innerHTML = '<span class="git-diff-eyebrow">GIT REVIEW</span><strong></strong><small></small>';
  identity.querySelector('strong')!.textContent = block.title;
  identity.querySelector('small')!.textContent = `${block.repository} · ${block.target}`;
  heading.append(identity);
  const refresh = terminalButton({ label: 'REFRESH', icon: icons.refresh, variant: 'terminal-button--neutral terminal-button--nav', title: 'Refresh Git changes' });
  heading.append(refresh);
  root.append(heading);

  if (options.mediaSurface === 'thread') {
    const reference = document.createElement('p');
    reference.className = 'git-diff-thread-reference';
    reference.textContent = 'Open the card to use this Git review widget.';
    root.append(reference);
    return root;
  }

  const status = document.createElement('p');
  status.className = 'git-diff-status';
  status.setAttribute('aria-live', 'polite');
  const content = document.createElement('div');
  content.className = 'git-diff-content';
  root.append(status, content);

  let response: ReviewResponse | null = null;
  let fileIndex = 0;
  let hunkIndex = 0;
  let selection: ReviewSelection | null = null;
  let renderer: { cleanUp(): void } | null = null;
  let notes = normalizeGitReviewNotes(options.gitReviewNotes);
  let voiceCapture: GitReviewVoiceCapture | null = null;

  const endpoint = () => {
    const query = new URLSearchParams({ repo: block.repository, path: block.target });
    return projectScopedRequestPath(`/api/git-review?${query.toString()}`, String(state.projectId ?? ''));
  };

  async function stage(hunk: ReviewHunk): Promise<void> {
    if (!response) return;
    status.textContent = 'Staging selected change…';
    const request = await fetch(projectScopedRequestPath('/api/git-review/stage', String(state.projectId ?? '')), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repository: block.repository, target: block.target, expectedPatchHash: response.patchHash, patch: hunk.patch, operation: 'stage' })
    });
    const payload = await request.json() as ReviewResponse;
    if (!request.ok) { status.textContent = payload.error || 'The selected change could not be staged.'; root.dataset.state = 'error'; return; }
    response = payload;
    hunkIndex = 0;
    await renderCurrent();
  }

  async function renderCurrent(): Promise<void> {
    renderer?.cleanUp();
    renderer = null;
    selection = null;
    content.replaceChildren();
    if (!response?.files.length) { status.textContent = 'This review target has no working-tree changes.'; root.dataset.state = 'empty'; return; }
    const file = response.files[Math.min(fileIndex, response.files.length - 1)];
    const hunks = file.hunks.length ? file.hunks : [{ id: 'file', header: 'File change', patch: file.patch }];
    const hunk = hunks[Math.min(hunkIndex, hunks.length - 1)];
    status.textContent = `${response.files.length} changed ${response.files.length === 1 ? 'file' : 'files'} · change ${hunkIndex + 1} of ${hunks.length}`;
    root.dataset.state = 'ready';

    const nav = document.createElement('nav');
    nav.className = 'git-diff-nav';
    nav.setAttribute('aria-label', 'Changed code navigation');
    const previous = terminalButton({ label: 'PREV', icon: icons.previous, variant: 'terminal-button--neutral terminal-button--nav', title: 'Previous change' });
    const title = document.createElement('div');
    title.innerHTML = '<strong></strong><small></small>';
    title.querySelector('strong')!.textContent = file.path;
    title.querySelector('small')!.textContent = `HUNK ${hunkIndex + 1} / ${hunks.length} · ${hunk.header}`;
    const next = terminalButton({ label: 'NEXT', icon: icons.next, variant: 'terminal-button--neutral terminal-button--nav', title: 'Next change' });
    previous.disabled = fileIndex === 0 && hunkIndex === 0;
    next.disabled = fileIndex === response.files.length - 1 && hunkIndex === hunks.length - 1;
    previous.onclick = () => { if (hunkIndex > 0) hunkIndex -= 1; else { fileIndex -= 1; hunkIndex = Math.max(0, response!.files[fileIndex].hunks.length - 1); } void renderCurrent(); };
    next.onclick = () => { if (hunkIndex < hunks.length - 1) hunkIndex += 1; else { fileIndex += 1; hunkIndex = 0; } void renderCurrent(); };
    nav.append(previous, title, next);

    const viewport = document.createElement('div');
    viewport.className = 'git-diff-viewport';
    const selectionStatus = document.createElement('p');
    selectionStatus.className = 'git-diff-selection-status';
    selectionStatus.textContent = selectionLabel(null);
    content.append(nav, viewport, selectionStatus);
    try {
      const pierre = await loadPierre();
      const parsed = pierre.parsePatchFiles(hunk.patch, response.patchHash, true)[0]?.files[0];
      if (!parsed) throw new Error('The selected change did not produce a renderable diff.');
      const diffContainer = createPierreDiffContainer(pierre);
      diffContainer.className = 'git-diff-pierre-container';
      viewport.append(diffContainer);
      const instance = new pierre.FileDiff({
        themeType: 'dark', diffStyle: 'unified', overflow: 'wrap', enableLineSelection: true, disableFileHeader: true,
        onLineSelectionEnd: (range: ReviewSelection | null) => {
          selection = range;
          selectionStatus.textContent = selectionLabel(selection);
        },
      });
      instance.render({ fileDiff: parsed, fileContainer: diffContainer });
      renderer = instance;
    } catch (error) {
      const pre = document.createElement('pre');
      pre.textContent = hunk.patch;
      viewport.replaceChildren(pre);
      status.textContent = error instanceof Error ? error.message : String(error);
    }

    const actions = document.createElement('footer');
    actions.className = 'git-diff-actions';
    const staged = response.stagedFiles.some((stagedFile) => stagedFile.path === file.path && stagedFile.hunks.some((stagedHunk) => stagedHunk.patch === hunk.patch));
    const stageButton = terminalButton({ label: staged ? 'STAGED' : 'STAGE CHANGE', icon: icons.stage, variant: 'terminal-button--send terminal-button--action' });
    stageButton.disabled = staged;
    stageButton.onclick = () => void stage(hunk);
    const record = terminalButton({ label: 'REC', icon: icons.record, key: 'X', variant: 'terminal-button--send terminal-button--stack git-diff-record' });
    actions.append(stageButton, record);
    content.append(actions);

    const noteList = document.createElement('section');
    noteList.className = 'git-diff-review-notes';
    const renderNotes = () => {
      const matching = notes.filter((note) => note.repository === block.repository && note.target === block.target && note.file === file.path && note.hunk === hunk.header);
      noteList.replaceChildren();
      if (!matching.length) return;
      const heading = document.createElement('strong');
      heading.textContent = `${matching.length} VOICE ${matching.length === 1 ? 'REVIEW' : 'REVIEWS'}`;
      noteList.append(heading);
      for (const note of matching) {
        const article = document.createElement('article');
        const transcript = document.createElement('p');
        transcript.textContent = note.body;
        const context = document.createElement('small');
        context.textContent = `${note.selection ? `${note.selection} · ` : ''}${note.status}`;
        article.append(transcript, context);
        noteList.append(article);
      }
    };
    renderNotes();
    content.append(noteList);

    const voice = document.createElement('section');
    voice.className = 'git-diff-voice agent-chat';
    voice.hidden = true;
    voice.innerHTML = `<div class="git-diff-voice-panel"><span class="git-diff-voice-status" aria-live="polite"></span>${reviewVoiceDock()}</div>`;
    content.append(voice);

    const voiceStatus = voice.querySelector('.git-diff-voice-status') as HTMLElement;
    const voiceTimer = voice.querySelector('.wave-timer') as HTMLElement;
    const voiceMeter = voice.querySelector('.meter-fill') as HTMLElement;
    const cancelButton = voice.querySelector('[data-git-review-voice="cancel"]') as HTMLButtonElement;
    const sendButton = voice.querySelector('[data-git-review-voice="send"]') as HTMLButtonElement;
    const setReviewControlsDisabled = (disabled: boolean) => {
      previous.disabled = disabled || (fileIndex === 0 && hunkIndex === 0);
      next.disabled = disabled || (fileIndex === response!.files.length - 1 && hunkIndex === hunks.length - 1);
      refresh.disabled = disabled;
      stageButton.disabled = disabled || staged;
      record.disabled = disabled;
    };
    const resetVoice = () => {
      voiceCapture = null;
      voice.hidden = true;
      voiceStatus.textContent = '';
      voiceTimer.textContent = '00:00';
      voiceMeter.style.height = '18%';
      setReviewControlsDisabled(false);
    };

    record.onclick = async () => {
      if (voiceCapture) return;
      voice.hidden = false;
      voiceStatus.textContent = 'Recording this Git review only';
      setReviewControlsDisabled(true);
      try {
        voiceCapture = await startGitReviewVoiceCapture(({ durationMs, level }) => {
          voiceTimer.textContent = formatRecordingDuration(durationMs);
          voiceMeter.style.height = `${Math.round(18 + level * 74)}%`;
        });
      } catch (error) {
        voiceStatus.textContent = error instanceof Error ? error.message : String(error);
        setReviewControlsDisabled(false);
      }
    };

    cancelButton.addEventListener('click', () => {
      voiceCapture?.cancel();
      resetVoice();
    });

    sendButton.addEventListener('click', async () => {
      if (!voiceCapture || !options.cardId) return;
      sendButton.disabled = true;
      cancelButton.disabled = true;
      voiceStatus.textContent = 'Transcribing Git review…';
      const capture = voiceCapture;
      voiceCapture = null;
      const audio = await capture.stop();
      const form = new FormData();
      form.append('audio', audio, audio.type.includes('wav') ? 'git-review.wav' : 'git-review.webm');
      form.append('repository', block.repository);
      form.append('target', block.target);
      form.append('file', file.path);
      form.append('hunk', hunk.header);
      form.append('patchHash', response!.patchHash);
      if (selection) form.append('selection', JSON.stringify(selection));
      const request = await fetch(projectScopedRequestPath('/api/git-review/voice', String(state.projectId ?? '')), { method: 'POST', body: form }).catch(() => undefined);
      const payload = await request?.json().catch(() => null) as { ok?: boolean; error?: string; note?: GitReviewNote } | null;
      if (!request?.ok || !payload?.ok || !payload.note) {
        voiceStatus.textContent = payload?.error || 'Git review transcription failed.';
        sendButton.disabled = false;
        cancelButton.disabled = false;
        setReviewControlsDisabled(false);
        return;
      }
      const nextNotes = notes.concat(payload.note);
      const committed = await (options.onGitReviewNotesChange
        ? options.onGitReviewNotesChange(nextNotes)
        : defaultPersistNotes(options.cardId, nextNotes)).catch(() => false);
      if (!committed) {
        voiceStatus.textContent = 'Git review note could not be saved to this card.';
        sendButton.disabled = false;
        cancelButton.disabled = false;
        setReviewControlsDisabled(false);
        return;
      }
      notes = nextNotes;
      renderNotes();
      resetVoice();
    });
    root.onkeydown = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'x') {
        event.preventDefault();
        event.stopPropagation();
        if (voiceCapture) sendButton.click();
        else record.click();
      }
      if (key === 'escape' && voiceCapture) {
        event.preventDefault();
        event.stopPropagation();
        cancelButton.click();
      }
    };
  }

  async function load(): Promise<void> {
    root.dataset.state = 'loading'; status.textContent = 'Loading repository changes…'; content.replaceChildren();
    const request = await fetch(endpoint(), { cache: 'no-store' });
    response = await request.json() as ReviewResponse;
    if (!request.ok || !response.ok) { root.dataset.state = 'error'; status.textContent = response.error || 'Git review could not be loaded.'; return; }
    fileIndex = 0; hunkIndex = 0; await renderCurrent();
  }
  refresh.onclick = () => void load();
  void load();
  return root;
}
