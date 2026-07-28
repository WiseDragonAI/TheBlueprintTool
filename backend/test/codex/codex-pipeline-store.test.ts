import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mutateCodexPipelineStore,
  normalizeCodexPipelineStore,
  pipelineStoreFile,
  readCodexPipelineStore,
  writeCodexPipelineStore,
} from '../../src/business/codex/helper/codex-pipeline-store.js';
import { ensureServerPipelines, migrateLegacyProjectPipelines, readScopedCodexPipelineStores } from '../../src/business/codex/helper/server-pipeline-catalog.js';
import {
  exportFederatedPipelineSnapshot,
  importFederatedPipelineSnapshot,
} from '../../src/business/federation/helper/federated-library-cache.js';

function pipelineFixture(id: string, stepId: string, name = id): Record<string, unknown> {
  return {
    pipelines: [{ id, name, purpose: '', stepIds: [stepId], createdAt: 'one', updatedAt: 'one' }],
    steps: [{ id: stepId, name: stepId, purpose: '', skills: [], createdAt: 'one', updatedAt: 'one' }],
    runs: [],
    skillLibrary: [],
    activeWorkspaceRun: null,
  };
}

test('pipeline store starts empty and preserves ordered reusable definitions across a durable round-trip', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-store-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    const empty = readCodexPipelineStore({ decisionOsRoot, availableSkillNames: ['analysis'] });
    assert.deepEqual(empty.store, {
      version: 2,
      pipelines: [],
      steps: [],
      runs: [],
      skillLibrary: [],
      authoredContent: [],
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
          favorite: true,
          tags: ['Research', 'Priority'],
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
    assert.equal(loaded.store.skillLibrary[0].favorite, true);
    assert.deepEqual(loaded.store.skillLibrary[0].tags, ['Research']);
    assert.equal(loaded.invalidReferences.length, 0);
    assert.equal(readFileSync(pipelineStoreFile(decisionOsRoot), 'utf8').includes(workspace), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('pipeline content kinds and prompt file references normalize into one contained durable contract', () => {
  const normalized = normalizeCodexPipelineStore({
    steps: [{
      id: 'prompt-step',
      name: 'Prompt',
      skills: [{ id: 'prompt-content', skillName: 'review-output', codexModel: null, codexEffort: null }],
    }],
    authoredContent: [{
      id: 'review-output',
      kind: 'pipeline-prompt',
      description: 'Review output',
      contentFile: 'pipeline-prompts/review-output.md',
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
    }],
  }, {
    availableSkillNames: ['review-output'],
    availableContentKinds: [['review-output', 'pipeline-prompt']],
  });
  assert.equal(normalized.store.steps[0].skills[0].contentKind, 'pipeline-prompt');
  assert.deepEqual(normalized.store.authoredContent, [{
    id: 'review-output',
    kind: 'pipeline-prompt',
    description: 'Review output',
    contentFile: 'pipeline-prompts/review-output.md',
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
  }]);
  assert.equal(normalized.issues.length, 0);

  const rejected = normalizeCodexPipelineStore({
    steps: [{
      id: 'prompt-step',
      name: 'Prompt',
      skills: [{
        id: 'prompt-content',
        skillName: 'review-output',
        contentKind: 'workspace-skill',
        codexModel: null,
        codexEffort: null,
      }],
    }],
    authoredContent: [{
      id: 'review-output',
      kind: 'pipeline-prompt',
      description: 'Review output',
      contentFile: '../review-output.md',
    }],
  }, {
    availableSkillNames: ['review-output'],
    availableContentKinds: [['review-output', 'pipeline-prompt']],
  });
  assert.equal(rejected.issues.some((entry) => entry.code === 'pipeline-content-kind-mismatch'), true);
  assert.equal(rejected.issues.some((entry) => entry.code === 'invalid-authored-content-file'), true);
  assert.deepEqual(rejected.store.authoredContent, []);
});

test('valid version-1 stores migrate atomically once while invalid and future bytes remain unchanged', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-store-v2-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const file = pipelineStoreFile(decisionOsRoot);
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    writeFileSync(file, `${JSON.stringify({
      version: 1,
      ...pipelineFixture('legacy', 'legacy-step'),
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    const migrated = readCodexPipelineStore({ decisionOsRoot });
    assert.equal(migrated.store.version, 2);
    assert.equal(migrated.store.pipelines[0].id, 'legacy');
    const migratedBytes = readFileSync(file, 'utf8');
    assert.equal((JSON.parse(migratedBytes) as Record<string, unknown>).version, 2);
    readCodexPipelineStore({ decisionOsRoot });
    assert.equal(readFileSync(file, 'utf8'), migratedBytes);

    const invalidV1 = `${JSON.stringify({
      version: 1,
      pipelines: [
        { id: 'duplicate', name: 'One', stepIds: [] },
        { id: 'duplicate', name: 'Two', stepIds: [] },
      ],
    })}\n`;
    writeFileSync(file, invalidV1);
    const invalid = readCodexPipelineStore({ decisionOsRoot });
    assert.equal(invalid.availability, 'unavailable');
    assert.equal(invalid.issues.some((entry) => entry.code === 'duplicate-pipeline-id'), true);
    assert.equal(readFileSync(file, 'utf8'), invalidV1);

    const future = '{"version":99,"pipelines":[]}\n';
    writeFileSync(file, future);
    const rejected = readCodexPipelineStore({ decisionOsRoot });
    assert.equal(rejected.availability, 'unavailable');
    assert.equal(rejected.unavailableCode, 'codex_pipeline_store_unsupported_version');
    assert.match(rejected.incidentId, /^incident-/);
    assert.equal(rejected.issues.some((entry) => entry.code === 'unsupported-store-version'), true);
    assert.throws(() => mutateCodexPipelineStore({
      decisionOsRoot,
      mutate: (store) => store,
    }), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'codex_pipeline_store_corrupt');
      return true;
    });
    assert.equal(readFileSync(file, 'utf8'), future);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('serialized pipeline and prompt mutations retain both updates without stale-store replacement', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-pipeline-store-mutation-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    const stale = readCodexPipelineStore({ decisionOsRoot }).store;
    mutateCodexPipelineStore({
      decisionOsRoot,
      mutate: (store) => ({
        ...store,
        pipelines: [{
          id: 'pipeline-writer',
          name: 'Pipeline writer',
          purpose: '',
          stepIds: [],
          createdAt: 'one',
          updatedAt: 'one',
        }],
      }),
    });
    mutateCodexPipelineStore({
      decisionOsRoot,
      mutate: (store) => ({
        ...store,
        authoredContent: [{
          id: 'prompt-writer',
          kind: 'pipeline-prompt',
          description: 'Prompt writer',
          contentFile: 'pipeline-prompts/prompt-writer.md',
          createdAt: 'two',
          updatedAt: 'two',
        }],
      }),
    });
    assert.deepEqual(stale.pipelines, []);
    const reloaded = readCodexPipelineStore({ decisionOsRoot }).store;
    assert.deepEqual(reloaded.pipelines.map((pipeline) => pipeline.id), ['pipeline-writer']);
    assert.deepEqual(reloaded.authoredContent.map((record) => record.id), ['prompt-writer']);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('server catalog seeds the synchronization pipeline once and preserves operator edits', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-server-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  const skills = ['project-sync-source-publisher', 'project-sync-initiator-reconciler', 'project-sync-source-finalizer'];
  try {
    assert.deepEqual(ensureServerPipelines({ serverDecisionOsRoot: decisionOsRoot, availableSkillNames: skills }).createdPipelineIds, ['project-synchronization']);
    const seeded = readCodexPipelineStore({ decisionOsRoot, availableSkillNames: skills });
    assert.deepEqual(seeded.store.pipelines[0].stepIds, [
      'project-synchronization-source-publish',
      'project-synchronization-initiator-reconcile',
      'project-synchronization-source-finalize',
    ]);
    writeCodexPipelineStore({
      decisionOsRoot,
      availableSkillNames: skills,
      store: {
        ...seeded.store,
        pipelines: seeded.store.pipelines.map((pipeline) => pipeline.id === 'project-synchronization' ? { ...pipeline, name: 'Operator synchronization' } : pipeline),
      },
    });
    assert.deepEqual(ensureServerPipelines({ serverDecisionOsRoot: decisionOsRoot, availableSkillNames: skills }).createdPipelineIds, []);
    assert.equal(readCodexPipelineStore({ decisionOsRoot, availableSkillNames: skills }).store.pipelines[0].name, 'Operator synchronization');
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
  assert.deepEqual(normalized.store.skillLibrary.map((entry) => entry.favorite), [false, false]);
  assert.deepEqual(normalized.store.skillLibrary.map((entry) => entry.tags), [[], []]);
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

test('an invalid store pauses only its catalog scope, records an incident, blocks export and overwrite, then recovers explicitly', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-invalid-pipeline-store-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    writeCodexPipelineStore({ decisionOsRoot, store: {} });
    const file = pipelineStoreFile(decisionOsRoot);
    writeFileSync(file, '{invalid-json', 'utf8');
    const loaded = readCodexPipelineStore({ decisionOsRoot });
    assert.equal(loaded.availability, 'unavailable');
    assert.equal(loaded.unavailableCode, 'codex_pipeline_store_corrupt');
    assert.match(loaded.incidentId, /^incident-/);
    assert.equal(loaded.issues.some((entry) => entry.code === 'invalid-store'), true);
    assert.throws(() => loaded.store, (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'runtime_scope_paused');
      assert.equal((error as { scope?: string }).scope, loaded.scope);
      return true;
    });
    assert.throws(() => readScopedCodexPipelineStores({
      decisionOsRoot,
      runtime: { serverRoot: workspace },
    }), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'runtime_scope_paused');
      return true;
    });
    assert.throws(() => exportFederatedPipelineSnapshot(decisionOsRoot), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'runtime_scope_paused');
      return true;
    });
    assert.throws(() => importFederatedPipelineSnapshot({
      decisionOsRoot,
      snapshot: { version: 1, pipelines: [] },
    }), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'runtime_scope_paused');
      return true;
    });
    assert.throws(() => writeCodexPipelineStore({ decisionOsRoot, store: {} }), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'codex_pipeline_store_corrupt');
      return true;
    });
    assert.equal(readFileSync(file, 'utf8'), '{invalid-json');
    const incidentFile = join(decisionOsRoot, 'runtime-incidents.json');
    const incidentDocument = JSON.parse(readFileSync(incidentFile, 'utf8')) as Record<string, any>;
    const active = incidentDocument.incidents.find((entry: Record<string, any>) => entry.scope === loaded.scope);
    assert.equal(active.status, 'paused');
    assert.equal(active.code, 'codex_pipeline_store_corrupt');
    assert.equal(active.context.file, file);

    const recoveredBytes = `${JSON.stringify({
      version: 2,
      ...pipelineFixture('recovered', 'recovered-step'),
      authoredContent: [],
    }, null, 2)}\n`;
    writeFileSync(file, recoveredBytes);
    const recovered = readCodexPipelineStore({ decisionOsRoot });
    assert.equal(recovered.availability, 'available');
    assert.equal(recovered.store.pipelines[0].id, 'recovered');
    const resolvedDocument = JSON.parse(readFileSync(incidentFile, 'utf8')) as Record<string, any>;
    assert.equal(
      resolvedDocument.incidents.find((entry: Record<string, any>) => entry.scope === loaded.scope).status,
      'resolved',
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('invalid pipeline input cannot replace a valid durable store', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-invalid-pipeline-write-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    writeCodexPipelineStore({ decisionOsRoot, store: pipelineFixture('valid', 'valid-step') });
    const file = pipelineStoreFile(decisionOsRoot);
    const validBytes = readFileSync(file, 'utf8');
    assert.throws(() => writeCodexPipelineStore({
      decisionOsRoot,
      store: {
        ...pipelineFixture('duplicate', 'duplicate-step'),
        pipelines: [
          ...(pipelineFixture('duplicate', 'duplicate-step').pipelines as unknown[]),
          ...(pipelineFixture('duplicate', 'second-step').pipelines as unknown[]),
        ],
      },
    }), (error: unknown) => {
      assert.equal((error as { code?: string }).code, 'codex_pipeline_store_corrupt');
      return true;
    });
    assert.equal(readFileSync(file, 'utf8'), validBytes);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('server pipeline catalog takes precedence while retaining non-conflicting project definitions', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-scoped-pipelines-'));
  const serverDecisionOsRoot = join(root, '.decision-os');
  const projectDecisionOsRoot = join(root, 'project', '.decision-os');
  try {
    writeCodexPipelineStore({ decisionOsRoot: serverDecisionOsRoot, store: pipelineFixture('shared', 'server-step', 'Server') });
    writeCodexPipelineStore({
      decisionOsRoot: projectDecisionOsRoot,
      store: {
        ...pipelineFixture('shared', 'project-step', 'Project'),
        pipelines: [
          ...(pipelineFixture('shared', 'project-step', 'Project').pipelines as unknown[]),
          { id: 'local', name: 'Local', purpose: '', stepIds: ['local-step'], createdAt: 'one', updatedAt: 'one' },
        ],
        steps: [
          ...(pipelineFixture('shared', 'project-step', 'Project').steps as unknown[]),
          { id: 'local-step', name: 'Local step', purpose: '', skills: [], createdAt: 'one', updatedAt: 'one' },
        ],
      },
    });
    const scoped = readScopedCodexPipelineStores({
      decisionOsRoot: projectDecisionOsRoot,
      runtime: { serverRoot: root },
    });
    assert.deepEqual(scoped.pipelines.map((pipeline) => [pipeline.id, pipeline.name, pipeline.scope]), [
      ['shared', 'Server', 'server'],
      ['local', 'Local', 'project'],
    ]);
    assert.deepEqual(scoped.steps.map((step) => [step.id, step.scope]), [
      ['server-step', 'server'],
      ['project-step', 'project'],
      ['local-step', 'project'],
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('legacy project pipelines migrate once into a new server catalog and future project pipelines stay local', () => {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-migrate-pipelines-'));
  const serverDecisionOsRoot = join(root, '.decision-os');
  const firstProject = join(root, 'a', '.decision-os');
  const secondProject = join(root, 'b', '.decision-os');
  try {
    writeCodexPipelineStore({ decisionOsRoot: firstProject, store: pipelineFixture('first', 'first-step') });
    writeCodexPipelineStore({ decisionOsRoot: secondProject, store: pipelineFixture('second', 'second-step') });
    const migrated = migrateLegacyProjectPipelines({
      serverDecisionOsRoot,
      projectDecisionOsRoots: [secondProject, firstProject],
    });
    assert.deepEqual(migrated, { migratedPipelineIds: ['first', 'second'], retainedCollisionIds: [] });
    assert.deepEqual(readCodexPipelineStore({ decisionOsRoot: serverDecisionOsRoot }).store.pipelines.map((pipeline) => pipeline.id), ['first', 'second']);
    assert.deepEqual(readCodexPipelineStore({ decisionOsRoot: firstProject }).store.pipelines, []);
    assert.deepEqual(readCodexPipelineStore({ decisionOsRoot: secondProject }).store.pipelines, []);

    writeCodexPipelineStore({ decisionOsRoot: firstProject, store: pipelineFixture('future-local', 'future-step') });
    assert.deepEqual(migrateLegacyProjectPipelines({ serverDecisionOsRoot, projectDecisionOsRoots: [firstProject] }), {
      migratedPipelineIds: [],
      retainedCollisionIds: [],
    });
    assert.equal(readCodexPipelineStore({ decisionOsRoot: firstProject }).store.pipelines[0].id, 'future-local');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
