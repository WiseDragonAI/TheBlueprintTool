/** WHAT: Preserves the source responsive Codex library contract. WHY: Skills and pipelines must retain their complete mobile behavior in the unified frontend. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setMobileCodexView } from '../src/app/responsive/codex-view.js';

const root = new URL('../', import.meta.url);
const [html, script, styles, mobile, sharedRow, sharedLibrary] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/app/responsive/codex.js', root), 'utf8'),
  readFile(new URL('assets/application.css', root), 'utf8'),
  readFile(new URL('src/app/responsive/application.js', root), 'utf8'),
  readFile(new URL('../frontend/src/runtime/codex/component/render-skill-library-item-content.ts', root), 'utf8'),
  readFile(new URL('../frontend/src/runtime/codex/component/render-codex-library.ts', root), 'utf8'),
]);

test('mobile card detail exposes processing and both process libraries', () => {
  assert.match(html, /class="process-card-button"/);
  assert.match(html, /data-process-tab="skills"/);
  assert.match(html, /data-process-tab="pipelines"/);
  assert.match(mobile, /setMobileCodexContext\(\{ projectId: state\.resourceProjectId, ledgerId: state\.activeLedgerId, cardId: state\.activeCardId \}\)/);
  assert.match(script, /projectScopedRequestPath\(url, projectId\)/);
  assert.match(script, /ledgerId: launch\.ledgerId, cardId: launch\.cardId, skillName: skill\.name/);
  assert.match(script, /ledgerId: launch\.ledgerId, sourceCardId: launch\.cardId, pipelineId: pipeline\.id/);
});

test('mobile card detail keeps its three navigation controls in one row before the title', () => {
  assert.match(html, /card-detail-actions[\s\S]*back-to-zone-button[\s\S]*process-card-button[\s\S]*thread-open-button[\s\S]*id="card-title"/);
  assert.match(styles, /\.card-detail-actions \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.card-detail-header h1 \{[^}]*width: 100%[^}]*font-size: clamp\(24px, 7vw, 34px\)/);
  assert.match(mobile, /backButton\.replaceChildren\(backIcon, backLabel\)/);
});

test('dynamic navigation library actions use delegated event handling', () => {
  assert.match(script, /document\.addEventListener\('click', \(event\) => \{/);
  assert.match(script, /event\.target\.closest\('\.nav-pipelines-button, \.nav-skills-button'\)/);
  assert.doesNotMatch(script, /el\('\.nav-(?:pipelines|skills)-button'\)\.addEventListener/);
});

test('mobile processing guards duplicate submissions and delegates status to the card route', () => {
  assert.match(script, /setBusy\(submit, true\)/);
  assert.match(script, /setAttribute\('aria-busy', 'true'\)/);
  assert.doesNotMatch(script, /function poll(?:Skill|Pipeline)/);
});

test('successful responsive processing closes the card through the shared Control Room navigation lifecycle', () => {
  assert.match(script, /function finishProcessLaunch\(detail, launch\)/);
  assert.match(script, /const actionOwned = processLaunchOwned\(launch\)/);
  assert.match(script, /const requestId = createExecutionRequestId\('(skill|pipeline)'\)/);
  assert.match(script, /decision-os:codex-run-preparing/);
  assert.match(script, /clientRequestId: executionDetail\.requestId, \.\.\.\(body\.receipts\?\.\[0\] \?\? \{\}\)/);
  assert.match(script, /decision-os:codex-run-enqueued/);
  assert.match(script, /threadPresentationGeneration/);
  assert.match(mobile, /addEventListener\('decision-os:codex-run-preparing', \(event\) => \{ beginOptimisticExecution\(event\.detail\); \}\)/);
  assert.match(mobile, /addEventListener\('decision-os:codex-run-enqueued', \(event\) => \{[\s\S]*acknowledgeOptimisticExecution\(event\.detail\);[\s\S]*navigateAcceptedProcess\(event\.detail\)/);
  assert.match(mobile, /acceptedRunOwnsRoute\(detail, snapshot, threadGeneration\)/);
});

test('mobile pipeline editor supports ordered steps, ordered skills, inheritance, and persistence', () => {
  assert.match(html, /class="codex-modal pipeline-editor-modal"/);
  assert.match(html, /class="codex-modal skill-picker-modal"/);
  assert.match(script, /move\(state\.editor\.steps, index, -1\)/);
  assert.match(script, /move\(step\.skills, index, -1\)/);
  assert.match(script, /codexModel: null, codexEffort: null/);
  assert.match(script, /method: editor\.existingId \? 'PUT' : 'POST'/);
  assert.match(script, /setBusy\(save, true\)/);
});

test('mobile controls share voice-derived geometry, depth, motion, and accessible states', () => {
  assert.match(styles, /--control-size: 44px/);
  assert.match(styles, /--control-radius: 3px/);
  assert.match(styles, /--control-shadow: inset/);
  assert.match(styles, /--motion-fast: 120ms/);
  assert.match(styles, /--motion-disclosure: 180ms/);
  assert.match(styles, /--motion-view: 240ms/);
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(styles, /button\[aria-pressed="true"\]/);
  assert.match(styles, /button\[aria-selected="true"\]/);
  assert.match(styles, /button\[aria-busy="true"\]/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('nested mobile layers have explicit back actions and narrow layouts cannot overflow', () => {
  assert.match(html, /class="codex-back pipeline-editor-back"/);
  assert.match(html, /class="codex-back skill-picker-back"/);
  assert.match(styles, /\.codex-modal \{ width: min\(100%, 720px\)/);
  assert.match(styles, /min-width: 0/);
  assert.match(styles, /:focus-visible/);
});

test('catalog, save, run, invalid-reference, and warning messages stay actionable', () => {
  assert.match(script, /throw Object\.assign\(new Error/);
  assert.match(script, /Invalid references:/);
  assert.match(script, /result\.issues\?\.map/);
  assert.match(script, /message\('\.pipeline-editor-message', formatError\(error\), true\)/);
});

test('global skills and pipelines read only the connection-synchronized local server catalogs', () => {
  assert.match(script, /jsonRequest\('\/api\/codex\/server-pipelines'\)/);
  assert.match(script, /jsonRequest\('\/api\/codex\/server-skills'\)/);
  assert.doesNotMatch(script, /Promise\.allSettled\(state\.projects\.map/);
  assert.match(script, /Library views must never fan out to remote projects/);
  assert.match(script, /state\.skills = \(serverSkills\.skills \|\| \[\]\)/);
  assert.match(script, /failedProjects: 0/);
  assert.doesNotMatch(script, /Choose the project whose (?:skill library|pipelines)/);
});

test('global skill and pipeline modals expose ordered manual federation synchronization', () => {
  assert.match(html, /class="codex-secondary process-resynchronize"[^>]*>Resynchronize<\/button>/);
  assert.match(html, /class="codex-secondary pipelines-resynchronize"[^>]*>Resynchronize<\/button>/);
  assert.match(script, /jsonRequest\('\/api\/federation\/libraries\/synchronize', \{ method: 'POST' \}\)/);
  assert.match(script, /Synchronizing skills, then pipelines…/);
  assert.match(script, /await loadGlobalLibraries\(\)/);
  assert.match(script, /setBusy\(button, true\)/);
  assert.match(script, /setBusy\(button, false\)/);
});

test('library surfaces expose search, project filters, tag filters, and clearing', () => {
  assert.match(html, /class="process-search"/);
  assert.match(html, /class="process-project-filters codex-filter-row"/);
  assert.match(html, /class="process-tag-filters codex-filter-row"/);
  assert.match(html, /class="pipelines-search"/);
  assert.match(html, /class="pipelines-project-filters codex-filter-row"/);
  assert.match(html, /class="pipelines-tag-filters codex-filter-row"/);
  assert.match(sharedLibrary, /filters\.projectId !== 'All'/);
  assert.match(sharedLibrary, /filters\.tag !== 'All'/);
  assert.match(sharedLibrary, /filters\.query\.trim\(\)\.toLowerCase\(\)/);
  assert.match(styles, /\.codex-filter-row \{[^}]*overflow-x: auto/);
});

test('global pipeline editing creates server definitions at All projects and preserves local ownership', () => {
  assert.match(script, /pipeline\?\.scope === 'server'/);
  assert.match(script, /state\.projectFilter === 'All' \? 'server' : 'project'/);
  assert.match(script, /editor\.scope === 'server' \? '\/api\/codex\/server-pipelines' : '\/api\/codex\/pipelines'/);
  assert.match(script, /state\.projectFilter === 'All' \? '' : state\.projectFilter/);
  assert.doesNotMatch(script, /if \(state\.projectFilter === 'All'\) return/);
  assert.match(script, /item\.scope !== 'server'/);
  assert.match(script, /project\.id === state\.projectId/);
  assert.match(script, /projects: state\.projects/);
});

test('pipeline library entries use the shared card surface with ownership color', () => {
  const renderPipelineLibrary = script.match(/function renderPipelineLibrary\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(renderPipelineLibrary, /document\.createElement\('article'\); card\.className = 'codex-list-card'/);
  assert.match(renderPipelineLibrary, /card\.style\.setProperty\('--skill-category-color', pipeline\.projectColor\)/);
  assert.match(renderPipelineLibrary, /card\.append\(node\); return card/);
  assert.doesNotMatch(renderPipelineLibrary, /node\.style\.borderInlineStartColor/);
});

test('skill libraries share favorite ordering, colored categories, and scope-specific detail actions', () => {
  assert.match(sharedLibrary, /favoriteOrder/);
  assert.match(script, /renderSkillLibraryItemContent\(record\)/);
  assert.match(script, /document\.createElement\('article'\); card\.className = 'codex-list-card'/);
  assert.match(script, /card\.append\(node\); return card/);
  assert.match(sharedLibrary, /decorateSkillCategoryLabel\(chip, tag\)/);
  assert.match(script, /state\.libraryScope === 'global'/);
  assert.match(script, /record\.favorite \? '★' : '☆'/);
  assert.match(script, /'Remove from favorites' : 'Add to favorites'/);
  assert.doesNotMatch(script, /'Save tags'/);
  assert.match(script, /skills\.availableTags/);
  assert.match(script, /state\.availableTags = \[\.\.\.skillCategories\]/);
  assert.doesNotMatch(script, /input\.type = 'checkbox'/);
  assert.match(script, /saveGlobalSkillTag\(record, tag\)/);
  assert.match(script, /choice\.setAttribute\('aria-pressed'/);
  assert.match(script, /const tags = \[tag\]/);
  assert.match(script, /state\.availableTags\.includes\(tag\)/);
  assert.match(script, /JSON\.stringify\(\{ tags \}\)/);
  assert.match(script, /JSON\.stringify\(\{ favorite \}\)/);
  assert.match(script, /try \{ await loadGlobalLibraries\(\); \}/);
  assert.match(script, /Loading SKILL\.md/);
  assert.match(script, /renderLedgerCardMarkdown\(skillInstructionMarkdown\(skill\.markdown\)\)/);
  assert.match(script, /serverSkillPath\(record\.name\)/);
  assert.doesNotMatch(script, /Promise\.all\(recordProjects\(record\)\.map\(\(project\) => jsonRequest\(`\/api\/codex\/skill-library/);
  assert.match(script, /Related references/);
  assert.match(script, /skill-reference-card/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /skill-detail-scroll/);
  assert.match(script, /skill-detail-actions/);
  assert.match(script, /detail\.classList\.remove\('skill-detail-layout'\)/);
  assert.doesNotMatch(sharedRow, /project-record-label|skill-source-label|skill-favorite-label/);
  assert.match(sharedRow, /skill-favorite-star/);
  assert.match(sharedRow, /favorite\.textContent = '★'/);
  assert.match(styles, /\.skill-category-filter \{[^}]*background: var\(--skill-category-color\)/);
  assert.match(styles, /\.skill-favorite-toggle\[aria-pressed="true"\] \{[^}]*color: #fbbf24/);
  assert.match(styles, /\.skill-tag-choice\[aria-pressed="true"\]/);
  assert.match(styles, /\.codex-list-card \{[^}]*box-shadow/);
  assert.match(styles, /\.codex-list-item \{[^}]*background: transparent;[^}]*box-shadow: none/);
  assert.match(styles, /\.skill-picker-list\.codex-list \{[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow-y: auto/);
  assert.match(styles, /\.skill-picker-list > \.codex-list-card \{[^}]*flex: 0 0 auto/);
  assert.match(styles, /\.skill-reference-toggle \{[^}]*background: transparent;[^}]*box-shadow: none/);
  assert.match(styles, /\.process-modal \{ height: min\(80dvh, 860px\); \}/);
  assert.match(styles, /\.skill-detail-scroll \{[^}]*overflow-y: auto/);
  assert.doesNotMatch(styles, /\.skill-markdown-section \.ledger-card-body[^}]*background:/);
  assert.match(styles, /\.codex-list-item \.project-record-label, \.codex-list-item \.skill-category-label[^}]*padding: 4px 7px/);
});

test('pipeline Add skill uses the shared rich catalog and explicit confirmation', () => {
  assert.match(html, /class="skill-picker-controls codex-library-controls"/);
  assert.match(html, /class="skill-picker-position"/);
  assert.match(html, /class="skill-picker-confirm primary-button"[^>]*>Add skill/);
  assert.match(script, /function renderSkillPicker\(\)/);
  assert.match(script, /renderCodexLibrary\(\{/);
  assert.match(script, /favoriteFirst: true/);
  assert.match(script, /onSynchronize: \(\) => \{ void synchronizePickerLibraries\(\); \}/);
  assert.match(script, /function confirmPicker\(\)/);
  assert.match(script, /step\.skills\.splice\(state\.pickerInsertionIndex/);
  assert.doesNotMatch(script, /skills\.map\(\(skill\) => button\(skill\.name/);
});

test('skill detail is an exclusive modal view and the single close control restores every library control', () => {
  const selectors = new Map([
    ['.codex-tabs', { hidden: false }],
    ['.codex-library-controls', { hidden: false }],
    ['.process-message', { hidden: false }],
    ['.process-library', { hidden: false }],
    ['.process-detail', { hidden: true }],
    ['#process-title', { textContent: '' }],
    ['.process-modal .eyebrow', { textContent: '' }],
  ]);
  const rootNode = { querySelector: (selector) => selectors.get(selector) || null };
  setMobileCodexView(rootNode, 'detail', { global: true, libraryTitle: 'Skill library', detailTitle: 'Skill details' });
  assert.deepEqual([...selectors.keys()].slice(0, 4).map((selector) => selectors.get(selector).hidden), [true, true, true, true]);
  assert.equal(selectors.get('.process-detail').hidden, false);
  assert.equal(selectors.get('#process-title').textContent, 'Skill details');
  setMobileCodexView(rootNode, 'library', { global: true, libraryTitle: 'Skill library' });
  assert.deepEqual([...selectors.keys()].slice(0, 4).map((selector) => selectors.get(selector).hidden), [false, false, false, false]);
  assert.equal(selectors.get('.process-detail').hidden, true);
  assert.equal(selectors.get('#process-title').textContent, 'Skill library');
  assert.doesNotMatch(script, /Back to library/);
  assert.match(script, /if \(!el\('\.process-detail'\)\.hidden\)/);
  assert.match(script, /setMobileCodexView\(document, 'library'/);
});
