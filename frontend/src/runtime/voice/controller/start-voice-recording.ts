/**
 * WHAT: Starts microphone capture and stores MediaRecorder chunks for transcription.
 * WHY: Voice input needs the raw browser audio available when recording stops.
 */
import { state } from '../../state.js';
import { renderVoiceStatus } from '../effect/render-voice-status.js';
import { telemetry } from '../../telemetry/effect/telemetry.js';
import { updateVoiceRecordingFrame } from '../effect/update-voice-recording-frame.js';

export async function startVoiceRecording(): Promise<void> {
  if (state.voice.recording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) chunks.push(event.data);
    });
    recorder.start();
    state.voice = { recording: true, startedAt: Date.now(), durationMs: 0, level: 0, waveSamples: [], transcriptionStatus: 'recording', stream, audioContext, analyser, recorder, chunks, mimeType: recorder.mimeType || 'audio/webm', error: '' };
    telemetry('resolve-voice-session', { threadId: state.threadId });
    telemetry('capture-voice-audio', { status: 'recording', source: 'microphone' });
    updateVoiceRecordingFrame();
  } catch (error) {
    state.voice = { recording: false, startedAt: 0, durationMs: 0, level: 0, transcriptionStatus: 'permission denied', error: error instanceof Error ? error.message : String(error) };
    telemetry('voice-recording-failed', { error: state.voice.error });
    renderVoiceStatus();
  }
}
