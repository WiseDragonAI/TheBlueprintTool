import { acquireVoiceCaptureOwnership, releaseVoiceCaptureOwnership, type VoiceCaptureOwner } from '../../voice/helper/voice-capture-ownership.js';

/**
 * WHAT: Captures audio for one Git review widget with instance-local browser state.
 * WHY: Git review recording must not read or mutate the singleton thread voice recorder.
 */
export type GitReviewVoiceFrame = { durationMs: number; level: number };

export type GitReviewVoiceCapture = {
  stop(): Promise<Blob>;
  cancel(): void;
};

function audioLevel(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * 4);
}

export async function startGitReviewVoiceCapture(owner: VoiceCaptureOwner, onFrame: (frame: GitReviewVoiceFrame) => void): Promise<GitReviewVoiceCapture> {
  if (!acquireVoiceCaptureOwnership(owner)) throw new Error('Another voice recording is already active.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (error) {
    releaseVoiceCaptureOwnership(owner);
    throw error;
  }
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 128;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  if (audioContext.state === 'suspended') await audioContext.resume();
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.addEventListener('dataavailable', (event) => { if (event.data?.size) chunks.push(event.data); });
  recorder.start();
  const startedAt = Date.now();
  const samples = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  let animationFrameId = 0;
  let settled = false;

  const frame = () => {
    onFrame({ durationMs: Date.now() - startedAt, level: audioLevel(analyser, samples) });
    animationFrameId = requestAnimationFrame(frame);
  };
  animationFrameId = requestAnimationFrame(frame);

  const release = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    stream.getTracks().forEach((track) => track.stop());
    void audioContext.close();
    releaseVoiceCaptureOwnership(owner);
  };

  return {
    async stop() {
      if (settled) return new Blob([], { type: recorder.mimeType || 'audio/webm' });
      settled = true;
      const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));
      if (recorder.state !== 'inactive') recorder.stop();
      await stopped;
      release();
      return new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    },
    cancel() {
      if (settled) return;
      settled = true;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}
