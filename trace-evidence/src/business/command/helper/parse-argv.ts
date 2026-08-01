/**
 * WHAT: Parses trace-evidence commands into stable direct-argv actions.
 * WHY: Background workers and agents require repeatable selectors without shell interpretation.
 */
export type TraceCliAction = { command: string; values: Map<string, string[]>; flags: Set<string>; childCommand: string[] };

export function parseArgv(argv: string[]): TraceCliAction {
  const separator = argv.indexOf('--');
  const own = separator >= 0 ? argv.slice(0, separator) : argv;
  const childCommand = separator >= 0 ? argv.slice(separator + 1) : [];
  const command = own[0] ?? 'help';
  const values = new Map<string, string[]>();
  for (let index = 1; index < own.length; index += 1) {
    const flag = own[index];
    // WHAT: Reject positional arguments in the trace command boundary.
    // WHY: Only the child command after the separator may contain unrestricted argv.
    if (!flag.startsWith('--')) throw new Error(`unexpected_argument:${flag}`);
    const next = own[index + 1];
    const value = next && !next.startsWith('--') ? next : 'true';
    if (value !== 'true') index += 1;
    values.set(flag.slice(2), [...(values.get(flag.slice(2)) ?? []), value]);
  }
  const action = { command, values, flags: new Set([...values].filter(([, entries]) => entries.at(-1) === 'true').map(([name]) => name)), childCommand };
  const childExecutable = childCommand[0]?.split('/').at(-1);
  const childChangesDirectory = childExecutable === 'env' && childCommand.slice(1).some((argument) => argument === '-C' || argument.startsWith('-C') || argument === '--chdir' || argument.startsWith('--chdir='));
  // WHAT: Reject two competing child working-directory owners.
  // WHY: Combining trace --cwd with env --chdir or -C resolves package paths twice and can prevent the selected test from starting.
  if (values.has('cwd') && childChangesDirectory) throw new Error('conflicting_working_directory:use_trace_cwd_only');
  return action;
}

export function value(action: TraceCliAction, name: string, fallback = ''): string { return action.values.get(name)?.at(-1) ?? fallback; }
export function values(action: TraceCliAction, name: string): string[] { return action.values.get(name) ?? []; }
