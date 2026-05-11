// @ts-nocheck
/**
 * WHAT: Generated controller function transcribe-voice-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@backend/telemetry/harness.js';
import { callOpenaiTranscription } from '@backend/business/transcription/effect/call-openai-transcription.js';
import { parseHttpRequest } from '@backend/business/routing/helper/parse-http-request.js';
import { persistTranscribedText } from '@backend/business/transcription/effect/persist-transcribed-text.js';
import { resolveTranscriptionConfig } from '@backend/business/transcription/helper/resolve-transcription-config.js';
import { sendJsonResponse } from '@backend/business/routing/effect/send-json-response.js';

export async function transcribeVoiceController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:transcribe-voice-controller -> start', { functionName: 'transcribe-voice-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:transcribe-voice-controller -> transcribe-voice-controller-started', { functionName: 'transcribe-voice-controller', phase: 'event' });
    try {
      await parseHttpRequest({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'transcribe-voice-controller', dependencyName: 'parse-http-request', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await resolveTranscriptionConfig({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'transcribe-voice-controller', dependencyName: 'resolve-transcription-config', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:transcribe-voice-controller -> transcribe-voice-disabled', { functionName: 'transcribe-voice-controller', phase: 'event' });
    try {
      await sendJsonResponse({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'transcribe-voice-controller', dependencyName: 'send-json-response', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await callOpenaiTranscription({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'transcribe-voice-controller', dependencyName: 'call-openai-transcription', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await persistTranscribedText({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'transcribe-voice-controller', dependencyName: 'persist-transcribed-text', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await sendJsonResponse({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'transcribe-voice-controller', dependencyName: 'send-json-response', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:transcribe-voice-controller -> transcribe-voice-controller-completed', { functionName: 'transcribe-voice-controller', phase: 'event' });
  } finally {
    telemetry('controller:transcribe-voice-controller -> complete', { functionName: 'transcribe-voice-controller', phase: 'completed', arguments: input });
  }
}
