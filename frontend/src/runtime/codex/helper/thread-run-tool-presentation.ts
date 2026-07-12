/**
 * WHAT: Derives compact operator-facing labels for one Codex tool event.
 * WHY: Tool vocabulary and command cleanup are presentation calculations, not DOM effect ownership.
 */
import type { ThreadRunLogEvent } from './thread-run-log.js';

export type ThreadRunToolPresentation = {
  action: string;
  command: string;
  compactCommand: string;
  status: string;
};

function compactText(value: string, maxLength = 108): string {
  const text = value.replace(/\s+/g, ' ').trim();
  // WHAT: Preserve short commands without lossy abbreviation.
  // WHY: Truncation is useful only when the command exceeds the summary surface.
  if (text.length <= maxLength) return text;
  const head = Math.max(22, Math.floor(maxLength * 0.64));
  const tail = Math.max(12, maxLength - head - 5);
  return `${text.slice(0, head).trimEnd()} ... ${text.slice(-tail).trimStart()}`;
}

function stripOuterQuotes(value: string): string {
  const text = value.trim();
  const quote = text[0];
  return (quote === '"' || quote === "'") && text.endsWith(quote) ? text.slice(1, -1).trim() : text;
}

function displayCommand(value: string): string {
  const command = value.replace(/\s+/g, ' ').trim();
  const shell = command.match(/^(?:\/usr\/bin\/env\s+)?(?:\/[^\s]+\/)?(?:zsh|bash|sh)\s+-lc\s+(.+)$/);
  return shell?.[1] ? stripOuterQuotes(shell[1]) : command || 'command';
}

function commandHasToken(command: string, tokens: string[]): boolean {
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(^|[\\s;&|()])(?:${escaped})(?=\\s|$)`, 'i').test(command);
}

function toolAction(command: string): string {
  // WHAT: Label version-control commands with the Git action family.
  // WHY: Operators scan semantic action labels faster than raw command prefixes.
  if (commandHasToken(command, ['git', 'gh'])) return 'Git';
  // WHAT: Label repository discovery commands as search work.
  // WHY: Search activity is distinct from reading a known file.
  if (commandHasToken(command, ['rg', 'grep', 'find', 'fd'])) return 'Search';
  // WHAT: Label filesystem mutation commands as writes.
  // WHY: Mutating tools carry a different review risk from observational commands.
  if (commandHasToken(command, ['apply_patch', 'tee', 'touch', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'chown'])) return 'Write';
  // WHAT: Label observational file commands as reads.
  // WHY: Known-file inspection should not be conflated with repository search.
  if (commandHasToken(command, ['cat', 'sed', 'nl', 'head', 'tail', 'less', 'wc'])) return 'Read';
  return 'Ran';
}

export function threadRunToolPresentation(event: ThreadRunLogEvent): ThreadRunToolPresentation {
  if (event.title === 'File changes') {
    const files = event.tool.split('\n').map((line) => line.replace(/^-\s*/, '').trim()).filter(Boolean);
    return {
      action: 'Files',
      command: files.join('\n') || 'File changes',
      compactCommand: compactText(files.join(', ') || 'File changes'),
      status: event.status || 'pending',
    };
  }
  const command = displayCommand(event.tool || event.title);
  const statusParts = [event.status];
  // WHAT: Surface a producer exit code beside lifecycle status when available.
  // WHY: Exit codes disambiguate failed and partially reported command lifecycles.
  if (event.exitCode) statusParts.push(`code ${event.exitCode}`);
  return {
    action: toolAction(command),
    command,
    compactCommand: compactText(command),
    status: statusParts.filter(Boolean).join(' / ') || 'pending',
  };
}
