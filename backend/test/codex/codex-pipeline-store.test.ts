import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeCodexPipelineStore,
  pipelineStoreFile,
  readCodexPipelineStore,
  writeCodexPipelineStore,
} from '@backend/business/codex/helper/codex-pipeline-store.js';

test('pipeline store starts empty and preserves ordered reusable definitions across a durable round-trip', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-store-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    const empty = readCodexPipelineStore({ decisionOsRoot, availableSkillNames: ['analysis'] });
    assert.deepEqual(empty.store, {
      version: 1,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [],
      activeWorkspaceRun: null,
    });
    assert.equal(existsSync(pipelineStoreFile(decisionOsRoot)), false);
    assert.equal(pipelineStoreFile(decisionOsRoot), join(decisionOsRoot, 'codex-pipelines.json'));

    writeCodexPipelineStore({
      decisionOsRoot,
      availableSkillNames: ['analysis', 'task-list'],
      store: {
        pipelines: [{
          id: 'pipeline-a',
          name: 'Pipeline A',
          purpose: 'Preserve order',
          stepIds: ['step-b', 'step-a'],
          createdAt: '2026-07-10T00:00:00.000Z',
          updatedAt: '2026-07-10T00:00:00.000Z',
        }],
        steps: [
          {
            id: 'step-a',
            name: 'Analyze',
            purpose: '',
            skills: [{ id: 'skill-analysis', skillName: 'analysis', codexModel: null, codexEffort: null }],
            createdAt: '2026-07-10T00:00:00.000Z',
            updatedAt: '2026-07-10T00:00:00.000Z',
          },
          {
            id: 'step-b',
            name: 'Inventory',
            purpose: '',
            skills: [{ id: 'skill-task-list', skillName: 'task-list', codexModel: 'gpt-5.5', codexEffort: 'xhigh' }],
            createdAt: '2026-07-10T00:00:00.000Z',
            updatedAt: '2026-07-10T00:00:00.000Z',
          },
        ],
        runs: [],
        skillLibrary: [{
          skillName: 'analysis',
          defaultCodexModel: 'gpt-5.4',
          defaultCodexEffort: 'high',
          updatedAt: '2026-07-10T00:00:00.000Z',
        }],
        activeWorkspaceRun: null,
      },
    });

    const loaded = readCodexPipelineStore({ decisionOsRoot, availableSkillNames: ['analysis', 'task-list'] });
    assert.deepEqual(loaded.store.pipelines[0].stepIds, ['step-b', 'step-a']);
    assert.deepEqual(loaded.store.steps.map((step) => step.id), ['step-a', 'step-b']);
    assert.deepEqual(loaded.store.steps[1].skills.map((skill) => skill.skillName), ['task-list']);
    assert.equal(loaded.store.skillLibrary[0].defaultCodexModel, 'gpt-5.4');
    assert.equal(loaded.invalidReferences.length, 0);
    assert.equal(readFileSync(pipelineStoreFile(decisionOsRoot), 'utf8').includes(workspace), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('pipeline store normalization is deterministic and reports duplicate, stale, and invalid references', () => {
  const normalized = normalizeCodexPipelineStore({
    pipelines: [
      { id: 'pipeline-a', name: 'First', stepIds: ['step-a', 'missing-step'] },
      { id: 'pipeline-a', name: 'Duplicate', stepIds: [] },
    ],
    steps: [
      {
        id: 'step-a',
        name: 'Step A',
        skills: [
          { id: 'skill-a', skillName: 'analysis', codexModel: null, codexEffort: null },
          { id: 'skill-b', skillName: 'missing-skill', codexModel: null, codexEffort: null },
        ],
      },
      { id: 'step-a', name: 'Duplicate step', skills: [] },
    ],
    runs: [],
    skillLibrary: [
      { skillName: 'analysis', defaultCodexModel: 'gpt-5.5', defaultCodexEffort: 'xhigh', updatedAt: 'one' },
      { skillName: 'analysis', defaultCodexModel: 'gpt-5.4', defaultCodexEffort: 'high', updatedAt: 'duplicate' },
      { skillName: 'bad-model', defaultCodexModel: 'unsupported', defaultCodexEffort: 'high', updatedAt: 'bad' },
      { skillName: 'stale-skill', defaultCodexModel: null, defaultCodexEffort: null, updatedAt: 'stale' },
      { skillName: '', defaultCodexModel: null, defaultCodexEffort: null, updatedAt: 'empty' },
    ],
  }, { availableSkillNames: ['analysis'] });

  assert.equal(normalized.store.pipelines.length, 1);
  assert.equal(normalized.store.pipelines[0].name, 'First');
  assert.equal(normalized.store.steps.length, 1);
  assert.deepEqual(normalized.store.skillLibrary.map((entry) => entry.skillName), ['analysis', 'stale-skill']);
  assert.deepEqual(normalized.invalidReferences, [
    { kind: 'skill', reference: 'missing-skill', pipelineId: 'pipeline-a', stepId: 'step-a' },
    { kind: 'step', reference: 'missing-step', pipelineId: 'pipeline-a', stepId: 'missing-step' },
  ]);
  const codes = normalized.issues.map((entry) => entry.code);
  assert.equal(codes.includes('duplicate-pipeline-id'), true);
  assert.equal(codes.includes('duplicate-step-id'), true);
  assert.equal(codes.includes('duplicate-skill-library-name'), true);
  assert.equal(codes.includes('unsupported-default-model'), true);
  assert.equal(codes.includes('stale-skill-library-record'), true);
  assert.equal(codes.includes('empty-skill-library-name'), true);
});

test('an invalid store file is reported without corrupting or rewriting it', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-invalid-pipeline-store-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    writeCodexPipelineStore({ decisionOsRoot, store: {} });
    const file = pipelineStoreFile(decisionOsRoot);
    writeFileSync(file, '{invalid-json', 'utf8');
    const loaded = readCodexPipelineStore({ decisionOsRoot });
    assert.deepEqual(loaded.store.pipelines, []);
    assert.equal(loaded.issues.some((entry) => entry.code === 'invalid-store'), true);
    assert.equal(readFileSync(file, 'utf8'), '{invalid-json');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
