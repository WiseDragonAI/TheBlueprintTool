/**
 * WHAT: Derives the expected unit test path for a frontend source function file.
 * WHY: One function file should map to one predictable unit test file under the test directory.
 */
import { basename, dirname, join, relative } from 'node:path';

export function deriveUnitTestPath(rootDirectory, sourcePath) {
  const businessPrefix = join(rootDirectory, 'frontend/src/business');
  const runtimeHelperPrefix = join(rootDirectory, 'frontend/src/runtime/helper');
  if (sourcePath.startsWith(businessPrefix)) {
    const relativePath = relative(businessPrefix, sourcePath);
    const testName = basename(relativePath, '.ts') + '.test.ts';
    return join(rootDirectory, 'frontend/test/unit', dirname(relativePath), testName);
  }
  const relativePath = relative(runtimeHelperPrefix, sourcePath);
  const testName = basename(relativePath, '.ts') + '.test.ts';
  return join(rootDirectory, 'frontend/test/unit/runtime/helper', dirname(relativePath), testName);
}
