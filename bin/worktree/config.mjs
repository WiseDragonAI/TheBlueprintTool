/**
 * WHAT: Defines immutable repository paths and package dependency proofs for the worktree lifecycle.
 * WHY: Every controller must resolve the same primary checkout, canonical dev checkout, and dependency evidence.
 */
import { dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const primaryRoot = basename(dirname(scriptRoot)) === '.worktrees' ? dirname(dirname(scriptRoot)) : scriptRoot;
export const devRoot = resolve(primaryRoot, '.worktrees', 'dev');
export const dependencyContracts = [
  { name: 'backend', proof: 'tsx/dist/loader.mjs' },
  { name: 'frontend', proof: 'tsx/dist/esm/index.mjs' },
  { name: 'federation-relay', proof: 'typescript/bin/tsc' },
];
export const generatedSearchIgnoreBefore = '/executor-analysis/';
export const generatedSearchIgnoreAfter = '/frontend-telemetry.jsonl*';
export const usage = 'Usage: decision-os-worktree <init-dev|status|create|integrate|cleanup> [feature-name] --json';
