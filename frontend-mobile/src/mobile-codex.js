const modelOptions = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex', 'gpt-5.2'];
const effortOptions = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const terminalStatuses = new Set(['complete', 'failed', 'cancelled']);
const state = { ledgerId: '', cardId: '', skills: [], pipelines: [], steps: [], processTab: 'skills', selected: null, editor: null, pickerStepId: '', pollTimer: 0 };
const el = (selector) => document.querySelector(selector);
const uid = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const message = (selector, text, bad = false) => { const node = el(selector); node.textContent = text; node.classList.toggle('error', bad); };
const setBusy = (node, busy) => { node.disabled = busy; if (busy) node.setAttribute('aria-busy', 'true'); else node.removeAttribute('aria-busy'); };
async function jsonRequest(url, options) {
  const response = await fetch(url, options).catch(() => null);
  if (!response) throw new Error('Request failed.');
  const body = await response.json().catch(() => null);
  if (!body) throw new Error('The server returned an invalid response.');
  if (!response.ok || body.ok === false) throw Object.assign(new Error(body.error || `Request failed (${response.status}).`), { body });
  return body;
}
async function loadLibraries() {
  const [skills, pipelines] = await Promise.all([
    jsonRequest('/api/codex/skills'),
    jsonRequest('/api/codex/pipelines')
  ]);
  state.skills = Array.isArray(skills.skills) ? skills.skills : [];
  state.pipelines = Array.isArray(pipelines.pipelines) ? pipelines.pipelines : [];
  state.steps = Array.isArray(pipelines.steps) ? pipelines.steps : [];
  return pipelines;
}
function button(label, className, action) { const node = document.createElement('button'); node.type = 'button'; node.className = className; node.textContent = label; node.addEventListener('click', action); return node; }
function pipelineSteps(pipeline) { return pipeline.stepIds.map((id) => state.steps.find((step) => step.id === id)).filter(Boolean); }
function renderProcessList() {
  const list = el('.process-library');
  const records = state.processTab === 'skills' ? state.skills : state.pipelines;
  list.replaceChildren(...records.map((record) => {
    const node = button('', 'codex-list-item', () => renderProcessDetail(record));
    const title = document.createElement('strong'); title.textContent = record.name;
    const detail = document.createElement('span');
    detail.textContent = state.processTab === 'skills' ? (record.description || `${record.source} skill`) : (record.purpose || `${record.stepIds.length} steps`);
    node.append(title, detail); return node;
  }));
  if (!records.length) message('.process-message', `No ${state.processTab} are available.`);
}
function option(value, label = value) { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; }
function renderProcessDetail(record) {
  state.selected = record;
  const detail = el('.process-detail'); detail.hidden = false; detail.replaceChildren();
  const back = button('← Back to library', 'codex-back-link', () => { detail.hidden = true; el('.process-library').hidden = false; });
  const title = document.createElement('h3'); title.textContent = record.name;
  const purpose = document.createElement('p');
  purpose.textContent = state.processTab === 'skills' ? record.description : (record.purpose || 'No purpose provided.');
  detail.append(back, title, purpose);
  if (state.processTab === 'skills') {
    const model = document.createElement('select'); model.setAttribute('aria-label', 'Codex model');
    model.append(option('', `Inherit (${record.effectiveCodexModel || 'default'})`), ...modelOptions.map((item) => option(item)));
    const effort = document.createElement('select'); effort.setAttribute('aria-label', 'Codex effort');
    effort.append(option('', `Inherit (${record.effectiveCodexEffort || 'default'})`), ...effortOptions.map((item) => option(item)));
    detail.append(model, effort, button('Start skill', 'primary-button process-start', () => startSkill(record, model.value, effort.value)));
  } else {
    const steps = document.createElement('ol');
    for (const step of pipelineSteps(record)) { const item = document.createElement('li'); item.textContent = `${step.name}: ${step.skills.map((skill) => skill.skillName).join(', ') || 'No skills'}`; steps.append(item); }
    detail.append(steps, button('Start pipeline', 'primary-button process-start', () => startPipeline(record)));
  }
  el('.process-library').hidden = true;
}
async function startSkill(skill, codexModel, codexEffort) {
  const submit = el('.process-start'); setBusy(submit, true); message('.process-message', 'Submitting skill run…');
  try {
    const payload = { ledgerId: state.ledgerId, cardId: state.cardId, skillName: skill.name };
    if (codexModel) payload.codexModel = codexModel; if (codexEffort) payload.codexEffort = codexEffort;
    const body = await jsonRequest('/api/codex/skills/process', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    message('.process-message', `Skill run ${body.run?.status || 'started'}.`);
    if (body.run?.id) pollSkill(body.run);
  } catch (error) { message('.process-message', error.message, true); setBusy(submit, false); }
}
async function startPipeline(pipeline) {
  const submit = el('.process-start'); setBusy(submit, true); message('.process-message', 'Submitting pipeline run…');
  try {
    const body = await jsonRequest('/api/codex/pipelines/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ledgerId: state.ledgerId, sourceCardId: state.cardId, pipelineId: pipeline.id }) });
    message('.process-message', `Pipeline ${body.run?.status || 'started'}.`);
    if (body.run?.id) pollPipeline(body.run.id);
  } catch (error) { message('.process-message', formatError(error), true); setBusy(submit, false); }
}
function schedule(task) { clearTimeout(state.pollTimer); state.pollTimer = setTimeout(task, 1500); }
async function pollPipeline(runId) {
  try { const body = await jsonRequest(`/api/codex/pipelines/runs/${encodeURIComponent(runId)}`); const status = body.run?.status || 'running'; message('.process-message', `Pipeline ${status}.`); if (!terminalStatuses.has(status)) schedule(() => pollPipeline(runId)); else setBusy(el('.process-start'), false); }
  catch (error) { message('.process-message', error.message, true); setBusy(el('.process-start'), false); }
}
async function pollSkill(run) {
  const outputCardId = run.outputCardId || state.cardId;
  try { const body = await jsonRequest(`/api/codex/skills/runs/${encodeURIComponent(run.id)}?ledgerId=${encodeURIComponent(state.ledgerId)}&cardId=${encodeURIComponent(outputCardId)}&since=0`); const status = body.run?.status || body.status || 'running'; message('.process-message', `Skill run ${status}.`); if (!terminalStatuses.has(status)) schedule(() => pollSkill({ ...run, ...(body.run || {}) })); else setBusy(el('.process-start'), false); }
  catch (error) { message('.process-message', error.message, true); setBusy(el('.process-start'), false); }
}
function formatError(error) { const refs = error.body?.invalidReferences; return refs?.length ? `${error.message} Invalid references: ${refs.map((item) => item.reference).join(', ')}.` : error.message; }
async function openProcess() {
  if (!state.ledgerId || !state.cardId) return;
  el('.process-modal').showModal(); el('.process-library').hidden = false; el('.process-detail').hidden = true; message('.process-message', 'Loading libraries…');
  try { const result = await loadLibraries(); message('.process-message', result.issues?.map((issue) => issue.message).join(' ') || ''); renderProcessList(); }
  catch (error) { message('.process-message', error.message, true); el('.process-library').replaceChildren(); }
}
async function openPipelines() {
  el('.pipelines-modal').showModal(); message('.pipelines-message', 'Loading pipelines…');
  try { const result = await loadLibraries(); renderPipelineLibrary(); message('.pipelines-message', result.issues?.map((issue) => issue.message).join(' ') || (state.pipelines.length ? '' : 'No saved pipelines.')); }
  catch (error) { message('.pipelines-message', error.message, true); el('.pipeline-library').replaceChildren(); }
}
function renderPipelineLibrary() {
  el('.pipeline-library').replaceChildren(...state.pipelines.map((pipeline) => {
    const node = button('', 'codex-list-item', () => openEditor(pipeline)); const title = document.createElement('strong'); title.textContent = pipeline.name; const copy = document.createElement('span'); copy.textContent = pipeline.purpose || `${pipeline.stepIds.length} steps`; node.append(title, copy); return node;
  }));
}
function clonePipeline(pipeline) {
  return { id: pipeline?.id || uid('codex-pipeline'), existingId: pipeline?.id || '', name: pipeline?.name || '', purpose: pipeline?.purpose || '', steps: pipeline ? pipelineSteps(pipeline).map((step) => ({ ...step, skills: step.skills.map((skill) => ({ ...skill })) })) : [] };
}
function openEditor(pipeline = null) { state.editor = clonePipeline(pipeline); el('.pipelines-modal').close(); el('.pipeline-editor-modal').showModal(); renderEditor(); }
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
function openSkillPicker(stepId) { state.pickerStepId = stepId; el('.pipeline-editor-modal').close(); el('.skill-picker-modal').showModal(); message('.skill-picker-message', state.skills.length ? '' : 'No skills are available.'); el('.skill-picker-list').replaceChildren(...state.skills.map((skill) => button(skill.name, 'codex-list-item', () => { const step = state.editor.steps.find((item) => item.id === stepId); step.skills.push({ id: uid('codex-pipeline-skill'), skillName: skill.name, codexModel: null, codexEffort: null }); closePicker(); })) ); }
function closePicker() { el('.skill-picker-modal').close(); el('.pipeline-editor-modal').showModal(); renderEditor(); }
async function saveEditor() {
  const editor = state.editor; const form = el('.pipeline-editor-form'); editor.name = form.elements['pipeline-name'].value.trim(); editor.purpose = form.elements['pipeline-purpose'].value.trim();
  if (!editor.name) return message('.pipeline-editor-message', 'Pipeline name is required.', true);
  const save = el('.pipeline-save'); setBusy(save, true); message('.pipeline-editor-message', 'Saving…');
  const pipeline = { id: editor.id, name: editor.name, purpose: editor.purpose, stepIds: editor.steps.map((step) => step.id) };
  const steps = editor.steps.map((step) => ({ id: step.id, name: step.name.trim(), purpose: step.purpose.trim(), skills: step.skills }));
  try { const url = editor.existingId ? `/api/codex/pipelines/${encodeURIComponent(editor.existingId)}` : '/api/codex/pipelines'; const body = await jsonRequest(url, { method: editor.existingId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pipeline, steps }) }); state.pipelines = body.pipelines || state.pipelines; state.steps = body.steps || state.steps; el('.pipeline-editor-modal').close(); el('.pipelines-modal').showModal(); renderPipelineLibrary(); message('.pipelines-message', body.issues?.map((issue) => issue.message).join(' ') || 'Pipeline saved.'); }
  catch (error) { message('.pipeline-editor-message', formatError(error), true); } finally { setBusy(save, false); }
}
export function setMobileCodexContext(context) { state.ledgerId = String(context.ledgerId || ''); state.cardId = String(context.cardId || ''); el('.process-card-button').disabled = !state.cardId; }
export function initializeMobileCodex() {
  el('.process-card-button').addEventListener('click', openProcess); el('.pipelines-button').addEventListener('click', openPipelines);
  el('.process-close').addEventListener('click', () => el('.process-modal').close()); el('.pipelines-close').addEventListener('click', () => el('.pipelines-modal').close());
  document.querySelectorAll('[data-process-tab]').forEach((tab) => tab.addEventListener('click', () => { state.processTab = tab.dataset.processTab; document.querySelectorAll('[data-process-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === tab))); el('.process-detail').hidden = true; el('.process-library').hidden = false; message('.process-message', ''); renderProcessList(); }));
  el('.pipeline-new').addEventListener('click', () => openEditor()); el('.pipeline-editor-back').addEventListener('click', () => { el('.pipeline-editor-modal').close(); el('.pipelines-modal').showModal(); });
  el('.pipeline-add-step').addEventListener('click', () => { state.editor.steps.push({ id: uid('codex-step'), name: `Step ${state.editor.steps.length + 1}`, purpose: '', skills: [] }); renderEditor(); });
  el('.pipeline-editor-form').addEventListener('submit', (event) => { event.preventDefault(); void saveEditor(); }); el('.skill-picker-back').addEventListener('click', closePicker);
}
