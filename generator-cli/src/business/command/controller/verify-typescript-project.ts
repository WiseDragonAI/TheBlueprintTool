/**
 * WHAT: TypeScript project verification controller.
 * WHY: the Root Block must be implemented as TypeScript source with project configuration.
 */
import type { FileSystemPort, Result } from '../../../lib/types.js';
import { telemetry } from '../../../lib/telemetry/telemetry.js';
import { readTypescriptProjectConfig } from '../helper/read-typescript-project-config.js';
import { verifyTypescriptSourceFiles } from '../helper/verify-typescript-source-files.js';

export async function verifyTypescriptProjectController(root = '.', fs?: FileSystemPort): Promise<Result<string[]>> {
  const config = await readTypescriptProjectConfig(`${root}/tsconfig.json`, fs);
  telemetry('read-typescript-project-config');

  // WHY: TypeScript source verification is meaningless without project config.
  // WHAT: reject before walking files.
  if (!config.ok) {
    telemetry('verify-typescript-project-rejected', { error: config.error });
    return config;
  }

  const verification = await verifyTypescriptSourceFiles(root, fs);
  telemetry('verify-typescript-source-files');

  // WHY: JavaScript implementation files violate the Root Block contract.
  // WHAT: return the verification failure.
  if (!verification.ok) {
    telemetry('verify-typescript-project-rejected', { error: verification.error });
    return verification;
  }

  telemetry('verify-typescript-project-completed');
  return verification;
}
