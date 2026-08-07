/**
 * WHAT: Mounts a native, project-scoped Git review widget declared by card Markdown.
 * WHY: Reviews need card-native staging and voice context without granting iframe assets repository authority.
 */
import { state } from '../../state.js';
import { projectScopedRequestPath } from '../../project/helper/project-request-scope.js';
import { startVoiceRecording } from '../../voice/controller/start-voice-recording.js';
import type { LedgerMarkdownBlock } from '../helper/parse-ledger-card-markdown.js';

type ReviewHunk = { id: string; header: string; patch: string };
type ReviewFile = { path: string; patch: string; hunks: ReviewHunk[] };
type ReviewResponse = { ok: boolean; error?: string; repository: string; target: string; patchHash: string; files: ReviewFile[]; stagedFiles: ReviewFile[] };
type PierreModule = typeof import('@pierre/diffs');

let pierreModule: Promise<PierreModule> | null = null;
function loadPierre(): Promise<PierreModule> {
  const loadModule = new Function('path', 'return import(path)') as (path: string) => Promise<PierreModule>;
  pierreModule ??= loadModule('/assets/vendor/pierre-diffs-1.2.12.js');
  return pierreModule;
}

function button(label: string, className = ''): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `git-diff-button ${className}`.trim();
  node.textContent = label;
  return node;
}

export function renderLedgerCardGitDiff(block: Extract<LedgerMarkdownBlock, { kind: 'gitDiff' }>, options: { cardId?: string; mediaSurface?: 'card' | 'detail' | 'thread' } = {}): HTMLElement {
  const root = document.createElement('section');
  root.className = 'ledger-card-git-diff';
  root.dataset.repository = block.repository;
  root.dataset.target = block.target;

  const heading = document.createElement('header');
  heading.className = 'git-diff-heading';
  const identity = document.createElement('div');
  identity.innerHTML = `<strong></strong><small></small>`;
  identity.querySelector('strong')!.textContent = block.title;
  identity.querySelector('small')!.textContent = `${block.repository} · ${block.target}`;
  heading.append(identity);
  const refresh = button('REFRESH');
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
  const content = document.createElement('div');
  content.className = 'git-diff-content';
  root.append(status, content);

  let response: ReviewResponse | null = null;
  let fileIndex = 0;
  let hunkIndex = 0;
  let renderer: { cleanUp(): void } | null = null;

  const endpoint = () => {
    const query = new URLSearchParams({ repo: block.repository, path: block.target });
    return projectScopedRequestPath(`/api/git-review?${query.toString()}`, String(state.projectId ?? ''));
  };

  async function stage(operation: 'stage' | 'unstage', hunk: ReviewHunk): Promise<void> {
    if (!response) return;
    status.textContent = operation === 'stage' ? 'Staging selected review change…' : 'Unstaging selected review change…';
    const request = await fetch(projectScopedRequestPath('/api/git-review/stage', String(state.projectId ?? '')), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repository: block.repository, target: block.target, expectedPatchHash: response.patchHash, patch: hunk.patch, operation })
    });
    const payload = await request.json() as ReviewResponse;
    if (!request.ok) { status.textContent = payload.error || 'The hunk could not be staged.'; root.dataset.state = 'error'; return; }
    response = payload;
    hunkIndex = 0;
    await renderCurrent();
  }

  async function renderCurrent(): Promise<void> {
    renderer?.cleanUp();
    renderer = null;
    content.replaceChildren();
    if (!response?.files.length) { status.textContent = 'This review target has no working-tree changes.'; root.dataset.state = 'empty'; return; }
    const file = response.files[Math.min(fileIndex, response.files.length - 1)];
    const hunks = file.hunks.length ? file.hunks : [{ id: 'file', header: 'File change', patch: file.patch }];
    const hunk = hunks[Math.min(hunkIndex, hunks.length - 1)];
    status.textContent = `${fileIndex + 1}/${response.files.length} files · ${hunkIndex + 1}/${hunks.length} hunks`;
    root.dataset.state = 'ready';

    const nav = document.createElement('nav');
    nav.className = 'git-diff-nav';
    const previous = button('‹');
    const title = document.createElement('div');
    title.innerHTML = '<strong></strong><small></small>';
    title.querySelector('strong')!.textContent = file.path;
    title.querySelector('small')!.textContent = hunk.header;
    const next = button('›');
    previous.disabled = fileIndex === 0 && hunkIndex === 0;
    next.disabled = fileIndex === response.files.length - 1 && hunkIndex === hunks.length - 1;
    previous.onclick = () => { if (hunkIndex > 0) hunkIndex -= 1; else { fileIndex -= 1; hunkIndex = Math.max(0, response!.files[fileIndex].hunks.length - 1); } void renderCurrent(); };
    next.onclick = () => { if (hunkIndex < hunks.length - 1) hunkIndex += 1; else { fileIndex += 1; hunkIndex = 0; } void renderCurrent(); };
    nav.append(previous, title, next);

    const viewport = document.createElement('div');
    viewport.className = 'git-diff-viewport';
    content.append(nav, viewport);
    try {
      const pierre = await loadPierre();
      const parsed = pierre.parsePatchFiles(hunk.patch, response.patchHash, true)[0]?.files[0];
      if (!parsed) throw new Error('The selected hunk did not produce a renderable diff.');
      const instance = new pierre.FileDiff({ themeType: 'dark', diffStyle: 'unified', overflow: 'wrap', enableLineSelection: true, disableFileHeader: true });
      instance.render({ fileDiff: parsed, fileContainer: viewport });
      renderer = instance;
    } catch (error) {
      const pre = document.createElement('pre');
      pre.textContent = hunk.patch;
      viewport.append(pre);
      status.textContent = error instanceof Error ? error.message : String(error);
    }
    const actions = document.createElement('footer');
    actions.className = 'git-diff-actions';
    const record = button('REC', 'record');
    record.onclick = () => {
      state.threadId = options.cardId ? `thread-${options.cardId}` : state.threadId;
      state.voice.reviewContext = { repository: block.repository, target: block.target, file: file.path, hunk: hunk.header, patchHash: response!.patchHash };
      void startVoiceRecording();
    };
    const stageButton = button('STAGE HUNK', 'primary');
    stageButton.onclick = () => void stage('stage', hunk);
    actions.append(record, stageButton);
    content.append(actions);
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
