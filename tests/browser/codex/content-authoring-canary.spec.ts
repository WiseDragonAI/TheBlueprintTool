/**
 * WHAT: Proves served workspace-skill authoring and clean federated-skill discovery on the registered 50151 canary.
 * WHY: The G12 gate requires real canary routing, CodeMirror interaction, Git history, and strict owner boundaries.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { chromium, type Browser } from '@playwright/test';

const canaryUrl = process.env.DECISION_OS_URL ?? '';
const proofProjectId = 'e08b7f37-da8e-498b-a973-2c9206247f8b';
const proofRoot = resolve('.worktrees/g12-served-proof');
const workspaceSkillName = 'g12-workspace-skill';
const workspaceSkillFile = join(proofRoot, '.skills', workspaceSkillName, 'SKILL.md');
const cleanFederatedSkill = 'project-sync-source-publisher';
const cleanFederatedSkillFile = `.skills/${cleanFederatedSkill}/SKILL.md`;
const gateTestName = 'GateTest';
const gateTestProjectId = 'ZGV2L0VkaXRvckJQL2RlY2lzaW9uLW9z';
const evidenceRoot = '/tmp/decision-os-g12-proof';
const canaryOnly = { skip: !canaryUrl };

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

test('served Skills creation is projectless and preserves authored casing', { ...canaryOnly, timeout: 60_000 }, async () => {
  assert.equal(canaryUrl, 'http://127.0.0.1:50151', 'DECISION_OS_URL must select the registered canary.');
  mkdirSync(evidenceRoot, { recursive: true });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: '/snap/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15_000);
    const creationRequests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/codex/skill-library')) {
        creationRequests.push(request.url());
      }
    });

    const response = await page.goto(`${canaryUrl}/skills`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    const library = page.locator('.process-modal[open]');
    await library.waitFor({ state: 'visible' });
    const newSkill = library.getByRole('button', { name: 'New skill', exact: true });
    await newSkill.click();

    const creator = page.locator('.skill-library-editor-modal[open]');
    await creator.waitFor({ state: 'visible' });
    const content = creator.locator('.cm-content');
    await content.waitFor({ state: 'visible' });
    await content.click();
    await page.keyboard.type('Hello, this keeps Mixed Case.\n## Markdown title\nlowercase body');
    const presentation = await creator.evaluate(() => {
      const editor = document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .cm-content');
      const scroller = document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .cm-scroller');
      if (!editor || !scroller) return null;
      const editorStyle = getComputedStyle(editor);
      const scrollerStyle = getComputedStyle(scroller);
      return {
        text: editor.innerText,
        textTransform: editorStyle.textTransform,
        fontWeight: editorStyle.fontWeight,
        letterSpacing: editorStyle.letterSpacing,
        fontFamily: scrollerStyle.fontFamily,
      };
    });
    assert.deepEqual(
      {
        textTransform: presentation?.textTransform,
        fontWeight: presentation?.fontWeight,
        letterSpacing: presentation?.letterSpacing,
      },
      { textTransform: 'none', fontWeight: '400', letterSpacing: 'normal' },
    );
    assert.match(presentation?.fontFamily ?? '', /Ubuntu Mono|monospace/i);
    assert.match(presentation?.text ?? '', /Hello, this keeps Mixed Case\./);
    assert.match(presentation?.text ?? '', /Markdown title/);
    assert.match(presentation?.text ?? '', /lowercase body/);
    assert.deepEqual(creationRequests, []);
    await page.screenshot({ path: join(evidenceRoot, 'editor-theme-projectless-skill.png'), fullPage: false });
  } finally {
    await browser?.close();
  }
});

test('served Skills editor preserves CodeMirror state and navigates Git revisions accessibly', { ...canaryOnly, timeout: 120_000 }, async () => {
  assert.equal(canaryUrl, 'http://127.0.0.1:50151', 'DECISION_OS_URL must select the registered canary.');
  assert.equal(existsSync(workspaceSkillFile), true);
  mkdirSync(evidenceRoot, { recursive: true });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: '/snap/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (entry) => {
      if (entry.type() === 'error') consoleErrors.push(entry.text());
    });

    const response = await page.goto(
      `${canaryUrl}/skills?editor=skill&name=${workspaceSkillName}&projectId=${proofProjectId}`,
      { waitUntil: 'domcontentloaded' },
    );
    assert.equal(response?.status(), 200);
    const editor = page.locator('.skill-library-editor-modal[open]');
    await editor.waitFor({ state: 'visible' });
    await editor.locator('.cm-content').waitFor({ state: 'visible' });
    const geometry = await editor.evaluate((element) => {
      return { width: element.offsetWidth, height: element.offsetHeight, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    assert.ok(Math.abs(geometry.width - geometry.viewportWidth * 0.8) <= 2, JSON.stringify(geometry));
    assert.ok(Math.abs(geometry.height - geometry.viewportHeight * 0.95) <= 2, JSON.stringify(geometry));

    const content = editor.locator('.cm-content');
    await content.click();
    await page.keyboard.press('Control+End');
    const marker = `Workspace served revision ${Date.now()}.`;
    await page.keyboard.type(`\n${marker}`);
    assert.equal(await editor.locator('.text-file-editor').getAttribute('data-dirty'), 'true');
    await editor.getByRole('button', { name: 'Find', exact: true }).click();
    await editor.locator('.cm-search').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await editor.getByRole('button', { name: 'Wrap lines', exact: true }).click();
    assert.equal(await editor.getByRole('button', { name: 'Wrap lines', exact: true }).getAttribute('aria-pressed'), 'false');
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.doesNotMatch(await content.textContent() ?? '', new RegExp(marker));
    await editor.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.match(await content.textContent() ?? '', new RegExp(marker));

    const headBefore = git(proofRoot, ['rev-parse', 'HEAD']);
    const saveResponse = page.waitForResponse((candidate) => (
      candidate.request().method() === 'PUT'
      && candidate.url().includes(`/api/codex/skill-library/${workspaceSkillName}`)
    ));
    await editor.getByRole('button', { name: 'Save new revision', exact: true }).click();
    assert.equal((await saveResponse).status(), 200);
    await editor.getByText('Saved as a new Git revision.', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await editor.locator('.text-file-editor').getAttribute('data-dirty'), 'false');
    assert.notEqual(git(proofRoot, ['rev-parse', 'HEAD']), headBefore);
    assert.equal(git(proofRoot, ['rev-list', '--count', `${headBefore}..HEAD`]), '1');
    assert.match(git(proofRoot, ['show', 'HEAD:.skills/g12-workspace-skill/SKILL.md']), new RegExp(marker));
    await page.screenshot({ path: join(evidenceRoot, 'workspace-skill-editor.png'), fullPage: false });

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloaded = page.locator('.skill-library-editor-modal[open]');
    await reloaded.waitFor({ state: 'visible' });
    assert.match(await reloaded.locator('.cm-content').textContent() ?? '', new RegExp(marker));
    const additions = reloaded.locator('.cm-authored-addition');
    await additions.first().waitFor({ state: 'visible' });
    const additionPresentation = await additions.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        change: element.getAttribute('data-change'),
        label: element.getAttribute('aria-label'),
        borderLeftColor: style.borderLeftColor,
        backgroundColor: style.backgroundColor,
      };
    });
    assert.deepEqual(
      { change: additionPresentation.change, label: additionPresentation.label },
      { change: 'added', label: 'Added Markdown' },
    );
    assert.notEqual(additionPresentation.borderLeftColor, 'rgba(0, 0, 0, 0)');
    assert.notEqual(additionPresentation.backgroundColor, 'rgba(0, 0, 0, 0)');
    await reloaded.getByRole('button', { name: /^Revisions \(\d+\)$/ }).click();
    await reloaded.getByRole('region', { name: /full historical Markdown/ }).waitFor({ state: 'visible' });
    await reloaded.getByRole('region', { name: /changes introduced by revision/ }).waitFor({ state: 'visible' });
    const diffGroup = reloaded.getByRole('group', {
      name: 'File changes. Removed lines use a minus sign and red. Added lines use a plus sign and blue.',
      exact: true,
    });
    await diffGroup.waitFor({ state: 'visible' });
    const presentation = await reloaded.evaluate(() => {
      const key = document.querySelector<HTMLElement>('.skill-revision-key');
      const addition = key?.querySelector<HTMLElement>('.is-addition');
      const removal = key?.querySelector<HTMLElement>('.is-removal');
      const group = document.querySelector<HTMLElement>('.skill-revision-pierre');
      return {
        keyLabel: key?.getAttribute('aria-label') ?? '',
        additionText: addition?.textContent ?? '',
        additionColor: addition ? getComputedStyle(addition).color : '',
        removalText: removal?.textContent ?? '',
        removalColor: removal ? getComputedStyle(removal).color : '',
        groupLabel: group?.getAttribute('aria-label') ?? '',
      };
    });
    assert.match(presentation.keyLabel, /minus means removed in red; plus means added in blue/);
    assert.match(presentation.additionText, /\+ Added/);
    assert.match(presentation.removalText, /− Removed/);
    assert.notEqual(presentation.additionColor, presentation.removalColor);
    assert.match(presentation.additionColor, /77, 156, 255|4d9cff/i);
    assert.match(presentation.removalColor, /255, 95, 109|ff5f6d/i);
    assert.match(presentation.groupLabel, /Removed lines use a minus sign and red/);
    await page.screenshot({ path: join(evidenceRoot, 'workspace-skill-history.png'), fullPage: false });
    await reloaded.getByRole('button', { name: 'Older', exact: true }).click();
    await reloaded.getByRole('button', { name: 'Newer', exact: true }).click();

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
  } finally {
    await browser?.close();
  }
});

test('served GateTest editor renders the unified authored diff on Dev', { ...canaryOnly, timeout: 60_000 }, async () => {
  assert.equal(canaryUrl, 'http://127.0.0.1:50151', 'DECISION_OS_URL must select the registered canary.');
  mkdirSync(evidenceRoot, { recursive: true });
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: '/snap/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (entry) => {
      // WHAT: Retain browser console errors as served-surface failure evidence.
      // WHY: A visible diff is not accepted when the same editor emits runtime errors.
      if (entry.type() === 'error') consoleErrors.push(entry.text());
    });

    const response = await page.goto(
      `${canaryUrl}/skills?editor=skill&name=${gateTestName}&projectId=${gateTestProjectId}`,
      { waitUntil: 'domcontentloaded' },
    );
    assert.equal(response?.status(), 200);
    const editor = page.locator('.skill-library-editor-modal[open]');
    await editor.waitFor({ state: 'visible' });
    await editor.locator('.cm-content').waitFor({ state: 'visible' });
    const additions = editor.locator('.cm-authored-addition');
    await additions.first().waitFor({ state: 'visible' });
    const presentation = await additions.first().evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        count: document.querySelectorAll('.skill-library-editor-modal[open] .cm-authored-addition').length,
        change: element.getAttribute('data-change'),
        label: element.getAttribute('aria-label'),
        borderLeftColor: style.borderLeftColor,
        backgroundColor: style.backgroundColor,
      };
    });
    assert.ok(presentation.count > 0);
    assert.deepEqual(
      { change: presentation.change, label: presentation.label },
      { change: 'added', label: 'Added Markdown' },
    );
    assert.notEqual(presentation.borderLeftColor, 'rgba(0, 0, 0, 0)');
    assert.notEqual(presentation.backgroundColor, 'rgba(0, 0, 0, 0)');
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    await page.screenshot({ path: join(evidenceRoot, 'gatetest-unified-diff-dev.png'), fullPage: false });
  } finally {
    await browser?.close();
  }
});

test('canary catalogs expose one clean committed federated skill and no pipeline-only prompt fixture', canaryOnly, async () => {
  assert.equal(canaryUrl, 'http://127.0.0.1:50151', 'DECISION_OS_URL must select the registered canary.');
  const serverCatalogResponse = await fetch(`${canaryUrl}/api/codex/server-skills`);
  assert.equal(serverCatalogResponse.status, 200);
  const serverCatalog = await serverCatalogResponse.json() as {
    skills: Array<{ name: string; contentKind?: string; executionVisibility?: string }>;
  };
  const federated = serverCatalog.skills.find((skill) => skill.name === cleanFederatedSkill);
  assert.deepEqual(
    { contentKind: federated?.contentKind, executionVisibility: federated?.executionVisibility },
    { contentKind: 'federated-skill', executionVisibility: 'agent' },
  );
  assert.equal(serverCatalog.skills.some((skill) => skill.contentKind === 'pipeline-prompt'), false);
  assert.equal(git(resolve('.'), ['diff', '--quiet', 'HEAD', '--', cleanFederatedSkillFile]), '');
  assert.equal(git(resolve('.'), ['ls-tree', '--name-only', 'HEAD', cleanFederatedSkillFile]), cleanFederatedSkillFile);

  const pipelinesResponse = await fetch(`${canaryUrl}/api/codex/server-pipelines`);
  assert.equal(pipelinesResponse.status, 200);
  const pipelines = await pipelinesResponse.json() as {
    steps: Array<{ skills?: Array<{ skillName?: string; contentKind?: string }> }>;
    authoredContent?: Array<{ kind?: string }>;
  };
  const injected = pipelines.steps
    .flatMap((step) => step.skills ?? [])
    .find((skill) => skill.skillName === cleanFederatedSkill);
  assert.equal(injected?.contentKind, 'federated-skill');
  assert.equal((pipelines.authoredContent ?? []).some((record) => record.kind === 'pipeline-prompt'), false);
});
