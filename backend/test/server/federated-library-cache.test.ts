import test from 'node:test';
import assert from 'node:assert/strict';
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

function writeSkill(root: string, name: string): void {
  const directory = join(root, '.skills', name);
  mkdirSync(join(directory, 'references'), { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: Federated ${name}\n---\n\n# Instructions\n\nRead references/guide.md.\n`);
  writeFileSync(join(directory, 'references', 'guide.md'), '# Guide\n');
  const timestamp = new Date('2026-07-17T08:00:00.000Z');
  utimesSync(join(directory, 'SKILL.md'), timestamp, timestamp);
}

test('materializes complete skill packages locally before importing pipeline definitions', () => {
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

    const manifest = exportFederatedSkillManifest(source);
    assert.deepEqual(manifest.skills.map((skill) => skill.name), ['remote-analysis']);
    const skillResult = importFederatedSkillSnapshot({ serverRoot: target, snapshot: exportFederatedSkillSnapshot(source) });
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

    assert.deepEqual(importFederatedSkillSnapshot({ serverRoot: target, snapshot: exportFederatedSkillSnapshot(source) }).imported, []);
    assert.deepEqual(importFederatedPipelineSnapshot({ decisionOsRoot: join(target, '.decision-os'), snapshot: exportFederatedPipelineSnapshot(sourceDecisionOsRoot) }).imported, []);

    writeFileSync(join(source, '.skills', 'remote-analysis', 'references', 'guide.md'), '# Updated guide\n');
    const changedSnapshot = exportFederatedSkillSnapshot(source);
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

test('rejects an escaping skill path without replacing the last local package', () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-invalid-codex-home-'));
  const root = mkdtempSync(join(tmpdir(), 'decision-os-federation-invalid-'));
  try {
    process.env.CODEX_HOME = codexHome;
    writeSkill(root, 'safe-skill');
    const snapshot = exportFederatedSkillSnapshot(root);
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

test('retains a blocked pipeline and validates it when its federated skill arrives later', () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = mkdtempSync(join(tmpdir(), 'decision-os-federation-recovery-home-'));
  const source = mkdtempSync(join(tmpdir(), 'decision-os-federation-recovery-source-'));
  const target = mkdtempSync(join(tmpdir(), 'decision-os-federation-recovery-target-'));
  try {
    process.env.CODEX_HOME = codexHome;
    writeSkill(source, 'late-skill');
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

    importFederatedSkillSnapshot({ serverRoot: target, snapshot: exportFederatedSkillSnapshot(source) });
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
