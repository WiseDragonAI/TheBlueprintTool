/**
 * WHAT: GeneratedReport file writer.
 * WHY: report mode must persist exactly one generated report file.
 */
import type { FileSystemPort, GeneratedReport } from '../../../lib/types.js';
import { nodeFileSystem } from '../../../lib/fs/node-file-system.js';
import { stringifyJson } from '../../../lib/json/json.js';

export async function writeGeneratedReportFile(path: string, report: GeneratedReport, fs: FileSystemPort = nodeFileSystem): Promise<void> {
  await fs.writeFile(path, stringifyJson(report));
}
