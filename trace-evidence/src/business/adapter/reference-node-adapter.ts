/**
 * WHAT: Provides the minimal reusable adapter for an ordinary Node repository.
 * WHY: A second repository must adopt the core by changing raw discovery boundaries only.
 */
import { access, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import type { CardDescriptor, RawEvidenceRecord, SourceFileDescriptor, TestCommand, TraceRepositoryAdapter, TraceScope } from '../../lib/types.js';

export class ReferenceNodeAdapter implements TraceRepositoryAdapter {
  readonly name = 'reference-node'; readonly version = '1';
  constructor(private readonly root: string) {}
  async discoverTests(input: { files: string[]; names: string[]; command: string[]; cwd: string }): Promise<TestCommand[]> {
    // WHAT: Require direct argv for the reference test adapter.
    // WHY: The reusable boundary never interprets shell command strings.
    if (input.command.length === 0) throw new Error('test_command_required');
    const identities = input.files.length > 0 ? input.files : input.names.length > 0 ? input.names : ['selected-tests'];
    return identities.map((testId) => ({ testId, executable: input.command[0], args: input.command.slice(1), cwd: resolve(input.cwd), env: {} }));
  }
  async resolveCards(_input: { projectId: string; cardIds: string[] }): Promise<CardDescriptor[]> { throw new Error('unsupported_capability:cards'); }
  async resolveScopes(_input: { projectId: string; cardIds: string[]; executionIds: string[]; sessionIds: string[] }): Promise<TraceScope[]> { throw new Error('unsupported_capability:tasks'); }
  async wrapTestCommandWithLease(input: { command: TestCommand }): Promise<TestCommand> { return input.command; }
  async *collectEvidence(): AsyncIterable<RawEvidenceRecord> { throw new Error('unsupported_capability:task-evidence'); }
  async locateSourceMaps(_input: { scopes: TraceScope[]; generatedFiles: string[] }): Promise<string[]> {
    const maps: string[] = [];
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
        // WHAT: Skip dependencies and Git internals during reference source-map discovery.
        // WHY: Only repository-owned build outputs belong to the selected build identity.
        if (entry.isDirectory() && ['node_modules', '.git'].includes(entry.name)) continue;
        const path = resolve(directory, entry.name);
        // WHAT: Recurse through repository-owned directories.
        // WHY: Node packages commonly emit maps into nested dist directories.
        if (entry.isDirectory()) { await visit(path); continue; }
        // WHAT: Admit only readable source-map filename candidates.
        // WHY: Generated JavaScript without a map remains an explicit mapping failure.
        if (entry.name.endsWith('.map')) maps.push(path);
      }
    };
    await visit(this.root); return maps;
  }
  async resolveSourceFiles(input: { files: string[] }): Promise<SourceFileDescriptor[]> {
    const files = [...new Set(input.files.map((file) => resolve(file)))];
    const existing = await Promise.all(files.map(async (path) => ({ path, exists: await access(path).then(() => true, () => false) })));
    return existing.filter((entry) => entry.exists).map((entry) => ({ path: entry.path, repositoryRelativePath: relative(this.root, entry.path), tracked: false, gitBlobHash: null }));
  }
}
