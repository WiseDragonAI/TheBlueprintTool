/**
 * WHAT: Adopts one prepared immutable Decision OS release through a validated node supervisor profile.
 * WHY: Supervisor registration is a bootstrap lifecycle, not immutable release-store persistence.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { runBoundedProcess } from '../../process/helper/run-bounded-process.js';
import {
  createNodeReleaseStore,
  NodeReleaseError,
  type NodeReleaseIdentity,
  type NodeReleaseProcessRunner,
} from '../helper/node-release-store.js';
import { redactDeliveryText } from '../helper/delivery-redactor.js';

export type DecisionOsDeliveryNodeSettings = {
  deliveryProtocol: 1;
  deliveryNodeId: string;
  deliveryRepositoryRoot: string;
  deliveryReleaseRoot: string;
  deliveryCurrentPointer: string;
  deliverySupervisorProfile: string;
  deliverySupervisorAdopted: boolean;
  deliverySupervisedExit: boolean;
  deliveryEmergencyHealth: boolean;
  deliveryDecisionOsRoot: string;
  deliveryLocalDispatchToken: string;
};

type WorkstationSupervisorProfile = {
  profile: 'multiterm-workstation-v1';
  managerCommand: string;
  catalogRoot: string;
  port: 50150;
  url: string;
  name: string;
  description: string;
  automaticRestart: true;
};

function absoluteDirectory(value: string, field: string): string {
  if (!isAbsolute(value)) {
    throw new NodeReleaseError(`node_release_${field}_invalid`, `${field} must be absolute.`);
  }
  return resolve(value);
}

function exactSupervisorProfile(value: unknown): WorkstationSupervisorProfile {
  const profile = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  // WHAT: Admit only the fixture-proven workstation adapter.
  // WHY: The phone supervisor remains an explicit operator-owned production prerequisite.
  if (profile.profile !== 'multiterm-workstation-v1') {
    throw new NodeReleaseError('unsupported_supervisor_profile', 'Only multiterm-workstation-v1 is implemented; non-workstation nodes require a validated node-owned adapter.');
  }
  const keys = ['profile', 'managerCommand', 'catalogRoot', 'port', 'url', 'name', 'description', 'automaticRestart'];
  if (Object.keys(profile).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(profile, key))) {
    throw new NodeReleaseError('node_supervisor_profile_invalid', 'The workstation supervisor profile shape is invalid.');
  }
  if (profile.port !== 50150 || profile.automaticRestart !== true) {
    throw new NodeReleaseError('node_supervisor_profile_invalid', 'The workstation supervisor must retain port 50150 and automatic restart.');
  }
  for (const key of ['managerCommand', 'catalogRoot', 'url', 'name', 'description']) {
    if (typeof profile[key] !== 'string' || !profile[key]) {
      throw new NodeReleaseError('node_supervisor_profile_invalid', `Supervisor ${key} is required.`);
    }
  }
  return profile as WorkstationSupervisorProfile;
}

function writeSettingsAtomically(settingsFile: string, settings: Record<string, unknown>): void {
  mkdirSync(dirname(settingsFile), { recursive: true });
  const temporary = `${settingsFile}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, settingsFile);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export async function bootstrapDecisionOsNode(input: {
  nodeId: string;
  decisionOsRoot: string;
  repositoryRoot: string;
  releaseRoot: string;
  initialCommit: string;
  settings: unknown;
  supervisorProfile: unknown;
  runner?: NodeReleaseProcessRunner;
  environment?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}): Promise<{ settings: DecisionOsDeliveryNodeSettings; release: NodeReleaseIdentity; supervisorAdopted: true }> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/.test(input.nodeId)) {
    throw new NodeReleaseError('node_release_node_id_invalid', 'A stable node ID is required.');
  }
  // WHAT: Stop before interpreting an unsupported node-owned supervisor record.
  // WHY: Bootstrap must never infer the missing phone lifecycle commands.
  if (input.nodeId !== 'workstation') {
    throw new NodeReleaseError('unsupported_supervisor_profile', 'The phone supervisor profile is not implemented; bootstrap requires its node-owned validated profile.');
  }
  const profile = exactSupervisorProfile(input.supervisorProfile);
  const decisionOsRoot = absoluteDirectory(input.decisionOsRoot, 'decision_os_root');
  const settingsFile = resolve(decisionOsRoot, '.settings.json');
  const existing = existsSync(settingsFile)
    ? JSON.parse(readFileSync(settingsFile, 'utf8')) as Record<string, unknown>
    : {};
  const existingDispatchToken = String(existing.deliveryLocalDispatchToken ?? '');
  const deliveryLocalDispatchToken = /^[A-Za-z0-9_-]{43}$/.test(existingDispatchToken)
    ? existingDispatchToken
    : randomBytes(32).toString('base64url');
  const store = createNodeReleaseStore({
    repositoryRoot: input.repositoryRoot,
    releaseRoot: input.releaseRoot,
    settings: input.settings,
    runner: input.runner,
    environment: input.environment,
    decisionOsRoot,
  });
  await store.prepare(input.initialCommit, input.signal);
  const before = store.active();
  // WHAT: Initialize only an empty release pointer.
  // WHY: Bootstrap cannot replace a node whose active release already has another identity.
  if (!before.releaseSha) {
    store.initialize(input.initialCommit);
  } else if (before.releaseSha !== input.initialCommit) {
    throw new NodeReleaseError('node_release_bootstrap_pointer_conflict', 'Bootstrap found a different existing active release.');
  }
  const deliverySettings: DecisionOsDeliveryNodeSettings = {
    deliveryProtocol: 1,
    deliveryNodeId: input.nodeId,
    deliveryRepositoryRoot: store.repositoryRoot,
    deliveryReleaseRoot: store.releaseRoot,
    deliveryCurrentPointer: store.currentPointer,
    deliverySupervisorProfile: profile.profile,
    deliverySupervisorAdopted: true,
    deliverySupervisedExit: true,
    deliveryEmergencyHealth: true,
    deliveryDecisionOsRoot: decisionOsRoot,
    deliveryLocalDispatchToken,
  };
  const runner = input.runner ?? runBoundedProcess;
  const supervisorResult = await runner({
    command: profile.managerCommand,
    args: [
      'register',
      '--cwd', profile.catalogRoot,
      '--cmd', `env PORT=50150 ${store.currentPointer}/bin/decision-os-server.mjs`,
      '--port', '50150',
      '--url', profile.url,
      '--name', profile.name,
      '--description', profile.description,
      '--auto-restart',
      '--no-launch',
    ],
    cwd: profile.catalogRoot,
    env: input.environment ?? process.env,
    deadlineMs: 30_000,
    signal: input.signal,
    maximumOutputBytes: 1024 * 1024,
    context: { component: 'bootstrap-decision-os-node', operation: 'adopt-multiterm-supervisor' },
  });
  if (!supervisorResult.ok) {
    throw new NodeReleaseError(
      'node_supervisor_adoption_failed',
      redactDeliveryText(supervisorResult.stderr || supervisorResult.spawnError || 'MultiTerm supervisor adoption failed.'),
    );
  }
  writeSettingsAtomically(settingsFile, { ...existing, ...deliverySettings });
  return { settings: deliverySettings, release: store.active(), supervisorAdopted: true };
}
