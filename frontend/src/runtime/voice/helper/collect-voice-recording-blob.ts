/**
 * WHAT: Resolves the final MediaRecorder audio blob after recording stops.
 * WHY: Stop flow must wait for the browser's last dataavailable chunk before upload.
 */
export function collectVoiceRecordingBlob(recorder: MediaRecorder | undefined, chunks: BlobPart[] = [], mimeType = 'audio/webm'): Promise<Blob | null> {
  if (!recorder) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = () => resolve(chunks.length > 0 ? new Blob(chunks, { type: mimeType || 'audio/webm' }) : null);
    if (recorder.state === 'inactive') {
      finish();
      return;
    }
    recorder.addEventListener('stop', finish, { once: true });
    recorder.requestData?.();
    recorder.stop();
  });
}
