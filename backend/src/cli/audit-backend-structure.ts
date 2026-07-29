/**
 * WHAT: Reports backend TypeScript file size, import ownership, and dependency cycles.
 * WHY: Structural regressions must be measurable with a repository command instead of one-off shell analysis.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type BackendStructureFile = {
  file: string;
  imports: number;
  lines: number;
};

export type BackendStructureAudit = {
  cycles: string[][];
  files: BackendStructureFile[];
  oversizedFiles: BackendStructureFile[];
  sourceRoot: string;
};

function typescriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...typescriptFiles(target));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) files.push(target);
  }
  return files.sort();
}

function resolvedImport(sourceRoot: string, ownerFile: string, importPath: string): string | null {
  if (importPath.startsWith('@backend/')) {
    return resolve(sourceRoot, importPath.slice('@backend/'.length).replace(/\.js$/, '.ts'));
  }
  if (importPath.startsWith('.')) {
    return resolve(dirname(ownerFile), importPath.replace(/\.js$/, '.ts'));
  }
  return null;
}

function dependencyCycles(edges: Map<string, string[]>): string[][] {
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const stacked = new Set<string>();
  const cycles: string[][] = [];
  let nextIndex = 0;

  const visit = (file: string): void => {
    indexes.set(file, nextIndex);
    lowLinks.set(file, nextIndex);
    nextIndex += 1;
    stack.push(file);
    stacked.add(file);

    for (const dependency of edges.get(file) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(file, Math.min(lowLinks.get(file)!, lowLinks.get(dependency)!));
        continue;
      }
      if (stacked.has(dependency)) {
        lowLinks.set(file, Math.min(lowLinks.get(file)!, indexes.get(dependency)!));
      }
    }

    if (lowLinks.get(file) !== indexes.get(file)) return;
    const component: string[] = [];
    while (stack.length > 0) {
      const candidate = stack.pop()!;
      stacked.delete(candidate);
      component.push(candidate);
      if (candidate === file) break;
    }
    if (component.length > 1) cycles.push(component.sort());
  };

  for (const file of edges.keys()) {
    if (!indexes.has(file)) visit(file);
  }
  return cycles.sort((left, right) => left[0]!.localeCompare(right[0]!));
}

export function auditBackendStructure(input: {
  sourceRoot: string;
  oversizedLineCount?: number;
}): BackendStructureAudit {
  const sourceRoot = resolve(input.sourceRoot);
  const oversizedLineCount = input.oversizedLineCount ?? 300;
  const absoluteFiles = typescriptFiles(sourceRoot);
  const knownFiles = new Set(absoluteFiles);
  const edges = new Map<string, string[]>();
  const files = absoluteFiles.map((file) => {
    const source = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const dependencies: string[] = [];
    let imports = 0;
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      imports += 1;
      if (!ts.isStringLiteralLike(statement.moduleSpecifier)) continue;
      const importPath = statement.moduleSpecifier.text;
      const target = resolvedImport(sourceRoot, file, importPath);
      if (target && knownFiles.has(target)) dependencies.push(target);
    }
    edges.set(file, dependencies);
    return {
      file: relative(sourceRoot, file).replaceAll('\\', '/'),
      imports,
      lines: source.split('\n').length,
    };
  });

  return {
    cycles: dependencyCycles(edges).map((cycle) => cycle.map((file) => (
      relative(sourceRoot, file).replaceAll('\\', '/')
    ))),
    files,
    oversizedFiles: files.filter((file) => file.lines > oversizedLineCount)
      .sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file)),
    sourceRoot,
  };
}

function main(): void {
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const sourceRootArgument = process.argv.find((argument) => argument.startsWith('--source-root='));
  const lineCountArgument = process.argv.find((argument) => argument.startsWith('--oversized-lines='));
  const report = auditBackendStructure({
    sourceRoot: sourceRootArgument?.slice('--source-root='.length) || defaultRoot,
    oversizedLineCount: lineCountArgument ? Number(lineCountArgument.slice('--oversized-lines='.length)) : 300,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
