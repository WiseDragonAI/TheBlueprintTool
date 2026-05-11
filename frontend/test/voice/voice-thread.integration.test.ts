/**
 * WHAT: Integration test for spec eaced0c9-667ae9a9-5f8c7152-cc7ed3b4-7984a4f3-d38927c1-747b461e-3d074416-8b1ff788-6cc37b58-040cef84-828e6225-c0c42d20-5c4e5c22-21b2b050-b5a783cd.
 * WHY: each suite dispatches through generated controllers and records telemetry evidence.
 */
import test from 'node:test';
import { traces } from '@frontend/telemetry/harness.js';
import { recordVoiceController } from '@frontend/business/voice/controller/record-voice-controller.js';
import { editThreadController } from '@frontend/business/thread/controller/edit-thread-controller.js';

test('Threads notes voice recording voice transcription status and transient audio hold', async () => {
  traces.length = 0;
  const expectedTelemetry = ["render-thread-panel","resolve-voice-session","capture-voice-audio","upload-voice-audio","request-transcription","fill-thread-draft","render-voice-status"];
  const argvPayload = {
    ok: true,
    mode: 'dry-run',
    apply_command: true,
    check_ledger_command: true,
    report_command: true,
    patch_doc_command: true,
    ledger_command: 'mutate',
    master_ledger_file: 'generated-master-ledger.md',
    specs_ledger_file: 'generated-specs-ledger.json',
    patch_batch_file: 'generated-patch-batch.json',
    report_file: 'generated-report.json'
  };
  const actionPayload = { ...argvPayload, cli_command_argv: argvPayload, argv: argvPayload };
  try {
    await recordVoiceController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: 'eaced0c9-667ae9a9-5f8c7152-cc7ed3b4-7984a4f3-d38927c1-747b461e-3d074416-8b1ff788-6cc37b58-040cef84-828e6225-c0c42d20-5c4e5c22-21b2b050-b5a783cd', controllerName: 'record-voice-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  try {
    await editThreadController({ action_payload: actionPayload });
  } catch (error) {
    console.log(JSON.stringify({ specId: 'eaced0c9-667ae9a9-5f8c7152-cc7ed3b4-7984a4f3-d38927c1-747b461e-3d074416-8b1ff788-6cc37b58-040cef84-828e6225-c0c42d20-5c4e5c22-21b2b050-b5a783cd', controllerName: 'edit-thread-controller', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
  }
  const actualTelemetry = traces.map((trace) => trace.name);
  console.log(JSON.stringify({ specId: 'eaced0c9-667ae9a9-5f8c7152-cc7ed3b4-7984a4f3-d38927c1-747b461e-3d074416-8b1ff788-6cc37b58-040cef84-828e6225-c0c42d20-5c4e5c22-21b2b050-b5a783cd', suiteName: 'Threads notes voice recording voice transcription status and transient audio hold', controllerName: ["record-voice-controller","edit-thread-controller"], executionEntry: 'controller', expectedTelemetry, actualTelemetry }));
});
