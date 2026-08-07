/**
 * WHAT: Joins dotted causal clocks and multi-value registers.
 * WHY: Current candidates must converge independent of delivery order and duplication.
 */
import type { TaskCausalClock, TaskCurrentRegister, TaskDot, TaskRegisterCandidate } from './model.js';
import { canonicalJson } from './canonical-json.js';

export type TaskRegisterDotCollision = { replicaId: string; counter: number };

export function taskRegisterDotCollisions(left: TaskCurrentRegister, right: TaskCurrentRegister): TaskRegisterDotCollision[] {
  const rightCandidates = new Map(right.candidates.map((candidate) => [dotKey(candidate.dot), candidate]));
  return left.candidates.flatMap((candidate) => {
    const matching = rightCandidates.get(dotKey(candidate.dot));
    // WHAT: Report only an identical dot carrying a different canonical candidate.
    // WHY: Recovery evidence must describe the same invariant that the join continues to reject.
    if (!matching || canonicalJson(candidate) === canonicalJson(matching)) return [];
    return [{ replicaId: candidate.dot.replicaId, counter: candidate.dot.counter }];
  }).sort((a, b) => a.replicaId.localeCompare(b.replicaId) || a.counter - b.counter);
}

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
  const collision = taskRegisterDotCollisions(left, right)[0];
  // WHAT: Preserve the terminal rejection for every same-dot different-value register join.
  // WHY: Structured recovery evidence must not relax the CRDT collision invariant.
  if (collision) throw new Error(`task_current_dot_collision:${encodeURIComponent(collision.replicaId)}:${collision.counter}`);
  const retained = new Map<string, TaskRegisterCandidate>();
  for (const [key, candidate] of leftCandidates) {
    if (rightCandidates.has(key) || !clockCovers(right.clock, candidate.dot)) retained.set(key, structuredClone(candidate));
  }
  for (const [key, candidate] of rightCandidates) {
    if (leftCandidates.has(key) || !clockCovers(left.clock, candidate.dot)) retained.set(key, structuredClone(candidate));
  }
  return { clock: joinTaskClocks(left.clock, right.clock), candidates: [...retained.values()].sort((a, b) => dotKey(a.dot).localeCompare(dotKey(b.dot))) };
}
