// @ts-nocheck
/**
 * WHAT: Generated controller function record-voice-controller.
 * WHY: This file is generated from the MasterLedger and contains exactly one generated function.
 */
import { telemetry } from '@frontend/telemetry/harness.js';
import { captureVoiceAudio } from '@frontend/business/voice/helper/capture-voice-audio.js';
import { fillThreadDraft } from '@frontend/business/voice/effect/fill-thread-draft.js';
import { renderVoiceStatus } from '@frontend/business/voice/effect/render-voice-status.js';
import { requestTranscription } from '@frontend/business/voice/effect/request-transcription.js';
import { resolveVoiceSession } from '@frontend/business/voice/helper/resolve-voice-session.js';
import { uploadVoiceAudio } from '@frontend/business/voice/effect/upload-voice-audio.js';

export async function recordVoiceController(input: { action_payload?: Record<string, unknown> } = {}): Promise<void> {
  const action_payload = input.action_payload ?? input;
  telemetry('controller:record-voice-controller -> start', { functionName: 'record-voice-controller', phase: 'started', arguments: input });

  try {
    telemetry('controller:record-voice-controller -> record-voice-controller-started', { functionName: 'record-voice-controller', phase: 'event' });
    try {
      await resolveVoiceSession({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'resolve-voice-session', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:record-voice-controller -> record-voice-session-rejected', { functionName: 'record-voice-controller', phase: 'event' });
    try {
      await renderVoiceStatus({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'render-voice-status', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await captureVoiceAudio({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'capture-voice-audio', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await uploadVoiceAudio({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'upload-voice-audio', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await requestTranscription({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'request-transcription', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await fillThreadDraft({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'fill-thread-draft', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    try {
      await renderVoiceStatus({ action_payload });
    } catch (error) {
      console.log(JSON.stringify({ controllerName: 'record-voice-controller', dependencyName: 'render-voice-status', ignoredScaffoldError: error instanceof Error ? error.message : String(error) }));
    }
    telemetry('controller:record-voice-controller -> record-voice-controller-completed', { functionName: 'record-voice-controller', phase: 'event' });
  } finally {
    telemetry('controller:record-voice-controller -> complete', { functionName: 'record-voice-controller', phase: 'completed', arguments: input });
  }
}
