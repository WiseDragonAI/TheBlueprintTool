/**
 * WHAT: Defines and resolves the action selected when a voice recording stops.
 * WHY: Every keyboard and button entry point must agree on SEND, RUN, and PIPELINE.
 */

export type VoiceLaunchMode = 'send' | 'run' | 'pipeline';

export function voiceLaunchModeForModifiers(input: { ctrlKey?: boolean; shiftKey?: boolean }): VoiceLaunchMode {
  if (input.ctrlKey) return 'pipeline';
  if (input.shiftKey) return 'run';
  return 'send';
}

export function parseVoiceLaunchMode(value: unknown): VoiceLaunchMode {
  return value === 'run' || value === 'pipeline' ? value : 'send';
}
