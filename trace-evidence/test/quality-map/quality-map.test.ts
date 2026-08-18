/**
 * WHAT: Proves AST rationale extraction, Graphify linking, quality findings, coverage, and stack projection.
 * WHY: The static map must expose logical control flow beside Trace Evidence source frames.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSourceFile } from '../../src/business/quality-map/helper/parse-source-file.js';
import { buildQualityMap } from '../../src/business/quality-map/controller/build-quality-map.js';
import { projectStack } from '../../src/business/quality-map/helper/project-stack.js';

const source = `/**
 * WHAT: Controls one decision.
 * WHY: The fixture proves rationale extraction.
 */
export function decide(value: boolean): string {
  // WHAT: Select the accepted path.
  // WHY: True input requires the successful result.
  if (value) {
    return 'yes';
  } else {
    // WHAT: Select the rejected path.
    // WHY: False input requires the alternate result.
    return 'no';
  }
}
`;

test('AST parsing returns function and branch WHAT/WHY rationale', () => {
  const parsed = parseSourceFile('src/example/controller/decide.ts', source);
  assert.equal(parsed.header.what, 'Controls one decision.');
  assert.equal(parsed.functions.length, 1);
  assert.deepEqual(parsed.functions[0]?.branches.map((branch) => [branch.kind, branch.comments.what, branch.comments.why, branch.compliant]), [
    ['if', 'Select the accepted path.', 'True input requires the successful result.', true],
    ['else', 'Select the rejected path.', 'False input requires the alternate result.', true],
  ]);
});

test('non-Git filesystem map joins Graphify, LCOV, quality roles, and stack control flow', async () => {
  const root = await mkdtemp(join(tmpdir(), 'quality-map-fixture-'));
  await mkdir(join(root, 'src/example/controller'), { recursive: true });
  await mkdir(join(root, 'src/example/helper'), { recursive: true });
  await writeFile(join(root, 'src/example/controller/decide.ts'), source);
  await writeFile(join(root, 'src/example/helper/result.ts'), `/**\n * WHAT: Returns a result.\n * WHY: The controller needs a bounded derivation.\n */\nexport function result(): string { return 'ok'; }\n`);
  await writeFile(join(root, 'README.md'), '# Fixture\n');
  const graphPath = join(root, 'graph.json');
  await writeFile(graphPath, JSON.stringify({ nodes: [{ id: 'decide', source_file: 'src/example/controller/decide.ts', name: 'decide' }, { id: 'result', source_file: 'src/example/helper/result.ts', name: 'result' }], edges: [{ source: 'decide', target: 'result' }] }));
  const lcovPath = join(root, 'coverage.lcov');
  await writeFile(lcovPath, 'SF:src/example/controller/decide.ts\nFN:5,decide\nFNDA:1,decide\nDA:5,1\nDA:8,1\nend_of_record\n');
  const report = buildQualityMap({ root, graphPath, lcovPath });
  const controller = report.files.find((file) => file.path.endsWith('decide.ts'))!;
  const helper = report.files.find((file) => file.path.endsWith('result.ts'))!;
  assert.equal(report.scope, 'filesystem');
  assert.equal(report.root, root);
  assert.equal(controller.role, 'controller');
  assert.deepEqual(controller.dependencies, [helper.path]);
  assert.deepEqual(controller.functions[0]?.callees, [helper.functions[0]?.id]);
  assert.equal(controller.lineCoverage, 100);
  const projection = projectStack(report, `at decide (${join(root, controller.path)}:8:3)`) as Array<Record<string, unknown>>;
  assert.equal(projection[0]?.status, 'mapped');
  assert.equal((projection[0]?.function as { name: string }).name, 'decide');
  assert.equal((projection[0]?.controlFlow as unknown[]).length, 2);
});
