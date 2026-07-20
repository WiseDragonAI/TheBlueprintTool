/**
 * WHAT: Mounts a native, project-scoped Git review widget declared by card Markdown.
 * WHY: Reviews need card-native staging and voice context without granting iframe assets repository authority.
 */
import { state } from '../../state.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import { cancelVoiceRecording } from '../../voice/controller/cancel-voice-recording.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import { stopVoiceRecording } from '../../voice/controller/stop-voice-recording.js';
import { controlDock } from '../../voice/component/control-dock.js';
import type { LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';

type ReviewHunk = { id: string; header: string; patch: string };
type ReviewFile = { path: string; patch: string; hunks: ReviewHunk[] };
type ReviewResponse = { ok: boolean; error?: string; repository: string; target: string; patchHash: string; files: ReviewFile[]; stagedFiles: ReviewFile[] };
type PierreModule = typeof import('@pierre/diffs');
type ReviewSelection = { start: number; end?: number; side?: string; endSide?: string };

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

export function renderLedgerCardGitDiff(block: Extract<LedgerMarkdownBlock, { kind: 'gitDiff' }>, options: { cardId?: string; mediaSurface?: 'card' | 'detail' | 'thread' } = {}): HTMLElement {
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

    const voice = document.createElement('section');
    voice.className = 'git-diff-voice agent-chat';
    voice.hidden = true;
    voice.innerHTML = `<div class="voice-panel"><span class="voice-status" aria-live="polite"></span>${controlDock()}</div>`;
    voice.querySelector('.voice-action--run')?.remove();
    voice.querySelector('.voice-action--pipeline')?.remove();
    content.append(voice);

    record.onclick = async () => {
      const threadId = options.cardId ? `thread-${options.cardId}` : String(state.threadId || 'conversation-ledger');
      state.threadId = threadId;
      voice.hidden = false;
      await startVoiceRecording({
        threadId,
        surfaceRoot: voice,
        reviewContext: {
          repository: block.repository,
          target: block.target,
          file: file.path,
          hunk: hunk.header,
          patchHash: response!.patchHash,
          ...(selection ? { selection: JSON.stringify(selection) } : {}),
        },
      });
    };
    voice.querySelector('[data-action="voice-cancel"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      cancelVoiceRecording();
      voice.hidden = true;
    });
    voice.querySelector('[data-action="voice-stop"]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      void stopVoiceRecording({ launchMode: 'send', onPersisted: () => { voice.hidden = true; } });
    });
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
