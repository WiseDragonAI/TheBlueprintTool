/**
 * WHAT: Arbitrates exclusive microphone ownership without sharing recorder state.
 * WHY: Thread and embedded-widget recorders must never capture concurrently.
 */
export type VoiceCaptureOwner = 'thread' | `git-review:${string}`;
export type VoiceCaptureLease = Readonly<{ owner: VoiceCaptureOwner; token: symbol }>;

let activeLease: VoiceCaptureLease | null = null;

export function acquireVoiceCaptureOwnership(owner: VoiceCaptureOwner): VoiceCaptureLease | null {
  if (activeLease) return null;
  activeLease = Object.freeze({ owner, token: Symbol(owner) });
  return activeLease;
}

export function releaseVoiceCaptureOwnership(lease: VoiceCaptureLease | null | undefined): boolean {
  if (!lease || activeLease !== lease) return false;
  activeLease = null;
  return true;
}

export function currentVoiceCaptureOwner(): VoiceCaptureOwner | null {
  return activeLease?.owner ?? null;
}
