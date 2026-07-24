import assert from 'node:assert/strict';
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
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      error: '',
      skills: [{
        id: 'pipeline-remote-skill-1',
        pipelineSkillId: 'saved-skill',
        skillName: 'test-skill',
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
  };
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
