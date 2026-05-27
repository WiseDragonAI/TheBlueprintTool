/**
 * WHAT: Stops microphone capture and forwards the captured audio to transcription.
 * WHY: Voice stop is the handoff between local recording state and draft insertion.
 */
import { state } from '../../state.js';
import { renderVoiceStatus } from '../effect/render-voice-status.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestTranscription } from '../effect/request-transcription.js';
import { collectVoiceRecordingBlob } from '../helper/collect-voice-recording-blob.js';
import { encodeWavBlob } from '../helper/encode-wav-blob.js';

export async function stopVoiceRecording(): Promise<void> {
  if (state.voice.animationFrameId) cancelAnimationFrame(state.voice.animationFrameId);
  const threadId = String(state.voice.threadId || state.threadId || 'conversation-ledger');
  const recorder = state.voice.recorder as MediaRecorder | undefined;
  const chunks = state.voice.chunks as BlobPart[] | undefined;
  const recorderMimeType = String(state.voice.recorderMimeType ?? 'audio/webm');
  const processor = state.voice.processor as ScriptProcessorNode | undefined;
  processor?.disconnect();
  const silentGain = state.voice.silentGain as GainNode | undefined;
  silentGain?.disconnect();
  const pendingPeak = Math.max(0, Math.min(1, Number(state.voice.pendingVoicePeak ?? 0)));
  if (pendingPeak > 0) {
    const waveSamples = Array.isArray(state.voice.waveSamples) ? state.voice.waveSamples : [];
    waveSamples.push(pendingPeak);
    state.voice.waveSamples = waveSamples;
    state.voice.pendingVoicePeak = 0;
  }
  const pcmChunks = state.voice.pcmChunks as Float32Array[] | undefined;
  const sampleRate = Number(state.voice.sampleRate ?? 0);
  const audio = pcmChunks?.length && sampleRate > 0 ? encodeWavBlob(pcmChunks, sampleRate) : await collectVoiceRecordingBlob(recorder, chunks, recorderMimeType);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  const stream = state.voice.stream as MediaStream | undefined;
  stream?.getTracks().forEach((track) => track.stop());
  const audioContext = state.voice.audioContext as AudioContext | undefined;
  void audioContext?.close();
  state.voice.recording = false;
  state.voice.durationMs = state.voice.startedAt ? Date.now() - state.voice.startedAt : state.voice.durationMs;
  state.voice.level = 0;
  state.voice.transcriptionStatus = 'uploading voice';
  telemetry('render-voice-status', { status: state.voice.transcriptionStatus, durationMs: state.voice.durationMs });
  renderVoiceStatus();
  await requestTranscription(audio, threadId);
}
