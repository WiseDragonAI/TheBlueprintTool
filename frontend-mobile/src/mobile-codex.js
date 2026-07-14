const modelOptions = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'];
const effortOptions = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const state = { projectId: '', projects: [], ledgerId: '', cardId: '', skills: [], availableTags: [], tagSaving: false, pipelines: [], steps: [], processTab: 'skills', libraryScope: 'project', query: '', projectFilter: 'All', tagFilter: 'All', selected: null, editor: null, pickerStepId: '' };
const el = (selector) => document.querySelector(selector);
const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const message = (selector, text, bad = false) => { const node = el(selector); node.textContent = text; node.classList.toggle('error', bad); };
const setBusy = (node, busy) => { node.disabled = busy; if (busy) node.setAttribute('aria-busy', 'true'); else node.removeAttribute('aria-busy'); };
async function jsonRequest(url, options, projectId = state.projectId) {
  const response = await fetch(projectScopedRequestPath(url, projectId), options).catch(() => null);
  if (!response) throw new Error('Request failed.');
  const body = await response.json().catch(() => null);
  if (!body) throw new Error('The server returned an invalid response.');
  if (!response.ok || body.ok === false) throw Object.assign(new Error(body.error || `Request failed (${response.status}).`), { body });
  return body;
}
async function loadLibraries(projectId = state.projectId) {
  const [skills, pipelines] = await Promise.all([
    jsonRequest('/api/codex/skills', undefined, projectId),
    jsonRequest('/api/codex/pipelines', undefined, projectId)
  ]);
  const project = state.projects.find((entry) => entry.id === projectId);
  state.skills = (Array.isArray(skills.skills) ? skills.skills : []).map((skill) => ({ ...skill, projects: project ? [project] : [] }));
  state.availableTags = Array.isArray(skills.availableTags) && skills.availableTags.length ? skills.availableTags : [...skillCategories];
  state.pipelines = (Array.isArray(pipelines.pipelines) ? pipelines.pipelines : []).map((pipeline) => ({ ...pipeline, projectId, projectName: project?.name || '', projectColor: project?.color || '#20242b' }));
  state.steps = (Array.isArray(pipelines.steps) ? pipelines.steps : []).map((step) => ({ ...step, projectId }));
  return pipelines;
}
function skillTags(skill) { return tagsForSkill(skill); }
function pipelineTags(pipeline) { return [...new Set(pipelineSteps(pipeline).flatMap((step) => step.skills.flatMap((skill) => skillTags(state.skills.find((item) => item.name === skill.skillName) || { name: skill.skillName }))))]; }
function recordProjects(record) { return Array.isArray(record.projects) ? record.projects : state.projects.filter((project) => project.id === record.projectId); }
function recordTags(record) { return state.processTab === 'skills' ? skillTags(record) : pipelineTags(record); }
function filteredRecords(records) {
  const query = state.query.trim().toLowerCase();
  const filtered = records.filter((record) => {
    const projects = recordProjects(record);
    const tags = recordTags(record);
    if (state.projectFilter !== 'All' && !projects.some((project) => project.id === state.projectFilter)) return false;
    if (state.tagFilter !== 'All' && !tags.includes(state.tagFilter)) return false;
    return !query || [record.name, record.description, record.purpose, ...projects.map((project) => project.name), ...tags].join(' ').toLowerCase().includes(query);
  });
  return state.processTab === 'skills' ? sortSkillsByFavorite(filtered) : filtered;
}
async function loadGlobalLibraries() {
  const results = await Promise.allSettled(state.projects.map(async (project) => {
    const [skills, pipelines] = await Promise.all([
      jsonRequest('/api/codex/skills', undefined, project.id),
      jsonRequest('/api/codex/pipelines', undefined, project.id)
    ]);
    return { project, skills: skills.skills || [], availableTags: skills.availableTags || [], pipelines: pipelines.pipelines || [], steps: pipelines.steps || [], issues: pipelines.issues || [] };
  }));
  const loaded = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  if (!loaded.length && state.projects.length) throw new Error('Could not load any project libraries.');
  state.availableTags = [...new Set(loaded.flatMap((library) => library.availableTags))];
  if (!state.availableTags.length) state.availableTags = [...skillCategories];
  const bySkill = new Map();
  for (const library of loaded) {
    for (const skill of library.skills) {
      const key = [skill.name, skill.source, skill.revision].join('\u0000');
      const existing = bySkill.get(key);
      if (existing) {
        existing.projects.push(library.project);
        existing.favorite ||= skill.favorite === true;
        if (!existing.tags?.length && skill.tags?.length) existing.tags = [skill.tags[0]];
      }
      else bySkill.set(key, { ...skill, projects: [library.project] });
    }
  }
  state.skills = [...bySkill.values()].sort((left, right) => left.name.localeCompare(right.name));
  state.pipelines = loaded.flatMap(({ project, pipelines }) => pipelines.map((pipeline) => ({ ...pipeline, projectId: project.id, projectName: project.name, projectColor: project.color })));
  state.steps = loaded.flatMap(({ project, steps }) => steps.map((step) => ({ ...step, projectId: project.id })));
  return { issues: loaded.flatMap((library) => library.issues), failedProjects: results.length - loaded.length };
}
function button(label, className, action) { const node = document.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label; node.addEventListener('click', action); return node; }
function pipelineSteps(pipeline) { return pipeline.stepIds.map((id) => state.steps.find((step) => step.id === id && (!pipeline.projectId || step.projectId === pipeline.projectId))).filter(Boolean); }
function renderFilterChips(containerSelector, values, selected, className, onSelect) {
  const container = el(containerSelector);
  container.replaceChildren(...values.map((value) => {
    const chip = button(value.label, className, () => onSelect(value.id));
    chip.setAttribute('aria-pressed', String(value.id === selected));
    if (value.color) chip.style.setProperty('--project-color', value.color);
    if (value.category) decorateSkillCategoryLabel(chip, value.category);
    return chip;
  }));
}
function renderLibraryFilters(records, rerender, prefix = 'process') {
  const projects = [{ id: 'All', label: 'All projects', color: '#20242b' }, ...state.projects.map((project) => ({ id: project.id, label: project.name, color: project.color }))]
    .filter((project) => project.id === 'All' || records.some((record) => recordProjects(record).some((candidate) => candidate.id === project.id)));
  const tags = ['All', ...new Set(records.flatMap(recordTags))].map((tag) => ({ id: tag, label: tag === 'All' ? 'All tags' : tag, category: tag }));
  if (!projects.some((project) => project.id === state.projectFilter)) state.projectFilter = 'All';
  if (!tags.some((tag) => tag.id === state.tagFilter)) state.tagFilter = 'All';
  const projectSelector = `.${prefix}-project-filters`;
  const tagSelector = `.${prefix}-tag-filters`;
  const search = el(`.${prefix}-search`);
  search.value = state.query;
  renderFilterChips(projectSelector, projects, state.projectFilter, 'project-filter-chip', (id) => { state.projectFilter = id; rerender(); });
  renderFilterChips(tagSelector, tags, state.tagFilter, 'skill-category-filter', (id) => { state.tagFilter = id; rerender(); });
  el(projectSelector).hidden = state.libraryScope !== 'global';
}
function renderProcessList() {
  const list = el('.process-library');
  const records = state.processTab === 'skills' ? state.skills : state.pipelines;
  renderLibraryFilters(records, renderProcessList);
  const visible = filteredRecords(records);
  list.replaceChildren(...visible.map((record) => {
    const node = button('', 'codex-list-item', () => renderProcessDetail(record));
    if (state.processTab === 'skills') { node.replaceChildren(...renderSkillLibraryItemContent(record)); return node; }
    const title = document.createElement('strong'); title.textContent = record.name;
    const detail = document.createElement('span');
    detail.textContent = state.processTab === 'skills' ? (record.description || `${record.source} skill`) : (record.purpose || `${record.stepIds.length} steps`);
    const labels = document.createElement('span'); labels.className = 'codex-list-labels';
    for (const project of recordProjects(record)) { const label = document.createElement('small'); label.className = 'project-record-label'; label.textContent = project.name; label.style.setProperty('--project-color', project.color); labels.append(label); }
    for (const category of recordTags(record)) { const label = document.createElement('small'); label.textContent = category; decorateSkillCategoryLabel(label, category); labels.append(label); }
    node.append(title, detail, labels); return node;
  }));
  message('.process-message', visible.length ? `${visible.length} ${state.processTab}` : records.length ? `No matching ${state.processTab}.` : `No ${state.processTab} are available.`);
}
function option(value, label = value) { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; }
function renderSkillTagChoices(record) {
  const fieldset = document.createElement('fieldset'); fieldset.className = 'skill-tags-field';
  const legend = document.createElement('legend'); legend.textContent = 'Tags';
  const choices = document.createElement('div'); choices.className = 'skill-tag-choices'; choices.setAttribute('aria-label', 'Select one skill tag');
  const selected = Array.isArray(record.tags) ? record.tags[0] : '';
  for (const tag of state.availableTags) {
    const choice = button(tag, 'skill-tag-choice', () => { void saveGlobalSkillTag(record, tag); });
    choice.setAttribute('aria-pressed', String(selected === tag));
    choice.setAttribute('aria-label', `Set ${tag} tag`);
    choice.disabled = state.tagSaving;
    decorateSkillCategoryLabel(choice, tag);
    choices.append(choice);
  }
  fieldset.append(legend, choices);
  return fieldset;
}
function renderProcessDetail(record) {
  state.selected = record;
  if (record.projectId) state.projectId = record.projectId;
  const detail = el('.process-detail'); detail.hidden = false; detail.replaceChildren();
  const viewContext = { global: state.libraryScope === 'global', libraryTitle: state.processTab === 'skills' ? 'Skill library' : 'Pipelines', detailTitle: state.processTab === 'skills' ? 'Skill details' : 'Pipeline details' };
  const title = document.createElement('h3'); title.className = 'skill-detail-title'; title.textContent = record.name;
  const purpose = document.createElement('p');
  purpose.textContent = state.processTab === 'skills' ? record.description : (record.purpose || 'No purpose provided.');
  detail.append(title, purpose);
  if (state.processTab === 'skills') {
    if (state.libraryScope === 'global') {
      const tagsField = renderSkillTagChoices(record);
      const favorite = button(record.favorite ? '★' : '☆', 'skill-favorite-toggle', () => { void toggleGlobalSkillFavorite(record); });
      favorite.setAttribute('aria-label', record.favorite ? 'Remove from favorites' : 'Add to favorites');
      favorite.setAttribute('aria-pressed', String(record.favorite === true));
      const status = document.createElement('p'); status.className = 'codex-message process-detail-message'; status.setAttribute('role', 'status');
      detail.append(tagsField, favorite, status);
      setMobileCodexView(document, 'detail', viewContext);
      return;
    }
    const model = document.createElement('select'); model.setAttribute('aria-label', 'Codex model');
    model.append(option('', `Inherit (${record.effectiveCodexModel || 'default'})`), ...modelOptions.map((item) => option(item)));
    const effort = document.createElement('select'); effort.setAttribute('aria-label', 'Codex effort');
    effort.append(option('', `Inherit (${record.effectiveCodexEffort || 'default'})`), ...effortOptions.map((item) => option(item)));
    const start = button('Start skill', 'primary-button process-start', () => startSkill(record, model.value, effort.value));
    start.disabled = !state.cardId;
    if (!state.cardId) start.title = 'Open a card to run this skill.';
    detail.append(model, effort, start);
  } else {
    const steps = document.createElement('ol');
    for (const step of pipelineSteps(record)) { const item = document.createElement('li'); item.textContent = `${step.name}: ${step.skills.map((skill) => skill.skillName).join(', ') || 'No skills'}`; steps.append(item); }
    const start = button('Start pipeline', 'primary-button process-start', () => startPipeline(record));
    start.disabled = !state.cardId;
    if (!state.cardId) start.title = 'Open a card to run this pipeline.';
    detail.append(steps, start);
  }
  setMobileCodexView(document, 'detail', viewContext);
}
async function toggleGlobalSkillFavorite(record) {
  const favorite = !record.favorite;
  const identity = (skill) => skill.name === record.name && skill.source === record.source && skill.revision === record.revision;
  const prior = state.skills.filter(identity).map((skill) => ({ skill, favorite: skill.favorite === true }));
  prior.forEach(({ skill }) => { skill.favorite = favorite; });
  renderProcessList();
  renderProcessDetail(record);
  const submit = el('.skill-favorite-toggle');
  setBusy(submit, true);
  message('.process-detail-message', favorite ? 'Adding favorite…' : 'Removing favorite…');
  try {
    await Promise.all(recordProjects(record).map((project) => jsonRequest(`/api/codex/skill-library/${encodeURIComponent(record.name)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ favorite })
    }, project.id)));
    renderProcessList();
    renderProcessDetail(record);
    message('.process-detail-message', favorite ? 'Added to favorites.' : 'Removed from favorites.');
  } catch (error) {
    try { await loadGlobalLibraries(); }
    catch { prior.forEach(({ skill, favorite: priorFavorite }) => { skill.favorite = priorFavorite; }); }
    const current = state.skills.find(identity) || record;
    renderProcessList();
    renderProcessDetail(current);
    message('.process-detail-message', error.message, true);
  }
}
async function saveGlobalSkillTag(record, tag) {
  if (state.tagSaving || !state.availableTags.includes(tag) || record.tags?.[0] === tag) return;
  const tags = [tag];
  const identity = (skill) => skill.name === record.name && skill.source === record.source && skill.revision === record.revision;
  const prior = state.skills.filter(identity).map((skill) => ({ skill, tags: [...(skill.tags || [])] }));
  state.tagSaving = true;
  prior.forEach(({ skill }) => { skill.tags = tags; });
  renderProcessList();
  renderProcessDetail(record);
  message('.process-detail-message', `Saving ${tag}…`);
  try {
    await Promise.all(recordProjects(record).map((project) => jsonRequest(`/api/codex/skill-library/${encodeURIComponent(record.name)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tags })
    }, project.id)));
    state.tagSaving = false;
    renderProcessList();
    renderProcessDetail(record);
    message('.process-detail-message', `${tag} saved.`);
  } catch (error) {
    try { await loadGlobalLibraries(); }
    catch { prior.forEach(({ skill, tags: priorTags }) => { skill.tags = priorTags; }); }
    state.tagSaving = false;
    const current = state.skills.find(identity) || record;
    renderProcessList();
    renderProcessDetail(current);
    message('.process-detail-message', error.message, true);
  }
}
async function startSkill(skill, codexModel, codexEffort) {
  const submit = el('.process-start'); setBusy(submit, true); message('.process-message', 'Submitting skill run…');
  try {
    const payload = { ledgerId: state.ledgerId, cardId: state.cardId, skillName: skill.name };
    if (codexModel) payload.codexModel = codexModel; if (codexEffort) payload.codexEffort = codexEffort;
    const body = await jsonRequest('/api/codex/skills/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    finishProcessLaunch({ pipelineRunId: body.pipelineRun?.id || '', queuePosition: body.queuePosition });
  } catch (error) { message('.process-message', error.message, true); setBusy(submit, false); }
}
async function startPipeline(pipeline) {
  const submit = el('.process-start'); setBusy(submit, true); message('.process-message', 'Submitting pipeline run…');
  try {
    const body = await jsonRequest('/api/codex/pipelines/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ledgerId: state.ledgerId, sourceCardId: state.cardId, pipelineId: pipeline.id }) });
    finishProcessLaunch({ pipelineRunId: body.run?.id || '', queuePosition: body.queuePosition });
  } catch (error) { message('.process-message', formatError(error), true); setBusy(submit, false); }
}
function finishProcessLaunch(detail) {
  el('.process-modal').close();
  setMobileCodexView(document, 'library', { global: false, libraryTitle: 'Process card' });
  window.dispatchEvent(new CustomEvent('decision-os:codex-run-enqueued', { detail: { ...detail, cardId: state.cardId, ledgerId: state.ledgerId, projectId: state.projectId } }));
}
function formatError(error) { const refs = error.body?.invalidReferences; return refs?.length ? `${error.message} Invalid references: ${refs.map((item) => item.reference).join(', ')}.` : error.message; }
async function openProcess() {
  if (!state.ledgerId || !state.cardId) return;
  state.libraryScope = 'project'; state.query = ''; state.projectFilter = 'All'; state.tagFilter = 'All';
  el('.process-modal').showModal(); setMobileCodexView(document, 'library', { global: false, libraryTitle: 'Process card' }); message('.process-message', 'Loading libraries…');
  try { const result = await loadLibraries(); message('.process-message', result.issues?.map((issue) => issue.message).join(' ') || ''); renderProcessList(); }
  catch (error) { message('.process-message', error.message, true); el('.process-library').replaceChildren(); }
}
async function openSkills() {
  state.processTab = 'skills';
  state.libraryScope = 'global'; state.query = ''; state.projectFilter = 'All'; state.tagFilter = 'All';
  document.querySelectorAll('[data-process-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.processTab === 'skills')));
  el('.process-modal').showModal(); setMobileCodexView(document, 'library', { global: true, libraryTitle: 'Skill library' });
  message('.process-message', 'Loading skill library…');
  try { const result = await loadGlobalLibraries(); renderProcessList(); if (result.failedProjects) message('.process-message', `${result.failedProjects} project libraries could not be loaded.`, true); }
  catch (error) { message('.process-message', error.message, true); el('.process-library').replaceChildren(); }
}
async function openPipelines() {
  state.libraryScope = 'global'; state.query = ''; state.projectFilter = 'All'; state.tagFilter = 'All';
  el('.pipelines-modal').showModal();
  message('.pipelines-message', 'Loading pipelines…');
  try { const result = await loadGlobalLibraries(); renderPipelineLibrary(); message('.pipelines-message', result.failedProjects ? `${result.failedProjects} project libraries could not be loaded.` : (state.pipelines.length ? `${state.pipelines.length} pipelines` : 'No saved pipelines.'), result.failedProjects > 0); }
  catch (error) { message('.pipelines-message', error.message, true); el('.pipeline-library').replaceChildren(); }
}
function renderPipelineLibrary() {
  const priorTab = state.processTab; state.processTab = 'pipelines';
  renderLibraryFilters(state.pipelines, renderPipelineLibrary, 'pipelines');
  const pipelines = filteredRecords(state.pipelines);
  state.processTab = priorTab;
  const create = el('.pipeline-new');
  create.disabled = state.projectFilter === 'All';
  create.title = create.disabled ? 'Choose a project filter to create a pipeline.' : '';
  el('.pipeline-library').replaceChildren(...pipelines.map((pipeline) => {
    const node = button('', 'codex-list-item', () => openEditor(pipeline)); const title = document.createElement('strong'); title.textContent = pipeline.name; const copy = document.createElement('span'); copy.textContent = pipeline.purpose || `${pipeline.stepIds.length} steps`; const metadata = document.createElement('small'); metadata.textContent = `${pipeline.projectName} · ${pipelineTags(pipeline).join(' · ')}`; node.style.borderInlineStartColor = pipeline.projectColor; node.append(title, copy, metadata); return node;
  }));
  if (!pipelines.length) message('.pipelines-message', state.pipelines.length ? 'No matching pipelines.' : 'No saved pipelines.');
}
function clonePipeline(pipeline) {
  return { id: pipeline?.id || uid('codex-pipeline'), existingId: pipeline?.id || '', name: pipeline?.name || '', purpose: pipeline?.purpose || '', steps: pipeline ? pipelineSteps(pipeline).map((step) => ({ ...step, skills: step.skills.map((skill) => ({ ...skill })) })) : [] };
}
function openEditor(pipeline = null) { if (pipeline?.projectId) state.projectId = pipeline.projectId; state.editor = clonePipeline(pipeline); el('.pipelines-modal').close(); el('.pipeline-editor-modal').showModal(); renderEditor(); }
function move(items, index, delta) { const target = index + delta; if (target < 0 || target >= items.length) return; [items[index], items[target]] = [items[target], items[index]]; }
function renderEditor() {
  const editor = state.editor; const form = el('.pipeline-editor-form'); form.elements['pipeline-name'].value = editor.name; form.elements['pipeline-purpose'].value = editor.purpose;
  el('#pipeline-editor-title').textContent = editor.existingId ? 'Edit pipeline' : 'New pipeline';
  el('.pipeline-steps').replaceChildren(...editor.steps.map((step, index) => renderStep(step, index))); message('.pipeline-editor-message', '');
}
function renderStep(step, index) {
  const node = document.createElement('section'); node.className = 'pipeline-step';
  const heading = document.createElement('div'); heading.className = 'pipeline-step-heading'; const label = document.createElement('strong'); label.textContent = `Step ${index + 1}`;
  const controls = document.createElement('span'); const up = button('↑', 'codex-icon', () => { move(state.editor.steps, index, -1); renderEditor(); }); up.disabled = index === 0; up.setAttribute('aria-label', 'Move step earlier'); const down = button('↓', 'codex-icon', () => { move(state.editor.steps, index, 1); renderEditor(); }); down.disabled = index === state.editor.steps.length - 1; down.setAttribute('aria-label', 'Move step later'); const remove = button('×', 'codex-icon', () => { state.editor.steps.splice(index, 1); renderEditor(); }); remove.setAttribute('aria-label', 'Remove step'); controls.append(up, down, remove); heading.append(label, controls);
  const name = document.createElement('input'); name.value = step.name; name.placeholder = 'Step name'; name.setAttribute('aria-label', `Step ${index + 1} name`); name.addEventListener('input', () => { step.name = name.value; });
  const purpose = document.createElement('textarea'); purpose.value = step.purpose; purpose.placeholder = 'Step purpose'; purpose.setAttribute('aria-label', `Step ${index + 1} purpose`); purpose.addEventListener('input', () => { step.purpose = purpose.value; });
  const skills = document.createElement('div'); skills.className = 'pipeline-skill-list'; skills.replaceChildren(...step.skills.map((skill, skillIndex) => renderStepSkill(step, skill, skillIndex)));
  node.append(heading, name, purpose, skills, button('+ Add skill', 'codex-secondary', () => openSkillPicker(step.id))); return node;
}
function renderStepSkill(step, skill, index) {
  const node = document.createElement('div'); node.className = 'pipeline-skill'; const title = document.createElement('strong'); title.textContent = skill.skillName;
  const model = document.createElement('select'); model.setAttribute('aria-label', `${skill.skillName} model`); model.append(option('', 'Inherit model'), ...modelOptions.map((item) => option(item))); model.value = skill.codexModel || ''; model.addEventListener('change', () => { skill.codexModel = model.value || null; });
  const effort = document.createElement('select'); effort.setAttribute('aria-label', `${skill.skillName} effort`); effort.append(option('', 'Inherit effort'), ...effortOptions.map((item) => option(item))); effort.value = skill.codexEffort || ''; effort.addEventListener('change', () => { skill.codexEffort = effort.value || null; });
  const controls = document.createElement('span'); const up = button('↑', 'codex-icon', () => { move(step.skills, index, -1); renderEditor(); }); up.disabled = index === 0; up.setAttribute('aria-label', 'Move skill earlier'); const down = button('↓', 'codex-icon', () => { move(step.skills, index, 1); renderEditor(); }); down.disabled = index === step.skills.length - 1; down.setAttribute('aria-label', 'Move skill later'); const remove = button('×', 'codex-icon', () => { step.skills.splice(index, 1); renderEditor(); }); remove.setAttribute('aria-label', 'Remove skill'); controls.append(up, down, remove); node.append(title, model, effort, controls); return node;
}
function openSkillPicker(stepId) { state.pickerStepId = stepId; el('.pipeline-editor-modal').close(); el('.skill-picker-modal').showModal(); const skills = state.skills.filter((skill) => !skill.projects?.length || skill.projects.some((project) => project.id === state.projectId)); message('.skill-picker-message', skills.length ? '' : 'No skills are available.'); el('.skill-picker-list').replaceChildren(...skills.map((skill) => button(skill.name, 'codex-list-item', () => { const step = state.editor.steps.find((item) => item.id === stepId); step.skills.push({ id: uid('codex-pipeline-skill'), skillName: skill.name, codexModel: null, codexEffort: null }); closePicker(); })) ); }
function closePicker() { el('.skill-picker-modal').close(); el('.pipeline-editor-modal').showModal(); renderEditor(); }
async function saveEditor() {
  const editor = state.editor; const form = el('.pipeline-editor-form'); editor.name = form.elements['pipeline-name'].value.trim(); editor.purpose = form.elements['pipeline-purpose'].value.trim();
  if (!editor.name) return message('.pipeline-editor-message', 'Pipeline name is required.', true);
  const save = el('.pipeline-save'); setBusy(save, true); message('.pipeline-editor-message', 'Saving…');
  const pipeline = { id: editor.id, name: editor.name, purpose: editor.purpose, stepIds: editor.steps.map((step) => step.id) };
  const steps = editor.steps.map((step) => ({ id: step.id, name: step.name.trim(), purpose: step.purpose.trim(), skills: step.skills }));
  try { const url = editor.existingId ? `/api/codex/pipelines/${encodeURIComponent(editor.existingId)}` : '/api/codex/pipelines'; const body = await jsonRequest(url, { method: editor.existingId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pipeline, steps }) }); const project = state.projects.find((item) => item.id === state.projectId); const savedPipelines = (body.pipelines || []).map((item) => ({ ...item, projectId: state.projectId, projectName: project?.name || '', projectColor: project?.color || '#20242b' })); const savedSteps = (body.steps || []).map((item) => ({ ...item, projectId: state.projectId })); if (state.libraryScope === 'global') { state.pipelines = [...state.pipelines.filter((item) => item.projectId !== state.projectId), ...savedPipelines]; state.steps = [...state.steps.filter((item) => item.projectId !== state.projectId), ...savedSteps]; } else { state.pipelines = savedPipelines; state.steps = savedSteps; } el('.pipeline-editor-modal').close(); el('.pipelines-modal').showModal(); renderPipelineLibrary(); message('.pipelines-message', body.issues?.map((issue) => issue.message).join(' ') || 'Pipeline saved.'); }
  catch (error) { message('.pipeline-editor-message', formatError(error), true); } finally { setBusy(save, false); }
}
export function setMobileCodexContext(context) {
  if ('projectId' in context) state.projectId = String(context.projectId || '');
  if (Array.isArray(context.projects)) state.projects = context.projects;
  if ('ledgerId' in context) state.ledgerId = String(context.ledgerId || '');
  if ('cardId' in context) state.cardId = String(context.cardId || '');
  el('.process-card-button').disabled = !state.cardId;
}
export function openMobileCodexLibrary(kind) {
  if (kind === 'pipelines') void openPipelines();
  else void openSkills();
}
export function initializeMobileCodex() {
  el('.process-card-button').addEventListener('click', openProcess);
  document.addEventListener('click', (event) => {
    const navigationButton = event.target.closest('.nav-pipelines-button, .nav-skills-button');
    if (!navigationButton) return;
    document.body.classList.remove('menu-open');
    if (navigationButton.getAttribute('href')) return;
    if (navigationButton.classList.contains('nav-pipelines-button')) void openPipelines();
    else void openSkills();
  });
  el('.process-close').addEventListener('click', () => {
    if (!el('.process-detail').hidden) {
      setMobileCodexView(document, 'library', { global: state.libraryScope === 'global', libraryTitle: state.processTab === 'skills' ? 'Skill library' : 'Pipelines' });
      return;
    }
    el('.process-modal').close();
  }); el('.pipelines-close').addEventListener('click', () => el('.pipelines-modal').close());
  document.querySelectorAll('[data-process-tab]').forEach((tab) => tab.addEventListener('click', () => { state.processTab = tab.dataset.processTab; state.query = ''; state.tagFilter = 'All'; document.querySelectorAll('[data-process-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === tab))); setMobileCodexView(document, 'library', { global: state.libraryScope === 'global', libraryTitle: state.processTab === 'skills' ? 'Skill library' : 'Pipelines' }); message('.process-message', ''); renderProcessList(); }));
  el('.process-search').addEventListener('input', (event) => { state.query = event.target.value; renderProcessList(); event.target.focus(); });
  el('.process-filter-clear').addEventListener('click', () => { state.query = ''; state.projectFilter = 'All'; state.tagFilter = 'All'; renderProcessList(); });
  el('.pipelines-search').addEventListener('input', (event) => { state.query = event.target.value; renderPipelineLibrary(); event.target.focus(); });
  el('.pipelines-filter-clear').addEventListener('click', () => { state.query = ''; state.projectFilter = 'All'; state.tagFilter = 'All'; renderPipelineLibrary(); });
  el('.pipeline-new').addEventListener('click', () => { if (state.projectFilter === 'All') return; state.projectId = state.projectFilter; openEditor(); }); el('.pipeline-editor-back').addEventListener('click', () => { el('.pipeline-editor-modal').close(); el('.pipelines-modal').showModal(); });
  el('.pipeline-add-step').addEventListener('click', () => { state.editor.steps.push({ id: uid('codex-step'), name: `Step ${state.editor.steps.length + 1}`, purpose: '', skills: [] }); renderEditor(); });
  el('.pipeline-editor-form').addEventListener('submit', (event) => { event.preventDefault(); void saveEditor(); }); el('.skill-picker-back').addEventListener('click', closePicker);
}
import { projectScopedRequestPath } from '/canvas-src/runtime/project/helper/project-request-scope.js';
import { decorateSkillCategoryLabel, sortSkillsByFavorite, tagsForSkill } from '/canvas-src/runtime/codex/helper/skill-library-presentation.js';
import { skillCategories } from '/canvas-src/runtime/codex/helper/skill-category.js';
import { renderSkillLibraryItemContent } from '/canvas-src/runtime/codex/component/render-skill-library-item-content.js';
import { setMobileCodexView } from './mobile-codex-view.js';
