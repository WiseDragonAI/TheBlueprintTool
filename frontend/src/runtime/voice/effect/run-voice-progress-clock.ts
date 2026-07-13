/**
 * WHAT: Advances visible voice-note elapsed labels between server lifecycle updates.
 * WHY: Server timestamps are authoritative, but the displayed clock must not wait for network polls.
 */
const clockIntervalMs = 1_000;
const elapsedSelector = '[data-voice-phase-started-at]';
let clock: ReturnType<typeof setInterval> | null = null;

function elapsedNodes(): HTMLElement[] {
  const nodes = globalThis.document?.querySelectorAll?.(elapsedSelector);
  return nodes ? Array.from(nodes) as HTMLElement[] : [];
}

export function tickVoiceProgressClock(now = Date.now()): number {
  const nodes = elapsedNodes();
  for (const node of nodes) {
    const startedAt = Date.parse(String(node.dataset.voicePhaseStartedAt ?? ''));
    if (!Number.isFinite(startedAt)) continue;
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1_000));
    const label = String(node.dataset.voicePhaseLabel ?? 'Processing');
    const next = `${label} · ${elapsedSeconds}s`;
    if (node.textContent !== next) node.textContent = next;
  }
  return nodes.length;
}

export function stopVoiceProgressClock(): void {
  if (clock) clearInterval(clock);
  clock = null;
}

export function syncVoiceProgressClock(): void {
  const activeCount = tickVoiceProgressClock();
  if (activeCount === 0) {
    stopVoiceProgressClock();
    return;
  }
  if (clock) return;
  clock = setInterval(() => {
    if (tickVoiceProgressClock() === 0) stopVoiceProgressClock();
  }, clockIntervalMs);
  (clock as { unref?: () => void }).unref?.();
}

export function voiceProgressClockActiveForTests(): boolean {
  return clock !== null;
}
