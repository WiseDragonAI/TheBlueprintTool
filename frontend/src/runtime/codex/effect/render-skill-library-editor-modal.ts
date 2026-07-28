/**
 * WHAT: Adapts skill metadata and owner requests to one stable text-file editor session.
 * WHY: Metadata, status, save, and history rerenders must never replace the active editable EditorView.
 */
import { skillLibraryEditorModal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import {
  renderAuthoredFileRevision,
  type AuthoredFileRevisionDetail,
} from '../../content-authoring/component/render-authored-file-revision.js';
import {
  createTextFileEditorSession,
  type TextFileEditorRecovery,
  type TextFileEditorSession,
} from '../../content-authoring/controller/text-file-editor-session.js';
import { renderSkillRevisionDiff } from '../component/render-skill-revision-diff.js';
import { codexEffortOptions, codexModelOptions, type CodexEffort, type CodexModel } from '../helper/codex-run-options.js';
import { loadCodexSkillLibrary, type CodexSkillLibraryDetail } from './load-codex-skill-library.js';
import {
  loadCodexSkillRevision,
  loadCodexSkillRevisionHistory,
  type CodexSkillGitRevisionDetail,
} from './load-codex-skill-revision.js';
import { requestCodexSkillLibraryCreate, type CodexSkillContentKind } from './request-codex-skill-library-create.js';
import {
  requestCodexSkillLibrarySave,
  requestCodexSkillRevisionRetry,
} from './request-codex-skill-library-save.js';
import { requestCodexSkillFavoriteSave, requestCodexSkillMetadataSave } from './request-codex-skill-favorite-save.js';

export type SkillLibraryEditorState = {
  mode: 'create' | 'edit';
  view: 'editor' | 'history';
  skillName: string;
  createDescription: string;
  contentKind: CodexSkillContentKind;
  requestProjectId: string;
  workspaceProjectId: string;
  projects: Array<{ id: string; name: string }>;
  detail: CodexSkillLibraryDetail | null;
  markdown: string;
  persistedMarkdown: string;
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
  loading: boolean;
  saving: boolean;
  favoriteSaving: boolean;
  availableTags: string[];
  tags: string[];
  tagsSaving: boolean;
  selectedRevisionIndex: number;
  revisionDetail: CodexSkillGitRevisionDetail | null;
  revisionLoading: boolean;
  historyNextCursor: string | null;
  historyInitialized: boolean;
  historyLoadingMore: boolean;
  recovery: TextFileEditorRecovery;
  conflictRevision: string;
  error: string;
  notice: string;
  onSaved?: (skill: CodexSkillLibraryDetail) => void | Promise<void>;
  onSaveError?: (message: string) => void;
  onClosed?: () => void;
};

export const skillLibraryEditorState: SkillLibraryEditorState = {
  mode: 'edit',
  view: 'editor',
  skillName: '',
  createDescription: '',
  contentKind: 'federated-skill',
  requestProjectId: '',
  workspaceProjectId: '',
  projects: [],
  detail: null,
  markdown: '',
  persistedMarkdown: '',
  defaultCodexModel: null,
  defaultCodexEffort: null,
  loading: false,
  saving: false,
  favoriteSaving: false,
  availableTags: [],
  tags: [],
  tagsSaving: false,
  selectedRevisionIndex: 0,
  revisionDetail: null,
  revisionLoading: false,
  historyNextCursor: null,
  historyInitialized: false,
  historyLoadingMore: false,
  recovery: null,
  conflictRevision: '',
  error: '',
  notice: '',
};

type ModalShell = {
  kicker: HTMLElement;
  title: HTMLElement;
  subtitle: HTMLElement;
  metadata: HTMLElement;
  tabs: HTMLElement;
  controls: HTMLElement;
  editorPane: HTMLElement;
  editorLabel: HTMLElement;
  editorHost: HTMLElement;
  historyPane: HTMLElement;
  message: HTMLElement;
  actions: HTMLElement;
};

let generation = 0;
let shell: ModalShell | null = null;
let session: TextFileEditorSession | null = null;
let sessionMounting = false;
let disposeDiff: (() => void) | null = null;
let returnFocusTo: HTMLElement | null = null;

function button(label: string, action: () => void, className = 'ghost-button'): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function field(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'codex-field';
  const title = document.createElement('span');
  title.textContent = labelText;
  label.append(title, control);
  return label;
}

function activeFocusTarget(): HTMLElement | null {
  const active = globalThis.document?.activeElement as HTMLElement | null | undefined;
  return active && typeof active.focus === 'function' ? active : null;
}

function filename(): string {
  return skillLibraryEditorState.contentKind === 'pipeline-prompt'
    ? `${skillLibraryEditorState.skillName || 'prompt'}.md`
    : 'SKILL.md';
}

function ownerMetadataDirty(): boolean {
  if (skillLibraryEditorState.mode === 'create') {
    return Boolean(skillLibraryEditorState.skillName.trim() || skillLibraryEditorState.createDescription.trim());
  }
  const detail = skillLibraryEditorState.detail;
  if (!detail?.editable) return false;
  return skillLibraryEditorState.defaultCodexModel !== detail.defaultCodexModel
    || skillLibraryEditorState.defaultCodexEffort !== detail.defaultCodexEffort;
}

function resetState(input: Partial<SkillLibraryEditorState>): void {
  Object.assign(skillLibraryEditorState, {
    mode: 'edit',
    view: 'editor',
    skillName: '',
    createDescription: '',
    contentKind: 'federated-skill',
    requestProjectId: '',
    workspaceProjectId: '',
    projects: [],
    detail: null,
    markdown: '',
    persistedMarkdown: '',
    defaultCodexModel: null,
    defaultCodexEffort: null,
    loading: false,
    saving: false,
    favoriteSaving: false,
    availableTags: [],
    tags: [],
    tagsSaving: false,
    selectedRevisionIndex: 0,
    revisionDetail: null,
    revisionLoading: false,
    historyNextCursor: null,
    historyInitialized: false,
    historyLoadingMore: false,
    recovery: null,
    conflictRevision: '',
    error: '',
    notice: '',
    onSaved: undefined,
    onSaveError: undefined,
    onClosed: undefined,
    ...input,
  });
}

function disposeHistory(): void {
  disposeDiff?.();
  disposeDiff = null;
  session?.closePreview();
}

function disposeSession(): void {
  session?.dispose();
  session = null;
  sessionMounting = false;
  disposeHistory();
}

function finishClose(): void {
  const onClosed = skillLibraryEditorState.onClosed;
  generation += 1;
  const focus = returnFocusTo;
  const sessionReturnsFocus = Boolean(session);
  returnFocusTo = null;
  disposeSession();
  skillLibraryEditorModal?.close?.();
  shell = null;
  if (!sessionReturnsFocus && focus?.isConnected) focus.focus();
  onClosed?.();
}

function buildShell(): ModalShell | null {
  if (!skillLibraryEditorModal) return null;
  skillLibraryEditorModal.setAttribute('tabindex', '-1');
  const head = document.createElement('header');
  head.className = 'codex-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  const title = document.createElement('h2');
  title.id = 'skill-library-editor-modal-title';
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  copy.append(kicker, title, subtitle);
  const close = button('×', closeSkillLibraryEditor, 'plain-close');
  close.setAttribute('aria-label', 'Close skill editor');
  head.append(copy, close);

  const body = document.createElement('section');
  body.className = 'skill-library-editor-body';
  const metadata = document.createElement('section');
  const tabs = document.createElement('nav');
  tabs.className = 'skill-editor-view-tabs';
  tabs.setAttribute('aria-label', 'Authored file views');
  const controls = document.createElement('section');
  controls.className = 'skill-editor-owner-controls';
  const editorPane = document.createElement('section');
  editorPane.className = 'codex-field skill-markdown-field skill-editor-pane';
  const editorLabel = document.createElement('span');
  const editorHost = document.createElement('div');
  editorHost.className = 'skill-codemirror-host';
  editorPane.append(editorLabel, editorHost);
  const historyPane = document.createElement('section');
  historyPane.className = 'skill-history-pane';
  historyPane.hidden = true;
  body.append(metadata, tabs, controls, editorPane, historyPane);

  const footer = document.createElement('footer');
  footer.className = 'codex-modal-actions';
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'skill-editor-footer-actions';
  footer.append(message, actions);
  skillLibraryEditorModal.replaceChildren(head, body, footer);
  return { kicker, title, subtitle, metadata, tabs, controls, editorPane, editorLabel, editorHost, historyPane, message, actions };
}

function showModal(): void {
  if (!skillLibraryEditorModal?.open) skillLibraryEditorModal?.showModal?.();
}

function renderCreationControls(target: HTMLElement): void {
  const form = document.createElement('div');
  form.className = 'skill-create-form skill-create-metadata';
  const name = document.createElement('input');
  name.value = skillLibraryEditorState.skillName;
  name.placeholder = 'my-skill';
  name.autocomplete = 'off';
  name.addEventListener('input', () => {
    skillLibraryEditorState.skillName = name.value;
    session?.setIdentity(filename());
  });
  const description = document.createElement('input');
  description.value = skillLibraryEditorState.createDescription;
  description.placeholder = 'When and why this content should be used';
  description.addEventListener('input', () => { skillLibraryEditorState.createDescription = description.value; });
  const kind = document.createElement('select');
  kind.setAttribute('aria-label', 'Content type');
  for (const [value, label] of [
    ['federated-skill', 'Federated agent skill'],
    ['workspace-skill', 'Workspace agent skill'],
    ['pipeline-prompt', 'Pipeline-only prompt'],
  ] as Array<[CodexSkillContentKind, string]>) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    kind.append(option);
  }
  kind.value = skillLibraryEditorState.contentKind;
  kind.addEventListener('change', () => {
    skillLibraryEditorState.contentKind = kind.value as CodexSkillContentKind;
    renderSkillLibraryEditorModal();
  });
  form.append(field('Name', name), field('Type', kind), field('Description', description));
  if (skillLibraryEditorState.contentKind === 'workspace-skill') {
    const project = document.createElement('select');
    project.setAttribute('aria-label', 'Workspace project');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a project';
    project.append(placeholder);
    for (const record of skillLibraryEditorState.projects) {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = record.name;
      project.append(option);
    }
    project.value = skillLibraryEditorState.workspaceProjectId;
    project.addEventListener('change', () => {
      skillLibraryEditorState.workspaceProjectId = project.value;
      skillLibraryEditorState.requestProjectId = project.value;
    });
    form.append(field('Workspace project', project));
  }
  const visibility = document.createElement('p');
  visibility.className = 'codex-inline-warning';
  visibility.textContent = 'Pipeline-only prompts stay outside agent discovery and are injected only by a selected pipeline.';
  form.append(visibility);
  target.replaceChildren(form);
}

function defaultSelect<T extends string>(input: {
  label: string;
  value: T | null;
  options: readonly T[];
  onChange: (value: T | null) => void;
}): HTMLLabelElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', input.label);
  const inherited = document.createElement('option');
  inherited.value = '';
  inherited.textContent = 'Use workspace default';
  select.append(inherited);
  for (const value of input.options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = input.value ?? '';
  select.disabled = skillLibraryEditorState.detail?.editable === false || skillLibraryEditorState.saving;
  select.addEventListener('change', () => input.onChange((select.value || null) as T | null));
  return field(input.label, select);
}

function renderEditControls(target: HTMLElement, detail: CodexSkillLibraryDetail): void {
  const tags = document.createElement('fieldset');
  tags.className = 'codex-field skill-tags-field';
  const legend = document.createElement('legend');
  legend.textContent = 'Tags';
  const choices = document.createElement('div');
  choices.className = 'skill-editor-tag-choices';
  for (const tag of skillLibraryEditorState.availableTags) {
    const choice = button(tag, () => { void saveSkillLibraryTag(tag); }, 'skill-editor-tag-choice');
    choice.setAttribute('aria-pressed', String(detail.tags?.[0] === tag));
    choice.disabled = skillLibraryEditorState.tagsSaving;
    choices.append(choice);
  }
  tags.append(legend, choices);
  const defaults = document.createElement('div');
  defaults.className = 'skill-library-defaults';
  defaults.append(
    defaultSelect({
      label: 'Default model',
      value: skillLibraryEditorState.defaultCodexModel,
      options: codexModelOptions,
      onChange: (value) => { skillLibraryEditorState.defaultCodexModel = value; },
    }),
    defaultSelect({
      label: 'Default effort',
      value: skillLibraryEditorState.defaultCodexEffort,
      options: codexEffortOptions,
      onChange: (value) => { skillLibraryEditorState.defaultCodexEffort = value; },
    }),
  );
  target.replaceChildren(tags, defaults);
}

function renderMetadata(target: HTMLElement, detail: CodexSkillLibraryDetail): void {
  target.className = 'skill-library-metadata';
  const source = document.createElement('span');
  source.textContent = `Source: ${detail.source}`;
  const visibility = document.createElement('span');
  visibility.textContent = detail.executionVisibility === 'pipeline-only' ? 'Pipeline injection only' : 'Agent-discoverable';
  const revision = document.createElement('span');
  revision.textContent = `Content: ${detail.revision.slice(0, 12)}`;
  target.replaceChildren(source, visibility, revision);
  if (!detail.editable) {
    const reason = document.createElement('p');
    reason.className = 'codex-inline-warning';
    reason.textContent = detail.readOnlyReason || 'This authored file is read-only.';
    target.append(reason);
  }
}

function renderTabs(target: HTMLElement, detail: CodexSkillLibraryDetail): void {
  const history = detail.history ?? [];
  for (const view of ['editor', 'history'] as const) {
    const selected = skillLibraryEditorState.view === view;
    const tab = button(view === 'editor' ? 'Editor' : `Revisions (${history.length}${skillLibraryEditorState.historyNextCursor ? '+' : ''})`, () => {
      skillLibraryEditorState.view = view;
      skillLibraryEditorState.error = '';
      renderSkillLibraryEditorModal();
      if (view === 'history') {
        void initializeHistory().then(() => {
          if (skillLibraryEditorState.detail?.history.length) void selectSkillRevision(skillLibraryEditorState.selectedRevisionIndex);
        });
      }
    }, `process-mode-tab${selected ? ' is-selected' : ''}`);
    tab.setAttribute('aria-pressed', String(selected));
    target.append(tab);
  }
}

function renderHistory(target: HTMLElement, detail: CodexSkillLibraryDetail): void {
  disposeHistory();
  renderAuthoredFileRevision({
    host: target,
    revisions: detail.history ?? [],
    selectedIndex: skillLibraryEditorState.selectedRevisionIndex,
    selectedDetail: skillLibraryEditorState.revisionDetail as AuthoredFileRevisionDetail | null,
    loading: skillLibraryEditorState.revisionLoading || skillLibraryEditorState.historyLoadingMore,
    hasOlderPage: Boolean(skillLibraryEditorState.historyNextCursor),
    filename: filename(),
    onSelect: (index) => { void selectSkillRevision(index); },
    onRequestOlderPage: () => { void loadOlderHistoryPage(); },
    mountPreview: (host, revision) => {
      void session?.mountPreview({
        parent: host,
        filename: filename(),
        markdown: revision.markdown,
        revision: revision.commit,
      });
    },
    mountDiff: (host, revision) => {
      const currentGeneration = generation;
      void renderSkillRevisionDiff({ host, patch: revision.patch, commit: revision.commit })
        .then((dispose) => {
          if (currentGeneration !== generation || !host.isConnected) dispose();
          else disposeDiff = dispose;
        })
        .catch((error) => {
          if (currentGeneration === generation) host.textContent = error instanceof Error ? error.message : String(error);
        });
    },
  });
}

function syncShell(): void {
  if (!shell) return;
  shell.kicker.textContent = skillLibraryEditorState.mode === 'create' ? 'New authored content' : 'Skill library';
  shell.title.textContent = skillLibraryEditorState.mode === 'create'
    ? 'Create authored content'
    : skillLibraryEditorState.skillName || 'Edit authored content';
  shell.subtitle.textContent = 'Edit one server-owned Markdown file or inspect the complete Git history.';
  shell.editorLabel.textContent = filename();
  shell.message.className = skillLibraryEditorState.error ? 'codex-form-error' : 'codex-form-notice';
  shell.message.textContent = skillLibraryEditorState.error || skillLibraryEditorState.notice;
  shell.metadata.replaceChildren();
  shell.tabs.replaceChildren();
  shell.controls.replaceChildren();
  shell.actions.replaceChildren();

  if (skillLibraryEditorState.mode === 'create') {
    renderCreationControls(shell.controls);
    const create = button(skillLibraryEditorState.saving ? 'Creating…' : 'Create', () => { void createSkillLibraryDraft(); }, 'primary-action');
    create.disabled = skillLibraryEditorState.saving;
    shell.actions.append(create);
  } else if (skillLibraryEditorState.loading) {
    const loading = document.createElement('p');
    loading.className = 'codex-empty-state';
    loading.textContent = 'Loading authored content…';
    shell.controls.replaceChildren(loading);
  } else if (!skillLibraryEditorState.detail) {
    const unavailable = document.createElement('p');
    unavailable.className = 'codex-empty-state';
    unavailable.textContent = skillLibraryEditorState.error || 'Authored content is unavailable.';
    shell.controls.replaceChildren(unavailable);
  } else {
    const detail = skillLibraryEditorState.detail;
    renderMetadata(shell.metadata, detail);
    renderTabs(shell.tabs, detail);
    if (skillLibraryEditorState.view === 'editor') renderEditControls(shell.controls, detail);
    const favorite = button(
      skillLibraryEditorState.favoriteSaving ? 'Saving favorite…' : detail.favorite ? 'Remove from favorites' : 'Mark as favorite',
      () => { void toggleSkillLibraryFavorite(); },
    );
    favorite.setAttribute('aria-pressed', String(detail.favorite));
    favorite.disabled = skillLibraryEditorState.favoriteSaving || skillLibraryEditorState.saving;
    const reload = button('Reload authoritative', () => { void reloadSkillLibraryDraft(); });
    reload.disabled = skillLibraryEditorState.loading || skillLibraryEditorState.saving;
    shell.actions.append(favorite, reload);
    if (skillLibraryEditorState.recovery) {
      const retry = button('Retry Git revision', () => { void retrySkillLibraryRevision(); }, 'primary-action');
      retry.disabled = skillLibraryEditorState.saving;
      shell.actions.append(retry);
    } else if (skillLibraryEditorState.view === 'editor') {
      const save = button(skillLibraryEditorState.saving ? 'Saving…' : 'Save new revision', () => { void saveSkillLibraryDraft(); }, 'primary-action');
      save.disabled = !detail.editable || skillLibraryEditorState.saving;
      shell.actions.append(save);
    }
  }
  shell.actions.append(button('Close', closeSkillLibraryEditor));
  shell.editorPane.hidden = skillLibraryEditorState.view !== 'editor';
  shell.historyPane.hidden = skillLibraryEditorState.view !== 'history';
  if (skillLibraryEditorState.view === 'history' && skillLibraryEditorState.detail) {
    renderHistory(shell.historyPane, skillLibraryEditorState.detail);
  } else {
    disposeHistory();
    shell.historyPane.replaceChildren();
  }
  session?.setIdentity(filename(), skillLibraryEditorState.detail?.gitRevision?.commit || skillLibraryEditorState.detail?.revision);
  session?.setReadOnly(skillLibraryEditorState.detail?.editable === false);
  session?.setSaving(skillLibraryEditorState.saving);
}

function ensureSession(): void {
  if (!shell || session || sessionMounting || skillLibraryEditorState.loading) return;
  if (skillLibraryEditorState.mode === 'edit' && !skillLibraryEditorState.detail) return;
  sessionMounting = true;
  const currentGeneration = generation;
  const readOnly = skillLibraryEditorState.mode === 'edit' && skillLibraryEditorState.detail?.editable === false;
  void createTextFileEditorSession({
    parent: shell.editorHost,
    filename: filename(),
    markdown: skillLibraryEditorState.markdown,
    loadedRevision: skillLibraryEditorState.detail?.revision ?? '',
    readOnly,
    returnFocusTo,
    isOwnerDirty: ownerMetadataDirty,
    onChange: (markdown) => { skillLibraryEditorState.markdown = markdown; },
    onCloseRequested: finishClose,
    restoreBackNavigation: () => globalThis.history?.forward?.(),
  }).then((mounted) => {
    sessionMounting = false;
    if (currentGeneration !== generation || !shell?.editorHost.isConnected) {
      mounted.dispose();
      return;
    }
    session = mounted;
    session.setRecovery(skillLibraryEditorState.recovery);
    syncShell();
  }).catch((error) => {
    sessionMounting = false;
    if (currentGeneration !== generation) return;
    skillLibraryEditorState.error = error instanceof Error ? error.message : String(error);
    if (shell) shell.editorHost.textContent = `The editor could not load: ${skillLibraryEditorState.error}`;
    syncShell();
  });
}

export function renderSkillLibraryEditorModal(): void {
  shell ??= buildShell();
  syncShell();
  ensureSession();
}

function startSession(input: Partial<SkillLibraryEditorState>): void {
  generation += 1;
  disposeSession();
  shell = null;
  resetState(input);
  renderSkillLibraryEditorModal();
  showModal();
}

export function openSkillLibraryCreator(input: {
  contentKind?: CodexSkillContentKind;
  requestProjectId: string;
  projects?: Array<{ id: string; name: string }>;
  onSaved?: SkillLibraryEditorState['onSaved'];
  onSaveError?: SkillLibraryEditorState['onSaveError'];
}): void {
  returnFocusTo = activeFocusTarget();
  startSession({
    mode: 'create',
    contentKind: input.contentKind ?? 'federated-skill',
    requestProjectId: input.requestProjectId,
    workspaceProjectId: input.requestProjectId,
    projects: [...(input.projects ?? [])],
    onSaved: input.onSaved,
    onSaveError: input.onSaveError,
  });
  telemetry('codex-skill-library-creator-open', { contentKind: skillLibraryEditorState.contentKind });
}

export async function openSkillLibraryEditor(input: {
  skillName: string;
  requestProjectId: string;
  onSaved?: SkillLibraryEditorState['onSaved'];
  onSaveError?: SkillLibraryEditorState['onSaveError'];
  onClosed?: SkillLibraryEditorState['onClosed'];
}): Promise<void> {
  const skillName = input.skillName.trim();
  if (!skillName) return;
  returnFocusTo = activeFocusTarget();
  startSession({
    mode: 'edit',
    skillName,
    requestProjectId: input.requestProjectId,
    loading: true,
    onSaved: input.onSaved,
    onSaveError: input.onSaveError,
    onClosed: input.onClosed,
  });
  telemetry('codex-skill-library-editor-open', { skillName });
  await loadSkillLibraryDraft(false);
}

function adoptDetail(detail: CodexSkillLibraryDetail, availableTags: string[], authoritativeReload: boolean): void {
  skillLibraryEditorState.detail = detail;
  skillLibraryEditorState.contentKind = detail.contentKind === 'pipeline-prompt'
    ? 'pipeline-prompt'
    : detail.contentKind === 'workspace-skill'
      ? 'workspace-skill'
      : 'federated-skill';
  if (skillLibraryEditorState.contentKind !== 'workspace-skill') skillLibraryEditorState.requestProjectId = '';
  skillLibraryEditorState.markdown = detail.markdown;
  skillLibraryEditorState.persistedMarkdown = detail.markdown;
  skillLibraryEditorState.defaultCodexModel = detail.defaultCodexModel;
  skillLibraryEditorState.defaultCodexEffort = detail.defaultCodexEffort;
  skillLibraryEditorState.availableTags = availableTags;
  skillLibraryEditorState.tags = [...(detail.tags ?? [])];
  skillLibraryEditorState.selectedRevisionIndex = 0;
  skillLibraryEditorState.revisionDetail = null;
  skillLibraryEditorState.historyInitialized = false;
  skillLibraryEditorState.historyNextCursor = null;
  skillLibraryEditorState.recovery = null;
  skillLibraryEditorState.conflictRevision = '';
  if (authoritativeReload) session?.reloadAuthoritative(detail.markdown, detail.revision);
}

async function loadSkillLibraryDraft(authoritativeReload: boolean): Promise<void> {
  if (!skillLibraryEditorState.skillName || skillLibraryEditorState.mode !== 'edit') return;
  const currentGeneration = generation;
  const requestedName = skillLibraryEditorState.skillName;
  skillLibraryEditorState.loading = true;
  skillLibraryEditorState.error = '';
  skillLibraryEditorState.notice = '';
  renderSkillLibraryEditorModal();
  const result = await loadCodexSkillLibrary(requestedName, skillLibraryEditorState.requestProjectId);
  if (currentGeneration !== generation || requestedName !== skillLibraryEditorState.skillName) return;
  skillLibraryEditorState.loading = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.error = result.error || 'Could not load this authored file.';
    if (!session) skillLibraryEditorState.detail = null;
  } else {
    adoptDetail(result.skill, result.availableTags, authoritativeReload);
    if (authoritativeReload) skillLibraryEditorState.notice = 'Reloaded the server-confirmed revision.';
  }
  renderSkillLibraryEditorModal();
}

export async function reloadSkillLibraryDraft(): Promise<void> {
  if (session?.state().dirty || ownerMetadataDirty()) {
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm('Discard the current draft and reload the authoritative revision?')) return;
  }
  await loadSkillLibraryDraft(Boolean(session));
}

export async function createSkillLibraryDraft(): Promise<boolean> {
  if (skillLibraryEditorState.mode !== 'create' || skillLibraryEditorState.saving) return false;
  if (skillLibraryEditorState.contentKind === 'workspace-skill' && !skillLibraryEditorState.workspaceProjectId) {
    skillLibraryEditorState.error = 'Select the project that owns this workspace skill.';
    renderSkillLibraryEditorModal();
    return false;
  }
  skillLibraryEditorState.markdown = session?.value() ?? skillLibraryEditorState.markdown;
  skillLibraryEditorState.saving = true;
  skillLibraryEditorState.error = '';
  renderSkillLibraryEditorModal();
  const currentGeneration = generation;
  const result = await requestCodexSkillLibraryCreate({
    name: skillLibraryEditorState.skillName.trim(),
    description: skillLibraryEditorState.createDescription.trim(),
    instructions: skillLibraryEditorState.markdown,
    contentKind: skillLibraryEditorState.contentKind,
    requestProjectId: skillLibraryEditorState.requestProjectId,
  });
  if (currentGeneration !== generation) return false;
  skillLibraryEditorState.saving = false;
  if (!result.ok || !result.skill) {
    const message = result.error || 'Could not create this authored file.';
    skillLibraryEditorState.error = message;
    skillLibraryEditorState.onSaveError?.(message);
    renderSkillLibraryEditorModal();
    return false;
  }
  const saved = result.skill;
  skillLibraryEditorState.mode = 'edit';
  skillLibraryEditorState.skillName = saved.name;
  adoptDetail(saved, skillLibraryEditorState.availableTags, false);
  session?.markSaved(saved.markdown, saved.revision);
  session?.setIdentity(filename(), saved.gitRevision?.commit || saved.revision);
  skillLibraryEditorState.notice = 'Created with its first Git revision.';
  await skillLibraryEditorState.onSaved?.(saved);
  renderSkillLibraryEditorModal();
  return true;
}

export async function saveSkillLibraryDraft(): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  if (!detail?.editable || skillLibraryEditorState.saving) return false;
  skillLibraryEditorState.markdown = session?.value() ?? skillLibraryEditorState.markdown;
  skillLibraryEditorState.saving = true;
  skillLibraryEditorState.error = '';
  skillLibraryEditorState.notice = '';
  renderSkillLibraryEditorModal();
  const currentGeneration = generation;
  const result = await requestCodexSkillLibrarySave({
    skillName: detail.name,
    markdown: skillLibraryEditorState.markdown,
    revision: detail.revision,
    defaultCodexModel: skillLibraryEditorState.defaultCodexModel,
    defaultCodexEffort: skillLibraryEditorState.defaultCodexEffort,
    requestProjectId: skillLibraryEditorState.requestProjectId,
  });
  if (currentGeneration !== generation || detail.name !== skillLibraryEditorState.skillName) return false;
  skillLibraryEditorState.saving = false;
  if (!result.ok || !result.skill) {
    if (result.code === 'git_revision_pending_recovery' && result.recovery?.recoveryToken) {
      const recovery: TextFileEditorRecovery = {
        recoveryToken: result.recovery.recoveryToken,
        contentRevision: result.recovery.contentRevision,
        message: result.error || 'The authored bytes are saved and their Git revision requires retry.',
      };
      skillLibraryEditorState.persistedMarkdown = skillLibraryEditorState.markdown;
      skillLibraryEditorState.detail = {
        ...detail,
        markdown: skillLibraryEditorState.markdown,
        revision: result.recovery.contentRevision,
      };
      skillLibraryEditorState.recovery = recovery;
      session?.markSaved(skillLibraryEditorState.markdown, result.recovery.contentRevision);
      session?.setRecovery(recovery);
      skillLibraryEditorState.notice = recovery.message;
    } else {
      const message = result.conflict
        ? 'This authored file changed after it was opened. The draft is preserved; reload the authoritative revision explicitly.'
        : result.error || 'Could not save this authored file.';
      skillLibraryEditorState.error = message;
      skillLibraryEditorState.conflictRevision = result.conflict ? result.currentRevision ?? '' : '';
      skillLibraryEditorState.onSaveError?.(message);
    }
    renderSkillLibraryEditorModal();
    return false;
  }
  adoptDetail(result.skill, skillLibraryEditorState.availableTags, false);
  session?.markSaved(result.skill.markdown, result.skill.revision);
  skillLibraryEditorState.notice = result.publication?.status === 'failed'
    ? `Saved locally; publication failed: ${result.publication.error ?? 'retry synchronization.'}`
    : 'Saved as a new Git revision.';
  await skillLibraryEditorState.onSaved?.(result.skill);
  renderSkillLibraryEditorModal();
  return true;
}

export async function retrySkillLibraryRevision(): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  const recovery = skillLibraryEditorState.recovery;
  if (!detail || !recovery || skillLibraryEditorState.saving) return false;
  skillLibraryEditorState.saving = true;
  skillLibraryEditorState.error = '';
  renderSkillLibraryEditorModal();
  const currentGeneration = generation;
  const result = await requestCodexSkillRevisionRetry({
    skillName: detail.name,
    contentRevision: recovery.contentRevision,
    recoveryToken: recovery.recoveryToken,
    requestProjectId: skillLibraryEditorState.requestProjectId,
  });
  if (currentGeneration !== generation) return false;
  skillLibraryEditorState.saving = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.error = result.error || 'Could not create the pending Git revision.';
    renderSkillLibraryEditorModal();
    return false;
  }
  adoptDetail(result.skill, skillLibraryEditorState.availableTags, false);
  session?.markSaved(result.skill.markdown, result.skill.revision);
  session?.setRecovery(null);
  skillLibraryEditorState.notice = 'Created the pending Git revision.';
  await skillLibraryEditorState.onSaved?.(result.skill);
  renderSkillLibraryEditorModal();
  return true;
}

async function initializeHistory(): Promise<void> {
  const detail = skillLibraryEditorState.detail;
  if (!detail || skillLibraryEditorState.historyInitialized || skillLibraryEditorState.historyLoadingMore) return;
  skillLibraryEditorState.historyLoadingMore = true;
  renderSkillLibraryEditorModal();
  const currentGeneration = generation;
  const result = await loadCodexSkillRevisionHistory(detail.name, { requestProjectId: skillLibraryEditorState.requestProjectId });
  if (currentGeneration !== generation || detail.name !== skillLibraryEditorState.skillName) return;
  skillLibraryEditorState.historyLoadingMore = false;
  skillLibraryEditorState.historyInitialized = true;
  if (result.ok) {
    skillLibraryEditorState.detail = { ...detail, history: result.history };
    skillLibraryEditorState.historyNextCursor = result.nextCursor;
    skillLibraryEditorState.selectedRevisionIndex = 0;
  } else {
    skillLibraryEditorState.error = result.error || 'Could not load revision history.';
  }
  renderSkillLibraryEditorModal();
}

async function loadOlderHistoryPage(): Promise<void> {
  const detail = skillLibraryEditorState.detail;
  const cursor = skillLibraryEditorState.historyNextCursor;
  if (!detail || !cursor || skillLibraryEditorState.historyLoadingMore) return;
  skillLibraryEditorState.historyLoadingMore = true;
  renderSkillLibraryEditorModal();
  const currentGeneration = generation;
  const result = await loadCodexSkillRevisionHistory(detail.name, {
    cursor,
    requestProjectId: skillLibraryEditorState.requestProjectId,
  });
  if (currentGeneration !== generation || detail.name !== skillLibraryEditorState.skillName) return;
  skillLibraryEditorState.historyLoadingMore = false;
  if (!result.ok) {
    skillLibraryEditorState.error = result.error || 'Could not load older revisions.';
  } else {
    const known = new Set(detail.history.map((revision) => revision.commit));
    const appended = result.history.filter((revision) => !known.has(revision.commit));
    skillLibraryEditorState.detail = { ...detail, history: [...detail.history, ...appended] };
    skillLibraryEditorState.historyNextCursor = result.nextCursor;
    if (appended.length) await selectSkillRevision(detail.history.length);
  }
  renderSkillLibraryEditorModal();
}

export async function selectSkillRevision(index: number): Promise<void> {
  const detail = skillLibraryEditorState.detail;
  const revisions = detail?.history ?? [];
  if (!detail || index < 0 || index >= revisions.length) return;
  const currentGeneration = generation;
  skillLibraryEditorState.selectedRevisionIndex = index;
  skillLibraryEditorState.revisionLoading = true;
  skillLibraryEditorState.error = '';
  session?.setSelectedRevision(revisions[index].commit);
  renderSkillLibraryEditorModal();
  const result = await loadCodexSkillRevision(detail.name, revisions[index].commit, skillLibraryEditorState.requestProjectId);
  if (currentGeneration !== generation || skillLibraryEditorState.selectedRevisionIndex !== index) return;
  skillLibraryEditorState.revisionLoading = false;
  skillLibraryEditorState.revisionDetail = result.revision ?? null;
  if (!result.ok) skillLibraryEditorState.error = result.error || 'Could not load this revision.';
  renderSkillLibraryEditorModal();
}

export async function saveSkillLibraryTag(tag: string): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  if (!detail || skillLibraryEditorState.tagsSaving || !skillLibraryEditorState.availableTags.includes(tag) || detail.tags?.[0] === tag) return false;
  const prior = detail;
  const tags = [tag];
  skillLibraryEditorState.tagsSaving = true;
  skillLibraryEditorState.detail = { ...detail, tags };
  renderSkillLibraryEditorModal();
  const result = await requestCodexSkillMetadataSave(detail.name, { tags }, skillLibraryEditorState.requestProjectId);
  skillLibraryEditorState.tagsSaving = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.detail = prior;
    skillLibraryEditorState.error = result.error || 'Could not save content tags.';
  } else {
    skillLibraryEditorState.detail = result.skill;
    skillLibraryEditorState.tags = [...(result.skill.tags ?? [])];
    await skillLibraryEditorState.onSaved?.(result.skill);
  }
  renderSkillLibraryEditorModal();
  return result.ok;
}

export async function toggleSkillLibraryFavorite(): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  if (!detail || skillLibraryEditorState.favoriteSaving) return false;
  const favorite = !detail.favorite;
  skillLibraryEditorState.favoriteSaving = true;
  skillLibraryEditorState.detail = { ...detail, favorite };
  renderSkillLibraryEditorModal();
  const result = await requestCodexSkillFavoriteSave(detail.name, favorite, skillLibraryEditorState.requestProjectId);
  skillLibraryEditorState.favoriteSaving = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.detail = detail;
    skillLibraryEditorState.error = result.error || 'Could not save this favorite.';
  } else {
    skillLibraryEditorState.detail = result.skill;
    await skillLibraryEditorState.onSaved?.(result.skill);
  }
  renderSkillLibraryEditorModal();
  return result.ok;
}

export function closeSkillLibraryEditor(): void {
  if (session) {
    session.requestClose('close');
    return;
  }
  const dirty = ownerMetadataDirty() || Boolean(skillLibraryEditorState.markdown);
  if (dirty && typeof globalThis.confirm === 'function' && !globalThis.confirm('Discard unsaved changes?')) return;
  finishClose();
}

export function requestSkillLibraryEditorClose(reason: 'close' | 'escape' | 'back' | 'route'): boolean {
  if (!skillLibraryEditorModal?.open) return true;
  if (session) return session.requestClose(reason);
  closeSkillLibraryEditor();
  return !skillLibraryEditorModal?.open;
}

skillLibraryEditorModal?.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (session) session.requestClose('escape');
  else closeSkillLibraryEditor();
});
