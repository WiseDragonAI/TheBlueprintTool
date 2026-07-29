/**
 * WHAT: Executes the repository delivery launcher and verifies strict JSON plus durable terminal exit mapping.
 * WHY: Automation must distinguish admission, paused runtime, compensation failure, and complete without parsing prose.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const launcher = resolve(repositoryRoot, 'bin/decision-os-delivery.mjs');
const admittedSha = 'a'.repeat(40);
const priorSha = 'b'.repeat(40);

function run(cwd, args) {
  const result = spawnSync(process.execPath, [launcher, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
  });
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  return { ...result, body: JSON.parse(lines[0]) };
}

function journal(deliveryId, status) {
  const complete = status === 'complete';
  return {
    protocol: 1,
    deliveryId,
    admittedSha,
    priorMainSha: priorSha,
    mainSha: complete ? 'c'.repeat(40) : null,
    phase: complete ? 'complete' : status === 'compensation-failed' || status === 'rolled-back-runtime' ? 'compensation' : 'admission',
    status,
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:01:00.000Z',
    topology: { capturedAt: '', fingerprint: '', admittedNodeIds: [], zeroProjectNodeIds: [] },
    relay: { priorDeploymentId: '', uploadedVersionId: '', activeVersionId: '' },
    nodes: [],
    activationOrder: [],
    phaseReceipts: [],
    compensationReceipts: [],
    artifactPaths: [],
    deadlines: [],
    retries: [],
    failure: complete ? null : {
      code: `delivery_${status.replaceAll('-', '_')}`,
      message: status,
      phase: status === 'compensation-failed' || status === 'rolled-back-runtime' ? 'compensation' : 'admission',
      nodeId: '',
      observedAt: '2026-07-28T00:01:00.000Z',
    },
  };
}

test('rejects unknown commands and non-fixed server input as one strict JSON error', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-cli-invalid-'));
  try {
    const unknown = run(root, ['execute', '--json']);
    assert.equal(unknown.status, 2);
    assert.deepEqual(
      { ok: unknown.body.ok, error: unknown.body.error, exitCode: unknown.body.exitCode },
      { ok: false, error: 'delivery_cli_usage', exitCode: 2 },
    );
    const server = run(root, [
      'promote',
      '--release-sha', admittedSha,
      '--server', 'http://example.invalid',
      '--json',
    ]);
    assert.equal(server.status, 2);
    assert.equal(server.body.error, 'delivery_server_invalid');
    const candidateExtra = run(root, [
      'candidate',
      '--release-sha', admittedSha,
      '--server', 'http://127.0.0.1:50150',
      '--json',
    ]);
    assert.equal(candidateExtra.status, 2);
    assert.equal(candidateExtra.body.error, 'delivery_cli_usage');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('maps every durable terminal state to the fixed JSON exit contract', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-cli-status-'));
  try {
    const decisionOsRoot = resolve(root, '.decision-os');
    const runRoot = resolve(decisionOsRoot, 'delivery', 'runs');
    mkdirSync(runRoot, { recursive: true });
    writeFileSync(resolve(decisionOsRoot, '.settings.json'), `${JSON.stringify({
      deliveryRepositoryRoot: root,
      deliveryNodeId: 'workstation',
      deliveryLocalDispatchToken: 'a'.repeat(43),
    })}\n`);
    const cases = [
      ['complete', 0],
      ['admission-rejected', 2],
      ['paused', 3],
      ['rolled-back-runtime', 3],
      ['compensation-failed', 4],
    ];
    for (const [status, exitCode] of cases) {
      const deliveryId = `delivery-cli-${status}`;
      writeFileSync(resolve(runRoot, `${deliveryId}.json`), `${JSON.stringify(journal(deliveryId, status))}\n`);
      const result = run(root, ['status', '--delivery-id', deliveryId, '--json']);
      assert.equal(result.status, exitCode);
      assert.equal(result.body.status, status);
      assert.equal(result.body.exitCode, exitCode);
      assert.equal(result.body.ok, status === 'complete');
      assert.equal(JSON.stringify(result.body).includes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects malformed, extra, and partial bootstrap configuration before any adapter effect', () => {
  const cases = [
    ['malformed', '{'],
    ['extra', JSON.stringify({
      nodeId: 'workstation',
      decisionOsRoot: '/fixture/.decision-os',
      repositoryRoot: '/fixture/repository',
      releaseRoot: '/fixture/releases',
      initialCommit: admittedSha,
      supervisorProfile: {},
      command: 'forbidden',
    })],
    ['partial', JSON.stringify({ nodeId: 'workstation' })],
  ];
  for (const [name, content] of cases) {
    const root = mkdtempSync(resolve(tmpdir(), `decision-os-delivery-cli-bootstrap-${name}-`));
    try {
      const deliveryRoot = resolve(root, '.decision-os', 'delivery');
      mkdirSync(deliveryRoot, { recursive: true });
      writeFileSync(resolve(deliveryRoot, 'bootstrap-node.json'), content);
      const result = run(root, ['bootstrap-node', '--json']);
      assert.equal(result.status, 3);
      assert.equal(result.body.error, 'delivery_bootstrap_configuration_invalid');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('corrupt status journal stays a single bounded JSON failure', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-delivery-cli-corrupt-'));
  try {
    const runRoot = resolve(root, '.decision-os', 'delivery', 'runs');
    mkdirSync(runRoot, { recursive: true });
    writeFileSync(resolve(root, '.decision-os', '.settings.json'), `${JSON.stringify({
      deliveryRepositoryRoot: root,
      deliveryNodeId: 'workstation',
      deliveryLocalDispatchToken: 'a'.repeat(43),
    })}\n`);
    writeFileSync(resolve(runRoot, 'delivery-corrupt.json'), '{"protocol":1');
    const result = run(root, ['status', '--delivery-id', 'delivery-corrupt', '--json']);
    assert.equal(result.status, 3);
    assert.equal(result.body.ok, false);
    assert.equal(result.body.error, 'delivery_run_invalid');
    assert.equal(result.stdout.trim().split('\n').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
