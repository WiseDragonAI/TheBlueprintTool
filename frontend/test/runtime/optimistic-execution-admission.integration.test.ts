import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('responsive execution launches create identity before admission and reconcile exact receipts', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const thread = source('frontend/src/app/responsive/thread.js');
  const codex = source('frontend/src/app/responsive/codex.js');
  const canvasThread = source('frontend/src/runtime/codex/controller/process-thread-codex-controller.ts');
  const canvasSkill = source('frontend/src/runtime/codex/controller/process-card-skill-controller.ts');
  const canvasModal = source('frontend/src/runtime/codex/effect/render-card-process-modal.ts');

  assert.match(thread, /const requestId = createExecutionRequestId\('thread'\);[\s\S]*codex-run-preparing[\s\S]*await requestCardSkillRunContinue/);
  assert.match(thread, /requestThreadCodexProcess\(\{[\s\S]*requestId,/);
  assert.match(thread, /codex-run-rejected[\s\S]*Codex execution admission failed/);
  assert.match(codex, /const requestId = createExecutionRequestId\('skill'\);[\s\S]*codex-run-preparing[\s\S]*JSON\.stringify\(payload\)/);
  assert.match(codex, /createExecutionRequestId\('pipeline'\)[\s\S]*handoffProcessLaunch\(executionDetail, launch\)[\s\S]*pipelineId: pipeline\.id, requestId/);
  assert.match(application, /requestCodexPipelineRun\(\{[\s\S]*requestId \}\)/);
  assert.match(application, /optimisticExecutionConfirmed\(intent, serverTask\)/);
  assert.match(application, /removeRejectedExecutionIntent\(optimisticExecutionIntents, detail\)/);
  assert.match(application, /mutation-error-message[\s\S]*Execution admission was rejected/);
  assert.match(canvasThread, /createExecutionRequestId\('thread'\)[\s\S]*requestId/);
  assert.match(canvasSkill, /createExecutionRequestId\('skill'\)[\s\S]*requestId/);
  assert.match(canvasModal, /requestCodexPipelineRun\(\{[\s\S]*requestId: createExecutionRequestId\('pipeline'\)/);
});

test('responsive optimism precedes settlement and success or rejection forces canonical reconciliation', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const thread = source('frontend/src/app/responsive/thread.js');
  const codex = source('frontend/src/app/responsive/codex.js');
  const begin = application.slice(
    application.indexOf('function beginOptimisticExecution'),
    application.indexOf('function acknowledgeOptimisticExecution'),
  );
  const acknowledge = application.slice(
    application.indexOf('function acknowledgeOptimisticExecution'),
    application.indexOf('function rejectOptimisticExecution'),
  );
  const reject = application.slice(
    application.indexOf('function rejectOptimisticExecution'),
    application.indexOf('async function navigateVoiceSubmission'),
  );
  const runStart = thread.indexOf("window.dispatchEvent(new CustomEvent('decision-os:codex-run-preparing'");
  const run = thread.slice(runStart, thread.indexOf("window.dispatchEvent(new CustomEvent('decision-os:codex-run-rejected'", runStart));
  const pipeline = codex.slice(codex.indexOf('async function startPipeline'), codex.indexOf('function handoffProcessLaunch'));
  const skill = codex.slice(codex.indexOf('async function startSkill'), codex.indexOf('async function startPipeline'));

  assert.ok(run.indexOf("decision-os:codex-run-preparing") < run.indexOf('await requestCardSkillRunContinue'));
  assert.ok(pipeline.indexOf("decision-os:codex-run-preparing") < pipeline.indexOf('handoffProcessLaunch(executionDetail, launch)'));
  assert.ok(pipeline.indexOf('handoffProcessLaunch(executionDetail, launch)') < pipeline.indexOf("await jsonRequest('/api/codex/pipelines/runs'"));
  assert.ok(skill.indexOf("await jsonRequest('/api/codex/skills/process'") < skill.indexOf('finishProcessLaunch('));
  assert.match(codex, /const PIPELINE_ADMISSION_TIMEOUT_MS = 30_000/);
  assert.match(pipeline, /new AbortController\(\)[\s\S]*setTimeout\(\(\) => admissionController\.abort\(\), PIPELINE_ADMISSION_TIMEOUT_MS\)/);
  assert.match(pipeline, /signal: admissionController\.signal[\s\S]*pipelineAdmissionError\(error, admissionController\.signal\.aborted\)[\s\S]*clearTimeout\(admissionDeadline\)/);
  assert.match(application, /pendingOptimisticExecutionDetails\.set\(String\(detail\.requestId\), detail\)/);
  assert.match(application, /materializePendingExecutionIntents\(pendingOptimisticExecutionDetails, optimisticExecutionIntents, nextControlRoom\)[\s\S]*for \(const \[identity, intent\] of optimisticExecutionIntents\)/);
  assert.match(begin, /optimisticExecutionIntents\.set\(identity, intent\);[\s\S]*applyOptimisticExecutionIntent\(state\.controlRoom, intent\)/);
  assert.match(acknowledge, /removeAcknowledgedExecutionIntent\(optimisticExecutionIntents, detail\)/);
  assert.ok(acknowledge.indexOf('removeAcknowledgedExecutionIntent') < acknowledge.indexOf("loadControlRoom({ force: true })"));
  assert.match(acknowledge, /loadControlRoom\(\{ force: true \}\)/);
  assert.match(reject, /removeRejectedExecutionIntent\(optimisticExecutionIntents, detail\)/);
  assert.match(reject, /pendingOptimisticExecutionDetails\.delete\(rejectedRequestId\)/);
  assert.ok(reject.indexOf('removeRejectedExecutionIntent(optimisticExecutionIntents, detail)') < reject.indexOf("loadControlRoom({ force: true })"));
  assert.match(reject, /mutation-error-message[\s\S]*mutation-error'\]\.hidden = false/);
  assert.match(application, /codex-run-handoff', \(event\) => \{ void navigateAcceptedProcess\(event\.detail\); \}/);
  assert.match(application, /codex-run-enqueued', \(event\) => \{[\s\S]*acknowledgeOptimisticExecution\(event\.detail\);[\s\S]*navigateAcceptedProcess\(event\.detail\)/);
});

test('voice handoff uses its durable note request identity and preserves it through rejection', () => {
  const transcription = source('frontend/src/runtime/voice/effect/request-transcription.ts');
  const execution = source('frontend/src/runtime/voice/controller/execute-voice-action.ts');

  assert.match(transcription, /requestId: `voice:\$\{noteId\}`/);
  assert.match(transcription, /options\.onPersisted\?\.\(\{[\s\S]*acceptedAt,[\s\S]*kind: 'voice'/);
  assert.match(execution, /handoffDetail = detail/);
  assert.match(execution, /if \(!submitted\) input\.onRejected\?\.\(handoffDetail\)/);
});
