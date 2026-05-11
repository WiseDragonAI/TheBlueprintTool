export function snapshotArgs(args: unknown): unknown {
  if (typeof structuredClone === 'function') return structuredClone(args);
  return JSON.parse(JSON.stringify(args));
}
