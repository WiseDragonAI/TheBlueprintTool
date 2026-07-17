/**
 * WHAT: Focused integration coverage for reusable pipeline and skill-library modal state.
 * WHY: Ordering, inheritance, default refresh, and conflict behavior must survive renderer refactors.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state } from '../../src/runtime/state.js';

const root = new URL('../../../', import.meta.url);
const timestamp = '2026-07-10T00:00:00.000Z';

type FakeListener = (event: Record<string, unknown>) => void;

class FakeStyle {
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string): void { this.values.set(name, value); }
  removeProperty(name: string): void { this.values.delete(name); }
}

class FakeElement {
  readonly tagName: string;
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, FakeListener[]>();
  readonly style = new FakeStyle();
  parentElement: FakeElement | null = null;
  className = '';
  id = '';
  value = '';
  type = '';
  placeholder = '';
  title = '';
  ariaLabel = '';
  tabIndex = 0;
  disabled = false;
  hidden = false;
  open = false;
  draggable = false;
  readOnly = false;
  spellcheck = true;
  autocomplete = '';
  private ownText = '';

  constructor(tagName: string) { this.tagName = tagName.toLowerCase(); }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.ownText = String(value ?? '');
    this.children.splice(0).forEach((child) => { child.parentElement = null; });
  }

  get lastElementChild(): FakeElement | null { return this.children.at(-1) ?? null; }

  append(...nodes: Array<FakeElement | string>): void {
    for (const node of nodes) {
      const child = typeof node === 'string' ? Object.assign(new FakeElement('#text'), { textContent: node }) : node;
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children.splice(0).forEach((child) => { child.parentElement = null; });
    this.ownText = '';
    this.append(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
    if (name === 'aria-label') this.ariaLabel = String(value);
    if (name === 'tabindex') this.tabIndex = Number(value);
    if (name.startsWith('data-')) this.dataset[dataKey(name.slice(5))] = String(value);
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    if (name === 'aria-label') return this.ariaLabel || null;
    if (name.startsWith('data-')) return this.dataset[dataKey(name.slice(5))] ?? null;
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: FakeListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  trigger(type: string, input: Record<string, unknown> = {}): void {
    const event = { target: this, currentTarget: this, preventDefault() {}, ...input };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  focus(): void { fakeDocument.activeElement = this; }
  showModal(): void { this.open = true; }
  close(): void { this.open = false; }
  contains(node: unknown): boolean { return node === this || this.children.some((child) => child.contains(node)); }
  querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector: string): FakeElement[] {
    let scope: FakeElement[] = [this];
    for (const part of selector.trim().split(/\s+/)) {
      scope = scope.flatMap((rootElement) => descendants(rootElement).filter((element) => matches(element, part)));
    }
    return scope;
  }
}

function dataKey(value: string): string {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function descendants(rootElement: FakeElement): FakeElement[] {
  return rootElement.children.flatMap((child) => [child, ...descendants(child)]);
}

function matches(element: FakeElement, selector: string): boolean {
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  if (selector.startsWith('.')) return selector.slice(1).split('.').every((className) => element.className.split(/\s+/).includes(className));
  const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attribute) {
    const value = element.getAttribute(attribute[1]);
    return attribute[2] === undefined ? value !== null : value === attribute[2];
  }
  return element.tagName === selector.toLowerCase();
}

class FakeDocument {
  readonly processModal = new FakeElement('dialog');
  readonly pipelinesModal = new FakeElement('dialog');
  readonly pipelineEditorModal = new FakeElement('dialog');
  readonly pipelineSkillPickerModal = new FakeElement('dialog');
  readonly skillLibraryEditorModal = new FakeElement('dialog');
  activeElement: FakeElement | null = null;

  createElement(tagName: string): FakeElement { return new FakeElement(tagName); }
  querySelector(selector: string): FakeElement | null {
    const hosts: Record<string, FakeElement> = {
      '.process-modal': this.processModal,
      '.skill-modal': this.processModal,
      '.pipelines-modal': this.pipelinesModal,
      '.pipeline-editor-modal': this.pipelineEditorModal,
      '.pipeline-skill-picker-modal': this.pipelineSkillPickerModal,
      '.skill-library-editor-modal': this.skillLibraryEditorModal,
    };
    return hosts[selector] ?? null;
  }
}

const fakeDocument = new FakeDocument();
const assignedLocations: string[] = [];

(globalThis as unknown as { window: unknown }).window = {
  __coreTelemetry: [],
  dispatchEvent() {},
  location: {
    assign(path: string) { assignedLocations.push(path); },
  },
};
(globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class CustomEvent {
  constructor(_name: string, public detail: unknown = undefined) {}
};
(globalThis as unknown as { document: unknown }).document = fakeDocument;
(globalThis as unknown as { CSS: unknown }).CSS = { escape: (value: string) => value };

const pipelineEditorModule = await import('../../src/runtime/codex/effect/render-pipeline-editor-modal.js');
const {
  buildPipelineSaveRequest,
  moveStepSkill,
  openPipelineEditor,
  pipelineEditorState,
  removePipelineStep,
  savePipelineDraft,
} = pipelineEditorModule;
const {
  closePipelineSkillPicker,
  openPipelineSkillPicker,
  pipelineSkillPickerState,
} = await import('../../src/runtime/codex/effect/render-pipeline-skill-picker-modal.js');
const processModalModule = await import('../../src/runtime/codex/effect/render-card-process-modal.js');
const {
  hasProcessSourceContent,
  openCardProcessModal,
  processModalState,
  processSelectedCardSkill,
  renderCardProcessModal,
  runSelectedPipeline,
  selectProcessSkill,
  setCardProcessTab,
} = processModalModule;
const {
  openSkillLibraryEditor,
  renderSkillLibraryEditorModal,
  saveSkillLibraryDraft,
  saveSkillLibraryTag,
  skillLibraryEditorState,
} = await import('../../src/runtime/codex/effect/render-skill-library-editor-modal.js');
const {
  pipelineLibraryState,
  renderPipelinesModal,
  togglePipelineExpanded,
} = await import('../../src/runtime/codex/effect/render-pipelines-modal.js');

function source(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

function findByText(rootElement: FakeElement, text: string): FakeElement[] {
  return [rootElement, ...descendants(rootElement)].filter((element) => element.textContent.trim() === text);
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const catalog = [
  {
    name: 'analysis', description: 'Analyze evidence.', source: 'workspace' as const, editable: true, readOnlyReason: null,
    revision: 'analysis-a', defaultCodexModel: 'gpt-5.5' as const, defaultCodexEffort: 'high' as const,
    effectiveCodexModel: 'gpt-5.5', effectiveCodexEffort: 'high'
  },
  {
    name: 'executor-implement', description: 'Implement the plan.', source: 'system' as const, editable: false,
    readOnlyReason: 'System skills are managed by Codex.', revision: 'executor-a', defaultCodexModel: null,
    defaultCodexEffort: null, effectiveCodexModel: 'gpt-5.4', effectiveCodexEffort: 'xhigh'
  },
  {
    name: 'ui-audit', description: 'Audit the result.', source: 'plugin' as const, editable: false,
    readOnlyReason: 'Plugin skills are read-only.', revision: 'audit-a', defaultCodexModel: null,
    defaultCodexEffort: null, effectiveCodexModel: 'gpt-5.3-codex', effectiveCodexEffort: 'medium'
  }
];

const steps = [
  {
    id: 'step-analyze', name: 'Analyze', purpose: 'Read the source.', createdAt: timestamp, updatedAt: timestamp,
    skills: [
      { id: 'skill-analysis', skillName: 'analysis', codexModel: null, codexEffort: null },
      { id: 'skill-audit', skillName: 'ui-audit', codexModel: 'gpt-5.3-codex' as const, codexEffort: 'medium' as const }
    ]
  },
  {
    id: 'step-build', name: 'Build', purpose: 'Implement the result.', createdAt: timestamp, updatedAt: timestamp,
    skills: [{ id: 'skill-build', skillName: 'executor-implement', codexModel: 'gpt-5.4' as const, codexEffort: 'xhigh' as const }]
  }
];

const pipeline = {
  id: 'pipeline-delivery', name: 'Delivery', purpose: 'Analyze then build.',
  stepIds: ['step-analyze', 'step-build'], createdAt: timestamp, updatedAt: timestamp
};

test('dedicated pipeline skill picker keeps a large catalog in intrinsic non-shrinking rows', () => {
  const largeCatalog = Array.from({ length: 30 }, (_value, index) => ({
    ...catalog[0],
    name: `analysis-${String(index + 1).padStart(2, '0')}`,
    description: `Analyze evidence for catalog entry ${index + 1} without overlapping the adjacent skill row.`,
    revision: `analysis-${index + 1}`,
  }));
  openPipelineSkillPicker({
    stepId: 'step-analyze',
    stepName: 'Analyze',
    stepSkillNames: [],
    skills: largeCatalog,
    onInsert: () => {},
  });

  const results = fakeDocument.pipelineSkillPickerModal.querySelector('.pipeline-skill-picker-results');
  assert.ok(results);
  assert.equal(results.children.length, largeCatalog.length);
  assert.equal(results.children.every((row) => (
    row.className.includes('pipeline-picker-result')
    && row.children[0]?.className.includes('skill-result-name')
    && Boolean(row.querySelector('.skill-result-description'))
    && Boolean(row.querySelector('.codex-list-labels'))
    && Boolean(row.querySelector('.process-result-metadata'))
  )), true);

  const dialogsCss = source('frontend/assets/canvas/dialogs.css');
  assert.match(dialogsCss, /\.pipeline-picker-results\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*height:\s*100%;[^}]*max-height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s);
  assert.match(dialogsCss, /\.pipeline-picker-result\s*\{[^}]*display:\s*flex;[^}]*flex:\s*0 0 auto;[^}]*flex-direction:\s*column;[^}]*height:\s*auto;[^}]*min-height:\s*auto;[^}]*overflow:\s*visible;/s);
  closePipelineSkillPicker();
});

test('pipeline editor preserves step and skill order, insertion position, and null inheritance', async () => {
  await openPipelineEditor({ pipeline, steps, skills: catalog });
  assert.equal(fakeDocument.pipelineEditorModal.open, true);
  assert.match(fakeDocument.pipelineEditorModal.textContent, /Use skill default/);
  assert.match(fakeDocument.pipelineEditorModal.textContent, /Current default: gpt-5\.5/);
  const iconButtons = descendants(fakeDocument.pipelineEditorModal).filter((element) => element.tagName === 'button' && ['↑', '↓', '−'].includes(element.textContent));
  assert.ok(iconButtons.length > 0);
  assert.equal(iconButtons.every((element) => Boolean(element.getAttribute('aria-label'))), true);
  assert.deepEqual(pipelineEditorState.steps.map((step) => step.id), ['step-analyze', 'step-build']);
  const moveAnalyzeDown = fakeDocument.pipelineEditorModal.querySelector('[data-codex-focus-key="step-down:step-analyze"]');
  assert.ok(moveAnalyzeDown);
  moveAnalyzeDown.focus();
  moveAnalyzeDown.trigger('click');
  assert.deepEqual(pipelineEditorState.steps.map((step) => step.id), ['step-build', 'step-analyze']);
  assert.equal(fakeDocument.activeElement?.dataset.codexFocusKey, 'step-down:step-analyze');
  moveStepSkill('step-analyze', 'skill-audit', -1);
  assert.deepEqual(pipelineEditorState.steps[1].skills.map((skill) => skill.id), ['skill-audit', 'skill-analysis']);
  pipelineEditorState.openStepId = 'step-analyze';
  const addSkill = findByText(fakeDocument.pipelineEditorModal, 'Add skill');
  assert.equal(addSkill.length, 1);
  assert.equal(fakeDocument.pipelineEditorModal.querySelector('.pipeline-skill-picker'), null);
  addSkill[0].trigger('click');
  assert.equal(fakeDocument.pipelineSkillPickerModal.open, true);
  assert.match(fakeDocument.pipelineSkillPickerModal.textContent, /Add skill to Analyze/);
  assert.match(fakeDocument.pipelineSkillPickerModal.textContent, /Implement the plan\./);
  const executor = fakeDocument.pipelineSkillPickerModal.querySelector('[data-codex-focus-key="picker-skill:executor-implement"]');
  assert.ok(executor);
  executor.trigger('click');
  assert.equal(pipelineSkillPickerState.selectedSkillName, 'executor-implement');
  const position = fakeDocument.pipelineSkillPickerModal.querySelector('select');
  assert.ok(position);
  position.value = '1';
  position.trigger('change');
  const confirmAdd = findByText(fakeDocument.pipelineSkillPickerModal, 'Add skill');
  assert.equal(confirmAdd.length, 1);
  confirmAdd[0].trigger('click');
  assert.equal(fakeDocument.pipelineSkillPickerModal.open, false);
  assert.deepEqual(pipelineEditorState.steps[1].skills.map((skill) => skill.skillName), ['ui-audit', 'executor-implement', 'analysis']);
  assert.equal(pipelineEditorState.steps[1].skills[1].codexModel, null);
  assert.equal(pipelineEditorState.steps[1].skills[1].codexEffort, null);

  const request = buildPipelineSaveRequest();
  assert.equal(request.operation, 'update');
  assert.equal(request.pipelineId, 'pipeline-delivery');
  assert.deepEqual(request.pipeline.stepIds, ['step-build', 'step-analyze']);
  assert.deepEqual(request.steps[1].skills.map((skill) => skill.skillName), ['ui-audit', 'executor-implement', 'analysis']);
  assert.deepEqual(request.steps[1].skills[1], {
    id: request.steps[1].skills[1].id,
    skillName: 'executor-implement',
    codexModel: null,
    codexEffort: null
  });
  assert.equal(request.steps[1].skills[0].codexModel, 'gpt-5.3-codex');
  removePipelineStep('step-build');
  assert.deepEqual(pipelineEditorState.steps.map((step) => step.id), ['step-analyze']);
  assert.match(pipelineEditorState.notice, /reusable step record remains available/);
});

test('pipeline editor save submits exact inherited and explicit values and applies server warnings', async () => {
  const previousFetch = globalThis.fetch;
  try {
    await openPipelineEditor({ pipeline, steps, skills: catalog });
    let saved = 0;
    pipelineEditorState.onSaved = () => { saved += 1; };
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/pipelines/pipeline-delivery');
      assert.equal(init?.method, 'PUT');
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.pipeline.stepIds, ['step-analyze', 'step-build']);
      assert.deepEqual(body.steps[0].skills[0], { id: 'skill-analysis', skillName: 'analysis', codexModel: null, codexEffort: null });
      assert.deepEqual(body.steps[0].skills[1], { id: 'skill-audit', skillName: 'ui-audit', codexModel: 'gpt-5.3-codex', codexEffort: 'medium' });
      return new Response(JSON.stringify({
        ok: true,
        pipeline,
        pipelines: [pipeline],
        steps,
        hasInvalidReferences: true,
        invalidReferences: [{ kind: 'skill', reference: 'missing-skill', pipelineId: pipeline.id, stepId: 'step-analyze' }],
        issues: []
      }), { status: 200 });
    }) as typeof fetch;
    assert.equal(await savePipelineDraft(), true);
    assert.equal(saved, 1);
    assert.equal(pipelineEditorState.warnings.length, 1);
    assert.equal(pipelineEditorState.notice, 'Pipeline saved with reference warnings.');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Process card derives source content, reloads skill defaults on reopen, and surfaces launch failures', async () => {
  const previousFetch = globalThis.fetch;
  const previousLedger = state.activeLedger;
  const previousTab = state.activeTab;
  let catalogVersion = 0;
  try {
    state.activeTab = 'specs';
    state.activeLedger = { cards: [{ id: 'card-source', comment: { what: 'Source content' } }] };
    assert.equal(hasProcessSourceContent('card-source'), true);
    state.activeLedger.cards[0].comment.what = '   ';
    assert.equal(hasProcessSourceContent('card-source'), false);
    state.activeLedger.cards[0].comment.what = 'Source content';
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (url === '/api/codex/pipelines') {
        return new Response(JSON.stringify({ ok: true, pipelines: [pipeline], steps, invalidReferences: [], issues: [] }), { status: 200 });
      }
      if (url === '/api/codex/skills') {
        catalogVersion += 1;
        const skills = catalog.map((skill, index) => index === 0
          ? { ...skill, effectiveCodexModel: catalogVersion === 1 ? 'gpt-5.5' : 'gpt-5.6-sol', effectiveCodexEffort: catalogVersion === 1 ? 'high' : 'ultra' }
          : skill);
        return new Response(JSON.stringify({ ok: true, skills }), { status: 200 });
      }
      assert.equal(url, '/api/codex/pipelines/runs');
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ ok: false, error: 'Another run is active.', activeRunId: 'run-active', invalidReferences: [] }), { status: 409 });
    }) as typeof fetch;

    await openCardProcessModal('card-source', 'skills');
    assert.equal(fakeDocument.processModal.open, true);
    assert.match(fakeDocument.processModal.textContent, /Process card/);
    assert.match(fakeDocument.processModal.textContent, /System skills are managed by Codex\./);
    const tabList = fakeDocument.processModal.querySelector('.process-mode-tabs');
    assert.equal(tabList?.getAttribute('role'), 'tablist');
    assert.equal(fakeDocument.processModal.querySelectorAll('.process-mode-tab').length, 2);
    const skillsPanel = fakeDocument.processModal.querySelector('#process-panel-skills');
    assert.equal(skillsPanel?.getAttribute('role'), 'tabpanel');
    assert.equal(skillsPanel?.getAttribute('aria-labelledby'), 'process-tab-skills');
    const pipelinesPanel = fakeDocument.processModal.querySelector('#process-panel-pipelines');
    assert.equal(pipelinesPanel?.hidden, true);
    assert.equal(pipelinesPanel?.getAttribute('aria-labelledby'), 'process-tab-pipelines');
    assert.equal(processModalState.mode, 'skills');
    assert.equal(processModalState.codexModel, 'gpt-5.5');
    assert.equal(processModalState.codexEffort, 'high');
    const directSelects = fakeDocument.processModal.querySelectorAll('.process-run-controls select');
    assert.equal(directSelects.length, 2);
    directSelects[0].value = 'gpt-5.6-terra';
    directSelects[0].trigger('change');
    assert.equal(processModalState.codexModelExplicit, true);
    assert.match(fakeDocument.processModal.textContent, /One-run override/);
    const skillsTab = fakeDocument.processModal.querySelector('#process-tab-skills');
    skillsTab?.trigger('keydown', { key: 'ArrowLeft' });
    assert.equal(processModalState.mode, 'pipelines');
    assert.equal(fakeDocument.activeElement?.id, 'process-tab-pipelines');
    setCardProcessTab('skills');
    const pipelineTab = fakeDocument.processModal.querySelector('#process-tab-pipelines');
    pipelineTab?.trigger('click');
    assert.equal(processModalState.mode, 'pipelines');
    assert.equal(fakeDocument.activeElement?.id, 'process-tab-pipelines');
    await openCardProcessModal('card-source', 'skills');
    assert.equal(processModalState.codexModel, 'gpt-5.6-sol');
    assert.equal(processModalState.codexEffort, 'ultra');
    setCardProcessTab('pipelines');
    assert.equal(await runSelectedPipeline(), false);
    assert.equal(processModalState.error, 'Another run is active.');
  } finally {
    globalThis.fetch = previousFetch;
    state.activeLedger = previousLedger;
    state.activeTab = previousTab;
  }
});

test('Pipelines library renders loading, empty, error, and ordered expanded-step states', () => {
  Object.assign(pipelineLibraryState, { pipelines: [], steps: [], invalidReferences: [], issues: [], expandedPipelineId: '', loading: true, error: '' });
  renderPipelinesModal();
  assert.match(fakeDocument.pipelinesModal.textContent, /Loading saved pipelines/);
  Object.assign(pipelineLibraryState, { loading: false, error: 'Library unavailable.' });
  renderPipelinesModal();
  assert.match(fakeDocument.pipelinesModal.textContent, /Library unavailable\./);
  Object.assign(pipelineLibraryState, { error: '', pipelines: [] });
  renderPipelinesModal();
  assert.match(fakeDocument.pipelinesModal.textContent, /No saved pipelines yet\./);
  Object.assign(pipelineLibraryState, { pipelines: [pipeline], steps, expandedPipelineId: '' });
  renderPipelinesModal();
  const expand = fakeDocument.pipelinesModal.querySelector('[data-codex-focus-key="pipeline-expand:pipeline-delivery"]');
  assert.ok(expand);
  expand.trigger('click');
  assert.equal(pipelineLibraryState.expandedPipelineId, 'pipeline-delivery');
  assert.match(fakeDocument.pipelinesModal.textContent, /1\. Analyze/);
  assert.match(fakeDocument.pipelinesModal.textContent, /analysis · ui-audit/);
  assert.match(fakeDocument.pipelinesModal.textContent, /2\. Build/);
});

test('Manage Pipelines propagates saved definitions back into the underlying Process card flow', async () => {
  const previousFetch = globalThis.fetch;
  try {
    Object.assign(processModalState, {
      mode: 'pipelines',
      pipelines: [pipeline],
      steps,
      skills: catalog,
      invalidReferences: [],
      issues: [],
      selectedPipelineId: pipeline.id,
      loadingPipelines: false,
      loadingSkills: false,
      sourceContentMissing: false,
      metadataError: '',
      skillCatalogError: '',
      error: '',
      saveError: ''
    });
    renderCardProcessModal();
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, pipelines: [pipeline], steps, invalidReferences: [], issues: [] }), { status: 200 })) as typeof fetch;
    const manage = findByText(fakeDocument.processModal, 'Manage pipelines');
    assert.equal(manage.length, 1);
    manage[0].trigger('click');
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    assert.equal(typeof pipelineLibraryState.onLibraryChanged, 'function');
    const nextPipeline = { ...pipeline, id: 'pipeline-next', name: 'Next pipeline' };
    await pipelineLibraryState.onLibraryChanged?.({
      ok: true,
      statusCode: 201,
      pipeline: nextPipeline,
      pipelines: [pipeline, nextPipeline],
      steps,
      hasInvalidReferences: false,
      invalidReferences: [],
      issues: []
    });
    assert.equal(processModalState.selectedPipelineId, 'pipeline-next');
    assert.equal(processModalState.pipelines.length, 2);
    assert.match(fakeDocument.processModal.textContent, /Next pipeline/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('direct skill defaults remain inherited until the operator sets a one-run override', async () => {
  const previousFetch = globalThis.fetch;
  const previousTab = state.activeTab;
  const bodies: Array<Record<string, unknown>> = [];
  try {
    state.activeTab = 'specs';
    Object.assign(processModalState, {
      cardId: 'card-source',
      skills: catalog,
      selectedSkillName: '',
      sourceContentMissing: false,
      processing: false,
      error: ''
    });
    selectProcessSkill('analysis', false);
    assert.equal(processModalState.codexModelExplicit, false);
    assert.equal(processModalState.codexEffortExplicit, false);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skills/process');
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: false, error: 'Fixture stop.' }), { status: 400 });
    }) as typeof fetch;
    assert.equal(await processSelectedCardSkill(), false);
    assert.equal('codexModel' in bodies[0], false);
    assert.equal('codexEffort' in bodies[0], false);

    processModalState.codexModel = 'gpt-5.6-sol';
    processModalState.codexModelExplicit = true;
    processModalState.codexEffortExplicit = false;
    assert.equal(await processSelectedCardSkill(), false);
    assert.equal(bodies[1].codexModel, 'gpt-5.6-sol');
    assert.equal('codexEffort' in bodies[1], false);
  } finally {
    globalThis.fetch = previousFetch;
    state.activeTab = previousTab;
  }
});

test('successful direct skill launches return to the canonical Control Room Exec route', async () => {
  const previousFetch = globalThis.fetch;
  const previousTab = state.activeTab;
  try {
    state.activeTab = 'specs';
    Object.assign(processModalState, {
      cardId: 'card-source',
      skills: catalog,
      selectedSkillName: 'analysis',
      sourceContentMissing: false,
      processing: false,
      error: '',
      codexModelExplicit: false,
      codexEffortExplicit: false,
    });
    fakeDocument.processModal.open = true;
    assignedLocations.length = 0;
    globalThis.fetch = (async (url: string) => {
      assert.equal(url, '/api/codex/skills/process');
      return new Response(JSON.stringify({ ok: true, run: { id: 'run-direct' } }), { status: 202 });
    }) as typeof fetch;

    assert.equal(await processSelectedCardSkill(), true);
    assert.equal(fakeDocument.processModal.open, false);
    assert.deepEqual(assignedLocations, ['/?tab=exec']);
  } finally {
    globalThis.fetch = previousFetch;
    state.activeTab = previousTab;
  }
});

test('skill-catalog failures render actionable errors instead of empty or invalid pipeline states', async () => {
  const previousFetch = globalThis.fetch;
  const previousLedger = state.activeLedger;
  try {
    state.activeLedger = { cards: [{ id: 'card-source', comment: { what: 'Source content' } }] };
    globalThis.fetch = (async (url: string) => {
      if (url === '/api/codex/pipelines') {
        return new Response(JSON.stringify({ ok: true, pipelines: [pipeline], steps, invalidReferences: [], issues: [] }), { status: 200 });
      }
      assert.equal(url, '/api/codex/skills');
      return new Response(JSON.stringify({ ok: false, error: 'Skill catalog unavailable.' }), { status: 503 });
    }) as typeof fetch;
    await openCardProcessModal('card-source');
    assert.equal(processModalState.skillCatalogError, 'Skill catalog unavailable.');
    assert.match(fakeDocument.processModal.textContent, /Skill catalog unavailable\./);
    const runButtons = findByText(fakeDocument.processModal, 'Run pipeline');
    assert.equal(runButtons.length, 1);
    assert.equal(runButtons[0].disabled, true);

    await openPipelineEditor({ pipeline, steps });
    assert.equal(pipelineEditorState.skillCatalogError, 'Skill catalog unavailable.');
    assert.match(fakeDocument.pipelineEditorModal.textContent, /Skill catalog unavailable\./);
    assert.equal(findByText(fakeDocument.pipelineEditorModal, 'Retry skill catalog').length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    state.activeLedger = previousLedger;
  }
});

test('late run and save responses cannot overwrite a newly opened modal session', async () => {
  const previousFetch = globalThis.fetch;
  const previousLedger = state.activeLedger;
  const previousTab = state.activeTab;
  try {
    state.activeTab = 'specs';
    state.activeLedger = {
      cards: [
        { id: 'card-a', comment: { what: 'Card A' } },
        { id: 'card-b', comment: { what: 'Card B' } },
      ],
    };
    Object.assign(processModalState, {
      cardId: 'card-a',
      pipelines: [pipeline],
      steps,
      skills: catalog,
      invalidReferences: [],
      selectedPipelineId: pipeline.id,
      sourceContentMissing: false,
      processing: false,
      error: ''
    });
    const runResponse = deferred<Response>();
    globalThis.fetch = (async (url: string) => {
      if (url === '/api/codex/pipelines/runs') return runResponse.promise;
      if (url === '/api/codex/pipelines') return new Response(JSON.stringify({ ok: true, pipelines: [pipeline], steps, invalidReferences: [], issues: [] }), { status: 200 });
      if (url === '/api/codex/skills') return new Response(JSON.stringify({ ok: true, skills: catalog }), { status: 200 });
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;
    const pendingRun = runSelectedPipeline();
    await openCardProcessModal('card-b');
    runResponse.resolve(new Response(JSON.stringify({ ok: false, error: 'Old run failed.', activeRunId: 'old-run' }), { status: 409 }));
    assert.equal(await pendingRun, false);
    assert.equal(processModalState.cardId, 'card-b');
    assert.equal(processModalState.error, '');

    await openPipelineEditor({ pipeline, steps, skills: catalog });
    const pipelineSaveResponse = deferred<Response>();
    globalThis.fetch = (async () => pipelineSaveResponse.promise) as typeof fetch;
    const pendingPipelineSave = savePipelineDraft();
    const pipelineB = { ...pipeline, id: 'pipeline-b', name: 'Pipeline B' };
    await openPipelineEditor({ pipeline: pipelineB, steps, skills: catalog });
    pipelineSaveResponse.resolve(new Response(JSON.stringify({ ok: true, pipeline, pipelines: [pipeline], steps, invalidReferences: [], issues: [] }), { status: 200 }));
    assert.equal(await pendingPipelineSave, false);
    assert.equal(pipelineEditorState.pipelineId, 'pipeline-b');
    assert.equal(pipelineEditorState.name, 'Pipeline B');

    const analysisDetail = { ...catalog[0], markdown: 'analysis body' };
    const executorDetail = { ...catalog[1], markdown: 'executor body' };
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, skill: analysisDetail }), { status: 200 })) as typeof fetch;
    await openSkillLibraryEditor({ skillName: 'analysis' });
    const skillSaveResponse = deferred<Response>();
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return skillSaveResponse.promise;
      assert.equal(url, '/api/codex/skill-library/executor-implement');
      return new Response(JSON.stringify({ ok: true, skill: executorDetail }), { status: 200 });
    }) as typeof fetch;
    const pendingSkillSave = saveSkillLibraryDraft();
    await openSkillLibraryEditor({ skillName: 'executor-implement' });
    skillSaveResponse.resolve(new Response(JSON.stringify({ ok: true, skill: { ...analysisDetail, revision: 'analysis-new' } }), { status: 200 }));
    assert.equal(await pendingSkillSave, false);
    assert.equal(skillLibraryEditorState.skillName, 'executor-implement');
    assert.equal(skillLibraryEditorState.detail?.revision, 'executor-a');
  } finally {
    globalThis.fetch = previousFetch;
    state.activeLedger = previousLedger;
    state.activeTab = previousTab;
  }
});

test('skill editor retains a conflicting draft and protected skills remain unsaveable', async () => {
  const previousFetch = globalThis.fetch;
  const editableDetail = { ...catalog[0], markdown: '---\nname: analysis\ndescription: Analyze evidence.\n---\n' };
  let saveRequestCount = 0;
  let savedCallbackCount = 0;
  try {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      assert.equal(url, '/api/codex/skill-library/analysis');
      if (!init) return new Response(JSON.stringify({ ok: true, skill: editableDetail }), { status: 200 });
      assert.equal(init.method, 'PUT');
      saveRequestCount += 1;
      if (saveRequestCount === 1) {
        return new Response(JSON.stringify({ ok: false, error: 'Conflict.', currentRevision: 'analysis-b' }), { status: 409 });
      }
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ ok: true, skill: { ...editableDetail, ...body, revision: 'analysis-b' } }), { status: 200 });
    }) as typeof fetch;
    await openSkillLibraryEditor({ skillName: 'analysis', onSaved: () => { savedCallbackCount += 1; } });
    skillLibraryEditorState.markdown = `${editableDetail.markdown}\nChanged locally.`;
    assert.equal(await saveSkillLibraryDraft(), false);
    assert.match(skillLibraryEditorState.error, /changed after it was opened/i);
    assert.match(skillLibraryEditorState.markdown, /Changed locally/);
    assert.equal(await saveSkillLibraryDraft(), true);
    assert.equal(skillLibraryEditorState.detail?.revision, 'analysis-b');
    assert.equal(skillLibraryEditorState.notice, 'Skill saved. Inherited run settings have been refreshed.');
    assert.equal(savedCallbackCount, 1);

    Object.assign(skillLibraryEditorState, {
      skillName: 'executor-implement',
      detail: { ...catalog[1], markdown: 'protected' },
      markdown: 'protected'
    });
    renderSkillLibraryEditorModal();
    assert.match(fakeDocument.skillLibraryEditorModal.textContent, /System skills are managed by Codex\./);
    const saveButtons = findByText(fakeDocument.skillLibraryEditorModal, 'Save skill');
    assert.equal(saveButtons.length, 1);
    assert.equal(saveButtons[0].disabled, true);
    assert.equal(await saveSkillLibraryDraft(), false);
    assert.equal(skillLibraryEditorState.detail?.readOnlyReason, 'System skills are managed by Codex.');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('skill tag buttons save one value immediately and roll back a rejected optimistic update', async () => {
  const previousFetch = globalThis.fetch;
  const detail = { ...catalog[0], markdown: 'skill', tags: [] };
  const firstSave = deferred<Response>();
  let saveCount = 0;
  try {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (!init) return new Response(JSON.stringify({ ok: true, skill: detail, availableTags: ['Research', 'Interface'] }), { status: 200 });
      saveCount += 1;
      assert.deepEqual(JSON.parse(String(init.body)), { tags: [saveCount === 1 ? 'Research' : 'Interface'] });
      if (saveCount === 1) return firstSave.promise;
      return new Response(JSON.stringify({ ok: false, error: 'Rejected tag.' }), { status: 403 });
    }) as typeof fetch;
    await openSkillLibraryEditor({ skillName: 'analysis' });
    const pending = saveSkillLibraryTag('Research');
    assert.deepEqual(skillLibraryEditorState.detail?.tags, ['Research']);
    assert.equal(skillLibraryEditorState.tagsSaving, true);
    assert.equal(findByText(fakeDocument.skillLibraryEditorModal, 'Save tags').length, 0);
    assert.equal(findByText(fakeDocument.skillLibraryEditorModal, 'Research')[0].getAttribute('aria-pressed'), 'true');
    firstSave.resolve(new Response(JSON.stringify({ ok: true, skill: { ...detail, tags: ['Research'] } }), { status: 200 }));
    assert.equal(await pending, true);
    assert.deepEqual(skillLibraryEditorState.detail?.tags, ['Research']);

    assert.equal(await saveSkillLibraryTag('Interface'), false);
    assert.deepEqual(skillLibraryEditorState.detail?.tags, ['Research']);
    assert.equal(skillLibraryEditorState.error, 'Rejected tag.');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('modal sources retain loading, empty, read-only, and inherited-value states', () => {
  const process = source('frontend/src/runtime/codex/effect/render-card-process-modal.ts');
  const library = source('frontend/src/runtime/codex/effect/render-pipelines-modal.ts');
  const editor = source('frontend/src/runtime/codex/effect/render-pipeline-editor-modal.ts');
  assert.match(process, /Loading \$\{processModalState\.mode\}/);
  assert.match(process, /No saved pipelines yet\./);
  assert.match(process, /Source card content is unavailable/);
  assert.match(process, /skill\.readOnlyReason \|\| 'Read-only skill'/);
  assert.match(library, /pipeline\.stepIds\.forEach/);
  assert.match(library, /No saved pipelines yet\./);
  assert.match(library, /Could not load saved pipelines\./);
  assert.match(editor, /Current default: \$\{input\.effectiveValue\}/);
  assert.match(editor, /Use skill default/);
});

test('desktop skill and pipeline modals expose manual federation synchronization states', () => {
  const process = source('frontend/src/runtime/codex/effect/render-card-process-modal.ts');
  const library = source('frontend/src/runtime/codex/effect/render-pipelines-modal.ts');
  assert.match(process, /process-resynchronize/);
  assert.match(process, /requestFederatedLibrarySynchronization\(\)/);
  assert.match(process, /Synchronizing skills, then pipelines…/);
  assert.match(library, /pipeline-library-resynchronize/);
  assert.match(library, /requestFederatedLibrarySynchronization\(\)/);
  assert.match(library, /synchronizationMessage/);
});
