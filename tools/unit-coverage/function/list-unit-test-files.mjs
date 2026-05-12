/**
 * WHAT: Lists frontend unit test files.
 * WHY: The structural coverage report compares source function files to explicit unit tests.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walkDirectory(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walkDirectory(path, files);
      continue;
    }
    if (path.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

export function listUnitTestFiles(rootDirectory) {
  return walkDirectory(join(rootDirectory, 'frontend/test/unit')).sort();
}
