import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportFederatedPipelineSnapshot,
  exportFederatedSkillManifest,
  exportFederatedSkillSnapshot,
  importFederatedPipelineSnapshot,
  importFederatedSkillSnapshot,
} from '@backend/business/federation/helper/federated-library-cache.js';
import { readCodexPipelineStore, writeCodexPipelineStore } from '@backend/business/codex/helper/codex-pipeline-store.js';
import { scanCodexSkills } from '@backend/business/codex/helper/scan-codex-skills.js';
import {
  readCodexSkillLibraryDetail,
  readCodexSkillRevisionContent,
  readCodexSkillRevisionHistory,
  saveCodexSkillLibrary,
} from '@backend/business/codex/helper/codex-skill-library.js';

function writeSkill(root: string, name: string): void {
  const directory = join(root, '.skills', name);
  mkdirSync(join(directory, 'references'), { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: Federated ${name}\n---\n\n# Instructions\n\nRead references/guide.md.\n`);
  writeFileSync(join(directory, 'references', 'guide.md'), '# Guide\n');
  const timestamp = new Date('2026-07-17T08:00:00.000Z');
  utimesSync(join(directory, 'SKILL.md'), timestamp, timestamp);
}

function commitAll(root: string, subject: string): void {
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, stdio: 'ignore' });
  } catch {
    execFileSync('git', ['init', '-q'], { cwd: root });
  }
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', [
    '-c', 'user.name=Test',
    '-c', 'user.email=test@localhost',
    'commit', '-q', '-m', subject,
  ], { cwd: root });
}

test('materializes complete skill packages locally before importing pipeline definitions', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-codex-home-'));
  const source = mkdtempSync(join(tmpdir(), 'decision-os-federation-source-'));
  const target = mkdtempSync(join(tmpdir(), 'decision-os-federation-target-'));
  const targetProject = join(target, 'project');
  try {
    process.env.CODEX_HOME = codexHome;
    writeSkill(source, 'remote-analysis');
    const sourceDecisionOsRoot = join(source, '.decision-os');
    writeCodexPipelineStore({
      decisionOsRoot: sourceDecisionOsRoot,
      store: {
        pipelines: [{ id: 'remote-pipeline', name: 'Remote pipeline', purpose: '', stepIds: ['remote-step'], createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z' }],
        steps: [{ id: 'remote-step', name: 'Remote step', purpose: '', skills: [{ id: 'remote-skill', skillName: 'remote-analysis', codexModel: null, codexEffort: null }], createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z' }],
        runs: [], skillLibrary: [], activeWorkspaceRun: null,
      },
    });
    commitAll(source, 'Initial federated package');

    const manifest = await exportFederatedSkillManifest(source);
    assert.deepEqual(manifest.skills.map((skill) => skill.name), ['remote-analysis']);
    const skillResult = importFederatedSkillSnapshot({ serverRoot: target, snapshot: await exportFederatedSkillSnapshot(source) });
    assert.deepEqual(skillResult.imported, ['remote-analysis']);
    assert.equal(readFileSync(join(target, '.skills', 'remote-analysis', 'references', 'guide.md'), 'utf8'), '# Guide\n');
    assert.equal(scanCodexSkills({ workspaceRoot: targetProject, serverRoot: target }).find((skill) => skill.name === 'remote-analysis')?.source, 'server');

    const pipelineResult = importFederatedPipelineSnapshot({
      decisionOsRoot: join(target, '.decision-os'),
      snapshot: exportFederatedPipelineSnapshot(sourceDecisionOsRoot),
    });
    assert.deepEqual(pipelineResult.imported, ['remote-pipeline']);
    const localStore = readCodexPipelineStore({ decisionOsRoot: join(target, '.decision-os'), availableSkillNames: ['remote-analysis'] });
    assert.equal(localStore.store.pipelines[0].id, 'remote-pipeline');
    assert.equal(localStore.invalidReferences.length, 0);

    assert.deepEqual(importFederatedSkillSnapshot({ serverRoot: target, snapshot: await exportFederatedSkillSnapshot(source) }).imported, []);
    assert.deepEqual(importFederatedPipelineSnapshot({ decisionOsRoot: join(target, '.decision-os'), snapshot: exportFederatedPipelineSnapshot(sourceDecisionOsRoot) }).imported, []);

    writeFileSync(join(source, '.skills', 'remote-analysis', 'references', 'guide.md'), '# Updated guide\n');
    assert.deepEqual((await exportFederatedSkillSnapshot(source)).skills, []);
    commitAll(source, 'Update federated package');
    const changedSnapshot = await exportFederatedSkillSnapshot(source);
    assert.notEqual(changedSnapshot.skills[0].revision, manifest.skills[0].revision);
    assert.deepEqual(importFederatedSkillSnapshot({ serverRoot: target, snapshot: changedSnapshot }).imported, ['remote-analysis']);
    assert.equal(readFileSync(join(target, '.skills', 'remote-analysis', 'references', 'guide.md'), 'utf8'), '# Updated guide\n');
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(codexHome, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  }
});

test('rejects an escaping skill path without replacing the last local package', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-invalid-codex-home-'));
  const root = mkdtempSync(join(tmpdir(), 'decision-os-federation-invalid-'));
  try {
    process.env.CODEX_HOME = codexHome;
    writeSkill(root, 'safe-skill');
    commitAll(root, 'Safe package');
    const snapshot = await exportFederatedSkillSnapshot(root);
    snapshot.skills[0].files.push({ path: '../escaped.txt', data: Buffer.from('bad').toString('base64'), mode: 0o644 });
    assert.throws(() => importFederatedSkillSnapshot({ serverRoot: root, snapshot }), /escapes its package/);
    assert.equal(existsSync(join(root, 'escaped.txt')), false);
    assert.match(readFileSync(join(root, '.skills', 'safe-skill', 'SKILL.md'), 'utf8'), /safe-skill/);
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(codexHome, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('retains a blocked pipeline and validates it when its federated skill arrives later', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-recovery-home-'));
  const source = mkdtempSync(join(tmpdir(), 'decision-os-federation-recovery-source-'));
  const target = mkdtempSync(join(tmpdir(), 'decision-os-federation-recovery-target-'));
  try {
    process.env.CODEX_HOME = codexHome;
    writeSkill(source, 'late-skill');
    commitAll(source, 'Late package');
    const sourceDecisionOsRoot = join(source, '.decision-os');
    const targetDecisionOsRoot = join(target, '.decision-os');
    writeCodexPipelineStore({
      decisionOsRoot: sourceDecisionOsRoot,
      store: {
        pipelines: [{ id: 'blocked-pipeline', name: 'Blocked pipeline', purpose: '', stepIds: ['blocked-step'], createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z' }],
        steps: [{ id: 'blocked-step', name: 'Blocked step', purpose: '', skills: [{ id: 'late', skillName: 'late-skill', codexModel: null, codexEffort: null }], createdAt: '2026-07-17T08:00:00.000Z', updatedAt: '2026-07-17T08:00:00.000Z' }],
        runs: [], skillLibrary: [], activeWorkspaceRun: null,
      },
    });
    importFederatedPipelineSnapshot({ decisionOsRoot: targetDecisionOsRoot, snapshot: exportFederatedPipelineSnapshot(sourceDecisionOsRoot) });
    const blocked = readCodexPipelineStore({ decisionOsRoot: targetDecisionOsRoot, availableSkillNames: [] });
    assert.equal(blocked.store.pipelines[0].id, 'blocked-pipeline');
    assert.deepEqual(blocked.invalidReferences.map((entry) => entry.reference), ['late-skill']);

    importFederatedSkillSnapshot({ serverRoot: target, snapshot: await exportFederatedSkillSnapshot(source) });
    const recovered = readCodexPipelineStore({ decisionOsRoot: targetDecisionOsRoot, availableSkillNames: ['late-skill'] });
    assert.equal(recovered.store.pipelines[0].id, 'blocked-pipeline');
    assert.equal(recovered.invalidReferences.length, 0);
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(codexHome, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  }
});

test('exports only clean committed authored server skills and keeps imported packages current-only read-only', async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-scope-home-'));
  const source = mkdtempSync(join(tmpdir(), 'decision-os-federation-scope-source-'));
  const target = mkdtempSync(join(tmpdir(), 'decision-os-federation-scope-target-'));
  const workspace = join(target, 'projects', 'project-a');
  try {
    process.env.CODEX_HOME = codexHome;
    writeSkill(source, 'imported-skill');
    commitAll(source, 'Imported package');
    writeSkill(target, 'local-server-skill');
    writeSkill(workspace, 'workspace-skill');
    mkdirSync(join(codexHome, 'skills', 'user-skill'), { recursive: true });
    writeFileSync(join(codexHome, 'skills', 'user-skill', 'SKILL.md'), '---\nname: user-skill\ndescription: User\n---\n\nUser.\n');
    mkdirSync(join(codexHome, 'skills', '.system', 'system-skill'), { recursive: true });
    writeFileSync(join(codexHome, 'skills', '.system', 'system-skill', 'SKILL.md'), '---\nname: system-skill\ndescription: System\n---\n\nSystem.\n');
    mkdirSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill'), { recursive: true });
    writeFileSync(join(codexHome, 'plugins', 'cache', 'vendor', 'plugin', '1.0.0', 'skills', 'plugin-skill', 'SKILL.md'), '---\nname: plugin-skill\ndescription: Plugin\n---\n\nPlugin.\n');
    mkdirSync(join(target, '.decision-os', 'pipeline-prompts'), { recursive: true });
    writeFileSync(join(target, '.decision-os', 'pipeline-prompts', 'pipeline-prompt.md'), 'Pipeline only.\n');
    writeCodexPipelineStore({
      decisionOsRoot: join(target, '.decision-os'),
      store: {
        authoredContent: [{
          id: 'pipeline-prompt',
          kind: 'pipeline-prompt',
          description: 'Pipeline only.',
          contentFile: 'pipeline-prompts/pipeline-prompt.md',
          createdAt: '2026-07-28T00:00:00.000Z',
          updatedAt: '2026-07-28T00:00:00.000Z',
        }],
      },
    });
    commitAll(target, 'Locally authored content');
    importFederatedSkillSnapshot({ serverRoot: target, snapshot: await exportFederatedSkillSnapshot(source) });

    const manifest = await exportFederatedSkillManifest(target, [target, workspace]);
    assert.deepEqual(manifest.skills.map((skill) => skill.name), ['local-server-skill']);
    assert.deepEqual(
      (await exportFederatedSkillSnapshot(target, undefined, [target, workspace])).skills.map((skill) => skill.name),
      ['local-server-skill'],
    );
    const imported = await readCodexSkillLibraryDetail({
      decisionOsRoot: join(target, '.decision-os'),
      runtime: { serverRoot: target },
      skillName: 'imported-skill',
    });
    assert.equal(imported?.editable, false);
    assert.equal(imported?.readOnlyReason, 'Imported federated skills are read-only on this node.');
    assert.deepEqual(imported?.history, []);
    assert.deepEqual(await readCodexSkillRevisionHistory({
      decisionOsRoot: join(target, '.decision-os'),
      runtime: { serverRoot: target },
      skillName: 'imported-skill',
    }), {
      ok: true,
      statusCode: 200,
      history: [],
      nextCursor: null,
    });
    assert.deepEqual(await readCodexSkillRevisionContent({
      decisionOsRoot: join(target, '.decision-os'),
      runtime: { serverRoot: target },
      skillName: 'imported-skill',
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: target, encoding: 'utf8' }).trim(),
    }), {
      ok: false,
      statusCode: 404,
      code: 'content_revision_not_found',
      error: 'Imported federated skills expose only their current revision on this node.',
    });
    const importedSave = await saveCodexSkillLibrary({
      decisionOsRoot: join(target, '.decision-os'),
      runtime: { serverRoot: target },
      skillName: 'imported-skill',
      payload: {
        revision: imported?.revision,
        markdown: imported?.markdown,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
    });
    assert.equal(importedSave.ok, false);
    if (importedSave.ok) return;
    assert.deepEqual({
      statusCode: importedSave.statusCode,
      code: importedSave.code,
      sourceClass: importedSave.sourceClass,
      readOnlyReason: importedSave.readOnlyReason,
    }, {
      statusCode: 403,
      code: 'content_read_only',
      sourceClass: 'imported',
      readOnlyReason: 'Imported federated skills are read-only on this node.',
    });

    const pendingMarkdown = '---\nname: local-server-skill\ndescription: Pending recovery\n---\n\nNot committed.\n';
    const local = await readCodexSkillLibraryDetail({
      decisionOsRoot: join(target, '.decision-os'),
      runtime: { serverRoot: target },
      skillName: 'local-server-skill',
    });
    assert.ok(local);
    const pending = await saveCodexSkillLibrary({
      decisionOsRoot: join(target, '.decision-os'),
      runtime: { serverRoot: target },
      skillName: 'local-server-skill',
      payload: {
        revision: local.revision,
        markdown: pendingMarkdown,
        defaultCodexModel: null,
        defaultCodexEffort: null,
      },
      gitFailureAt: 'add',
    });
    assert.equal(pending.ok, false);
    if (pending.ok) return;
    assert.equal(pending.code, 'git_revision_pending_recovery');
    assert.equal(pending.recovery?.authoredBytesPreserved, true);
    assert.equal(readFileSync(join(target, '.skills', 'local-server-skill', 'SKILL.md'), 'utf8'), pendingMarkdown);
    assert.deepEqual((await exportFederatedSkillManifest(target, [target, workspace])).skills, []);
    assert.deepEqual((await exportFederatedSkillSnapshot(target, undefined, [target, workspace])).skills, []);
  } finally {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    rmSync(codexHome, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  }
});
