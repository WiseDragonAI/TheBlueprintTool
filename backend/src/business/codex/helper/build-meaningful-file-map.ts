/**
 * WHAT: Supplies the compact Git-visible code map used by authored pipeline prompts.
 * WHY: The shared map contract keeps prompt injection and the on-demand CLI consistent.
 */
import {
  buildInjectedFileMap,
  meaningfulGitPaths as sharedMeaningfulGitPaths,
} from '../../../../../shared/meaningful-file-map.mjs';

export function meaningfulGitPaths(workspaceRoot: string): string[] {
  return sharedMeaningfulGitPaths(workspaceRoot);
}

export function buildMeaningfulFileMap(workspaceRoot: string): string {
  try {
    return buildInjectedFileMap(workspaceRoot);
  } catch {
    return 'DOMAINS\n (unavailable)\nQUERY\n tools/map.mjs <c|t|d> [domain]\n c=code t=test d=doc; domain optional; CODE=top5/dir by LOC\nCODE\n.\n (file map unavailable)';
  }
}
