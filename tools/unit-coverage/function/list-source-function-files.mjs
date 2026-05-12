/**
 * WHAT: Lists frontend source files that export a function and require unit coverage.
 * WHY: Runtime coverage percentages do not prove each source function has a dedicated unit test file.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walkDirectory(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walkDirectory(path, files);
      continue;
    }
    if (path.endsWith('.ts')) files.push(path);
  }
  return files;
}

function exportsFunction(path) {
  const source = readFileSync(path, 'utf8');
  return /export\s+(async\s+)?function\s+[A-Za-z0-9_]+/.test(source);
}

export function listSourceFunctionFiles(rootDirectory) {
  const sourceRoots = [
    join(rootDirectory, 'frontend/src/business'),
    join(rootDirectory, 'frontend/src/runtime/helper')
  ];
  const files = [];
  for (const sourceRoot of sourceRoots) {
    for (const path of walkDirectory(sourceRoot)) {
      if (exportsFunction(path)) files.push(path);
    }
  }
  return files.sort();
}
