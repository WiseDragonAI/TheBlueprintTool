/**
 * WHAT: Verifies release-canary delivery success, interruption recovery, rollback, and exact Git identity evidence.
 * WHY: The harness must retain behavioral delivery receipts without touching shared dev or production authorities.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { proveReleaseCanaryDelivery } from '../../src/business/delivery/helper/release-canary-delivery-proof.js';
import type { ReleaseCanaryGitReceipt } from '../../src/business/delivery/helper/release-canary-git-sandbox.js';
import { parseDeliveryRun } from '../../../shared/schemas/decision-os-delivery-types.js';

const candidateSha = 'a'.repeat(40);
const mainSha = 'b'.repeat(40);
const priorMainSha = 'c'.repeat(40);

function fixture(
  root: string,
  mode: ReleaseCanaryGitReceipt['mode'] = 'feature',
  currentCandidateSha = candidateSha,
): ReleaseCanaryGitReceipt {
  const mainStateProof = mode === 'feature' ? 'synthetic-sentinel' : 'paired-child-tags';
  const sandboxRoot = resolve(root, 'release-sandbox');
  mkdirSync(resolve(sandboxRoot, 'release-checkout'), { recursive: true });
  const receiptFile = resolve(root, 'release-receipt.json');
  const bytes = `${JSON.stringify({
    phase: 'canonical-release',
    status: 'passed',
    evidence: {
      mode,
      mainStateProof,
      candidateSha: currentCandidateSha,
      mainSha,
      releaseSha: candidateSha,
      priorMainSha,
      releaseTag: 'rel-0.3.13',
    },
  })}\n`;
  writeFileSync(receiptFile, bytes, { mode: 0o600 });
  return {
    mode,
    receiptFile,
    receiptId: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    candidateSha: currentCandidateSha,
    mainSha,
    releaseSha: candidateSha,
    priorMainSha,
    releaseTag: 'rel-0.3.13',
    devReleaseTag: 'devrel-0.3.13',
    decisionOsSha: 'd'.repeat(40),
    mainSentinelSha256: mode === 'feature' ? 'e'.repeat(64) : null,
    mainStateProof,
    mainFirstParent: priorMainSha,
    devSecondParent: candidateSha,
    parentTree: 'f'.repeat(40),
    initializedChildHead: 'd'.repeat(40),
    sandboxRoot,
    parentRemote: resolve(sandboxRoot, 'parent.git'),
    childRemote: resolve(sandboxRoot, 'child.git'),
    merge: mode === 'feature' ? {} as NonNullable<ReleaseCanaryGitReceipt['merge']> : null,
  };
}

test('release canary binds canonical SHAs to typed success, resume, and rollback delivery artifacts', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-release-canary-delivery-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const release = fixture(root);
  let clock = Date.parse('2026-08-07T10:00:00.000Z');
  const proof = await proveReleaseCanaryDelivery({
    runRoot: root,
    release,
    now: () => new Date(clock += 1),
  });

  assert.deepEqual(Object.keys(proof).sort(), ['delivery-resume', 'delivery-rollback', 'delivery-success']);
  for (const phase of ['delivery-success', 'delivery-resume', 'delivery-rollback'] as const) {
    const evidence = proof[phase];
    const bytes = readFileSync(evidence.receiptFile);
    assert.equal(evidence.receiptId, `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    const document = JSON.parse(bytes.toString('utf8')) as {
      phase: string;
      status: string;
      evidence: {
        releaseSha: string;
        mainSha: string;
        deliveryRun: unknown;
        externalMutationCounts: Record<string, number>;
      };
    };
    assert.equal(document.phase, phase);
    assert.equal(document.status, 'passed');
    assert.equal(document.evidence.releaseSha, candidateSha);
    assert.equal(document.evidence.mainSha, mainSha);
    const run = parseDeliveryRun(document.evidence.deliveryRun);
    assert.equal(run.admittedSha, candidateSha);
    assert.equal(run.mainSha, mainSha);
    assert.equal(run.status, phase === 'delivery-rollback' ? 'rolled-back-runtime' : 'complete');
    assert.equal(document.evidence.externalMutationCounts['activate-relay'], 1);
  }

  const resumeDocument = JSON.parse(readFileSync(proof['delivery-resume'].receiptFile, 'utf8')) as {
    evidence: { externalMutationCounts: Record<string, number> };
  };
  assert.equal(resumeDocument.evidence.externalMutationCounts['activate-relay'], 1);
  const rollbackDocument = JSON.parse(readFileSync(proof['delivery-rollback'].receiptFile, 'utf8')) as {
    evidence: { externalMutationCounts: Record<string, number> };
  };
  assert.equal(rollbackDocument.evidence.externalMutationCounts['rollback-relay'], 1);
});

test('release canary rejects an edited canonical release receipt before delivery', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-release-canary-delivery-tamper-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const release = fixture(root);
  writeFileSync(release.receiptFile, '{"tampered":true}\n');
  await assert.rejects(
    proveReleaseCanaryDelivery({ runRoot: root, release }),
    /release_canary_release_receipt_invalid/,
  );
});

test('release-bound proof keeps main HEAD distinct from the paired dev release identity', async (context) => {
  const root = mkdtempSync(resolve(tmpdir(), 'decision-os-release-canary-delivery-bound-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const release = fixture(root, 'release-bound', mainSha);
  const proof = await proveReleaseCanaryDelivery({ runRoot: root, release });
  const document = JSON.parse(readFileSync(proof['delivery-success'].receiptFile, 'utf8')) as {
    evidence: { candidateSha: string; releaseMode: string; mainStateProof: string; releaseSha: string; mainSha: string; deliveryRun: unknown };
  };
  assert.equal(document.evidence.releaseMode, 'release-bound');
  assert.equal(document.evidence.mainStateProof, 'paired-child-tags');
  assert.equal(document.evidence.candidateSha, mainSha);
  assert.equal(document.evidence.releaseSha, candidateSha);
  assert.equal(document.evidence.mainSha, mainSha);
  const run = parseDeliveryRun(document.evidence.deliveryRun);
  assert.equal(run.admittedSha, candidateSha);
  assert.equal(run.mainSha, mainSha);
});
