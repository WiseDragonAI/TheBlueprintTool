/**
 * WHAT: Renders the editable Codex skill-library detail surface.
 * WHY: Workspace and user skills need one conflict-aware editor for Markdown and run defaults.
 */
import { skillLibraryEditorModal } from '../../dom.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { codexEffortOptions, codexModelOptions, type CodexEffort, type CodexModel } from '../helper/codex-run-options.js';
import { loadCodexSkillLibrary, type CodexSkillLibraryDetail } from './load-codex-skill-library.js';
import { requestCodexSkillLibrarySave } from './request-codex-skill-library-save.js';
import { requestCodexSkillFavoriteSave, requestCodexSkillMetadataSave } from './request-codex-skill-favorite-save.js';

export type SkillLibraryEditorState = {
  skillName: string;
  detail: CodexSkillLibraryDetail | null;
  markdown: string;
  defaultCodexModel: CodexModel | null;
  defaultCodexEffort: CodexEffort | null;
  loading: boolean;
  saving: boolean;
  favoriteSaving: boolean;
  tags: string[];
  tagsSaving: boolean;
  error: string;
  notice: string;
  onSaved?: (skill: CodexSkillLibraryDetail) => void | Promise<void>;
  onSaveError?: (message: string) => void;
};

export const skillLibraryEditorState: SkillLibraryEditorState = {
  skillName: '',
  detail: null,
  markdown: '',
  defaultCodexModel: null,
  defaultCodexEffort: null,
  loading: false,
  saving: false,
  favoriteSaving: false,
  tags: [],
  tagsSaving: false,
  error: '',
  notice: '',
};

let skillEditorGeneration = 0;

function showEditor(): void {
  if (!skillLibraryEditorModal?.open) skillLibraryEditorModal?.showModal?.();
}

function button(label: string, action: () => void, className = 'ghost-button', focusKey = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  if (focusKey) element.dataset.codexFocusKey = focusKey;
  element.addEventListener('click', action);
  return element;
}

function defaultSelect<T extends string>(input: {
  label: string;
  value: T | null;
  options: readonly T[];
  onChange: (value: T | null) => void;
}): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'codex-field';
  const title = document.createElement('span');
  title.textContent = input.label;
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
  label.replaceChildren(title, select);
  return label;
}

export function renderSkillLibraryEditorModal(): void {
  if (!skillLibraryEditorModal) return;
  const focusKey = (globalThis.document?.activeElement as HTMLElement | null)?.dataset?.codexFocusKey ?? '';
  skillLibraryEditorModal.setAttribute('tabindex', '-1');
  const head = document.createElement('header');
  head.className = 'codex-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Skill library';
  const title = document.createElement('h2');
  title.id = 'skill-library-editor-modal-title';
  title.textContent = skillLibraryEditorState.skillName || 'Edit skill';
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = 'Edit SKILL.md and the defaults inherited by direct and pipeline runs.';
  copy.replaceChildren(kicker, title, subtitle);
  const close = button('×', closeSkillLibraryEditor, 'plain-close');
  close.setAttribute('aria-label', 'Close skill editor');
  head.replaceChildren(copy, close);

  const body = document.createElement('section');
  body.className = 'skill-library-editor-body';
  if (skillLibraryEditorState.loading) {
    const loading = document.createElement('p');
    loading.className = 'codex-empty-state';
    loading.textContent = 'Loading skill metadata…';
    body.replaceChildren(loading);
  } else if (!skillLibraryEditorState.detail) {
    const unavailable = document.createElement('p');
    unavailable.className = 'codex-empty-state';
    unavailable.textContent = skillLibraryEditorState.error || 'Skill metadata is unavailable.';
    body.replaceChildren(unavailable);
  } else {
    const detail = skillLibraryEditorState.detail;
    const metadata = document.createElement('div');
    metadata.className = 'skill-library-metadata';
    const source = document.createElement('span');
    source.textContent = `Source: ${detail.source}`;
    const revision = document.createElement('span');
    revision.textContent = `Revision: ${detail.revision.slice(0, 12)}`;
    metadata.replaceChildren(source, revision);

    if (!detail.editable) {
      const readOnly = document.createElement('p');
      readOnly.className = 'codex-inline-warning';
      readOnly.textContent = detail.readOnlyReason || 'This skill is read-only.';
      metadata.append(readOnly);
    }

    const defaults = document.createElement('div');
    defaults.className = 'skill-library-defaults';
    defaults.replaceChildren(
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

    const tagsField = document.createElement('label');
    tagsField.className = 'codex-field skill-tags-field';
    const tagsLabel = document.createElement('span');
    tagsLabel.textContent = 'Tags';
    const tagsInput = document.createElement('input');
    tagsInput.setAttribute('aria-label', 'Skill tags');
    tagsInput.value = skillLibraryEditorState.tags.join(', ');
    tagsInput.disabled = skillLibraryEditorState.tagsSaving;
    tagsInput.addEventListener('input', () => {
      skillLibraryEditorState.tags = [...new Set(tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
    });
    tagsField.replaceChildren(tagsLabel, tagsInput);

    const markdownField = document.createElement('label');
    markdownField.className = 'codex-field skill-markdown-field';
    const markdownLabel = document.createElement('span');
    markdownLabel.textContent = 'SKILL.md';
    const textarea = document.createElement('textarea');
    textarea.className = 'skill-markdown-editor';
    textarea.value = skillLibraryEditorState.markdown;
    textarea.spellcheck = false;
    textarea.readOnly = !detail.editable;
    textarea.disabled = skillLibraryEditorState.saving;
    textarea.addEventListener('input', () => { skillLibraryEditorState.markdown = textarea.value; });
    markdownField.replaceChildren(markdownLabel, textarea);
    body.replaceChildren(metadata, tagsField, defaults, markdownField);
  }

  const footer = document.createElement('footer');
  footer.className = 'codex-modal-actions';
  const message = document.createElement('p');
  message.className = skillLibraryEditorState.error ? 'codex-form-error' : 'codex-form-notice';
  message.setAttribute('role', 'status');
  message.textContent = skillLibraryEditorState.error || skillLibraryEditorState.notice;
  footer.append(message);
  if (skillLibraryEditorState.detail) {
    const saveTags = button(skillLibraryEditorState.tagsSaving ? 'Saving tags…' : 'Save tags', () => { void saveSkillLibraryTags(); }, 'ghost-button', 'skill-editor-save-tags');
    saveTags.disabled = skillLibraryEditorState.tagsSaving || skillLibraryEditorState.saving || skillLibraryEditorState.favoriteSaving;
    footer.append(saveTags);
    const favorite = button(
      skillLibraryEditorState.favoriteSaving
        ? 'Saving favorite…'
        : skillLibraryEditorState.detail.favorite ? 'Remove from favorites' : 'Mark as favorite',
      () => { void toggleSkillLibraryFavorite(); },
      'ghost-button skill-favorite-toggle',
      'skill-editor-favorite',
    );
    favorite.setAttribute('aria-pressed', String(skillLibraryEditorState.detail.favorite));
    favorite.disabled = skillLibraryEditorState.favoriteSaving || skillLibraryEditorState.saving;
    footer.append(favorite);
    const reload = button('Reload', () => { void reloadSkillLibraryDraft(); }, 'ghost-button', 'skill-editor-reload');
    reload.disabled = skillLibraryEditorState.loading || skillLibraryEditorState.saving;
    footer.append(reload);
    const save = button(skillLibraryEditorState.saving ? 'Saving…' : 'Save skill', () => { void saveSkillLibraryDraft(); }, 'primary-action', 'skill-editor-save');
    save.disabled = !skillLibraryEditorState.detail.editable || skillLibraryEditorState.saving;
    footer.append(save);
  }
  footer.append(button('Close', closeSkillLibraryEditor));
  skillLibraryEditorModal.replaceChildren(head, body, footer);
  if (focusKey) {
    const nextFocus = skillLibraryEditorModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
    else skillLibraryEditorModal.focus();
  }
}

export async function openSkillLibraryEditor(input: {
  skillName: string;
  onSaved?: SkillLibraryEditorState['onSaved'];
  onSaveError?: SkillLibraryEditorState['onSaveError'];
}): Promise<void> {
  const skillName = input.skillName.trim();
  if (!skillName) return;
  skillEditorGeneration += 1;
  Object.assign(skillLibraryEditorState, {
    skillName,
    detail: null,
    markdown: '',
    defaultCodexModel: null,
    defaultCodexEffort: null,
    loading: true,
    saving: false,
    favoriteSaving: false,
    tags: [],
    tagsSaving: false,
    error: '',
    notice: '',
    onSaved: input.onSaved,
    onSaveError: input.onSaveError,
  });
  renderSkillLibraryEditorModal();
  showEditor();
  telemetry('codex-skill-library-editor-open', { skillName });
  await reloadSkillLibraryDraft();
}

export async function reloadSkillLibraryDraft(): Promise<void> {
  if (!skillLibraryEditorState.skillName) return;
  const generation = ++skillEditorGeneration;
  const requestedSkillName = skillLibraryEditorState.skillName;
  skillLibraryEditorState.loading = true;
  skillLibraryEditorState.error = '';
  skillLibraryEditorState.notice = '';
  renderSkillLibraryEditorModal();
  const result = await loadCodexSkillLibrary(requestedSkillName);
  if (generation !== skillEditorGeneration || requestedSkillName !== skillLibraryEditorState.skillName) return;
  skillLibraryEditorState.loading = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.detail = null;
    skillLibraryEditorState.error = result.error || 'Could not load this skill.';
    renderSkillLibraryEditorModal();
    return;
  }
  skillLibraryEditorState.detail = result.skill;
  skillLibraryEditorState.markdown = result.skill.markdown;
  skillLibraryEditorState.defaultCodexModel = result.skill.defaultCodexModel;
  skillLibraryEditorState.defaultCodexEffort = result.skill.defaultCodexEffort;
  skillLibraryEditorState.tags = [...(result.skill.tags ?? [])];
  renderSkillLibraryEditorModal();
}

export async function saveSkillLibraryDraft(): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  if (!detail?.editable || skillLibraryEditorState.saving) return false;
  skillLibraryEditorState.saving = true;
  skillLibraryEditorState.error = '';
  skillLibraryEditorState.notice = '';
  renderSkillLibraryEditorModal();
  const generation = skillEditorGeneration;
  const skillName = detail.name;
  const onSaved = skillLibraryEditorState.onSaved;
  const onSaveError = skillLibraryEditorState.onSaveError;
  const result = await requestCodexSkillLibrarySave({
    skillName: detail.name,
    markdown: skillLibraryEditorState.markdown,
    revision: detail.revision,
    defaultCodexModel: skillLibraryEditorState.defaultCodexModel,
    defaultCodexEffort: skillLibraryEditorState.defaultCodexEffort,
  });
  if (generation !== skillEditorGeneration || skillName !== skillLibraryEditorState.skillName) return false;
  skillLibraryEditorState.saving = false;
  if (!result.ok || !result.skill) {
    const message = result.conflict
      ? 'This skill changed after it was opened. Reload it before saving again.'
      : result.error || 'Could not save this skill.';
    skillLibraryEditorState.error = message;
    onSaveError?.(message);
    telemetry('codex-skill-library-save-failed', { skillName: detail.name, statusCode: result.statusCode, conflict: result.conflict });
    renderSkillLibraryEditorModal();
    return false;
  }
  skillLibraryEditorState.detail = result.skill;
  skillLibraryEditorState.markdown = result.skill.markdown;
  skillLibraryEditorState.defaultCodexModel = result.skill.defaultCodexModel;
  skillLibraryEditorState.defaultCodexEffort = result.skill.defaultCodexEffort;
  skillLibraryEditorState.notice = 'Skill saved. Inherited run settings have been refreshed.';
  telemetry('codex-skill-library-saved', { skillName: detail.name });
  await onSaved?.(result.skill);
  renderSkillLibraryEditorModal();
  return true;
}

export async function saveSkillLibraryTags(): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  if (!detail || skillLibraryEditorState.tagsSaving) return false;
  const generation = skillEditorGeneration;
  const prior = detail;
  const tags = [...skillLibraryEditorState.tags];
  skillLibraryEditorState.tagsSaving = true;
  skillLibraryEditorState.error = '';
  skillLibraryEditorState.detail = { ...detail, tags };
  renderSkillLibraryEditorModal();
  const result = await requestCodexSkillMetadataSave(detail.name, { tags });
  if (generation !== skillEditorGeneration || detail.name !== skillLibraryEditorState.skillName) return false;
  skillLibraryEditorState.tagsSaving = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.detail = prior;
    skillLibraryEditorState.tags = [...(prior.tags ?? [])];
    skillLibraryEditorState.error = result.error || 'Could not save skill tags.';
    renderSkillLibraryEditorModal();
    return false;
  }
  skillLibraryEditorState.detail = result.skill;
  skillLibraryEditorState.tags = [...(result.skill.tags ?? [])];
  skillLibraryEditorState.notice = 'Tags saved.';
  await skillLibraryEditorState.onSaved?.(result.skill);
  renderSkillLibraryEditorModal();
  return true;
}

export async function toggleSkillLibraryFavorite(): Promise<boolean> {
  const detail = skillLibraryEditorState.detail;
  if (!detail || skillLibraryEditorState.favoriteSaving) return false;
  const generation = skillEditorGeneration;
  const favorite = !detail.favorite;
  skillLibraryEditorState.favoriteSaving = true;
  skillLibraryEditorState.error = '';
  skillLibraryEditorState.detail = { ...detail, favorite };
  renderSkillLibraryEditorModal();
  const result = await requestCodexSkillFavoriteSave(detail.name, favorite);
  if (generation !== skillEditorGeneration || detail.name !== skillLibraryEditorState.skillName) return false;
  skillLibraryEditorState.favoriteSaving = false;
  if (!result.ok || !result.skill) {
    skillLibraryEditorState.detail = detail;
    skillLibraryEditorState.error = result.error || 'Could not save this favorite.';
    renderSkillLibraryEditorModal();
    return false;
  }
  skillLibraryEditorState.detail = result.skill;
  skillLibraryEditorState.notice = favorite ? 'Added to favorites.' : 'Removed from favorites.';
  await skillLibraryEditorState.onSaved?.(result.skill);
  renderSkillLibraryEditorModal();
  return true;
}

export function closeSkillLibraryEditor(): void {
  skillEditorGeneration += 1;
  skillLibraryEditorModal?.close?.();
}
