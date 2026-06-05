/**
 * WHAT: Stores mutable staged detail reveal scheduling state.
 * WHY: One-function files need a shared state holder without adding hidden module-local functions.
 */
import type { RevealCard } from './types.js';

export const stagedDetailRevealState = {
  settleTimer: 0,
  frameHandle: 0,
  idleHandle: 0,
  urgentQueue: [] as RevealCard[],
  backgroundQueue: [] as RevealCard[],
  averageCardCostMs: 1,
  nextChunkSize: 1,
  sequence: 0,
  settleSequence: 0,
  frameSequence: 0,
  backgroundSequence: 0
};
