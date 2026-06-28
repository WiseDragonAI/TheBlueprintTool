import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

export function workspaceRelativePath(workspaceRoot: string, path: string): string {
  return toPosixPath(relative(workspaceRoot, path));
}

export function isInsideWorkspace(workspaceRoot: string, path: string): boolean {
  const inner = relative(workspaceRoot, path);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanAssetToken(value: string): string {
  return decodePath(value.trim().replace(/^['"<]+|['">,;.)`]+$/g, '')).split('#')[0]?.split('?')[0] ?? '';
}

export function normalizeAssetReference(input: { rawReference: string; sourceFile?: string; workspaceRoot: string }): string | null {
  const source = cleanAssetToken(input.rawReference);
  if (!source || /^https?:\/\//i.test(source) || /^data:/i.test(source) || source.startsWith('#')) return null;

  if (source.startsWith('/.blueprinttool/')) return source.slice(1);
  if (source.startsWith('.blueprinttool/')) return source;
  if (source.startsWith('./.blueprinttool/')) return source.slice(2);

  if ((source.startsWith('../') || source.startsWith('./')) && input.sourceFile) {
    const resolved = resolve(dirname(input.sourceFile), source);
    if (!isInsideWorkspace(input.workspaceRoot, resolved)) return null;
    const relativePath = workspaceRelativePath(input.workspaceRoot, resolved);
    return relativePath.startsWith('.blueprinttool/') ? relativePath : null;
  }

  return null;
}

export function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string | null {
  const resolved = resolve(workspaceRoot, relativePath);
  return isInsideWorkspace(workspaceRoot, resolved) ? resolved : null;
}
