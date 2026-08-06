/**
 * WHAT: Verifies exact relay project-owner topology selection, zero-project exclusion, and drift detection.
 * WHY: Admission must freeze authenticated ownership before any production mutation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDeliveryTopologyUnchanged,
  DeliveryTopologyError,
  freezeDeliveryTopology,
} from '../../src/business/delivery/controller/delivery-topology-controller.js';

const originA = '1'.repeat(64);
const originB = '2'.repeat(64);
const capturedAt = '2026-07-28T00:00:00.000Z';

function topology() {
  return freezeDeliveryTopology({
    capturedAt,
    nodes: [
      {
        nodeId: 'phone',
        nodeLabel: 'Phone',
        online: true,
        projects: [{ projectId: 'mobile', originFingerprint: originB }],
      },
      {
        nodeId: 'verifier',
        nodeLabel: 'Verifier',
        online: false,
        projects: [],
      },
      {
        nodeId: 'workstation',
        nodeLabel: 'Workstation',
        online: true,
        projects: [{ projectId: 'decision-os', originFingerprint: originA }],
      },
    ],
  });
}

test('freezes exact active owners and records offline zero-project identities separately', () => {
  const frozen = topology();
  assert.deepEqual(frozen.activeNodes.map((node) => node.nodeId), ['phone', 'workstation']);
  assert.deepEqual(frozen.zeroProjectNodes.map((node) => node.nodeId), ['verifier']);
  assert.match(frozen.fingerprint, /^[a-f0-9]{64}$/);
});

test('offline active owners and missing origin identity reject before topology freeze', () => {
  assert.throws(() => freezeDeliveryTopology({
    capturedAt,
    nodes: [{
      nodeId: 'phone',
      nodeLabel: 'Phone',
      online: false,
      projects: [{ projectId: 'mobile', originFingerprint: originB }],
    }],
  }), (error: unknown) => error instanceof DeliveryTopologyError && error.code === 'delivery_active_node_offline');
  assert.throws(() => freezeDeliveryTopology({
    capturedAt,
    nodes: [{
      nodeId: 'workstation',
      nodeLabel: 'Workstation',
      online: true,
      projects: [{ projectId: 'decision-os', originFingerprint: '' }],
    }],
  }), (error: unknown) => error instanceof DeliveryTopologyError && error.code === 'delivery_project_origin_missing');
});

test('targeted production topology ignores unrelated offline project owners', () => {
  const frozen = freezeDeliveryTopology({
    capturedAt,
    targetNodeId: 'workstation',
    nodes: [
      { nodeId: 'workstation', nodeLabel: 'Workstation', online: true, projects: [{ projectId: 'decision-os', originFingerprint: originA }] },
      { nodeId: 'phone', nodeLabel: 'Phone', online: false, projects: [{ projectId: 'mobile', originFingerprint: originB }] },
    ],
  });
  assert.deepEqual(frozen.activeNodes.map((node) => node.nodeId), ['workstation']);
  assert.deepEqual(frozen.zeroProjectNodes, []);
});

test('targeted production topology requires its configured coordinator', () => {
  assert.throws(() => freezeDeliveryTopology({
    capturedAt,
    targetNodeId: 'workstation',
    nodes: [{ nodeId: 'phone', nodeLabel: 'Phone', online: true, projects: [] }],
  }), (error: unknown) => error instanceof DeliveryTopologyError && error.code === 'delivery_target_node_missing');
});

test('project, owner, and origin drift all reject with delivery_topology_changed', () => {
  const frozen = topology();
  for (const observed of [
    freezeDeliveryTopology({
      capturedAt,
      nodes: [
        { nodeId: 'phone', nodeLabel: 'Phone', online: true, projects: [{ projectId: 'mobile-v2', originFingerprint: originB }] },
        { nodeId: 'verifier', nodeLabel: 'Verifier', online: true, projects: [] },
        { nodeId: 'workstation', nodeLabel: 'Workstation', online: true, projects: [{ projectId: 'decision-os', originFingerprint: originA }] },
      ],
    }),
    freezeDeliveryTopology({
      capturedAt,
      nodes: [
        { nodeId: 'phone-v2', nodeLabel: 'Phone', online: true, projects: [{ projectId: 'mobile', originFingerprint: originB }] },
        { nodeId: 'verifier', nodeLabel: 'Verifier', online: true, projects: [] },
        { nodeId: 'workstation', nodeLabel: 'Workstation', online: true, projects: [{ projectId: 'decision-os', originFingerprint: originA }] },
      ],
    }),
    freezeDeliveryTopology({
      capturedAt,
      nodes: [
        { nodeId: 'phone', nodeLabel: 'Phone', online: true, projects: [{ projectId: 'mobile', originFingerprint: '3'.repeat(64) }] },
        { nodeId: 'verifier', nodeLabel: 'Verifier', online: true, projects: [] },
        { nodeId: 'workstation', nodeLabel: 'Workstation', online: true, projects: [{ projectId: 'decision-os', originFingerprint: originA }] },
      ],
    }),
  ]) {
    assert.throws(
      () => assertDeliveryTopologyUnchanged(frozen, observed),
      (error: unknown) => error instanceof DeliveryTopologyError && error.code === 'delivery_topology_changed',
    );
  }
});
