/**
 * WHAT: Maps a rendered voice retry control back to its preserved upload identity.
 * WHY: Pre-acceptance failures have no server file reference and must retry through the browser-local upload id.
 */
export function voiceRetryInput(button) {
  return {
    threadId: button.dataset.threadId,
    noteId: button.dataset.noteId,
    voiceFileRef: button.dataset.voiceFileRef,
    localVoiceUploadId: button.dataset.localVoiceUploadId,
  };
}
