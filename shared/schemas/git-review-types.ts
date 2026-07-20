/** Durable voice review rendered by a Git diff widget and owned by its card. */
export type GitReviewNote = {
  id: string;
  repository: string;
  target: string;
  file: string;
  hunk: string;
  patchHash: string;
  selection?: string;
  body: string;
  voiceFileRef: string;
  status: 'transcribed' | 'transcription failed';
  error?: string;
  createdAt: string;
};

export function normalizeGitReviewNotes(value: unknown): GitReviewNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is GitReviewNote => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const note = entry as Record<string, unknown>;
    return typeof note.id === 'string'
      && typeof note.repository === 'string'
      && typeof note.target === 'string'
      && typeof note.file === 'string'
      && typeof note.hunk === 'string'
      && typeof note.patchHash === 'string'
      && typeof note.body === 'string'
      && typeof note.voiceFileRef === 'string'
      && (note.status === 'transcribed' || note.status === 'transcription failed')
      && typeof note.createdAt === 'string'
      && (note.selection === undefined || typeof note.selection === 'string')
      && (note.error === undefined || typeof note.error === 'string');
  });
}
