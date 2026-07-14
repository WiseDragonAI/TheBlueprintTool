import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
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
import { createHttpServer } from '@backend/business/server/helper/create-http-server.js';
import {
  saveCodexSkillLibrary,
  validateSkillMarkdown,
  writeEditableSkillFile,
} from '@backend/business/codex/helper/codex-skill-library.js';
import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';

function markdown(name: string, description: string, body = 'Follow the instructions.'): string {
  return ['---', `name: ${name}`, `description: ${description}`, '---', '', '# Instructions', '', body, ''].join('\n');
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
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
  writeFileSync(userFile, markdown('user-skill', 'User description'));
  writeFileSync(systemFile, markdown('system-skill', 'System description'));
  writeFileSync(pluginFile, markdown('plugin-skill', 'Plugin description'));
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
    assert.deepEqual(detail.availableTags, ['Architecture', 'Implementation', 'Interface', 'Writing', 'Marketing', 'Product', 'Research', 'Automation', 'Artifacts', 'Platform']);
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
    const storeFile = join(decisionOsRoot, 'codex-pipelines.json');
    const persisted = JSON.parse(readFileSync(storeFile, 'utf8')) as Record<string, any>;
    assert.deepEqual(persisted.skillLibrary[0], {
      skillName: 'workspace-skill',
      favorite: false,
      tags: [],
      defaultCodexModel: 'gpt-5.4',
      defaultCodexEffort: 'high',
      updatedAt: persisted.skillLibrary[0].updatedAt,
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
    assert.equal(JSON.parse(readFileSync(storeFile, 'utf8')).skillLibrary[0].favorite, true);

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
    assert.deepEqual(JSON.parse(readFileSync(storeFile, 'utf8')).skillLibrary[0].tags, ['Research']);

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
    assert.equal(invalidResponse.status, 400);
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
    assert.equal(pathResponse.status, 400);

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
    assert.equal(userDetail.skill.editable, true);
  } finally {
    await closeServer(server);
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  }
});

test('server skill tags persist as project metadata without editing synchronized Markdown', () => {
  const serverRoot = mkdtempSync(join(tmpdir(), 'decision-os-skill-library-server-'));
  const projectRoot = join(serverRoot, 'projects', 'child-project');
  const decisionOsRoot = join(projectRoot, '.decision-os');
  const serverFile = join(serverRoot, '.skills', 'server-skill', 'SKILL.md');
  mkdirSync(decisionOsRoot, { recursive: true });
  mkdirSync(join(serverFile, '..'), { recursive: true });
  writeFileSync(serverFile, markdown('server-skill', 'Server description'));

  try {
    const markdownBeforeTags = readFileSync(serverFile, 'utf8');
    const result = saveCodexSkillLibrary({
      decisionOsRoot,
      runtime: { serverRoot },
      skillName: 'server-skill',
      payload: { tags: ['Interface'] },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.skill.source, 'server');
    assert.equal(result.skill.editable, false);
    assert.deepEqual(result.skill.tags, ['Interface']);
    assert.equal(readFileSync(serverFile, 'utf8'), markdownBeforeTags);
    const persisted = JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')) as Record<string, any>;
    assert.deepEqual(persisted.skillLibrary[0].tags, ['Interface']);
  } finally {
    rmSync(serverRoot, { recursive: true, force: true });
  }
});

test('skill Markdown validation and editable writes reject incomplete content and symlink escapes', () => {
  assert.equal(validateSkillMarkdown(markdown('safe-skill', 'Safe description'), 'safe-skill').ok, true);
  assert.match(validateSkillMarkdown('---\nname: safe-skill\ndescription: Missing close', 'safe-skill').error ?? '', /opening and closing/);
  assert.match(validateSkillMarkdown(markdown('safe-skill', ''), 'safe-skill').error ?? '', /description/);
  assert.match(validateSkillMarkdown(['---', 'name: safe-skill', 'description: Safe', '---', '', ''].join('\n'), 'safe-skill').error ?? '', /instruction body/);

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
