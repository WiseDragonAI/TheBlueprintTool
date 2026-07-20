/**
 * WHAT: Submits a stopped recording without coupling run navigation to network upload.
 * WHY: Run and pipeline actions may leave the card once audio is durable locally, while send stays settled in place.
 */

export type VoiceLaunchMode = 'send' | 'run' | 'pipeline';

type StopVoiceRecording = (input: {
  launchMode: VoiceLaunchMode;
  onPersisted?: () => void;
}) => Promise<boolean>;

export async function submitVoiceRecording(input: {
  launchMode: VoiceLaunchMode;
  stop: StopVoiceRecording;
  onDurableHandoff: () => void;
  onRejected: () => void;
}): Promise<void> {
  if (input.launchMode === 'send') {
    await input.stop({ launchMode: input.launchMode });
    return;
  }

  let handedOff = false;
  const onPersisted = (): void => {
    if (handedOff) return;
    handedOff = true;
    input.onDurableHandoff();
  };
  void input.stop({ launchMode: input.launchMode, onPersisted })
    .then((submitted) => {
      if (!submitted && !handedOff) input.onRejected();
    })
    .catch(() => {
      if (!handedOff) input.onRejected();
    });
}
