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
  assert.match(codex, /createExecutionRequestId\('pipeline'\)[\s\S]*pipelineId: pipeline\.id, requestId/);
  assert.match(application, /requestCodexPipelineRun\(\{[\s\S]*requestId \}\)/);
  assert.match(application, /optimisticExecutionConfirmed\(intent, serverTask\)/);
  assert.match(application, /intent\.requestId === rejectedRequestId/);
  assert.match(application, /mutation-error-message[\s\S]*Execution admission was rejected/);
  assert.match(canvasThread, /createExecutionRequestId\('thread'\)[\s\S]*requestId/);
  assert.match(canvasSkill, /createExecutionRequestId\('skill'\)[\s\S]*requestId/);
  assert.match(canvasModal, /requestCodexPipelineRun\(\{[\s\S]*requestId: createExecutionRequestId\('pipeline'\)/);
});

test('responsive optimism precedes settlement and success or rejection forces canonical reconciliation', () => {
  const application = source('frontend/src/app/responsive/application.js');
  const thread = source('frontend/src/app/responsive/thread.js');
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

  assert.ok(run.indexOf("decision-os:codex-run-preparing") < run.indexOf('await requestCardSkillRunContinue'));
  assert.match(begin, /optimisticExecutionIntents\.set\(identity, intent\);[\s\S]*applyOptimisticExecutionIntent\(state\.controlRoom, intent\)/);
  assert.match(acknowledge, /intent\.requestId = String\(detail\.requestId[\s\S]*intent\.executionId = String\(detail\.executionId[\s\S]*intent\.revision = Math\.max/);
  assert.match(acknowledge, /loadControlRoom\(\{ force: true \}\)/);
  assert.match(reject, /optimisticExecutionIntents\.delete\(identity\)/);
  assert.ok(reject.indexOf('optimisticExecutionIntents.delete(identity)') < reject.indexOf("loadControlRoom({ force: true })"));
  assert.match(reject, /mutation-error-message[\s\S]*mutation-error'\]\.hidden = false/);
});

test('voice handoff uses its durable note request identity and preserves it through rejection', () => {
  const transcription = source('frontend/src/runtime/voice/effect/request-transcription.ts');
  const execution = source('frontend/src/runtime/voice/controller/execute-voice-action.ts');

  assert.match(transcription, /requestId: `voice:\$\{noteId\}`/);
  assert.match(transcription, /options\.onPersisted\?\.\(\{[\s\S]*acceptedAt,[\s\S]*kind: 'voice'/);
  assert.match(execution, /handoffDetail = detail/);
  assert.match(execution, /if \(!submitted\) input\.onRejected\?\.\(handoffDetail\)/);
});
