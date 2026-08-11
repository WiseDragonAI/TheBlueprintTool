import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHttpServer } from '@backend/business/server/application/create-decision-os-server.js';
import {
  createCodexSkillLibrary,
  readCodexContentCatalog,
  readCodexSkillCatalog,
  readCodexSkillLibraryDetail,
  readCodexSkillRevisionHistory,
  saveCodexSkillLibrary,
  validateSkillMarkdown,
  writeEditableSkillFile,
} from '@backend/business/codex/helper/codex-skill-library.js';
import {
  importedFederatedSkillMarker,
  scanCodexSkills,
  skillRevision,
} from '@backend/business/codex/helper/scan-codex-skills.js';
import {
  mutateCodexPipelineStore,
  writeCodexPipelineStore,
} from '@backend/business/codex/helper/codex-pipeline-store.js';
import { acquireRepositoryMutationLock } from '@backend/business/content-authoring/helper/repository-mutation-lock.js';
import { ensureDecisionOsGitRepository } from '@backend/business/server/helper/ensure-decision-os-git-repository.js';

function markdown(name: string, description: string, body = 'Follow the instructions.'): string {
  return ['---', `name: ${name}`, `description: ${description}`, '---', '', '# Instructions', '', body, ''].join('\n');
}

function initializeGitRepository(root: string): void {
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '--force', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@localhost', 'commit', '-q', '-m', 'Initial fixture'], { cwd: root });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

function deferred<T>(): {
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let reject!: (error: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

async function settleWithin<T>(promise: Promise<T>, description: string, timeoutMs = 1_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${description} did not settle within ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function waitForValue<T>(read: () => Promise<T | undefined>, description: string, timeoutMs = 2_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 10);
      timer.unref?.();
    });
  }
  throw new Error(`${description} was not observed within ${timeoutMs}ms.`);
}

test('skill library routes save editable Markdown and defaults without exposing paths or partially writing failures', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skill-library-'));
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skill-library-home-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const workspaceFile = join(workspace, '.skills', 'workspace-skill', 'SKILL.md');
  const userFile = join(codexHome, 'skills', 'user-skill', 'SKILL.md');
  const systemFile = join(codexHome, 'skills', '.system', 'system-skill', 'SKILL.md');
  const pluginFile = join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md');
  for (const file of [workspaceFile, userFile, systemFile, pluginFile]) mkdirSync(join(file, '..'), { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(workspaceFile, markdown('workspace-skill', 'Workspace description'));
  const referenceRoot = join(workspaceFile, '..', 'references');
  mkdirSync(join(referenceRoot, 'nested'), { recursive: true });
  writeFileSync(join(referenceRoot, 'guide.md'), '# Guide\n\nUse the guide.\n');
  writeFileSync(join(referenceRoot, 'nested', 'schema.json'), '{"type":"object"}\n');
  writeFileSync(join(referenceRoot, 'asset.png'), Buffer.from([0, 1, 2, 3]));
  symlinkSync(join(referenceRoot, 'guide.md'), join(referenceRoot, 'linked.md'));
  writeFileSync(userFile, markdown('user-skill', 'User description'));
  writeFileSync(systemFile, markdown('system-skill', 'System description'));
  writeFileSync(pluginFile, markdown('plugin-skill', 'Plugin description'));
  initializeGitRepository(workspace);
  process.env.CODEX_HOME = codexHome;

  const runtime: Record<string, any> = { decisionOsRoot };
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1' }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const detailResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`);
    assert.equal(detailResponse.status, 200);
    const detailText = await detailResponse.text();
    const detail = JSON.parse(detailText) as Record<string, any>;
    assert.equal(detail.skill.name, 'workspace-skill');
    assert.equal(detail.skill.editable, true);
    assert.equal(detail.skill.defaultCodexModel, null);
    assert.equal(detail.skill.defaultCodexEffort, null);
    assert.equal(detail.skill.favorite, false);
    assert.deepEqual(detail.skill.tags, []);
    assert.deepEqual(detail.skill.references, [
      { name: 'guide.md', markdown: '# Guide\n\nUse the guide.\n' },
      { name: 'nested/schema.json', markdown: '```json\n{"type":"object"}\n```\n' },
    ]);
    assert.deepEqual(detail.availableTags, ['System', 'Architecture', 'Implementation', 'Interface', 'Writing', 'Marketing', 'Product', 'Research', 'Automation', 'Artifacts', 'Platform']);
    assert.equal('skillFile' in detail.skill, false);
    assert.equal(detailText.includes(workspace), false);

    const updatedMarkdown = markdown('workspace-skill', 'Updated workspace description', 'Use the updated workflow.');
    const saveResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: detail.skill.revision,
        markdown: updatedMarkdown,
        defaultCodexModel: 'gpt-5.4',
        defaultCodexEffort: 'high',
      }),
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json() as Record<string, any>;
    assert.equal(saved.skill.description, 'Updated workspace description');
    assert.equal(saved.skill.defaultCodexModel, 'gpt-5.4');
    assert.equal(saved.skill.defaultCodexEffort, 'high');
    assert.notEqual(saved.skill.revision, detail.skill.revision);
    assert.equal(readFileSync(workspaceFile, 'utf8'), updatedMarkdown);
    const historyResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill/revisions`);
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json() as Record<string, any>;
    assert.equal(history.history.length, 2);
    assert.equal(history.history[0].subject, 'Revise federated-skill workspace-skill');
    const revisionResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill/revisions/${history.history[0].commit}`);
    assert.equal(revisionResponse.status, 200);
    const revisionDetail = await revisionResponse.json() as Record<string, any>;
    assert.equal(revisionDetail.revision.markdown, updatedMarkdown);
    assert.match(revisionDetail.revision.patch, /Updated workspace description/);
    const storeFile = join(decisionOsRoot, 'codex-pipelines.json');
    const persisted = JSON.parse(readFileSync(storeFile, 'utf8')) as Record<string, any>;
    const persistedWorkspaceSkill = persisted.skillLibrary.find(
      (record: Record<string, any>) => record.skillName === 'workspace-skill',
    );
    assert.deepEqual(persistedWorkspaceSkill, {
      skillName: 'workspace-skill',
      favorite: false,
      tags: [],
      defaultCodexModel: 'gpt-5.4',
      defaultCodexEffort: 'high',
      updatedAt: persistedWorkspaceSkill.updatedAt,
    });

    const markdownBeforeFavorite = readFileSync(workspaceFile, 'utf8');
    const favoriteResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorite: true }),
    });
    assert.equal(favoriteResponse.status, 200);
    const favorite = await favoriteResponse.json() as Record<string, any>;
    assert.equal(favorite.skill.favorite, true);
    assert.equal(readFileSync(workspaceFile, 'utf8'), markdownBeforeFavorite);
    const favoriteCatalog = await fetch(`${baseUrl}/api/codex/skills`).then((response) => response.json()) as Record<string, any>;
    assert.equal(favoriteCatalog.skills.find((entry: Record<string, any>) => entry.name === 'workspace-skill').favorite, true);
    const favoriteStore = JSON.parse(readFileSync(storeFile, 'utf8')) as Record<string, any>;
    assert.equal(
      favoriteStore.skillLibrary.find(
        (record: Record<string, any>) => record.skillName === 'workspace-skill',
      ).favorite,
      true,
    );

    const tagsResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: ['Research'] }),
    });
    assert.equal(tagsResponse.status, 200);
    const tagged = await tagsResponse.json() as Record<string, any>;
    assert.deepEqual(tagged.skill.tags, ['Research']);
    assert.equal(tagged.skill.favorite, true);
    assert.equal(readFileSync(workspaceFile, 'utf8'), markdownBeforeFavorite);
    const tagsCatalog = await fetch(`${baseUrl}/api/codex/skills`).then((response) => response.json()) as Record<string, any>;
    assert.deepEqual(tagsCatalog.skills.find((entry: Record<string, any>) => entry.name === 'workspace-skill').tags, ['Research']);
    assert.deepEqual(tagsCatalog.availableTags, detail.availableTags);

    const unsupportedTagsResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: ['Research', 'Priority'] }),
    });
    assert.equal(unsupportedTagsResponse.status, 400);
    assert.match(String((await unsupportedTagsResponse.json() as Record<string, any>).error), /at most one value from/);
    const tagsStore = JSON.parse(readFileSync(storeFile, 'utf8')) as Record<string, any>;
    assert.deepEqual(
      tagsStore.skillLibrary.find(
        (record: Record<string, any>) => record.skillName === 'workspace-skill',
      ).tags,
      ['Research'],
    );

    const multipleTagsResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: ['Research', 'Automation'] }),
    });
    assert.equal(multipleTagsResponse.status, 400);

    const staleResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: detail.skill.revision,
        markdown: updatedMarkdown,
        defaultCodexModel: 'gpt-5.5',
        defaultCodexEffort: 'xhigh',
      }),
    });
    assert.equal(staleResponse.status, 409);
    const stale = await staleResponse.json() as Record<string, any>;
    assert.equal(stale.currentRevision, saved.skill.revision);

    const markdownBeforeInvalid = readFileSync(workspaceFile, 'utf8');
    const storeBeforeInvalid = readFileSync(storeFile, 'utf8');
    const invalidResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: saved.skill.revision,
        markdown: markdown('renamed-skill', 'Renamed description'),
        defaultCodexModel: 'gpt-5.5',
        defaultCodexEffort: 'xhigh',
      }),
    });
    assert.equal(invalidResponse.status, 422);
    assert.equal(readFileSync(workspaceFile, 'utf8'), markdownBeforeInvalid);
    assert.equal(readFileSync(storeFile, 'utf8'), storeBeforeInvalid);

    const unsupportedResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: saved.skill.revision,
        markdown: updatedMarkdown,
        defaultCodexModel: 'unsupported',
        defaultCodexEffort: 'high',
      }),
    });
    assert.equal(unsupportedResponse.status, 400);
    assert.equal(readFileSync(workspaceFile, 'utf8'), markdownBeforeInvalid);
    assert.equal(readFileSync(storeFile, 'utf8'), storeBeforeInvalid);

    const pathResponse = await fetch(`${baseUrl}/api/codex/skill-library/workspace-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: saved.skill.revision,
        markdown: updatedMarkdown,
        defaultCodexModel: 'gpt-5.4',
        defaultCodexEffort: 'high',
        path: workspaceFile,
      }),
    });
    assert.equal(pathResponse.status, 422);

    for (const [skillName, expectedSource] of [['system-skill', 'system'], ['plugin-skill', 'plugin']] as const) {
      const protectedDetailResponse = await fetch(`${baseUrl}/api/codex/skill-library/${skillName}`);
      assert.equal(protectedDetailResponse.status, 200);
      const protectedDetail = await protectedDetailResponse.json() as Record<string, any>;
      assert.equal(protectedDetail.skill.source, expectedSource);
      assert.equal(protectedDetail.skill.editable, false);
      const protectedFavoriteResponse = await fetch(`${baseUrl}/api/codex/skill-library/${skillName}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ favorite: true }),
      });
      assert.equal(protectedFavoriteResponse.status, 200);
      assert.equal((await protectedFavoriteResponse.json() as Record<string, any>).skill.favorite, true);
      const protectedSaveResponse = await fetch(`${baseUrl}/api/codex/skill-library/${skillName}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          revision: protectedDetail.skill.revision,
          markdown: protectedDetail.skill.markdown,
          defaultCodexModel: null,
          defaultCodexEffort: null,
        }),
      });
      assert.equal(protectedSaveResponse.status, 403);
    }

    const userDetailResponse = await fetch(`${baseUrl}/api/codex/skill-library/user-skill`);
    assert.equal(userDetailResponse.status, 200);
    const userDetail = await userDetailResponse.json() as Record<string, any>;
    assert.equal(userDetail.skill.source, 'user');
    assert.equal(userDetail.skill.editable, false);
    assert.equal(userDetail.skill.readOnlyReason, 'User skills are read-only.');
  } finally {
    await closeServer(server);
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('server skill tags persist as project metadata without editing synchronized Markdown', async () => {
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-skill-library-server-'));
  const projectRoot = join(serverRoot, 'projects', 'child-project');
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const serverFile = join(serverRoot, '.skills', 'server-skill', 'SKILL.md');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(join(serverFile, '..'), { recursive: true });
  writeFileSync(serverFile, markdown('server-skill', 'Server description'));

  try {
    const markdownBeforeTags = readFileSync(serverFile, 'utf8');
    const result = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot },
      skillName: 'server-skill',
      payload: { tags: ['Interface'] },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.skill.source, 'server');
    assert.equal(result.skill.editable, true);
    assert.deepEqual(result.skill.tags, ['Interface']);
    assert.equal(readFileSync(serverFile, 'utf8'), markdownBeforeTags);
    const persisted = JSON.parse(readFileSync(join(serverRoot, '.decision-os', 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.deepEqual(persisted.skillLibrary[0].tags, ['Interface']);
  } finally {
    rmSync(serverRoot, { recursive: true, force: true });
  }
});

test('project-context server saves acquire the canonical server repository owner', async () => {
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-server-owner-repository-'));
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-project-owner-repository-'));
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const skillFile = join(serverRoot, '.skills', 'canonical-server-skill', 'SKILL.md');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(join(skillFile, '..'), { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(skillFile, markdown('canonical-server-skill', 'Canonical owner'));
  initializeGitRepository(serverRoot);
  initializeGitRepository(projectRoot);
  const projectHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const runtime = { serverRoot, projectId: 'project-a' };
  const detail = await readCodexSkillLibraryDetail({
    decisionOsRoot,
    runtime,
    skillName: 'canonical-server-skill',
  });
  assert.ok(detail);
  const projectLock = await acquireRepositoryMutationLock({
    repositoryRoot: projectRoot,
    purpose: 'unrelated-project-owner',
  });
  try {
    const savedMarkdown = markdown('canonical-server-skill', 'Saved through project context');
    const result = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime,
      skillName: 'canonical-server-skill',
      payload: {
        revision: detail.revision,
        markdown: savedMarkdown,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.publication.status, 'not-applicable');
    assert.equal(readFileSync(skillFile, 'utf8'), savedMarkdown);
    assert.deepEqual(
      execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: serverRoot, encoding: 'utf8' })
        .trim().split('\n'),
      ['.skills/canonical-server-skill/SKILL.md'],
    );
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(), projectHead);
  } finally {
    projectLock.release();
    rmSync(serverRoot, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('skill creation separates pipeline-only prompts from natural discovery and commits every revision', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skill-create-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(workspace, 'README.md'), 'fixture\n');
  initializeGitRepository(workspace);
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: workspace });
  execFileSync('git', ['config', 'user.email', 'test@localhost'], { cwd: workspace });
  ensureDecisionOsGitRepository(decisionOsRoot);
  try {
    mkdirSync(join(decisionOsRoot, 'pipeline-prompts'), { recursive: true });
    writeFileSync(join(decisionOsRoot, 'pipeline-prompts', 'orphan.md'), markdown('orphan', 'Not registered'));
    assert.equal(readCodexContentCatalog({ decisionOsRoot, runtime: { serverRoot: workspace } }).skills.some((skill) => skill.name === 'orphan'), false);
    const unscopedWorkspace = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'not-federated',
        description: 'Must remain workspace-owned.',
        instructions: 'Do not export.',
        contentKind: 'workspace-skill',
      },
    });
    assert.equal(unscopedWorkspace.ok, false);
    if (!unscopedWorkspace.ok) {
      assert.equal(unscopedWorkspace.statusCode, 422);
      assert.equal(unscopedWorkspace.code, 'workspace_project_required');
    }
    assert.equal(existsSync(join(workspace, '.skills', 'not-federated')), false);
    const workspaceCreated = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: join(workspace, 'server'), projectId: 'project-a' },
      payload: {
        name: 'workspace-authored',
        description: 'Project-owned authoring fixture.',
        instructions: 'Remain inside the selected project.',
        contentKind: 'workspace-skill',
      },
    });
    assert.equal(workspaceCreated.ok, true);
    if (!workspaceCreated.ok) return;
    assert.equal(workspaceCreated.skill.contentKind, 'workspace-skill');
    assert.equal(workspaceCreated.skill.projectId, 'project-a');
    assert.equal(workspaceCreated.skill.gitRevision?.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim());
    const workspaceReload = await readCodexSkillLibraryDetail({
      decisionOsRoot,
      runtime: { serverRoot: join(workspace, 'server'), projectId: 'project-a' },
      skillName: 'workspace-authored',
    });
    assert.equal(workspaceReload?.projectId, 'project-a');
    writeFileSync(join(workspace, 'README.md'), 'operator staged bytes\n');
    execFileSync('git', ['add', 'README.md'], { cwd: workspace });
    const parentHeadBeforePrompt = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
    const created = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'pipeline-review',
        description: 'Review pipeline output.',
        instructions: 'Inspect the prior card and report concrete issues.',
        contentKind: 'pipeline-prompt',
      },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.skill.executionVisibility, 'pipeline-only');
    assert.equal(created.skill.contentKind, 'pipeline-prompt');
    assert.equal(created.skill.history.length, 1);
    assert.equal(scanCodexSkills({ workspaceRoot: workspace, serverRoot: workspace }).some((skill) => skill.name === 'pipeline-review'), false);
    assert.equal(readCodexSkillCatalog({ decisionOsRoot, runtime: { serverRoot: workspace } }).skills.some((skill) => skill.name === 'pipeline-review'), false);
    assert.equal(readCodexContentCatalog({ decisionOsRoot, runtime: { serverRoot: workspace } }).skills.find((skill) => skill.name === 'pipeline-review')?.executionVisibility, 'pipeline-only');
    const createdPaths = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' })
      .trim().split('\n').sort();
    assert.deepEqual(createdPaths, ['codex-pipelines.json', 'pipeline-prompts/pipeline-review.md']);
    const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: workspace, encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(stagedPaths, ['README.md']);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(), parentHeadBeforePrompt);
    const promptStore = JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.deepEqual(promptStore.authoredContent, [{
      id: 'pipeline-review',
      kind: 'pipeline-prompt',
      description: 'Review pipeline output.',
      contentFile: 'pipeline-prompts/pipeline-review.md',
      createdAt: promptStore.authoredContent[0].createdAt,
      updatedAt: promptStore.authoredContent[0].updatedAt,
    }]);
    const duplicate = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'pipeline-review',
        description: 'Duplicate.',
        instructions: 'Must be rejected.',
        contentKind: 'pipeline-prompt',
      },
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.statusCode, 409);

    const revised = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      skillName: 'pipeline-review',
      payload: {
        revision: created.skill.revision,
        markdown: markdown('pipeline-review', 'Review pipeline output.', 'Inspect output and report only verified issues.'),
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.equal(revised.ok, true);
    if (!revised.ok) return;
    assert.equal(revised.skill.history.length, 2);
    assert.equal(revised.skill.history[0].subject, 'Revise pipeline-prompt pipeline-review');
    const revisedPaths = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' })
      .trim().split('\n').sort();
    assert.deepEqual(revisedPaths, ['codex-pipelines.json', 'pipeline-prompts/pipeline-review.md']);
    assert.deepEqual(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: workspace, encoding: 'utf8' }).trim().split('\n'), ['README.md']);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(), parentHeadBeforePrompt);
    const tagged = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      skillName: 'pipeline-review',
      payload: { tags: ['System'] },
    });
    assert.equal(tagged.ok, true);
    if (!tagged.ok) return;
    assert.deepEqual(tagged.skill.tags, ['System']);
    const taggedStore = JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.deepEqual(taggedStore.skillLibrary.find((entry: Record<string, any>) => entry.skillName === 'pipeline-review')?.tags, ['System']);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('server startup initializes a child repository and pipeline-prompt save never enters federation publication', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-child-prompt-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  const runtime: Record<string, any> = {};
  createHttpServer({
    action_payload: { port: 0, host: '127.0.0.1', cwd: workspace },
    runtime_state: runtime,
  });
  const server = runtime.server as Server;
  await once(server, 'listening');
  try {
    assert.equal(existsSync(join(workspace, '.git')), false);
    assert.equal(existsSync(join(decisionOsRoot, '.git')), true);
    const baselineHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim();
    const created = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'local-controller',
        description: 'Runs from the initialized child owner.',
        markdown: '# Local controller\n',
        contentKind: 'pipeline-prompt',
      },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const promptFile = join(decisionOsRoot, 'pipeline-prompts', 'local-controller.md');
    assert.equal(readFileSync(promptFile, 'utf8'), '# Local controller\n');
    assert.notEqual(created.skill.gitRevision?.commit, baselineHead);
    assert.equal(created.skill.gitRevision?.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim());
    assert.equal(created.skill.history.length, 1);

    const revised = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      skillName: 'local-controller',
      payload: {
        revision: created.skill.revision,
        markdown: '# Revised local controller\n',
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.equal(revised.ok, true);
    if (!revised.ok) return;
    assert.equal(readFileSync(promptFile, 'utf8'), '# Revised local controller\n');
    assert.equal(revised.skill.gitRevision?.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim());
    assert.equal(revised.skill.history.length, 2);

    const connector = runtime.federationNodeConnector as Record<string, any>;
    const federationRequestPaths: string[] = [];
    connector.status = () => ({ phase: 'connected' });
    connector.nodes = () => [{ nodeId: 'held-peer', nodeLabel: 'Held peer', online: true, projects: [] }];
    connector.request = async (_nodeId: string, path: string) => {
      federationRequestPaths.push(path);
      const payload = path.startsWith('/api/federation/skills-manifest')
        ? { version: 1, skills: [] }
        : { version: 1, pipelines: [] };
      return {
        status: 200,
        headers: {},
        body: Buffer.from(JSON.stringify(payload)),
        requestId: `request-${federationRequestPaths.length}`,
      };
    };
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const httpMarkdown = '# Saved through the pipeline prompt route\n';
    const response = await settleWithin(fetch(`${baseUrl}/api/codex/server-skills/local-controller`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: revised.skill.revision,
        markdown: httpMarkdown,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      }),
    }), 'pipeline prompt save response');
    assert.equal(response.status, 200);
    const saved = await response.json() as Record<string, any>;
    assert.equal(saved.ok, true);
    assert.equal(saved.skill.contentKind, 'pipeline-prompt');
    assert.equal(saved.publication.status, 'not-applicable');
    assert.equal(readFileSync(promptFile, 'utf8'), httpMarkdown);
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    // WHAT: Exclude only the force-refresh request owned by authored-skill publication.
    // WHY: Automatic non-forced library synchronization may legitimately use the same connector.
    assert.deepEqual(federationRequestPaths.filter((path) => path.includes('refresh=1')), []);

    const directlyEditedMarkdown = '# Directly edited local controller\n';
    writeFileSync(promptFile, directlyEditedMarkdown);
    const editedDetailResponse = await settleWithin(fetch(`${baseUrl}/api/codex/server-skills/local-controller`), 'directly edited prompt detail');
    assert.equal(editedDetailResponse.status, 200);
    const editedDetail = await editedDetailResponse.json() as Record<string, any>;
    const directCommitResponse = await settleWithin(fetch(`${baseUrl}/api/codex/server-skills/local-controller/revisions/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: editedDetail.skill.revision }),
    }), 'direct prompt commit response');
    assert.equal(directCommitResponse.status, 200);
    const directCommit = await directCommitResponse.json() as Record<string, any>;
    assert.equal(directCommit.ok, true);
    assert.equal(directCommit.skill.markdown, directlyEditedMarkdown);
    assert.equal(directCommit.skill.gitRevision.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim());
    assert.deepEqual(
      execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim().split('\n'),
      ['pipeline-prompts/local-controller.md'],
    );
    const cleanCommitResponse = await settleWithin(fetch(`${baseUrl}/api/codex/server-skills/local-controller/revisions/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: directCommit.skill.revision }),
    }), 'clean prompt commit response');
    assert.equal(cleanCommitResponse.status, 422);
    const cleanCommit = await cleanCommitResponse.json() as Record<string, any>;
    assert.equal(cleanCommit.code, 'content_not_changed');

    const history = await readCodexSkillRevisionHistory({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      skillName: 'local-controller',
    });
    assert.equal(history.ok, true);
    if (history.ok) {
      assert.equal(history.history.length, 4);
      assert.equal(history.nextCursor, null);
    }
  } finally {
    await closeServer(server);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('pipeline-prompt save rejects a coupled-store race with HTTP 409 and no new commit', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-prompt-save-race-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(workspace, 'README.md'), 'fixture\n');
  initializeGitRepository(workspace);
  ensureDecisionOsGitRepository(decisionOsRoot);
  try {
    const created = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'race-prompt',
        description: 'Race prompt',
        markdown: '# Original prompt\n',
        contentKind: 'pipeline-prompt',
      },
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const headBeforeSave = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: decisionOsRoot,
      encoding: 'utf8',
    }).trim();
    const promptFile = join(decisionOsRoot, 'pipeline-prompts', 'race-prompt.md');
    const result = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      skillName: 'race-prompt',
      payload: {
        revision: created.skill.revision,
        markdown: '# Submitted prompt\n',
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
      beforeGitRevision: () => {
        mutateCodexPipelineStore({
          decisionOsRoot,
          mutate: (store) => ({
            ...store,
            skillLibrary: store.skillLibrary.map((record) => (
              record.skillName === 'race-prompt' ? { ...record, favorite: true } : record
            )),
          }),
        });
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.statusCode, 409);
    assert.equal(result.code, 'content_revision_conflict');
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim(),
      headBeforeSave,
    );
    assert.equal(readFileSync(promptFile, 'utf8'), '# Original prompt\n');
    const racedStore = JSON.parse(
      readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8'),
    ) as Record<string, any>;
    assert.equal(
      racedStore.skillLibrary.find((record: Record<string, any>) => record.skillName === 'race-prompt')?.favorite,
      true,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('pipeline-prompt revisions reject unresolved exact-name templates before writing', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-prompt-template-validation-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(workspace, 'README.md'), 'fixture\n');
  initializeGitRepository(workspace);
  ensureDecisionOsGitRepository(decisionOsRoot);
  try {
    const availableSkills = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'AVAILABLE_SKILLS',
        description: 'Available skill instructions.',
        markdown: '# Available skills\n\nUse task-list.\n',
        contentKind: 'pipeline-prompt',
      },
    });
    assert.equal(availableSkills.ok, true);
    const gate = await createCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      payload: {
        name: 'gate',
        description: 'Dynamic gate.',
        markdown: '# Gate\n\n{{AVAILABLE_SKILLS}}\n\n{{MASTER_TASK}}\n',
        contentKind: 'pipeline-prompt',
      },
    });
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    const promptFile = join(decisionOsRoot, 'pipeline-prompts', 'gate.md');
    const bytesBefore = readFileSync(promptFile);
    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim();
    const rejected = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
      skillName: 'gate',
      payload: {
        revision: gate.skill.revision,
        markdown: '# Gate\n\n{{available_skills}}\n',
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.statusCode, 422);
    assert.equal(rejected.code, 'pipeline_prompt_template_invalid');
    assert.match(rejected.error, /Pipeline prompt template "available_skills" was not found\./);
    assert.deepEqual(readFileSync(promptFile), bytesBefore);
    assert.equal(
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: decisionOsRoot, encoding: 'utf8' }).trim(),
      headBefore,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('global authored identity admission rejects every indexed source class without path disclosure or writes', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-global-identity-server-'));
  const projectRoot = mkdtempSync(join(tmpdir(), 'decision-os-global-identity-project-'));
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-global-identity-home-'));
  const decisionOsRoot = join(serverRoot, '.decision-os');
  const promptFile = join(decisionOsRoot, 'pipeline-prompts', 'prompt-name.md');
  const files = [
    join(serverRoot, '.skills', 'server-name', 'SKILL.md'),
    join(projectRoot, '.skills', 'workspace-name', 'SKILL.md'),
    join(codexHome, 'skills', 'user-name', 'SKILL.md'),
    join(codexHome, 'skills', '.system', 'system-name', 'SKILL.md'),
    join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-name', 'SKILL.md'),
    join(serverRoot, '.skills', 'imported-name', 'SKILL.md'),
  ];
  try {
    process.env.CODEX_HOME = codexHome;
    for (const file of files) mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(files[0], markdown('server-name', 'Server'));
    writeFileSync(files[1], markdown('workspace-name', 'Workspace'));
    writeFileSync(files[2], markdown('user-name', 'User'));
    writeFileSync(files[3], markdown('system-name', 'System'));
    writeFileSync(files[4], markdown('plugin-name', 'Plugin'));
    writeFileSync(files[5], markdown('imported-name', 'Imported'));
    writeFileSync(join(files[5], '..', importedFederatedSkillMarker), JSON.stringify({ version: 1, source: 'federation' }));
    mkdirSync(join(promptFile, '..'), { recursive: true });
    writeFileSync(promptFile, '# Prompt instructions\n');
    writeCodexPipelineStore({
      decisionOsRoot,
      store: {
        authoredContent: [{
          id: 'prompt-name',
          kind: 'pipeline-prompt',
          description: 'Prompt',
          contentFile: 'pipeline-prompts/prompt-name.md',
          createdAt: 'one',
          updatedAt: 'one',
        }],
      },
    });
    const storeBefore = readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8');
    const runtime = {
      serverRoot,
      registeredProjects: [{ projectId: 'project-a', root: projectRoot }],
    };
    for (const name of ['server-name', 'workspace-name', 'prompt-name', 'user-name', 'system-name', 'plugin-name', 'imported-name']) {
      const result = await createCodexSkillLibrary({
        decisionOsRoot,
        runtime,
        payload: {
          name,
          description: 'Collision',
          instructions: 'Must not be written.',
          contentKind: 'federated-skill',
        },
      });
      assert.equal(result.ok, false, name);
      if (result.ok) continue;
      assert.equal(result.statusCode, 409, name);
      assert.equal(result.code, 'content_identity_conflict', name);
      assert.equal('path' in (result.conflict ?? {}), false, name);
      assert.equal('filePath' in (result.conflict ?? {}), false, name);
      assert.equal('skillFile' in (result.conflict ?? {}), false, name);
      if (name === 'imported-name') assert.equal(result.conflict?.sourceClass, 'imported');
    }
    assert.equal(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8'), storeBefore);
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(serverRoot, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('a Git add failure preserves authored bytes and returns scoped recovery evidence without advancing HEAD', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skill-git-failure-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const skillDirectory = join(workspace, '.skills', 'recoverable-skill');
  const skillFile = join(skillDirectory, 'SKILL.md');
  mkdirSync(skillDirectory, { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(skillFile, markdown('recoverable-skill', 'Initial'));
  initializeGitRepository(workspace);
  try {
    const before = readCodexSkillCatalog({
      decisionOsRoot,
      runtime: { serverRoot: join(workspace, 'server') },
    }).skills.find((skill) => skill.name === 'recoverable-skill');
    assert.ok(before);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
    const commitCount = Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim());
    const updated = markdown('recoverable-skill', 'Updated after Git failure');
    const result = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot: join(workspace, 'server') },
      skillName: 'recoverable-skill',
      payload: {
        revision: before.revision,
        markdown: updated,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
      gitFailureAt: 'add',
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.statusCode, 503);
    assert.equal(result.code, 'git_revision_pending_recovery');
    assert.equal(result.recovery?.authoredBytesPreserved, true);
    assert.equal(result.recovery?.gitRevisionCreated, false);
    assert.equal(result.recovery?.contentRevision, result.currentRevision);
    assert.match(result.recovery?.recoveryToken ?? '', /^[a-f0-9-]{36}$/);
    assert.match(result.recovery?.incidentId ?? '', /^incident-/);
    assert.equal(readFileSync(skillFile, 'utf8'), updated);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(), head);
    const runtime: Record<string, any> = {};
    createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: workspace }, runtime_state: runtime });
    const server = runtime.server as Server;
    await once(server, 'listening');
    try {
      const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const response = await fetch(`${baseUrl}/api/codex/skill-library/recoverable-skill/revisions/retry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recoveryToken: result.recovery?.recoveryToken ?? '',
          contentRevision: result.recovery?.contentRevision ?? '',
        }),
      });
      assert.equal(response.status, 200);
      const recovered = await response.json() as Record<string, any>;
      assert.equal(recovered.ok, true);
      assert.equal(recovered.skill.revision, result.recovery?.contentRevision);
      assert.notEqual(recovered.skill.gitRevision?.commit, head);
      assert.equal(recovered.publication.status, 'not-applicable');
      const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((incidentResponse) => incidentResponse.json()) as Record<string, any>;
      assert.equal(incidents.incidents.some((incident: Record<string, any>) =>
        incident.scope === 'federated-skill-publication:recoverable-skill'
        && incident.code === 'federated_skill_publication_failed'
        && incident.context?.operation === 'retry'), false);
      assert.equal(readFileSync(skillFile, 'utf8'), updated);
      assert.equal(Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim()), commitCount + 1);
      assert.deepEqual(
        execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: workspace, encoding: 'utf8' })
          .trim().split('\n'),
        ['.skills/recoverable-skill/SKILL.md'],
      );
    } finally {
      await closeServer(server);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('content saves expose stable no-op, oversized, locked, and staged states without changing owner bytes', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skill-save-states-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const skillFile = join(workspace, '.skills', 'stateful-skill', 'SKILL.md');
  mkdirSync(join(skillFile, '..'), { recursive: true });
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(skillFile, markdown('stateful-skill', 'Initial state'));
  initializeGitRepository(workspace);
  const runtime = { serverRoot: join(workspace, 'server'), projectId: 'project-a' };
  try {
    const detail = await readCodexSkillLibraryDetail({ decisionOsRoot, runtime, skillName: 'stateful-skill' });
    assert.ok(detail);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim();
    const noOp = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime,
      skillName: 'stateful-skill',
      payload: {
        revision: detail.revision,
        markdown: detail.markdown,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.deepEqual({ statusCode: noOp.statusCode, code: 'code' in noOp ? noOp.code : '' }, { statusCode: 422, code: 'content_not_changed' });
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspace, encoding: 'utf8' }).trim(), head);

    const oversized = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime,
      skillName: 'stateful-skill',
      payload: {
        revision: detail.revision,
        markdown: markdown('stateful-skill', 'Oversized', 'x'.repeat(1_000_001)),
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.deepEqual({ statusCode: oversized.statusCode, code: 'code' in oversized ? oversized.code : '' }, { statusCode: 413, code: 'content_too_large' });
    assert.equal(readFileSync(skillFile, 'utf8'), detail.markdown);

    const lock = await acquireRepositoryMutationLock({ repositoryRoot: workspace, purpose: 'test-live-lock' });
    try {
      const locked = await saveCodexSkillLibrary({
        decisionOsRoot,
        runtime,
        skillName: 'stateful-skill',
        payload: {
          revision: detail.revision,
          markdown: markdown('stateful-skill', 'Locked update'),
          defaultCodexModel: null,
          defaultCodexEffort: null,
        },
      });
      assert.deepEqual({ statusCode: locked.statusCode, code: 'code' in locked ? locked.code : '' }, { statusCode: 423, code: 'repository_mutation_locked' });
      assert.equal(readFileSync(skillFile, 'utf8'), detail.markdown);
    } finally {
      lock.release();
    }

    const stagedMarkdown = markdown('stateful-skill', 'Operator staged update');
    writeFileSync(skillFile, stagedMarkdown);
    execFileSync('git', ['add', '.skills/stateful-skill/SKILL.md'], { cwd: workspace });
    const staged = await saveCodexSkillLibrary({
      decisionOsRoot,
      runtime,
      skillName: 'stateful-skill',
      payload: {
        revision: skillRevision(stagedMarkdown),
        markdown: markdown('stateful-skill', 'Request must not replace staged bytes'),
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.deepEqual({ statusCode: staged.statusCode, code: 'code' in staged ? staged.code : '' }, { statusCode: 409, code: 'authored_path_staged' });
    assert.equal(readFileSync(skillFile, 'utf8'), stagedMarkdown);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('committed federated create and save routes respond before observed relay publication settles', async () => {
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-publication-failure-'));
  const decisionOsRoot = join(serverRoot, '.decision-os');
  mkdirSync(decisionOsRoot, { recursive: true });
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  initializeGitRepository(serverRoot);
  const runtime: Record<string, any> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: serverRoot }, runtime_state: runtime });
  const server = runtime.server as Server;
  await once(server, 'listening');
  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const initialManifest = await fetch(`${baseUrl}/api/federation/skills-manifest`).then((manifestResponse) => manifestResponse.json()) as Record<string, any>;
    assert.deepEqual(initialManifest.skills, []);
    const connector = runtime.federationNodeConnector as Record<string, any>;
    connector.status = () => ({ phase: 'connected' });
    connector.nodes = () => [{ nodeId: 'unavailable-peer', nodeLabel: 'Unavailable peer', online: true, projects: [] }];
    const createPublicationStarted = deferred<void>();
    const createPublication = deferred<never>();
    connector.request = async () => {
      createPublicationStarted.resolve(undefined);
      return await createPublication.promise;
    };
    const response = await settleWithin(fetch(`${baseUrl}/api/codex/skill-library`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'published-locally',
        description: 'Committed before relay publication.',
        instructions: 'Preserve the local revision.',
        contentKind: 'federated-skill',
      }),
    }), 'federated skill create response');
    assert.equal(response.status, 201);
    const body = await response.json() as Record<string, any>;
    assert.equal(body.ok, true);
    assert.equal(body.publication.status, 'not-applicable');
    await settleWithin(createPublicationStarted.promise, 'background create publication start');
    createPublication.reject(new Error('Injected relay request failure after local create commit.'));
    assert.equal(readFileSync(join(serverRoot, '.skills', 'published-locally', 'SKILL.md'), 'utf8'), body.skill.markdown);
    assert.equal(body.skill.gitRevision.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: serverRoot, encoding: 'utf8' }).trim());
    assert.deepEqual(
      execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: serverRoot, encoding: 'utf8' }).trim().split('\n'),
      ['.skills/published-locally/SKILL.md'],
    );
    const createdManifest = await fetch(`${baseUrl}/api/federation/skills-manifest`).then((manifestResponse) => manifestResponse.json()) as Record<string, any>;
    assert.deepEqual(createdManifest.skills.map((skill: Record<string, any>) => skill.name), ['published-locally']);
    await waitForValue(async () => {
      const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((incidentResponse) => incidentResponse.json()) as Record<string, any>;
      return incidents.incidents.find((incident: Record<string, any>) =>
        incident.scope === 'federated-skill-publication:published-locally'
        && incident.code === 'federated_skill_publication_failed'
        && incident.context?.operation === 'create');
    }, 'background create publication incident', 6_000);

    const savedMarkdown = markdown('published-locally', 'Saved before relay publication.', 'Keep the second local revision.');
    const savePublicationStarted = deferred<void>();
    const savePublication = deferred<never>();
    connector.request = async () => {
      savePublicationStarted.resolve(undefined);
      return await savePublication.promise;
    };
    const saveResponse = await settleWithin(fetch(`${baseUrl}/api/codex/skill-library/published-locally`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        revision: body.skill.revision,
        markdown: savedMarkdown,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      }),
    }), 'federated skill save response');
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json() as Record<string, any>;
    assert.equal(saved.ok, true);
    assert.equal(saved.publication.status, 'not-applicable');
    await settleWithin(savePublicationStarted.promise, 'background save publication start');
    savePublication.reject(new Error('Injected relay request failure after local save commit.'));
    assert.equal(readFileSync(join(serverRoot, '.skills', 'published-locally', 'SKILL.md'), 'utf8'), savedMarkdown);
    assert.equal(saved.skill.gitRevision.commit, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: serverRoot, encoding: 'utf8' }).trim());
    assert.deepEqual(
      execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { cwd: serverRoot, encoding: 'utf8' }).trim().split('\n'),
      ['.skills/published-locally/SKILL.md'],
    );
    const historyResponse = await fetch(`${baseUrl}/api/codex/server-skills/published-locally/revisions`);
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json() as Record<string, any>;
    assert.equal(history.ok, true);
    assert.equal(history.history.length, 2);
    const revisionResponse = await fetch(`${baseUrl}/api/codex/server-skills/published-locally/revisions/${history.history[0].commit}`);
    assert.equal(revisionResponse.status, 200);
    const revision = await revisionResponse.json() as Record<string, any>;
    assert.equal(revision.ok, true);
    assert.equal(revision.revision.markdown, savedMarkdown);
    const savedManifest = await fetch(`${baseUrl}/api/federation/skills-manifest`).then((manifestResponse) => manifestResponse.json()) as Record<string, any>;
    assert.notEqual(savedManifest.skills[0].revision, createdManifest.skills[0].revision);

    await waitForValue(async () => {
      const incidents = await fetch(`${baseUrl}/api/diagnostics/incidents`).then((incidentResponse) => incidentResponse.json()) as Record<string, any>;
      return incidents.incidents.find((incident: Record<string, any>) =>
        incident.scope === 'federated-skill-publication:published-locally'
        && incident.code === 'federated_skill_publication_failed'
        && incident.context?.operation === 'save');
    }, 'background save publication incident', 6_000);
  } finally {
    await closeServer(server);
    rmSync(serverRoot, { recursive: true, force: true });
  }
});

test('server and project skill views share migrated server-owned favorite metadata', async () => {
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-server-skill-owner-'));
  const masterDecisionOsRoot = join(serverRoot, '.decision-os');
  const childDecisionOsRoot = join(serverRoot, 'projects', 'child', '.decision-os');
  const secondChildDecisionOsRoot = join(serverRoot, 'projects', 'second-child', '.decision-os');
  const skillFile = join(serverRoot, '.skills', 'server-owned-skill', 'SKILL.md');
  mkdirSync(masterDecisionOsRoot, { recursive: true });
  mkdirSync(childDecisionOsRoot, { recursive: true });
  mkdirSync(secondChildDecisionOsRoot, { recursive: true });
  mkdirSync(join(skillFile, '..'), { recursive: true });
  writeFileSync(skillFile, markdown('server-owned-skill', 'Server-owned metadata fixture'));
  writeFileSync(join(masterDecisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(childDecisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(secondChildDecisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [] }));
  writeFileSync(join(childDecisionOsRoot, 'codex-pipelines.json'), JSON.stringify({
    version: 1,
    pipelines: [],
    steps: [],
    runs: [],
    skillLibrary: [{
      skillName: 'server-owned-skill',
      favorite: true,
      tags: ['Implementation'],
      defaultCodexModel: 'gpt-5.4',
      defaultCodexEffort: 'high',
      updatedAt: '2026-07-17T12:00:00.000Z',
    }],
    activeWorkspaceRun: null,
  }));
  initializeGitRepository(serverRoot);

  const runtime: Record<string, any> = {};
  createHttpServer({ action_payload: { port: 0, host: '127.0.0.1', cwd: serverRoot }, runtime_state: runtime });
  assert.equal(runtime.decisionOsRoot, masterDecisionOsRoot);
  const server = runtime.server as Server;
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const catalog = await fetch(`${baseUrl}/decision-os/projects`).then((response) => response.json()) as Record<string, any>;
    const projectId = catalog.projects.find((project: Record<string, any>) => project.name === 'child').id;
    const globalCreateResponse = await fetch(`${baseUrl}/api/codex/skill-library`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'projectless-server-skill',
        description: 'Created without project ownership.',
        instructions: 'Preserve the server-owned boundary.',
        contentKind: 'federated-skill',
      }),
    });
    assert.equal(globalCreateResponse.status, 201);
    const globalCreated = await globalCreateResponse.json() as Record<string, any>;
    assert.equal(globalCreated.ok, true);
    assert.equal(globalCreated.skill.name, 'projectless-server-skill');
    assert.equal(existsSync(join(serverRoot, '.skills', 'projectless-server-skill', 'SKILL.md')), true);
    const projectSkills = await fetch(`${baseUrl}/p/${encodeURIComponent(projectId)}/api/codex/skills`).then((response) => response.json()) as Record<string, any>;
    const projectSkill = projectSkills.skills.find((skill: Record<string, any>) => skill.name === 'server-owned-skill');
    assert.equal(projectSkill.favorite, true);
    assert.deepEqual(projectSkill.tags, ['Implementation']);

    const ambiguousAuthoringResponse = await fetch(`${baseUrl}/api/codex/skill-library/server-owned-skill`);
    assert.equal(ambiguousAuthoringResponse.status, 400);
    assert.match(await ambiguousAuthoringResponse.text(), /Project id is required in the URL/);

    const saveResponse = await fetch(`${baseUrl}/api/codex/server-skills/server-owned-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorite: true, tags: ['Interface'] }),
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json() as Record<string, any>;
    assert.equal(saved.skill.favorite, true);
    assert.deepEqual(saved.skill.tags, ['Interface']);

    const persisted = JSON.parse(readFileSync(join(masterDecisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    const persistedServerSkill = persisted.skillLibrary.find(
      (record: Record<string, any>) => record.skillName === 'server-owned-skill',
    );
    assert.deepEqual({
      skillName: persistedServerSkill.skillName,
      favorite: persistedServerSkill.favorite,
      tags: persistedServerSkill.tags,
    }, { skillName: 'server-owned-skill', favorite: true, tags: ['Interface'] });
    const childAfterServerSave = JSON.parse(readFileSync(join(childDecisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.deepEqual(childAfterServerSave.skillLibrary[0].tags, ['Implementation']);

    const projectSaveResponse = await fetch(`${baseUrl}/p/${encodeURIComponent(projectId)}/api/codex/skill-library/server-owned-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorite: false, tags: ['Architecture'] }),
    });
    assert.equal(projectSaveResponse.status, 200);
    const projectSaved = await projectSaveResponse.json() as Record<string, any>;
    assert.equal(projectSaved.skill.favorite, false);
    assert.deepEqual(projectSaved.skill.tags, ['Architecture']);
    const masterAfterProjectSave = JSON.parse(readFileSync(join(masterDecisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    const masterServerSkill = masterAfterProjectSave.skillLibrary.find(
      (record: Record<string, any>) => record.skillName === 'server-owned-skill',
    );
    assert.deepEqual({
      skillName: masterServerSkill.skillName,
      favorite: masterServerSkill.favorite,
      tags: masterServerSkill.tags,
    }, { skillName: 'server-owned-skill', favorite: false, tags: ['Architecture'] });

    const projectReload = await fetch(`${baseUrl}/p/${encodeURIComponent(projectId)}/api/codex/skills`).then((response) => response.json()) as Record<string, any>;
    const reloadedProjectSkill = projectReload.skills.find((skill: Record<string, any>) => skill.name === 'server-owned-skill');
    assert.equal(reloadedProjectSkill.favorite, false);
    assert.deepEqual(reloadedProjectSkill.tags, ['Architecture']);
    const serverReload = await fetch(`${baseUrl}/api/codex/server-skills`).then((response) => response.json()) as Record<string, any>;
    const reloadedServerSkill = serverReload.skills.find((skill: Record<string, any>) => skill.name === 'server-owned-skill');
    assert.equal(reloadedServerSkill.favorite, false);
    assert.deepEqual(reloadedServerSkill.tags, ['Architecture']);
    assert.deepEqual(JSON.parse(readFileSync(join(childDecisionOsRoot, 'codex-pipelines.json'), 'utf8')).skillLibrary[0].tags, ['Implementation']);

    const reloadResponse = await fetch(`${baseUrl}/api/codex/server-skills/server-owned-skill`);
    assert.equal(reloadResponse.status, 200);
    const reloaded = await reloadResponse.json() as Record<string, any>;
    assert.equal(reloaded.skill.favorite, false);
    assert.deepEqual(reloaded.skill.tags, ['Architecture']);

    const rejectedResponse = await fetch(`${baseUrl}/api/codex/server-skills/server-owned-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ markdown: '# Not allowed' }),
    });
    assert.equal(rejectedResponse.status, 400);
  } finally {
    await closeServer(server);
    rmSync(serverRoot, { recursive: true, force: true });
  }
});

test('skill Markdown validation and editable writes reject incomplete content and symlink escapes', () => {
  assert.equal(validateSkillMarkdown(markdown('safe-skill', 'Safe description'), 'safe-skill').ok, true);
  assert.match(validateSkillMarkdown('---\nname: safe-skill\ndescription: Missing close', 'safe-skill').error ?? '', /opening and closing/);
  assert.match(validateSkillMarkdown(markdown('safe-skill', ''), 'safe-skill').error ?? '', /description/);
  assert.match(validateSkillMarkdown(['---', 'name: safe-skill', 'description: Safe', '---', '', ''].join('\n'), 'safe-skill').error ?? '', /instruction body/);
  assert.match(validateSkillMarkdown(markdown('safe-skill', 'Oversized', 'x'.repeat(1_000_001)), 'safe-skill').error ?? '', /1,000,000 byte limit/);

  const previousCodexHome = process.env.CODEX_HOME;
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-skill-symlink-'));
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-skill-symlink-home-'));
  const external = mkdtempSync(join(tmpdir(), 'decision-os-skill-symlink-external-'));
  const skillFile = join(workspace, '.skills', 'safe-skill', 'SKILL.md');
  const externalFile = join(external, 'SKILL.md');
  try {
    process.env.CODEX_HOME = codexHome;
    mkdirSync(join(skillFile, '..'), { recursive: true });
    writeFileSync(skillFile, markdown('safe-skill', 'Safe description'));
    writeFileSync(externalFile, markdown('safe-skill', 'External description'));
    const skill = scanCodexSkills({ workspaceRoot: workspace }).find((entry) => entry.name === 'safe-skill');
    assert.ok(skill);
    rmSync(skillFile);
    symlinkSync(externalFile, skillFile, 'file');
    assert.throws(() => writeEditableSkillFile({
      skill,
      workspaceRoot: workspace,
      markdown: markdown('safe-skill', 'Attempted edit'),
      expectedRevision: skill.revision,
    }), /Symlinked skill files/);
    assert.equal(readFileSync(externalFile, 'utf8'), markdown('safe-skill', 'External description'));
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});
