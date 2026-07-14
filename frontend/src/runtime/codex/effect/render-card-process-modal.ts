/**
 * WHAT: Renders the combined Process card flow for saved pipelines and direct skills.
 * WHY: Card processing needs one entry point while preserving the one-skill compatibility route.
 */
import type {
  CodexPipeline,
  CodexPipelineInvalidReference,
  CodexPipelineStep,
  CodexPipelineStoreIssue,
} from '../../../../../shared/schemas/codex-pipeline-types.js';
import { processModal } from '../../dom.js';
import { refreshRuntimeState } from '../../refresh/controller/refresh-runtime-state.js';
import { state } from '../../state.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { processCardSkillController } from '../controller/process-card-skill-controller.js';
import { renderSkillLibraryItemContent } from '../component/render-skill-library-item-content.js';
import { colorForSkillTag, sortSkillsByFavorite, tagsForSkill } from '../helper/skill-library-presentation.js';
import { codexEffortOptions, codexModelOptions } from '../helper/codex-run-options.js';
import { loadCodexPipelines } from './load-codex-pipelines.js';
import { loadCodexSkillsResult, type CodexSkillSummary } from './load-codex-skills.js';
import { requestCodexPipelineRun } from './request-codex-pipeline-run.js';
import { openPipelineEditor } from './render-pipeline-editor-modal.js';
import { openPipelinesModal } from './render-pipelines-modal.js';
import { openSkillLibraryEditor } from './render-skill-library-editor-modal.js';

export type ProcessModalMode = 'pipelines' | 'skills';

export type ProcessModalState = {
  cardId: string;
  mode: ProcessModalMode;
  query: string;
  selectedCategory: string;
  selectedPipelineId: string;
  selectedSkillName: string;
  codexModel: string;
  codexEffort: string;
  codexModelExplicit: boolean;
  codexEffortExplicit: boolean;
  pipelines: readonly CodexPipeline[];
  steps: readonly CodexPipelineStep[];
  skills: CodexSkillSummary[];
  invalidReferences: readonly CodexPipelineInvalidReference[];
  issues: readonly CodexPipelineStoreIssue[];
  loadingPipelines: boolean;
  loadingSkills: boolean;
  processing: boolean;
  sourceContentMissing: boolean;
  metadataError: string;
  skillCatalogError: string;
  error: string;
  saveError: string;
};

export const processModalState: ProcessModalState = {
  cardId: '',
  mode: 'pipelines',
  query: '',
  selectedCategory: 'All',
  selectedPipelineId: '',
  selectedSkillName: '',
  codexModel: '',
  codexEffort: '',
  codexModelExplicit: false,
  codexEffortExplicit: false,
  pipelines: [],
  steps: [],
  skills: [],
  invalidReferences: [],
  issues: [],
  loadingPipelines: false,
  loadingSkills: false,
  processing: false,
  sourceContentMissing: false,
  metadataError: '',
  skillCatalogError: '',
  error: '',
  saveError: '',
};

let processLoadGeneration = 0;

function showProcessModal(): void {
  if (!processModal?.open) processModal?.showModal?.();
}

function button(label: string, onClick: () => void, className = 'ghost-button', focusKey = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  if (focusKey) element.dataset.codexFocusKey = focusKey;
  element.addEventListener('click', onClick);
  return element;
}

function activeLedgerCard(cardId: string): Record<string, unknown> | null {
  const cards = Array.isArray(state.activeLedger?.cards) ? state.activeLedger.cards as Array<Record<string, unknown>> : [];
  return cards.find((card) => String(card.id ?? '') === cardId) ?? null;
}

export function hasProcessSourceContent(cardId: string): boolean {
  const card = activeLedgerCard(cardId);
  const escape = globalThis.CSS?.escape ?? ((value: string) => value.replace(/["\\]/g, '\\$&'));
  if (!card) return Boolean(globalThis.document?.querySelector?.(`[data-card-id="${escape(cardId)}"]`));
  const comment = card.comment && typeof card.comment === 'object' && !Array.isArray(card.comment)
    ? card.comment as Record<string, unknown>
    : {};
  const content = comment.what ?? comment.body ?? comment.description ?? '';
  return typeof content === 'string' && content.trim().length > 0;
}

function stepsById(): Map<string, CodexPipelineStep> {
  return new Map(processModalState.steps.map((step) => [step.id, step]));
}

function selectedPipeline(): CodexPipeline | undefined {
  return processModalState.pipelines.find((pipeline) => pipeline.id === processModalState.selectedPipelineId);
}

function selectedSkill(): CodexSkillSummary | undefined {
  return processModalState.skills.find((skill) => skill.name === processModalState.selectedSkillName);
}

function pipelineReferences(pipelineId: string): readonly CodexPipelineInvalidReference[] {
  return processModalState.invalidReferences.filter((reference) => reference.pipelineId === pipelineId);
}

function pipelineCategories(pipeline: CodexPipeline): string[] {
  const stepLookup = stepsById();
  const categories = new Set<string>();
  for (const stepId of pipeline.stepIds) {
    const step = stepLookup.get(stepId);
    for (const skill of step?.skills ?? []) {
      const catalogSkill = processModalState.skills.find((entry) => entry.name === skill.skillName);
      tagsForSkill(catalogSkill ?? { name: skill.skillName }).forEach((tag) => categories.add(tag));
    }
  }
  return [...categories];
}

function pipelineSkillNames(pipeline: CodexPipeline): string[] {
  const stepLookup = stepsById();
  return pipeline.stepIds.flatMap((stepId) => stepLookup.get(stepId)?.skills.map((skill) => skill.skillName) ?? []);
}

function pipelineCanRun(pipeline: CodexPipeline): boolean {
  if (pipelineReferences(pipeline.id).length > 0 || pipeline.stepIds.length === 0) return false;
  const stepLookup = stepsById();
  const availableSkills = new Set(processModalState.skills.map((skill) => skill.name));
  return pipeline.stepIds.every((stepId) => {
    const step = stepLookup.get(stepId);
    return Boolean(step && step.skills.length > 0 && step.skills.every((skill) => availableSkills.has(skill.skillName)));
  });
}

function filteredPipelines(): CodexPipeline[] {
  const query = processModalState.query.trim().toLowerCase();
  return processModalState.pipelines.filter((pipeline) => {
    const categories = pipelineCategories(pipeline);
    if (processModalState.selectedCategory !== 'All' && !categories.includes(processModalState.selectedCategory)) return false;
    const text = `${pipeline.name} ${pipeline.purpose} ${pipelineSkillNames(pipeline).join(' ')} ${categories.join(' ')}`.toLowerCase();
    return !query || text.includes(query);
  });
}

function filteredSkills(): CodexSkillSummary[] {
  const query = processModalState.query.trim().toLowerCase();
  return sortSkillsByFavorite(processModalState.skills.filter((skill) => {
    const tags = tagsForSkill(skill);
    if (processModalState.selectedCategory !== 'All' && !tags.includes(processModalState.selectedCategory)) return false;
    return !query || `${skill.name} ${skill.description} ${tags.join(' ')}`.toLowerCase().includes(query);
  }));
}

function availableCategories(): string[] {
  const categories = new Set<string>();
  if (processModalState.mode === 'skills') {
    processModalState.skills.forEach((skill) => tagsForSkill(skill).forEach((tag) => categories.add(tag)));
  } else {
    processModalState.pipelines.forEach((pipeline) => pipelineCategories(pipeline).forEach((category) => categories.add(category)));
  }
  return ['All', ...[...categories].sort((left, right) => left.localeCompare(right))];
}

function renderTabs(): HTMLElement {
  const tabs = document.createElement('nav');
  tabs.className = 'process-mode-tabs';
  tabs.setAttribute('aria-label', 'Process mode');
  tabs.setAttribute('role', 'tablist');
  for (const mode of ['pipelines', 'skills'] as const) {
    const selected = processModalState.mode === mode;
    const tab = button(mode === 'pipelines' ? 'Pipelines' : 'Skills', () => setCardProcessTab(mode, true), `process-mode-tab${selected ? ' is-selected' : ''}`, `process-tab:${mode}`);
    tab.id = `process-tab-${mode}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('aria-controls', `process-panel-${mode}`);
    tab.tabIndex = selected ? 0 : -1;
    tab.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboardEvent.key)) return;
      keyboardEvent.preventDefault();
      const next = keyboardEvent.key === 'ArrowLeft' || keyboardEvent.key === 'Home' ? 'pipelines' : 'skills';
      setCardProcessTab(next, true);
    });
    tabs.append(tab);
  }
  return tabs;
}

function renderSearch(): HTMLInputElement {
  const search = document.createElement('input');
  search.className = 'skill-search process-search';
  search.type = 'search';
  search.placeholder = processModalState.mode === 'pipelines' ? 'Search pipelines' : 'Search skills';
  search.setAttribute('aria-label', search.placeholder);
  search.value = processModalState.query;
  search.addEventListener('input', () => {
    processModalState.query = search.value;
    renderCardProcessModal();
    processModal?.querySelector<HTMLInputElement>('.process-search')?.focus();
  });
  return search;
}

function renderCategoryFilters(): HTMLElement {
  const filters = document.createElement('div');
  filters.className = 'skill-category-filters process-category-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', `Filter ${processModalState.mode} by category`);
  for (const category of availableCategories()) {
    const selected = processModalState.selectedCategory === category;
    const filter = button(category, () => {
      processModalState.selectedCategory = category;
      renderCardProcessModal();
      processModal?.querySelector<HTMLButtonElement>(`.process-category-filters [data-process-category="${category}"]`)?.focus();
    }, `skill-category-filter${selected ? ' is-selected' : ''}`);
    filter.dataset.processCategory = category;
    filter.style.setProperty('--skill-category-color', category === 'All' ? '#cbd5e1' : colorForSkillTag(category));
    filter.setAttribute('aria-pressed', String(selected));
    filters.append(filter);
  }
  return filters;
}

function renderPipelineResult(pipeline: CodexPipeline): HTMLButtonElement {
  const selected = pipeline.id === processModalState.selectedPipelineId;
  const categories = pipelineCategories(pipeline);
  const runnable = pipelineCanRun(pipeline);
  const result = button('', () => selectProcessPipeline(pipeline.id), `process-result${selected ? ' is-selected' : ''}${runnable ? '' : ' has-warning'}`);
  result.dataset.processPipelineId = pipeline.id;
  if (categories[0]) result.style.setProperty('--skill-category-color', colorForSkillTag(categories[0]));
  result.setAttribute('aria-pressed', String(selected));
  const head = document.createElement('span');
  head.className = 'skill-result-header';
  const name = document.createElement('span');
  name.className = 'skill-result-name';
  name.textContent = pipeline.name;
  const badge = document.createElement('span');
  badge.className = 'skill-result-category';
  badge.textContent = runnable ? (categories[0] ?? 'Pipeline') : 'Needs repair';
  if (categories[0]) badge.style.setProperty('--skill-category-color', colorForSkillTag(categories[0]));
  head.replaceChildren(name, badge);
  const description = document.createElement('span');
  description.className = 'skill-result-description';
  description.textContent = pipeline.purpose || 'No purpose provided.';
  const metadata = document.createElement('span');
  metadata.className = 'process-result-metadata';
  metadata.textContent = `${pipeline.stepIds.length} step${pipeline.stepIds.length === 1 ? '' : 's'} · ${pipelineSkillNames(pipeline).join(' → ') || 'no configured skills'}`;
  result.replaceChildren(head, description, metadata);
  return result;
}

function renderSkillResult(skill: CodexSkillSummary): HTMLElement {
  const selected = skill.name === processModalState.selectedSkillName;
  const category = tagsForSkill(skill)[0];
  const row = document.createElement('article');
  row.className = `process-skill-row${selected ? ' is-selected' : ''}`;
  row.style.setProperty('--skill-category-color', colorForSkillTag(category));
  const select = button('', () => selectProcessSkill(skill.name), 'process-skill-select');
  select.dataset.processSkillName = skill.name;
  select.setAttribute('aria-pressed', String(selected));
  const defaults = document.createElement('span');
  defaults.className = 'process-result-metadata';
  defaults.textContent = `${skill.effectiveCodexModel} · ${skill.effectiveCodexEffort}`;
  select.replaceChildren(...renderSkillLibraryItemContent(skill), defaults);
  const editCell = document.createElement('div');
  editCell.className = 'process-skill-edit-cell';
  if (skill.editable) {
    editCell.append(button('Edit skill', () => {
      const generation = processLoadGeneration;
      const cardId = processModalState.cardId;
      void openSkillLibraryEditor({
        skillName: skill.name,
        onSaved: async () => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          await reloadProcessSkills();
        },
        onSaveError: (message) => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          processModalState.saveError = `Skill save failed: ${message}`;
          renderCardProcessModal();
        },
      });
    }));
  } else {
    const reason = document.createElement('span');
    reason.className = 'codex-readonly-reason';
    reason.textContent = skill.readOnlyReason || 'Read-only skill';
    editCell.append(reason);
  }
  row.replaceChildren(select, editCell);
  return row;
}

function renderResults(): HTMLElement {
  const results = document.createElement('section');
  results.className = 'process-results';
  results.id = `process-panel-${processModalState.mode}`;
  results.setAttribute('role', 'tabpanel');
  results.setAttribute('aria-labelledby', `process-tab-${processModalState.mode}`);
  results.setAttribute('aria-label', processModalState.mode === 'pipelines' ? 'Pipeline results' : 'Skill results');
  const loading = processModalState.mode === 'pipelines' ? processModalState.loadingPipelines : processModalState.loadingSkills;
  if (loading) {
    const message = document.createElement('p');
    message.className = 'codex-empty-state';
    message.textContent = `Loading ${processModalState.mode}…`;
    results.append(message);
    return results;
  }
  if (processModalState.mode === 'pipelines') {
    const pipelines = filteredPipelines();
    if (pipelines.length > 0) results.replaceChildren(...pipelines.map(renderPipelineResult));
    else {
      const empty = document.createElement('div');
      empty.className = 'codex-empty-state';
      const message = document.createElement('p');
      message.textContent = processModalState.pipelines.length === 0 ? 'No saved pipelines yet.' : 'No matching pipelines.';
      empty.replaceChildren(message, button('Create pipeline', () => editProcessPipeline(), 'primary-action'));
      results.append(empty);
    }
  } else {
    const skills = filteredSkills();
    if (skills.length > 0) results.replaceChildren(...skills.map(renderSkillResult));
    else {
      const empty = document.createElement('p');
      empty.className = 'codex-empty-state';
      empty.textContent = processModalState.skills.length === 0 ? 'No skills are available.' : 'No matching skills.';
      results.append(empty);
    }
  }
  return results;
}

function renderProcessPanels(): HTMLElement[] {
  return (['pipelines', 'skills'] as const).map((mode) => {
    if (mode === processModalState.mode) return renderResults();
    const panel = document.createElement('section');
    panel.className = 'process-results';
    panel.id = `process-panel-${mode}`;
    panel.hidden = true;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `process-tab-${mode}`);
    return panel;
  });
}

function runSelect(input: {
  label: string;
  hint: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'skill-run-field';
  const title = document.createElement('span');
  title.textContent = input.label;
  const select = document.createElement('select');
  select.setAttribute('aria-label', input.label);
  const values = input.options.includes(input.value) || !input.value ? input.options : [input.value, ...input.options];
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = input.value || input.options[0] || '';
  const hint = document.createElement('small');
  hint.className = 'direct-run-setting-hint';
  hint.textContent = input.hint;
  select.addEventListener('change', () => {
    input.onChange(select.value);
    hint.textContent = 'One-run override';
  });
  label.replaceChildren(title, select, hint);
  return label;
}

function renderDirectRunControls(): HTMLElement | null {
  const skill = selectedSkill();
  if (processModalState.mode !== 'skills' || !skill) return null;
  const controls = document.createElement('div');
  controls.className = 'skill-run-controls process-run-controls';
  controls.replaceChildren(
    runSelect({
      label: `Model · default ${skill.effectiveCodexModel}`,
      hint: processModalState.codexModelExplicit ? 'One-run override' : 'Using skill default',
      value: processModalState.codexModel,
      options: codexModelOptions,
      onChange: (value) => {
        processModalState.codexModel = value;
        processModalState.codexModelExplicit = true;
        telemetry('codex-skill-model-selected', { cardId: processModalState.cardId, codexModel: value });
      },
    }),
    runSelect({
      label: `Effort · default ${skill.effectiveCodexEffort}`,
      hint: processModalState.codexEffortExplicit ? 'One-run override' : 'Using skill default',
      value: processModalState.codexEffort,
      options: codexEffortOptions,
      onChange: (value) => {
        processModalState.codexEffort = value;
        processModalState.codexEffortExplicit = true;
        telemetry('codex-skill-effort-selected', { cardId: processModalState.cardId, codexEffort: value });
      },
    }),
  );
  return controls;
}

function renderFeedback(): HTMLElement {
  const feedback = document.createElement('div');
  feedback.className = 'process-feedback';
  const messages: Array<{ className: string; text: string }> = [];
  if (processModalState.sourceContentMissing) messages.push({ className: 'codex-form-error', text: 'Source card content is unavailable. Add card content before processing it.' });
  if (processModalState.mode === 'pipelines' && processModalState.metadataError) messages.push({ className: 'codex-form-error', text: processModalState.metadataError });
  if (processModalState.skillCatalogError) messages.push({ className: 'codex-form-error', text: processModalState.skillCatalogError });
  if (processModalState.error) messages.push({ className: 'codex-form-error', text: processModalState.error });
  if (processModalState.saveError) messages.push({ className: 'codex-form-error', text: processModalState.saveError });
  for (const message of messages) {
    const line = document.createElement('p');
    line.className = message.className;
    line.setAttribute('role', 'alert');
    line.textContent = message.text;
    feedback.append(line);
  }
  return feedback;
}

function renderActions(): HTMLElement {
  const actions = document.createElement('footer');
  actions.className = 'codex-modal-actions process-actions';
  const selectedName = document.createElement('span');
  selectedName.className = 'skill-selected-name';
  selectedName.textContent = processModalState.mode === 'pipelines'
    ? selectedPipeline()?.name ?? 'Choose a pipeline'
    : selectedSkill()?.name ?? 'Choose a skill';
  actions.append(selectedName);
  if (processModalState.mode === 'pipelines') {
    actions.append(button('Manage pipelines', () => {
      const generation = processLoadGeneration;
      const cardId = processModalState.cardId;
      void openPipelinesModal({
        onLibraryChanged: (result) => {
          if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
          processModalState.pipelines = result.pipelines;
          processModalState.steps = result.steps;
          processModalState.invalidReferences = result.invalidReferences;
          processModalState.issues = result.issues;
          processModalState.selectedPipelineId = result.pipeline?.id ?? processModalState.selectedPipelineId;
          renderCardProcessModal();
        },
      });
    }, 'ghost-button', 'process-manage-pipelines'));
    const pipeline = selectedPipeline();
    if (pipeline) actions.append(button('Edit pipeline', editProcessPipeline, 'ghost-button', 'process-edit-pipeline'));
    const run = button(processModalState.processing ? 'Starting…' : 'Run pipeline', () => { void runSelectedPipeline(); }, 'primary-action', 'process-run');
    run.disabled = !pipeline || !pipelineCanRun(pipeline) || processModalState.processing || processModalState.sourceContentMissing;
    actions.append(run);
  } else {
    const run = button(processModalState.processing ? 'Starting…' : 'Run one skill', () => { void processSelectedCardSkill(); }, 'primary-action', 'process-run');
    run.disabled = !selectedSkill() || processModalState.processing || processModalState.sourceContentMissing;
    actions.append(run);
  }
  actions.append(button('Close', closeCardProcessModal, 'ghost-button', 'process-close'));
  return actions;
}

export function renderCardProcessModal(): void {
  if (!processModal) return;
  const focusKey = (globalThis.document?.activeElement as HTMLElement | null)?.dataset?.codexFocusKey ?? '';
  processModal.setAttribute('tabindex', '-1');
  const head = document.createElement('header');
  head.className = 'codex-modal-head process-modal-head';
  const copy = document.createElement('div');
  const kicker = document.createElement('p');
  kicker.className = 'kicker';
  kicker.textContent = 'Codex processing';
  const title = document.createElement('h2');
  title.id = 'card-process-modal-title';
  title.textContent = 'Process card';
  const subtitle = document.createElement('p');
  subtitle.className = 'codex-modal-subtitle';
  subtitle.textContent = 'Run a reusable step pipeline or process this card with one skill.';
  copy.replaceChildren(kicker, title, subtitle);
  const close = button('×', closeCardProcessModal, 'plain-close', 'process-head-close');
  close.setAttribute('aria-label', 'Close Process card');
  head.replaceChildren(copy, close);
  const controls = renderDirectRunControls();
  processModal.replaceChildren(
    head,
    renderTabs(),
    renderSearch(),
    renderCategoryFilters(),
    ...(controls ? [controls] : []),
    renderFeedback(),
    ...renderProcessPanels(),
    renderActions(),
  );
  if (focusKey) {
    const nextFocus = processModal.querySelector<HTMLElement>(`[data-codex-focus-key="${focusKey}"]`);
    if (nextFocus) nextFocus.focus();
    else processModal.focus();
  }
}

export async function openCardProcessModal(cardId: string, initialMode: ProcessModalMode = 'pipelines'): Promise<void> {
  const normalizedCardId = cardId.trim();
  if (!normalizedCardId) return;
  const generation = ++processLoadGeneration;
  Object.assign(processModalState, {
    cardId: normalizedCardId,
    mode: initialMode,
    query: '',
    selectedCategory: 'All',
    selectedPipelineId: '',
    selectedSkillName: '',
    codexModel: '',
    codexEffort: '',
    codexModelExplicit: false,
    codexEffortExplicit: false,
    pipelines: [],
    steps: [],
    skills: [],
    invalidReferences: [],
    issues: [],
    loadingPipelines: true,
    loadingSkills: true,
    processing: false,
    sourceContentMissing: !hasProcessSourceContent(normalizedCardId),
    metadataError: '',
    skillCatalogError: '',
    error: '',
    saveError: '',
  });
  renderCardProcessModal();
  showProcessModal();
  telemetry('codex-card-process-modal-open', { cardId: normalizedCardId, mode: initialMode });
  const [library, skillCatalog] = await Promise.all([loadCodexPipelines(), loadCodexSkillsResult()]);
  if (generation !== processLoadGeneration || processModalState.cardId !== normalizedCardId) return;
  processModalState.loadingPipelines = false;
  processModalState.loadingSkills = false;
  processModalState.skills = skillCatalog.skills;
  processModalState.skillCatalogError = skillCatalog.ok ? '' : skillCatalog.error || 'Could not load Codex skills.';
  if (library.ok) {
    processModalState.pipelines = library.pipelines;
    processModalState.steps = library.steps;
    processModalState.invalidReferences = library.invalidReferences;
    processModalState.issues = library.issues;
    processModalState.selectedPipelineId = library.pipelines.find(pipelineCanRun)?.id ?? library.pipelines[0]?.id ?? '';
  } else {
    processModalState.metadataError = library.error || 'Could not load saved pipelines.';
  }
  if (skillCatalog.skills.length > 0) selectProcessSkill(skillCatalog.skills[0].name, false);
  renderCardProcessModal();
  processModal?.querySelector<HTMLInputElement>('.process-search')?.focus();
}

export function setCardProcessTab(mode: ProcessModalMode, restoreFocus = false): void {
  processModalState.mode = mode;
  processModalState.query = '';
  processModalState.selectedCategory = 'All';
  processModalState.error = '';
  renderCardProcessModal();
  if (restoreFocus) processModal?.querySelector<HTMLButtonElement>(`#process-tab-${mode}`)?.focus();
}

export function selectProcessPipeline(pipelineId: string): void {
  processModalState.selectedPipelineId = pipelineId;
  processModalState.error = '';
  renderCardProcessModal();
  processModal?.querySelector<HTMLButtonElement>(`[data-process-pipeline-id="${pipelineId}"]`)?.focus();
}

export function selectProcessSkill(skillName: string, rerender = true): void {
  const skill = processModalState.skills.find((entry) => entry.name === skillName);
  if (!skill) return;
  processModalState.selectedSkillName = skill.name;
  processModalState.codexModel = skill.effectiveCodexModel;
  processModalState.codexEffort = skill.effectiveCodexEffort;
  processModalState.codexModelExplicit = false;
  processModalState.codexEffortExplicit = false;
  processModalState.error = '';
  if (rerender) {
    renderCardProcessModal();
    processModal?.querySelector<HTMLButtonElement>(`[data-process-skill-name="${skillName}"]`)?.focus();
  }
  telemetry('codex-skill-selected', { cardId: processModalState.cardId, skillName });
}

export async function runSelectedPipeline(): Promise<boolean> {
  const pipeline = selectedPipeline();
  const ledgerId = String(state.activeTab ?? '').trim();
  if (!pipeline || !ledgerId || processModalState.processing || !pipelineCanRun(pipeline) || processModalState.sourceContentMissing) return false;
  const generation = processLoadGeneration;
  const cardId = processModalState.cardId;
  processModalState.processing = true;
  processModalState.error = '';
  renderCardProcessModal();
  const result = await requestCodexPipelineRun({
    ledgerId,
    sourceCardId: cardId,
    pipelineId: pipeline.id,
  });
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  processModalState.processing = false;
  if (!result.ok) {
    processModalState.error = result.statusCode === 409 && result.activeRunId
      ? `Another pipeline is active (${result.activeRunId}). Finish or cancel it before starting this pipeline.`
      : result.error || 'Could not start this pipeline.';
    renderCardProcessModal();
    return false;
  }
  await refreshRuntimeState();
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  telemetry('codex-pipeline-run-started', { cardId, pipelineId: pipeline.id, runId: result.run?.id ?? '' });
  closeCardProcessModal();
  return true;
}

export async function processSelectedCardSkill(): Promise<boolean> {
  const skill = selectedSkill();
  if (!skill || processModalState.processing || processModalState.sourceContentMissing) return false;
  const generation = processLoadGeneration;
  const cardId = processModalState.cardId;
  const codexModel = processModalState.codexModel;
  const codexEffort = processModalState.codexEffort;
  const codexModelExplicit = processModalState.codexModelExplicit;
  const codexEffortExplicit = processModalState.codexEffortExplicit;
  processModalState.processing = true;
  processModalState.error = '';
  renderCardProcessModal();
  const ok = await processCardSkillController({
    cardId,
    skillName: skill.name,
    codexModel: codexModelExplicit ? codexModel : undefined,
    codexEffort: codexEffortExplicit ? codexEffort : undefined,
  });
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return false;
  processModalState.processing = false;
  if (!ok) {
    processModalState.error = 'Could not start this skill. Check the active run and try again.';
    renderCardProcessModal();
    return false;
  }
  closeCardProcessModal();
  return true;
}

export function editProcessPipeline(): void {
  const pipeline = selectedPipeline();
  const generation = processLoadGeneration;
  const cardId = processModalState.cardId;
  void openPipelineEditor({
    pipeline,
    steps: processModalState.steps,
    ...(processModalState.skillCatalogError ? {} : { skills: processModalState.skills }),
    invalidReferences: pipeline ? pipelineReferences(pipeline.id) : [],
    onSaved: (result) => {
      if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
      processModalState.pipelines = result.pipelines;
      processModalState.steps = result.steps;
      processModalState.invalidReferences = result.invalidReferences;
      processModalState.issues = result.issues;
      processModalState.selectedPipelineId = result.pipeline?.id ?? processModalState.selectedPipelineId;
      processModalState.saveError = '';
      renderCardProcessModal();
    },
    onSaveError: (message) => {
      if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
      processModalState.saveError = `Pipeline save failed: ${message}`;
      renderCardProcessModal();
    },
  });
}

export async function reloadProcessSkills(): Promise<void> {
  const generation = ++processLoadGeneration;
  const cardId = processModalState.cardId;
  processModalState.loadingSkills = true;
  renderCardProcessModal();
  const result = await loadCodexSkillsResult();
  if (generation !== processLoadGeneration || cardId !== processModalState.cardId) return;
  const selectedName = processModalState.selectedSkillName;
  processModalState.skills = result.skills;
  processModalState.skillCatalogError = result.ok ? '' : result.error || 'Could not load Codex skills.';
  processModalState.loadingSkills = false;
  const nextSelection = result.skills.find((skill) => skill.name === selectedName) ?? result.skills[0];
  if (nextSelection) selectProcessSkill(nextSelection.name, false);
  renderCardProcessModal();
}

export function closeCardProcessModal(): void {
  processLoadGeneration += 1;
  processModal?.close?.();
}
