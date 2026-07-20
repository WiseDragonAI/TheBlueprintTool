/**
 * WHAT: Executes every SEND, RUN, and PIPELINE stop action through one lifecycle boundary.
 * WHY: Run-capable surfaces must hand off after local durability without waiting for network upload.
 */
import { stopVoiceRecording } from './stop-voice-recording.js';
import type { VoiceLaunchMode } from '../helper/voice-launch-mode.js';

type StopVoiceRecording = (input: {
  launchMode: VoiceLaunchMode;
  onPersisted?: () => void;
}) => Promise<boolean>;

export type ExecuteVoiceActionInput = {
  launchMode: VoiceLaunchMode;
  onDurableHandoff?: () => void;
  onRejected?: () => void;
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
  const onPersisted = (): void => {
    if (handedOff) return;
    handedOff = true;
    input.onDurableHandoff?.();
  };
  void stop({ launchMode: input.launchMode, onPersisted })
    .then((submitted) => {
      if (!submitted && !handedOff) input.onRejected?.();
    })
    .catch(() => {
      if (!handedOff) input.onRejected?.();
    });
  return true;
}
