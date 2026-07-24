/**
 * WHAT: Executes every SEND, RUN, and PIPELINE stop action through one lifecycle boundary.
 * WHY: Run-capable surfaces must hand off after local durability without waiting for network upload.
 */
import { stopVoiceRecording } from './stop-voice-recording.js';
import type { VoiceLaunchMode } from '../helper/voice-launch-mode.js';
import type { VoiceExecutionHandoff } from '../effect/request-transcription.js';

type StopVoiceRecording = (input: {
  launchMode: VoiceLaunchMode;
  onPersisted?: (detail: VoiceExecutionHandoff) => void;
}) => Promise<boolean>;

export type ExecuteVoiceActionInput = {
  launchMode: VoiceLaunchMode;
  onDurableHandoff?: (detail: VoiceExecutionHandoff) => void;
  onRejected?: (detail?: VoiceExecutionHandoff) => void;
  stop?: StopVoiceRecording;
};

export async function executeVoiceAction(input: ExecuteVoiceActionInput): Promise<boolean> {
  const stop = input.stop ?? stopVoiceRecording;
  if (input.launchMode === 'send') {
    try {
      return await stop({ launchMode: input.launchMode });
    } catch {
      input.onRejected?.();
      return false;
    }
  }

  let handedOff = false;
  let handoffDetail: VoiceExecutionHandoff | undefined;
  const onPersisted = (detail: VoiceExecutionHandoff): void => {
    if (handedOff) return;
    handedOff = true;
    handoffDetail = detail;
    input.onDurableHandoff?.(detail);
  };
  void stop({ launchMode: input.launchMode, onPersisted })
    .then((submitted) => {
      // A durable handoff gives immediate UI feedback; a later admission rejection still restores canonical state.
      if (!submitted) input.onRejected?.(handoffDetail);
    })
    .catch(() => {
      input.onRejected?.(handoffDetail);
    });
  return true;
}
