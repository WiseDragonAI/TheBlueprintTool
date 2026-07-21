/**
 * WHAT: Joins dotted causal clocks and multi-value registers.
 * WHY: Current candidates must converge independent of delivery order and duplication.
 */
import type { TaskCausalClock, TaskCurrentRegister, TaskDot, TaskRegisterCandidate } from './model.js';

export function dotKey(dot: TaskDot): string {
  return `${dot.replicaId}\u0000${String(dot.counter).padStart(16, '0')}`;
}

export function clockCovers(clock: TaskCausalClock, dot: TaskDot): boolean {
  return (clock[dot.replicaId] ?? 0) >= dot.counter;
}

export function joinTaskClocks(left: TaskCausalClock, right: TaskCausalClock): TaskCausalClock {
  const joined = { ...left };
  for (const [replicaId, counter] of Object.entries(right)) joined[replicaId] = Math.max(joined[replicaId] ?? 0, counter);
  return Object.fromEntries(Object.entries(joined).sort(([leftId], [rightId]) => leftId.localeCompare(rightId)));
}

export function joinTaskRegisters(left: TaskCurrentRegister, right: TaskCurrentRegister): TaskCurrentRegister {
  const leftCandidates = new Map(left.candidates.map((candidate) => [dotKey(candidate.dot), candidate]));
  const rightCandidates = new Map(right.candidates.map((candidate) => [dotKey(candidate.dot), candidate]));
  const retained = new Map<string, TaskRegisterCandidate>();
  for (const [key, candidate] of leftCandidates) {
    if (rightCandidates.has(key) || !clockCovers(right.clock, candidate.dot)) retained.set(key, structuredClone(candidate));
  }
  for (const [key, candidate] of rightCandidates) {
    if (leftCandidates.has(key) || !clockCovers(left.clock, candidate.dot)) retained.set(key, structuredClone(candidate));
  }
  return { clock: joinTaskClocks(left.clock, right.clock), candidates: [...retained.values()].sort((a, b) => dotKey(a.dot).localeCompare(dotKey(b.dot))) };
}
