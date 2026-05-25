import { state } from '../../state.js';
import { renderVoiceStatus } from '../effect/render-voice-status.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { requestTranscription } from '../effect/request-transcription.js';
import { collectVoiceRecordingBlob } from '../helper/collect-voice-recording-blob.js';

export async function stopVoiceRecording(): Promise<void> {
  if (state.voice.animationFrameId) cancelAnimationFrame(state.voice.animationFrameId);
  const recorder = state.voice.recorder as MediaRecorder | undefined;
  const chunks = state.voice.chunks as BlobPart[] | undefined;
  const mimeType = String(state.voice.mimeType ?? 'audio/webm');
  const audio = await collectVoiceRecordingBlob(recorder, chunks, mimeType);
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
  await requestTranscription(audio);
}
