import { acquireVoiceCaptureOwnership, releaseVoiceCaptureOwnership, type VoiceCaptureOwner } from '../../voice/helper/voice-capture-ownership.js';

/**
 * WHAT: Captures audio for one Git review widget with instance-local browser state.
 * WHY: Git review recording must not read or mutate the singleton thread voice recorder.
 */
export type GitReviewVoiceFrame = { durationMs: number; level: number; samples: readonly number[] };

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

export async function startGitReviewVoiceCapture(owner: VoiceCaptureOwner, onFrame: (frame: GitReviewVoiceFrame) => void, signal?: AbortSignal): Promise<GitReviewVoiceCapture> {
  if (signal?.aborted) throw new DOMException('Git review recording was canceled.', 'AbortError');
  const captureLease = acquireVoiceCaptureOwnership(owner);
  if (!captureLease) throw new Error('Another voice recording is already active.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (error) {
    releaseVoiceCaptureOwnership(captureLease);
    throw error;
  }
  if (signal?.aborted) {
    stream.getTracks().forEach((track) => track.stop());
    releaseVoiceCaptureOwnership(captureLease);
    throw new DOMException('Git review recording was canceled.', 'AbortError');
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
  const waveSamples: number[] = [];
  let animationFrameId = 0;
  let settled = false;
  let pendingPeak = 0;
  let lastSampleAt = 0;

  const frame = () => {
    const now = Date.now();
    const level = audioLevel(analyser, samples);
    pendingPeak = Math.max(pendingPeak, level);
    if (!lastSampleAt || now - lastSampleAt >= 32) {
      waveSamples.push(pendingPeak);
      if (waveSamples.length > 340) waveSamples.splice(0, waveSamples.length - 340);
      pendingPeak = 0;
      lastSampleAt = now;
    }
    onFrame({ durationMs: now - startedAt, level, samples: waveSamples });
    animationFrameId = requestAnimationFrame(frame);
  };
  animationFrameId = requestAnimationFrame(frame);

  const release = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    stream.getTracks().forEach((track) => track.stop());
    void audioContext.close();
    releaseVoiceCaptureOwnership(captureLease);
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
