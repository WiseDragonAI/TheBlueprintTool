/**
 * WHAT: Proves served workspace-skill authoring and clean federated-skill discovery on the registered 50151 canary.
 * WHY: The G12 gate requires real canary routing, CodeMirror interaction, Git history, and strict owner boundaries.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const gateTestOwnerRoot = resolve(process.env.DECISION_OS_GATE_TEST_OWNER_ROOT ?? '.decision-os');
const gateTestOwnerPath = 'pipeline-prompts/GateTest.md';
const gateTestRevisionHashes = [
  'e0ccac4e6e829b2c8c39d5eb5fbef60d38cd05a85c346b5df9ff29e7dcbd6574',
  '2d204a8c15deb84c7587d189731892612b062d5d500c461466b9e26ae26ec9a0',
  '24c6c2d47ce440989480bcd5a5d8e52cbb581933b695efe91c58a497e488ea6f',
  '6d9e2822525565e0192a9aacfdc4554fe00fc8d40cf06ad600fed2666191e486',
  '2e4818a85c70be6b1e13359e73d55821ffb7e5fda44fb423402a2397055a6d3b',
  '446115652cfad814c29b87f9e784446454f61b26e1ba8fc398db78cf37dc43f0',
  'c1edd32535b5d2d49e8cc3a6549dae38f7a97821b2b0c56beefb70e6d417a1ce',
  'db917e35248493cba5d69ba26f4cd8e7797e4a702a0f1e6a73534c75812edffc',
  '126362a0dfd36d8401463c6d2d37ebc883a876bd4817e3701331a5ecfe85d723',
  '3fc0754f7b65303452de028de92f56e0b70c5bcc3111d7191948a97646651548',
  '97efa3504798a193475cae027bc9af491aee93b0ecc8ec5d6a66e3603ed2ea7d',
  'c322783686369242516c695464d1f36a82dfe60ed75f6212294873887822c427',
  '2eabf6ed2008f28bad52973b72316bc8b39a9a5dde0a580415c1b9428d6cfe8b',
  '93334a8bbfdfe27659a6d7f2ccbe296c884c6f8b5342fc3313f9691abdf96ff9',
  '6bd3cec506e41ceb3ef2e6c7ea45df8c92ef63038ff453aa7b023a56b1f3882a',
  '21378b41afffd3c94ec74274cbe312391fd3284fd9c5009b705b59c0602d0bd4',
  'dd279ba4e38cefd350bb448212f2899f564bff7f91d8d140bfa9eba3fc745a6f',
] as const;
const evidenceRoot = '/tmp/decision-os-g12-proof';
const canaryOnly = { skip: !canaryUrl };

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function gitBytes(cwd: string, revision: string, path: string): Buffer {
  return execFileSync('git', ['show', `${revision}:${path}`], { cwd });
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function millionByteGateTestMarkdown(): string {
  const targetBytes = 1_000_000;
  const header = '# GateTest million-byte performance proof\n\n';
  const lines = Array.from(
    { length: 20_000 },
    (_, index) => `- STABLE00 ${String(index).padStart(6, '0')} Markdown line with **strong** text and \`code\`.\n`,
  ).join('');
  return `${header}${lines}`.slice(0, targetBytes);
}

function replaceMillionByteToken(markdown: string, minimumOffset: number, replacement: string): string {
  const token = 'STABLE00';
  const offset = markdown.indexOf(token, minimumOffset);
  assert.notEqual(offset, -1);
  assert.equal(Buffer.byteLength(replacement), Buffer.byteLength(token));
  return `${markdown.slice(0, offset)}${replacement}${markdown.slice(offset + token.length)}`;
}

type BrowserTraceEvent = {
  name?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  pid?: number;
  tid?: number;
};

function attributableRendererMainTasks(traceEvents: unknown[]): Array<{ name: string; duration: number }> {
  const events = traceEvents as BrowserTraceEvent[];
  const workerPost = events.filter((event) => event.name === 'authored-diff-worker-posted').at(-1);
  const settled = events.filter((event) => event.name === 'authored-diff-measurement-settled').at(-1);
  assert.ok(workerPost?.ts);
  assert.ok(settled?.ts);
  assert.equal(workerPost.pid, settled.pid);
  assert.equal(workerPost.tid, settled.tid);
  const causalEvents = new Set([
    'FunctionCall',
    'EventDispatch',
    'TimerFire',
    'FireAnimationFrame',
    'Document::UpdateStyleAndLayout',
    'UpdateLayoutTree',
    'Layout',
    'LayoutView::HitTest',
    'InlineNode::ShapeTextIncludingFirstLine',
    'PrePaint',
    'Paint',
    'Commit',
  ]);
  return events.filter((event) => (
    event.ph === 'X'
    && event.pid === workerPost.pid
    && event.tid === workerPost.tid
    && typeof event.ts === 'number'
    && typeof event.dur === 'number'
    && event.ts < (settled.ts ?? 0)
    && event.ts + event.dur > (workerPost.ts ?? 0)
    && event.dur >= 50_000
    && causalEvents.has(event.name ?? '')
  )).map((event) => ({
    name: event.name ?? 'unknown',
    duration: (event.dur ?? 0) / 1_000,
  }));
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
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
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

test('served GateTest editor preserves exact diff, persistence, conflict, Worker, and teardown contracts on Dev', { ...canaryOnly, timeout: 120_000 }, async () => {
  assert.equal(canaryUrl, 'http://127.0.0.1:50151', 'DECISION_OS_URL must select the registered canary.');
  const initialBranch = git(gateTestOwnerRoot, ['branch', '--show-current']);
  const proofBranch = `test/gatetest-unified-diff-${process.pid}-${Date.now()}`;
  assert.equal(git(gateTestOwnerRoot, ['status', '--short', '--', gateTestOwnerPath]), '');
  git(gateTestOwnerRoot, ['switch', '-c', proofBranch]);
  const gateTestCommits = git(gateTestOwnerRoot, [
    'log',
    '--format=%H',
    `-${gateTestRevisionHashes.length}`,
    '--',
    gateTestOwnerPath,
  ]).split('\n');
  assert.equal(gateTestCommits.length, gateTestRevisionHashes.length);
  assert.deepEqual(
    gateTestCommits.map((commit) => sha256(gitBytes(gateTestOwnerRoot, commit, gateTestOwnerPath))),
    [...gateTestRevisionHashes],
  );
  const currentMarkdown = gitBytes(gateTestOwnerRoot, gateTestCommits[0], gateTestOwnerPath).toString('utf8');
  const baseMarkdown = gitBytes(gateTestOwnerRoot, gateTestCommits[1], gateTestOwnerPath).toString('utf8');
  const detailResponse = await fetch(`${canaryUrl}/api/codex/server-skills/${gateTestName}`);
  assert.equal(detailResponse.status, 200);
  const detailBody = await detailResponse.json() as {
    skill?: {
      snapshot?: {
        baselineAvailability?: string;
        contentRevision?: string;
        commit?: string;
        olderCommit?: string;
        baseMarkdown?: string;
        markdown?: string;
      };
    };
  };
  assert.deepEqual(detailBody.skill?.snapshot, {
    baselineAvailability: 'available',
    contentRevision: sha256(Buffer.from(currentMarkdown)),
    commit: gateTestCommits[0],
    olderCommit: gateTestCommits[1],
    baseMarkdown,
    markdown: currentMarkdown,
  });
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
    await page.addInitScript({ content: `
      (() => {
        const NativeWorker = window.Worker;
        const heldCallbacks = [];
        const control = {
          created: 0,
          terminated: 0,
          held: 0,
          released: 0,
          mode: 'normal',
        };
        class ControlledWorker {
          constructor(url, options) {
            this.mode = control.mode;
            this.bridges = new Map();
            control.created += 1;
            // WHAT: Leave timeout-mode Workers unsettled until the application-owned deadline terminates them.
            // WHY: The served proof must exercise finite timeout settlement without changing production timing.
            if (this.mode === 'timeout') {
              this.nativeWorker = null;
              return;
            }
            this.nativeWorker = new NativeWorker(url, options);
          }

          addEventListener(type, listener) {
            const bridge = (event) => {
              // WHAT: Hold one real Worker result past supersession when delay mode owns this Worker.
              // WHY: Releasing the result after a newer generation settles proves stale delivery cannot repaint the editor.
              if (this.mode === 'delay' && type === 'message') {
                control.held += 1;
                heldCallbacks.push(() => {
                  control.released += 1;
                  // WHAT: Deliver through either supported listener shape.
                  // WHY: Browser EventTarget accepts functions and handleEvent objects.
                  if (typeof listener === 'function') listener.call(this, event);
                  else listener.handleEvent(event);
                });
                return;
              }
              // WHAT: Forward every non-held Worker event to the application listener.
              // WHY: Normal derivation must remain the real production Worker path.
              if (typeof listener === 'function') listener.call(this, event);
              else listener.handleEvent(event);
            };
            this.bridges.set(listener, bridge);
            this.nativeWorker?.addEventListener(type, bridge);
          }

          removeEventListener(type, listener) {
            const bridge = this.bridges.get(listener);
            // WHAT: Remove only the bridge registered for this listener.
            // WHY: Application cleanup must retain native EventTarget ownership.
            if (bridge) this.nativeWorker?.removeEventListener(type, bridge);
            this.bridges.delete(listener);
          }

          postMessage(message) {
            this.nativeWorker?.postMessage(message);
          }

          terminate() {
            control.terminated += 1;
            this.nativeWorker?.terminate();
          }
        }
        window.__authoredDiffWorkerControl = control;
        window.__releaseHeldAuthoredDiffWorkers = () => {
          heldCallbacks.splice(0).forEach((callback) => callback());
        };
        window.Worker = ControlledWorker;
      })();
    ` });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
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
    const content = editor.locator('.cm-content');
    await content.waitFor({ state: 'visible' });
    await content.click();
    await editor.getByRole('button', { name: 'Find', exact: true }).click();
    const search = editor.locator('.cm-search input').first();
    await search.fill('<FULL_THREAD>');
    await editor.locator('.cm-search').getByRole('button', { name: 'next', exact: true }).click();
    await page.keyboard.press('Escape');
    const revealedSource = editor.locator('.cm-line').filter({ hasText: '<FULL_THREAD>' });
    assert.equal(await revealedSource.count(), 1);
    await page.evaluate(async () => {
      const { EditorView } = await import('/assets/vendor/codemirror-6.0.2.js');
      const editorElement = document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .cm-editor');
      const view = EditorView.findFromDOM(editorElement!);
      const fenceStart = view.state.doc.toString().lastIndexOf('```', view.state.selection.main.from);
      // WHAT: Move the main selection to the blank byte immediately before the changed fenced block.
      // WHY: The changed block must return to canonical presentation without moving its viewport out of evidence.
      view.dispatch({ selection: { anchor: Math.max(0, fenceStart - 1) } });
    });
    const additions = editor.locator('.cm-ledger-block-widget .cm-authored-addition');
    await additions.first().waitFor({ state: 'visible' });
    const presentation = await editor.evaluate((element) => {
      const additionElements = [...element.querySelectorAll<HTMLElement>('.cm-ledger-block-widget .cm-authored-addition')];
      const deletionElements = [...element.querySelectorAll<HTMLElement>('.cm-ledger-block-widget .cm-authored-deletion')];
      const contextLine = [...element.querySelectorAll<HTMLElement>('.cm-ledger-block-widget li, .cm-ledger-block-widget p')]
        .find((line) => line.textContent?.includes('Any agent can just follow the plan and write the code'));
      const firstAddition = additionElements[0];
      const style = getComputedStyle(firstAddition);
      return {
        additionLines: additionElements.map((addition) => addition.textContent ?? ''),
        additionSigns: additionElements.map((addition) => getComputedStyle(addition, '::before').content),
        deletionLines: deletionElements.flatMap((deletion) => (
          (deletion.querySelector('.cm-authored-deletion-content')?.textContent ?? '').split('\n').filter(Boolean)
        )),
        deletionLabels: deletionElements.map((deletion) => (
          deletion.querySelector('.cm-authored-deletion-label')?.textContent ?? ''
        )),
        change: firstAddition.getAttribute('data-change'),
        label: firstAddition.getAttribute('aria-label'),
        borderLeftColor: style.borderLeftColor,
        backgroundColor: style.backgroundColor,
        contextLineFound: Boolean(contextLine),
        contextMarked: Boolean(contextLine?.matches('.cm-authored-addition') || contextLine?.querySelector('.cm-authored-addition')),
        headingText: [...element.querySelectorAll<HTMLElement>('.cm-ledger-block-widget .ledger-card-heading')]
          .map((record) => record.textContent ?? ''),
        listCount: element.querySelectorAll('.cm-ledger-block-widget ol, .cm-ledger-block-widget ul').length,
        codeCount: element.querySelectorAll('.cm-ledger-block-widget .ledger-card-code-block').length,
      };
    });
    assert.deepEqual(
      { change: presentation.change, label: presentation.label },
      { change: 'added', label: 'Added Markdown' },
    );
    assert.deepEqual(presentation.additionLines.slice(0, 5), [
      '<FULL_THREAD>',
      '<MASTER_TASK>',
      '<FILE_MAP>',
      '<PREVIOUS_SKILL_RESULT>',
      '<EXECUTION_CONTEXT>',
    ]);
    assert.deepEqual(presentation.deletionLines.slice(0, 5), [
      '{{FULL_THREAD}}',
      '{{MASTER_TASK}}',
      '{{FILE_MAP',
      '{{PREVIOUS_SKILL_RESULT}}',
      '{{EXECUTION_CONTEXT}}',
    ]);
    assert.equal(presentation.additionSigns.every((sign) => sign === '"+"'), true);
    assert.equal(presentation.deletionLabels.every((label) => label === '− Removed'), true);
    assert.notEqual(presentation.borderLeftColor, 'rgba(0, 0, 0, 0)');
    assert.notEqual(presentation.backgroundColor, 'rgba(0, 0, 0, 0)');
    assert.equal(presentation.contextLineFound, true);
    assert.equal(presentation.contextMarked, false);
    assert.ok(currentMarkdown.split('\n').length > presentation.additionLines.length * 10);
    assert.ok(presentation.headingText.some((heading) => heading.includes('For Skills only - not the gate')));
    assert.ok(presentation.listCount > 0);
    assert.ok(presentation.codeCount > 0);
    await editor.getByRole('button', { name: 'Find', exact: true }).click();
    const tailSearch = editor.locator('.cm-search input').first();
    await tailSearch.fill('run all tests again');
    await editor.locator('.cm-search').getByRole('button', { name: 'next', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const { EditorView } = await import('/assets/vendor/codemirror-6.0.2.js');
      const editorElement = document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .cm-editor');
      const view = EditorView.findFromDOM(editorElement!);
      const markdown = view.state.doc.toString();
      const lineStart = markdown.lastIndexOf('\n', view.state.selection.main.from - 1) + 1;
      // WHAT: Move the main selection to the byte immediately before the changed tail line.
      // WHY: The tail must return to canonical presentation while remaining inside the served viewport.
      view.dispatch({ selection: { anchor: Math.max(0, lineStart - 1) } });
    });
    await editor.locator('.cm-ledger-block-widget .cm-authored-addition').first().waitFor({ state: 'visible' });
    const tailPresentation = await editor.evaluate((element) => ({
      additions: [...element.querySelectorAll<HTMLElement>('.cm-ledger-block-widget .cm-authored-addition')]
        .map((addition) => addition.textContent ?? ''),
      deletions: [...element.querySelectorAll<HTMLElement>('.cm-ledger-block-widget .cm-authored-deletion-content')]
        .map((deletion) => deletion.textContent ?? ''),
    }));
    assert.deepEqual([...new Set([...presentation.additionLines, ...tailPresentation.additions])], [
      '<FULL_THREAD>',
      '<MASTER_TASK>',
      '<FILE_MAP>',
      '<PREVIOUS_SKILL_RESULT>',
      '<EXECUTION_CONTEXT>',
      'run all tests again',
    ]);
    assert.deepEqual([...new Set([
      ...presentation.deletionLines,
      ...tailPresentation.deletions.flatMap((deletion) => deletion.split('\n').filter(Boolean)),
    ])], [
      '{{FULL_THREAD}}',
      '{{MASTER_TASK}}',
      '{{FILE_MAP',
      '{{PREVIOUS_SKILL_RESULT}}',
      '{{EXECUTION_CONTEXT}}',
      'run all tests again',
    ]);
    await page.screenshot({ path: join(evidenceRoot, 'gatetest-unified-diff-dev.png'), fullPage: false });

    const diffStatus = editor.locator('.authored-file-diff-status');
    const firstMarker = `GateTest stale Worker first ${Date.now()}.`;
    const secondMarker = `GateTest persisted proof ${Date.now()}.`;
    await page.evaluate(() => {
      (window as unknown as { __authoredDiffWorkerControl: { mode: string } }).__authoredDiffWorkerControl.mode = 'delay';
    });
    await content.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(`\n${firstMarker}`);
    await page.waitForFunction(() => (
      (window as unknown as { __authoredDiffWorkerControl?: { held: number } })
        .__authoredDiffWorkerControl?.held === 1
    ));
    await page.evaluate(() => {
      (window as unknown as { __authoredDiffWorkerControl: { mode: string } }).__authoredDiffWorkerControl.mode = 'normal';
    });
    await page.keyboard.type(`\n${secondMarker}`);
    await diffStatus.waitFor({ state: 'visible' });
    await page.waitForFunction(() => (
      document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .authored-file-diff-status')
        ?.dataset.status === 'available'
    ));
    const settledMarkdown = await content.textContent() ?? '';
    await page.evaluate(() => {
      (window as unknown as { __releaseHeldAuthoredDiffWorkers: () => void }).__releaseHeldAuthoredDiffWorkers();
    });
    await page.waitForTimeout(50);
    assert.equal(await content.textContent(), settledMarkdown);
    assert.equal(await diffStatus.getAttribute('data-status'), 'available');
    assert.equal(
      await page.evaluate(() => (
        (window as unknown as { __authoredDiffWorkerControl: { released: number } })
          .__authoredDiffWorkerControl.released
      )),
      1,
    );

    const gateTestSavePath = `/api/codex/server-skills/${gateTestName}`;
    const saveBody: Array<{ markdown?: string; revision?: string }> = [];
    page.on('request', (request) => {
      // WHAT: Capture only GateTest authored-save requests.
      // WHY: The exact payload must equal the sole CodeMirror document authority.
      if (
        request.method() === 'PUT'
        && request.url().includes(gateTestSavePath)
      ) {
        saveBody.push(request.postDataJSON() as { markdown?: string; revision?: string });
      }
    });
    const expectedPersistedMarkdown = `${currentMarkdown}\n${firstMarker}\n${secondMarker}`;
    const headBeforeSave = git(gateTestOwnerRoot, ['rev-parse', 'HEAD']);
    const saveResponse = page.waitForResponse((candidate) => (
      candidate.request().method() === 'PUT'
      && candidate.url().includes(gateTestSavePath)
    ));
    await editor.getByRole('button', { name: 'Save new revision', exact: true }).click();
    assert.equal((await saveResponse).status(), 200);
    await editor.getByText('Saved as a new Git revision.', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(saveBody[0]?.markdown, expectedPersistedMarkdown);
    assert.notEqual(git(gateTestOwnerRoot, ['rev-parse', 'HEAD']), headBeforeSave);
    assert.equal(git(gateTestOwnerRoot, ['rev-list', '--count', `${headBeforeSave}..HEAD`]), '1');
    assert.equal(readFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), 'utf8'), expectedPersistedMarkdown);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloaded = page.locator('.skill-library-editor-modal[open]');
    await reloaded.waitFor({ state: 'visible' });
    const reloadedContent = reloaded.locator('.cm-content');
    await reloadedContent.waitFor({ state: 'visible' });
    await reloaded.getByRole('button', { name: 'Find', exact: true }).click();
    const persistedSearch = reloaded.locator('.cm-search input').first();
    await persistedSearch.fill(firstMarker);
    await reloaded.locator('.cm-search').getByRole('button', { name: 'next', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.match(await reloadedContent.textContent() ?? '', new RegExp(firstMarker));
    assert.match(await reloadedContent.textContent() ?? '', new RegExp(secondMarker));

    const localMarker = `GateTest preserved local ${Date.now()}.`;
    await reloadedContent.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(`\n${localMarker}`);
    const serverMarker = `GateTest authoritative server ${Date.now()}.`;
    const authoritativeMarkdown = `${expectedPersistedMarkdown}\n${serverMarker}`;
    writeFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), authoritativeMarkdown);
    git(gateTestOwnerRoot, ['add', '--', gateTestOwnerPath]);
    git(gateTestOwnerRoot, [
      'commit',
      '-m',
      'Create GateTest conflict proof',
      '-m',
      'WHAT: Advance the disposable GateTest proof branch with authoritative server bytes.',
      '-m',
      'WHY: The served editor must preserve a stale local draft beside exact conflict evidence.',
    ]);
    const rejectedResponse = page.waitForResponse((candidate) => (
      candidate.request().method() === 'PUT'
      && candidate.url().includes(gateTestSavePath)
    ));
    await reloaded.getByRole('button', { name: 'Save new revision', exact: true }).click();
    assert.equal((await rejectedResponse).status(), 409);
    const conflictEvidence = reloaded.getByRole('region', { name: 'Preserved authored Markdown conflict', exact: true });
    await conflictEvidence.waitFor({ state: 'visible' });
    assert.match(await reloadedContent.textContent() ?? '', new RegExp(localMarker));
    assert.doesNotMatch(await reloadedContent.textContent() ?? '', new RegExp(serverMarker));
    assert.match(await conflictEvidence.textContent() ?? '', new RegExp(localMarker));
    assert.match(await conflictEvidence.textContent() ?? '', new RegExp(serverMarker));
    assert.equal(await reloaded.locator('.authored-file-diff-status').getAttribute('data-status'), 'conflict');
    assert.equal(await reloaded.locator('.cm-authored-addition').count(), 0);
    assert.equal(await reloaded.locator('.cm-authored-deletion').count(), 0);
    await page.screenshot({ path: join(evidenceRoot, 'gatetest-conflict-dev.png'), fullPage: false });

    page.once('dialog', (dialog) => { void dialog.accept(); });
    await reloaded.getByRole('button', { name: 'Reload authoritative', exact: true }).click();
    await reloaded.getByText('Reloaded the server-confirmed revision.', { exact: true }).waitFor({ state: 'visible' });
    const reloadedDocument = await page.evaluate(async () => {
      const { EditorView } = await import('/assets/vendor/codemirror-6.0.2.js');
      const editorElement = document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .cm-editor');
      return EditorView.findFromDOM(editorElement!).state.doc.toString();
    });
    assert.equal(reloadedDocument, authoritativeMarkdown);
    assert.doesNotMatch(reloadedDocument, new RegExp(localMarker));

    await page.evaluate(() => {
      (window as unknown as { __authoredDiffWorkerControl: { mode: string } }).__authoredDiffWorkerControl.mode = 'timeout';
    });
    await reloadedContent.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(`\nGateTest timeout ${Date.now()}.`);
    await page.waitForFunction(() => (
      document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .authored-file-diff-status')
        ?.dataset.status === 'timeout'
    ), undefined, { timeout: 5_000 });
    assert.equal(
      await page.evaluate(() => Boolean(document.activeElement?.closest('.skill-library-editor-modal[open] .cm-content'))),
      true,
    );

    await page.evaluate(() => {
      (window as unknown as { __authoredDiffWorkerControl: { mode: string } }).__authoredDiffWorkerControl.mode = 'delay';
    });
    const heldBeforeClose = await page.evaluate(() => (
      (window as unknown as { __authoredDiffWorkerControl: { held: number } })
        .__authoredDiffWorkerControl.held
    ));
    await page.keyboard.type(`\nGateTest teardown ${Date.now()}.`);
    await page.waitForFunction((minimum) => (
      (window as unknown as { __authoredDiffWorkerControl?: { held: number } })
        .__authoredDiffWorkerControl?.held === minimum
    ), heldBeforeClose + 1);
    const terminatedBeforeClose = await page.evaluate(() => (
      (window as unknown as { __authoredDiffWorkerControl: { terminated: number } })
        .__authoredDiffWorkerControl.terminated
    ));
    page.once('dialog', (dialog) => { void dialog.accept(); });
    await reloaded.getByRole('button', { name: 'Close', exact: true }).click();
    await reloaded.waitFor({ state: 'hidden' });
    assert.equal(
      await page.evaluate((minimum) => (
        (window as unknown as { __authoredDiffWorkerControl: { terminated: number } })
          .__authoredDiffWorkerControl.terminated > minimum
      ), terminatedBeforeClose),
      true,
    );
    assert.equal(await page.locator('.skill-library-editor-modal[open] .text-file-editor').count(), 0);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, [
      'Failed to load resource: the server responded with a status of 409 (Conflict)',
    ]);
  } finally {
    await browser?.close();
    git(gateTestOwnerRoot, ['switch', initialBranch]);
    git(gateTestOwnerRoot, ['branch', '-D', proofBranch]);
    assert.equal(git(gateTestOwnerRoot, ['status', '--short', '--', gateTestOwnerPath]), '');
    assert.equal(readFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), 'utf8'), currentMarkdown);
  }
});

test('served GateTest editor settles a 1,000,000-byte diff without an input-thread long task', { ...canaryOnly, timeout: 120_000 }, async () => {
  assert.equal(canaryUrl, 'http://127.0.0.1:50151', 'DECISION_OS_URL must select the registered canary.');
  const initialBranch = git(gateTestOwnerRoot, ['branch', '--show-current']);
  const proofBranch = `test/gatetest-million-byte-${process.pid}-${Date.now()}`;
  const initialMarkdown = readFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), 'utf8');
  assert.equal(git(gateTestOwnerRoot, ['status', '--short', '--', gateTestOwnerPath]), '');
  git(gateTestOwnerRoot, ['switch', '-c', proofBranch]);
  const baseMarkdown = millionByteGateTestMarkdown();
  const firstRevision = replaceMillionByteToken(baseMarkdown, 128_000, 'CHANGED!');
  const secondRevision = replaceMillionByteToken(firstRevision, 512_000, 'UPDATED!');
  const currentMarkdown = replaceMillionByteToken(secondRevision, 896_000, 'REVISED!');
  assert.equal(Buffer.byteLength(baseMarkdown), 1_000_000);
  assert.equal(Buffer.byteLength(currentMarkdown), 1_000_000);
  writeFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), baseMarkdown);
  git(gateTestOwnerRoot, ['add', '--', gateTestOwnerPath]);
  git(gateTestOwnerRoot, [
    'commit',
    '-m',
    'Create GateTest performance baseline',
    '-m',
    'WHAT: Add the disposable one-million-byte authored Markdown baseline.',
    '-m',
    'WHY: The browser performance gate requires complete adjacent revision bytes.',
  ]);
  writeFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), currentMarkdown);
  git(gateTestOwnerRoot, ['add', '--', gateTestOwnerPath]);
  git(gateTestOwnerRoot, [
    'commit',
    '-m',
    'Create GateTest performance revision',
    '-m',
    'WHAT: Add three source-ordered changes to the one-million-byte baseline.',
    '-m',
    'WHY: The exact Skill route must derive a complete large-document diff.',
  ]);
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
    await page.addInitScript({ content: `
      (() => {
        const NativeWorker = window.Worker;
        const control = { records: [], longTasks: [], measurementStartedAt: 0, settledAt: 0 };
        new PerformanceObserver((list) => {
          control.longTasks.push(...list.getEntries().map((entry) => ({
            startTime: entry.startTime,
            duration: entry.duration,
          })));
        }).observe({ type: 'longtask', buffered: true });
        class MeasuredWorker {
          constructor(url, options) {
            this.nativeWorker = new NativeWorker(url, options);
            this.bridges = new Map();
            this.record = { postedAt: 0, messageAt: 0, terminatedAt: 0 };
            control.records.push(this.record);
          }

          addEventListener(type, listener) {
            const bridge = (event) => {
              // WHAT: Mark the real Worker delivery before application normalization and decoration.
              // WHY: The performance proof must separate off-thread derivation from input-thread settlement.
              if (type === 'message') {
                this.record.messageAt = performance.now();
              }
              listener.call(this, event);
            };
            this.bridges.set(listener, bridge);
            this.nativeWorker.addEventListener(type, bridge);
          }

          removeEventListener(type, listener) {
            const bridge = this.bridges.get(listener);
            // WHAT: Remove only a listener bridge that this wrapper owns.
            // WHY: Application cleanup must preserve native Worker EventTarget semantics.
            if (bridge) {
              this.nativeWorker.removeEventListener(type, bridge);
            }
            this.bridges.delete(listener);
          }

          postMessage(message) {
            this.record.postedAt = performance.now();
            performance.mark('authored-diff-worker-posted');
            this.nativeWorker.postMessage(message);
          }

          terminate() {
            this.record.terminatedAt = performance.now();
            this.nativeWorker.terminate();
          }
        }
        window.__authoredDiffPerformance = control;
        window.Worker = MeasuredWorker;
      })();
    ` });
    const cdp = await page.context().newCDPSession(page);
    const traceEvents: unknown[] = [];
    cdp.on('Tracing.dataCollected', (event) => traceEvents.push(...event.value));
    const traceComplete = new Promise<void>((resolveTrace) => {
      cdp.once('Tracing.tracingComplete', () => resolveTrace());
    });
    await cdp.send('Tracing.start', {
      categories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'toplevel',
        'blink',
        'cc',
        'benchmark',
        'blink.user_timing',
        'disabled-by-default-blink.debug.layout',
      ].join(','),
      transferMode: 'ReportEvents',
    });
    const response = await page.goto(
      `${canaryUrl}/skills?editor=skill&name=${gateTestName}&projectId=${gateTestProjectId}`,
      { waitUntil: 'domcontentloaded' },
    );
    assert.equal(response?.status(), 200);
    const editor = page.locator('.skill-library-editor-modal[open]');
    await editor.waitFor({ state: 'visible' });
    const content = editor.locator('.cm-content');
    await content.waitFor({ state: 'visible' });
    const diffStatus = editor.locator('.authored-file-diff-status');
    const initialSettlement = page.waitForFunction(() => {
      const status = document.querySelector<HTMLElement>(
        '.skill-library-editor-modal[open] .authored-file-diff-status',
      )?.dataset.status;
      return Boolean(status && status !== 'idle' && status !== 'deriving');
    }, undefined, { timeout: 20_000 }).then(() => true, () => false);
    const initialSettled = await Promise.race([
      initialSettlement,
      new Promise<false>((resolveDeadline) => setTimeout(() => resolveDeadline(false), 5_000)),
    ]);
    // WHAT: Preserve a browser-native trace when the initial large-document lifecycle misses its bound.
    // WHY: A timeout claim requires evidence of the main-thread subsystem that prevented settlement.
    if (!initialSettled) {
      await cdp.send('Tracing.end');
      await traceComplete;
      writeFileSync(
        join(evidenceRoot, 'gatetest-million-byte-initial-stall-trace.json'),
        JSON.stringify({ traceEvents }),
      );
      const diagnostic = await page.evaluate(() => ({
        url: location.href,
        status: document.querySelector<HTMLElement>(
          '.skill-library-editor-modal[open] .authored-file-diff-status',
        )?.dataset.status ?? null,
        statuses: [...document.querySelectorAll<HTMLElement>('.authored-file-diff-status')]
          .map((element) => element.dataset.status ?? null),
        modals: [...document.querySelectorAll<HTMLElement>('.skill-library-editor-modal')]
          .map((element) => ({
            open: element.hasAttribute('open'),
            display: getComputedStyle(element).display,
            text: element.innerText.slice(0, 500),
            editors: element.querySelectorAll('.cm-content').length,
          })),
        control: (window as unknown as {
          __authoredDiffPerformance: unknown;
        }).__authoredDiffPerformance,
      }));
      assert.fail(`Initial million-byte diff did not settle within 5,000 ms: ${JSON.stringify(diagnostic)}`);
    }
    const initialDiffStatus = await diffStatus.getAttribute('data-status');
    assert.ok(
      initialDiffStatus === 'available' || initialDiffStatus === 'timeout',
      `Unexpected initial million-byte diff status: ${initialDiffStatus}`,
    );
    const documentBytes = await page.evaluate(async () => {
      const { EditorView } = await import('/assets/vendor/codemirror-6.0.2.js');
      const editorElement = document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .cm-editor');
      return new TextEncoder().encode(EditorView.findFromDOM(editorElement!).state.doc.toString()).byteLength;
    });
    assert.equal(documentBytes, 1_000_000);

    await page.evaluate(() => {
      const control = (window as unknown as {
        __authoredDiffPerformance: {
          records: unknown[];
          longTasks: unknown[];
          measurementStartedAt: number;
          settledAt: number;
        };
      }).__authoredDiffPerformance;
      control.records.length = 0;
      control.longTasks.length = 0;
      control.measurementStartedAt = performance.now();
      control.settledAt = 0;
      performance.clearMarks('authored-diff-worker-posted');
      performance.clearMarks('authored-diff-measurement-settled');
    });
    await content.click({ position: { x: 12, y: 12 } });
    await page.keyboard.press('Control+Home');
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('Shift');
    await page.keyboard.type('!');
    await page.waitForFunction(() => (
      document.querySelector<HTMLElement>('.skill-library-editor-modal[open] .authored-file-diff-status')
        ?.dataset.status === 'deriving'
    ));
    await page.waitForFunction(() => {
      const status = document.querySelector<HTMLElement>(
        '.skill-library-editor-modal[open] .authored-file-diff-status',
      )?.dataset.status;
      return status === 'available' || status === 'timeout';
    }, undefined, { timeout: 5_000 });
    await page.evaluate(async () => {
      await new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame())));
      (window as unknown as {
        __authoredDiffPerformance: { settledAt: number };
      }).__authoredDiffPerformance.settledAt = performance.now();
      performance.mark('authored-diff-measurement-settled');
    });
    await cdp.send('Tracing.end');
    await traceComplete;
    writeFileSync(
      join(evidenceRoot, 'gatetest-million-byte-trace.json'),
      JSON.stringify({ traceEvents }),
    );

    const performanceEvidence = await page.evaluate(() => {
      const control = (window as unknown as {
        __authoredDiffPerformance: {
          records: Array<{ postedAt: number; messageAt: number; terminatedAt: number }>;
          longTasks: Array<{ startTime: number; duration: number }>;
          measurementStartedAt: number;
          settledAt: number;
        };
      }).__authoredDiffPerformance;
      return {
        ...control,
        focused: Boolean(document.activeElement?.closest('.skill-library-editor-modal[open] .cm-content')),
        dom: {
          widgets: document.querySelectorAll('.skill-library-editor-modal[open] .cm-ledger-block-widget').length,
          listItems: document.querySelectorAll('.skill-library-editor-modal[open] .cm-ledger-block-widget li').length,
          sourceLines: document.querySelectorAll('.skill-library-editor-modal[open] .cm-line').length,
          contentChildren: document.querySelector('.skill-library-editor-modal[open] .cm-content')?.children.length ?? 0,
        },
      };
    });
    const activeRecord = performanceEvidence.records.at(-1);
    const terminalStatus = await diffStatus.getAttribute('data-status');
    assert.ok(activeRecord);
    const diffLongTasks = performanceEvidence.longTasks.filter((entry) => (
      entry.startTime < performanceEvidence.settledAt
      && entry.startTime + entry.duration > activeRecord.postedAt
      && entry.duration >= 50
    ));
    const rendererMainTasks = attributableRendererMainTasks(traceEvents);
    writeFileSync(
      join(evidenceRoot, 'gatetest-million-byte-performance.json'),
      JSON.stringify({
        documentBytes,
        terminalStatus,
        workerPostToTerminationMs: activeRecord.terminatedAt - activeRecord.postedAt,
        inputToSettlementMs: performanceEvidence.settledAt - performanceEvidence.measurementStartedAt,
        diffLongTasks,
        attributableRendererMainTasks: rendererMainTasks,
        observedInputLongTasks: performanceEvidence.longTasks.filter((entry) => entry.duration >= 50),
        focused: performanceEvidence.focused,
        dom: performanceEvidence.dom,
        trace: join(evidenceRoot, 'gatetest-million-byte-trace.json'),
      }, null, 2),
    );
    assert.ok(activeRecord.postedAt >= performanceEvidence.measurementStartedAt, JSON.stringify(performanceEvidence));
    assert.ok(activeRecord.terminatedAt >= activeRecord.postedAt, JSON.stringify(performanceEvidence));
    assert.ok(activeRecord.terminatedAt - activeRecord.postedAt < 2_100, JSON.stringify(performanceEvidence));
    assert.ok(performanceEvidence.settledAt - performanceEvidence.measurementStartedAt < 2_500, JSON.stringify(performanceEvidence));
    assert.deepEqual(rendererMainTasks, []);
    assert.ok(terminalStatus === 'available' || terminalStatus === 'timeout');
    assert.equal(performanceEvidence.focused, true);
    // WHAT: Require rendered hunks only when the Worker completed before its finite deadline.
    // WHY: Timeout is an admitted stable state that deliberately withdraws incomplete Git presentation.
    if (terminalStatus === 'available') {
      assert.ok(activeRecord.messageAt >= activeRecord.postedAt, JSON.stringify(performanceEvidence));
      assert.ok(activeRecord.messageAt - activeRecord.postedAt < 2_000, JSON.stringify(performanceEvidence));
      assert.equal(await editor.locator('.cm-authored-addition').count() > 0, true);
      assert.equal(await editor.locator('.cm-authored-deletion').count() > 0, true);
    }
  } finally {
    await browser?.close();
    git(gateTestOwnerRoot, ['switch', initialBranch]);
    git(gateTestOwnerRoot, ['branch', '-D', proofBranch]);
    assert.equal(git(gateTestOwnerRoot, ['status', '--short', '--', gateTestOwnerPath]), '');
    assert.equal(readFileSync(resolve(gateTestOwnerRoot, gateTestOwnerPath), 'utf8'), initialMarkdown);
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
