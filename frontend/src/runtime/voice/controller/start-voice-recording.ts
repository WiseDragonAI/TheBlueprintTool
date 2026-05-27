/**
 * WHAT: Starts microphone capture and stores MediaRecorder chunks for transcription.
 * WHY: Voice input needs the raw browser audio available when recording stops.
 */
import { state } from '../../state.js';
import { renderVoiceStatus } from '../effect/render-voice-status.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { updateVoiceRecordingFrame } from '../effect/update-voice-recording-frame.js';
import { calculateVoiceLevel } from '../helper/calculate-voice-level.js';

export async function startVoiceRecording(): Promise<void> {
  if (state.voice.recording) return;
  try {
    const threadId = state.threadId || 'conversation-ledger';
    if (!state.threadId) state.threadId = threadId;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    const pcmChunks: Float32Array[] = [];
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;
    processor.onaudioprocess = (event) => {
      const samples = new Float32Array(event.inputBuffer.getChannelData(0));
      pcmChunks.push(samples);
      const level = calculateVoiceLevel(samples);
      state.voice.level = level;
      state.voice.pendingVoicePeak = Math.max(Number(state.voice.pendingVoicePeak ?? 0), level);
    };
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);
    if (audioContext.state === 'suspended') await audioContext.resume();
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) chunks.push(event.data);
    });
    recorder.start();
    state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, pendingVoicePeak: 0, waveSamples: [], transcriptionStatus: 'recording', threadId, stream, audioContext, analyser, recorder, chunks, mimeType: 'audio/wav', recorderMimeType: recorder.mimeType || 'audio/webm', pcmChunks, sampleRate: audioContext.sampleRate, processor, silentGain, error: '' };
    telemetry('resolve-voice-session', { threadId });
    telemetry('capture-voice-audio', { status: 'recording', source: 'microphone' });
    updateVoiceRecordingFrame();
  } catch (error) {
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'permission denied', error: error instanceof Error ? error.message : String(error) };
    telemetry('voice-recording-failed', { error: state.voice.error });
    renderVoiceStatus();
  }
}
