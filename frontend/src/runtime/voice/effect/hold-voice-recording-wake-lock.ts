/**
 * WHAT: Holds the browser screen wake lock while microphone capture is active.
 * WHY: Mobile devices must not dim or suspend an in-progress voice recording.
 */
let wakeLock: { release: () => Promise<void>; released?: boolean } | null = null;

export async function holdVoiceRecordingWakeLock(): Promise<void> {
  const manager = (navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; released?: boolean }> };
  }).wakeLock;
  if (!manager || (wakeLock && !wakeLock.released)) return;
  wakeLock = await manager.request('screen').catch(() => null);
}

export function releaseVoiceRecordingWakeLock(): void {
  const active = wakeLock;
  wakeLock = null;
  if (active && !active.released) void active.release().catch(() => undefined);
}
