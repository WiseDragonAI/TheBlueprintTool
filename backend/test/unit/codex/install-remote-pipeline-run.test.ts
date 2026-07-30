import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { CodexPipelineRun } from '../../../../shared/schemas/codex-pipeline-types.js';
import {
  installFederatedPipelineRun,
  installRemotePipelineRun,
  removeInstalledRemotePipelineRun,
} from '../../../src/business/codex/helper/install-remote-pipeline-run.js';
import { createTaskExecutionLaunchRequest } from '../../../src/business/codex/helper/task-execution-router.js';

function manifest(): CodexPipelineRun {
  const createdAt = '2026-07-23T02:00:00.000Z';
  return {
    id: 'pipeline-remote',
    restartOfPipelineRunId: null,
    pipelineId: 'saved-pipeline',
    pipelineName: 'Saved pipeline',
    temporary: false,
    executionMode: 'local',
    ledgerId: 'tasks',
    sourceCardId: 'master',
    sourceCardTitle: 'Master',
    outputParentCardId: 'master',
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: null,
    resumedAt: null,
    error: '',
    steps: [{
      id: 'pipeline-remote-step-1',
      stepId: 'saved-step',
      name: 'Step',
      purpose: 'Test remote installation.',
      outputCardId: 'output-card',
      outputSubtaskPosition: 0,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      error: '',
      skills: [{
        id: 'pipeline-remote-skill-1',
        pipelineSkillId: 'saved-skill',
        skillName: 'test-skill',
        contentKind: 'federated-skill',
        runId: 'skill-run',
        executionId: 'execution-remote',
        status: 'pending',
        codexModel: 'gpt-5.6-sol',
        codexEffort: 'medium',
        stdoutFile: '/origin-only/runs/skill-run.jsonl',
        stderrFile: '/origin-only/runs/skill-run.log',
        startedAt: null,
        finishedAt: null,
        error: '',
      }],
    }],
  } as CodexPipelineRun;
}

function promptManifest(overrides: Record<string, unknown> = {}): CodexPipelineRun {
  const promptSnapshot = '# Authenticated remote prompt\n\nUse only this snapshot.';
  const run = manifest();
  return {
    ...run,
    steps: run.steps.map((step) => ({
      ...step,
      skills: step.skills.map((skill) => ({
        ...skill,
        skillName: 'remote-prompt',
        contentKind: 'pipeline-prompt' as const,
        contentRevision: createHash('sha256').update(promptSnapshot).digest('hex'),
        contentCommit: 'a'.repeat(40),
        promptSnapshot,
        ...overrides,
      })),
    })),
  } as CodexPipelineRun;
}

function developerPromptManifest(overrides: Record<string, unknown> = {}): CodexPipelineRun {
  const developerPromptSnapshot = 'platform: <PLATFORM>\n\n# Admitted developer prompt';
  const run = manifest();
  return {
    ...run,
    steps: run.steps.map((step) => ({
      ...step,
      skills: step.skills.map((skill) => ({
        ...skill,
        skillName: 'remote-prompt',
        contentKind: 'pipeline-prompt' as const,
        syntaxVersion: 2 as const,
        developerPromptSnapshot,
        developerPromptRevision: createHash('sha256').update(developerPromptSnapshot).digest('hex'),
        developerPromptCommit: 'b'.repeat(40),
        ...overrides,
      })),
    })),
  } as CodexPipelineRun;
}

test('installs one validated remote pipeline topology with executor-local artifact paths', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-remote-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
    mkdirSync(join(workspace, '.skills', 'test-skill'), { recursive: true });
    writeFileSync(join(workspace, '.skills', 'test-skill', 'SKILL.md'), [
      '---',
      'name: test-skill',
      'description: Remote pipeline test skill',
      '---',
      '',
    ].join('\n'));
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
      cards: [
        { id: 'master', title: 'Master' },
        { id: 'output-card', title: 'Output', comment: { contentFile: '.decision-os/cards/tasks/output-card.md' } },
      ],
      annotations: [],
      relationships: [],
    }));
    writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'output-card.md'), '\n');
    const run = manifest();
    const runtime = {
      readTaskLedgerProjection: () => JSON.parse(readFileSync(join(decisionOsRoot, 'tasks.json'), 'utf8')),
    };
    const requests = [createTaskExecutionLaunchRequest({
      requestId: 'pipeline:pipeline-remote:execution-remote',
      executionId: 'execution-remote',
      projectId: 'project-a',
      ledgerId: 'tasks',
      sessionId: 'skill-run',
      sourceCardId: 'master',
      ownerCardId: 'output-card',
      kind: 'pipeline-skill',
      requestedAt: run.createdAt,
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId: run.id,
      pipelineStepId: run.steps[0].id,
      pipelineSkillRunId: 'skill-run',
    })];

    const installed = installRemotePipelineRun({
      decisionOsRoot,
      runtime,
      run,
      requests,
    });
    assert.equal(installed.installed, true);
    assert.equal(installed.run.steps[0].skills[0].stdoutFile, join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'skill-run.jsonl'));
    assert.equal(installed.run.steps[0].skills[0].stderrFile, join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'skill-run.log'));
    assert.equal(JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')).runs.length, 1);

    const duplicate = installRemotePipelineRun({ decisionOsRoot, runtime, run, requests });
    assert.equal(duplicate.installed, false);
    assert.throws(() => installRemotePipelineRun({
      decisionOsRoot,
      runtime,
      run: { ...run, pipelineName: 'Conflicting topology' },
      requests,
    }), /task_execution_pipeline_manifest_conflict/);

    removeInstalledRemotePipelineRun({ decisionOsRoot, runId: run.id });
    assert.deepEqual(JSON.parse(readFileSync(join(decisionOsRoot, 'codex-pipelines.json'), 'utf8')).runs, []);

    const dynamicRun: CodexPipelineRun = {
      ...run,
      id: 'pipeline-dynamic',
      queuedAfterExecutionId: 'execution-gate',
      initialInputCardId: 'gate-output',
    };
    const dynamicRequests = [createTaskExecutionLaunchRequest({
      ...requests[0],
      requestId: 'pipeline:pipeline-dynamic:execution-remote',
      pipelineRunId: dynamicRun.id,
      predecessorExecutionId: 'execution-gate',
    })];
    const dynamic = installRemotePipelineRun({
      decisionOsRoot,
      runtime,
      run: dynamicRun,
      requests: dynamicRequests,
    });
    assert.equal(dynamic.installed, true);
    assert.equal(dynamic.run.queuedAfterExecutionId, 'execution-gate');
    assert.equal(dynamic.run.initialInputCardId, 'gate-output');
    assert.throws(() => installRemotePipelineRun({
      decisionOsRoot,
      runtime,
      run: { ...dynamicRun, id: 'pipeline-dynamic-invalid' },
      requests: [createTaskExecutionLaunchRequest({
        ...dynamicRequests[0],
        requestId: 'pipeline:pipeline-dynamic-invalid:execution-remote',
        pipelineRunId: 'pipeline-dynamic-invalid',
        predecessorExecutionId: null,
      })],
    }), /task_execution_pipeline_manifest_topology_mismatch/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects an executor-unavailable skill before writing the remote manifest', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-remote-pipeline-unavailable-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    mkdirSync(decisionOsRoot, { recursive: true });
    const run = manifest();
    assert.throws(() => installRemotePipelineRun({
      decisionOsRoot,
      runtime: {},
      run,
      requests: [createTaskExecutionLaunchRequest({
        requestId: 'pipeline:pipeline-remote:execution-remote',
        executionId: 'execution-remote',
        projectId: 'project-a',
        ledgerId: 'tasks',
        sessionId: 'skill-run',
        sourceCardId: 'master',
        ownerCardId: 'output-card',
        kind: 'pipeline-skill',
        requestedAt: run.createdAt,
        model: 'gpt-5.6-sol',
        effort: 'medium',
        pipelineRunId: run.id,
        pipelineStepId: run.steps[0].id,
        pipelineSkillRunId: 'skill-run',
      })],
    }), /task_execution_pipeline_skill_unavailable:test-skill/);
    assert.equal(existsSync(join(decisionOsRoot, 'codex-pipelines.json')), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('installs an authenticated immutable prompt snapshot without writing any skill root', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-remote-prompt-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
      cards: [
        { id: 'master', title: 'Master' },
        { id: 'output-card', title: 'Output', comment: { contentFile: '.decision-os/cards/tasks/output-card.md' } },
      ],
      annotations: [],
      relationships: [],
    }));
    writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'output-card.md'), '\n');
    const run = promptManifest();
    const requests = [createTaskExecutionLaunchRequest({
      requestId: 'pipeline:pipeline-remote:execution-remote',
      executionId: 'execution-remote',
      projectId: 'project-a',
      ledgerId: 'tasks',
      sessionId: 'skill-run',
      sourceCardId: 'master',
      ownerCardId: 'output-card',
      kind: 'pipeline-skill',
      requestedAt: run.createdAt,
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId: run.id,
      pipelineStepId: run.steps[0].id,
      pipelineSkillRunId: 'skill-run',
    })];
    const installed = installRemotePipelineRun({
      decisionOsRoot,
      runtime: {
        readTaskLedgerProjection: () => JSON.parse(readFileSync(join(decisionOsRoot, 'tasks.json'), 'utf8')),
      },
      run,
      requests,
    });
    const stored = installed.run.steps[0].skills[0];
    assert.equal(stored.contentKind, 'pipeline-prompt');
    assert.equal(stored.contentKind === 'pipeline-prompt' ? stored.promptSnapshot : '', '# Authenticated remote prompt\n\nUse only this snapshot.');
    assert.equal(existsSync(join(workspace, '.skills')), false);
    assert.equal(existsSync(join(decisionOsRoot, 'pipeline-prompts')), false);
    const duplicate = installRemotePipelineRun({ decisionOsRoot, runtime: {}, run, requests });
    assert.equal(duplicate.installed, false);
    const replacementSnapshot = '# Different authenticated prompt';
    assert.throws(() => installRemotePipelineRun({
      decisionOsRoot,
      runtime: {},
      run: promptManifest({
        promptSnapshot: replacementSnapshot,
        contentRevision: createHash('sha256').update(replacementSnapshot).digest('hex'),
      }),
      requests,
    }), /task_execution_pipeline_manifest_conflict/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('remote installation preserves and validates the exact version-2 developer prompt envelope', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-remote-developer-prompt-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    mkdirSync(join(decisionOsRoot, 'cards', 'tasks'), { recursive: true });
    writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({
      ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }],
    }));
    writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
      cards: [
        { id: 'master', title: 'Master' },
        { id: 'output-card', title: 'Output', comment: { contentFile: '.decision-os/cards/tasks/output-card.md' } },
      ],
      annotations: [],
      relationships: [],
    }));
    writeFileSync(join(decisionOsRoot, 'cards', 'tasks', 'output-card.md'), '\n');
    const run = developerPromptManifest();
    const requests = [createTaskExecutionLaunchRequest({
      requestId: 'pipeline:pipeline-remote:execution-remote',
      executionId: 'execution-remote',
      projectId: 'project-a',
      ledgerId: 'tasks',
      sessionId: 'skill-run',
      sourceCardId: 'master',
      ownerCardId: 'output-card',
      kind: 'pipeline-skill',
      requestedAt: run.createdAt,
      model: 'gpt-5.6-sol',
      effort: 'medium',
      pipelineRunId: run.id,
      pipelineStepId: run.steps[0].id,
      pipelineSkillRunId: 'skill-run',
    })];
    const installed = installRemotePipelineRun({
      decisionOsRoot,
      runtime: {
        readTaskLedgerProjection: () => JSON.parse(readFileSync(join(decisionOsRoot, 'tasks.json'), 'utf8')),
      },
      run,
      requests,
    });
    const stored = installed.run.steps[0].skills[0];
    assert.equal(stored.syntaxVersion, 2);
    assert.equal(stored.developerPromptSnapshot, 'platform: <PLATFORM>\n\n# Admitted developer prompt');
    assert.equal(existsSync(join(decisionOsRoot, 'pipeline-prompts')), false);
    assert.throws(() => installRemotePipelineRun({
      decisionOsRoot: join(workspace, 'invalid', '.decision-os'),
      runtime: {},
      run: developerPromptManifest({ developerPromptRevision: 'c'.repeat(64) }),
      requests,
    }), /pipeline_developer_prompt_revision_mismatch/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('rejects malformed remote prompt evidence before manifest installation', () => {
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ['missing', { promptSnapshot: '' }, /pipeline_prompt_snapshot_missing/],
    ['missing revision', { contentRevision: undefined }, /pipeline_prompt_snapshot_revision_mismatch/],
    ['missing commit', { contentCommit: undefined }, /pipeline_prompt_snapshot_commit_invalid/],
    ['missing kind', { contentKind: undefined }, /pipeline_prompt_snapshot_kind_mismatch/],
    ['malformed text', { promptSnapshot: '\ud800' }, /pipeline_prompt_snapshot_malformed/],
    ['oversized', { promptSnapshot: 'x'.repeat(1_000_001) }, /pipeline_prompt_snapshot_oversized/],
    ['revision mismatch', { contentRevision: 'b'.repeat(64) }, /pipeline_prompt_snapshot_revision_mismatch/],
    ['unreachable commit identity', { contentCommit: 'not-a-commit' }, /pipeline_prompt_snapshot_commit_invalid/],
    ['kind mismatch', { contentKind: 'workspace-skill' }, /pipeline_prompt_snapshot_kind_mismatch/],
  ];
  for (const [label, overrides, expected] of cases) {
    const workspace = mkdtempSync(join(tmpdir(), `decision-os-remote-prompt-${label.replaceAll(' ', '-')}-`));
    const decisionOsRoot = join(workspace, '.decision-os');
    try {
      const run = promptManifest(overrides);
      assert.throws(() => installRemotePipelineRun({
        decisionOsRoot,
        runtime: {},
        run,
        requests: [createTaskExecutionLaunchRequest({
          requestId: `request-${label}`,
          executionId: 'execution-remote',
          projectId: 'project-a',
          ledgerId: 'tasks',
          sessionId: 'skill-run',
          sourceCardId: 'master',
          ownerCardId: 'output-card',
          kind: 'pipeline-skill',
          requestedAt: run.createdAt,
          model: 'gpt-5.6-sol',
          effort: 'medium',
          pipelineRunId: run.id,
          pipelineStepId: run.steps[0].id,
          pipelineSkillRunId: 'skill-run',
        })],
      }), expected);
      assert.equal(existsSync(join(decisionOsRoot, 'codex-pipelines.json')), false, label);
      assert.equal(existsSync(join(workspace, '.skills')), false, label);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

test('installs a federated prompt run as immutable evidence without materializing prompt content', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-federated-remote-prompt-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    const run: CodexPipelineRun = {
      ...promptManifest(),
      executionMode: 'federated',
      steps: promptManifest().steps.map((step) => ({
        ...step,
        skills: step.skills.map((skill) => ({
          ...skill,
          executor: {
            kind: 'federated',
            nodeId: 'executor-node',
            projectId: 'executor-project',
            role: 'source',
          },
        })),
      })),
    };
    const installed = installFederatedPipelineRun({
      decisionOsRoot,
      runtime: {},
      run,
    });
    const stored = installed.run.steps[0].skills[0];
    assert.equal(installed.installed, true);
    assert.equal(stored.contentKind, 'pipeline-prompt');
    assert.equal(
      stored.contentKind === 'pipeline-prompt' ? stored.promptSnapshot : '',
      '# Authenticated remote prompt\n\nUse only this snapshot.',
    );
    assert.equal(existsSync(join(workspace, '.skills')), false);
    assert.equal(existsSync(join(decisionOsRoot, 'pipeline-prompts')), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('installs one immutable federated topology with executor-local artifact paths', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'decision-os-federated-pipeline-'));
  const decisionOsRoot = join(workspace, '.decision-os');
  try {
    mkdirSync(join(workspace, '.skills', 'test-skill'), { recursive: true });
    writeFileSync(join(workspace, '.skills', 'test-skill', 'SKILL.md'), [
      '---',
      'name: test-skill',
      'description: Federated pipeline test skill',
      '---',
      '',
    ].join('\n'));
    const run: CodexPipelineRun = {
      ...manifest(),
      executionMode: 'federated',
      steps: manifest().steps.map((step) => ({
        ...step,
        skills: step.skills.map((skill) => ({
          ...skill,
          executor: {
            kind: 'federated',
            nodeId: 'executor-node',
            projectId: 'executor-project',
            role: 'source',
          },
        })),
      })),
    };

    const installed = installFederatedPipelineRun({
      decisionOsRoot,
      runtime: {},
      run,
    });
    assert.equal(installed.installed, true);
    assert.equal(installed.run.steps[0].skills[0].executor?.nodeId, 'executor-node');
    assert.equal(
      installed.run.steps[0].skills[0].stdoutFile,
      join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'skill-run.jsonl'),
    );
    assert.equal(
      installed.run.steps[0].skills[0].stderrFile,
      join(decisionOsRoot, 'runs', 'codex-skills', 'tasks', 'skill-run.log'),
    );

    const duplicate = installFederatedPipelineRun({ decisionOsRoot, runtime: {}, run });
    assert.equal(duplicate.installed, false);
    assert.throws(() => installFederatedPipelineRun({
      decisionOsRoot,
      runtime: {},
      run: {
        ...run,
        steps: run.steps.map((step) => ({
          ...step,
          skills: step.skills.map((skill) => ({
            ...skill,
            executor: { ...skill.executor!, nodeId: 'conflicting-node' },
          })),
        })),
      },
    }), /task_execution_pipeline_manifest_conflict/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
