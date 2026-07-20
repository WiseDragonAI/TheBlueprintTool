/**
 * WHAT: Arbitrates exclusive microphone ownership without sharing recorder state.
 * WHY: Thread and embedded-widget recorders must never capture concurrently.
 */
export type VoiceCaptureOwner = 'thread' | `git-review:${string}`;

let activeOwner: VoiceCaptureOwner | null = null;

export function acquireVoiceCaptureOwnership(owner: VoiceCaptureOwner): boolean {
  if (activeOwner && activeOwner !== owner) return false;
  activeOwner = owner;
  return true;
}

export function releaseVoiceCaptureOwnership(owner: VoiceCaptureOwner): void {
  if (activeOwner === owner) activeOwner = null;
}

export function currentVoiceCaptureOwner(): VoiceCaptureOwner | null {
  return activeOwner;
}
