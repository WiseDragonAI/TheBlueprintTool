/**
 * WHAT: Builds an isolated master-task accordion workspace and bounds its served Decision OS process.
 * WHY: Browser interaction proof must not inherit federation state, task state, or process ownership from the operator workspace.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectTaskState } from '../../../../backend/src/business/task-state/helper/project-task-state.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const projectId = 'master-subtask-accordion-project';
const masterCardId = 'accordion-master';
const runningChildId = 'accordion-child-1';
const queuedChildId = 'accordion-child-2';

export type AccordionFixture = {
  root: string;
  projectId: string;
  masterCardId: string;
  runningChildId: string;
  queuedChildId: string;
  repositoryStatus: { parent: string; child: string };
};

export type StartedAccordionServer = { process: ChildProcess; url: string; output: () => string };

export async function createMasterTaskSubtaskAccordionFixture(): Promise<AccordionFixture> {
  const root = mkdtempSync(join(tmpdir(), 'decision-os-master-subtask-accordion-'));
  // WHAT: Build the isolated fixture as one recoverable temporary-workspace transaction.
  // WHY: Any construction rejection must remove the exact workspace before it can escape.
  try {
  const decisionOsRoot = join(root, 'accordion-project', '.decision-os');
  const cardsRoot = join(decisionOsRoot, 'cards', 'tasks');
  mkdirSync(cardsRoot, { recursive: true });
  // WHAT: Mark exactly the sixth ordered fixture child hidden during its deterministic construction.
  // WHY: The served disclosure must prove exact hidden filtering while retaining five mounted visible rows.
  const children = Array.from({ length: 6 }, (_, index) => ({
    id: `accordion-child-${index + 1}`,
    title: `Child ${index + 1}`,
    // WHAT: Give only the sixth ordered child the exact hidden label.
    // WHY: The served disclosure must exclude one relationship without disturbing the other five rows.
    labels: index === 5 ? ['hidden'] : [],
  }));
  const cards = [
    {
      id: masterCardId,
      title: 'Accordion master',
      status: 'todo',
      labels: ['master-task'],
      x: 20,
      y: 20,
      w: 480,
      h: 300,
      comment: { contentFile: `.decision-os/cards/tasks/${masterCardId}.md` },
    },
    ...children.map((child, index) => ({
      id: child.id,
      title: child.title,
      status: 'todo',
      labels: child.labels,
      x: 40 + index * 40,
      y: 420,
      w: 240,
      h: 140,
      comment: { contentFile: `.decision-os/cards/tasks/${child.id}.md` },
    })),
  ];
  writeFileSync(join(decisionOsRoot, 'project.json'), JSON.stringify({ id: projectId }, null, 2));
  writeFileSync(join(decisionOsRoot, 'state.json'), JSON.stringify({ ledgers: [{ id: 'tasks', title: 'Tasks', ledgerFile: '.decision-os/tasks.json' }] }, null, 2));
  writeFileSync(join(decisionOsRoot, '.settings.json'), JSON.stringify({
    federationRelayUrl: '', federationId: '', federationNodeCredential: '', federationNodeId: 'accordion-fixture-node',
  }, null, 2));
  writeFileSync(join(decisionOsRoot, 'tasks.json'), JSON.stringify({
    cards,
    annotations: [{ id: 'accordion-zone', x: 0, y: 0, width: 1600, height: 900, color: '#38d9e8' }],
    relationships: children.map((child, index) => ({ id: `accordion-rel-${index + 1}`, from: masterCardId, to: child.id, label: 'subtask', position: index + 1 })),
    notes: {},
    threadFiles: {},
  }, null, 2));
  // WHAT: Materialize one content sidecar for every fixture card before the served catalog loads.
  // WHY: Each card's referenced durable content must exist so the fixture cannot pause its content watcher.
  for (const card of cards) writeFileSync(join(cardsRoot, `${card.id}.md`), `## A. Goal\n\n1. Isolated accordion fixture for ${card.title}.\n`);

  const taskState = createProjectTaskState({
    projectId,
    writerId: 'accordion-fixture-node',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
    initialize: true,
  });
  await admitExecution(taskState, {
    executionId: 'accordion-running-execution', sourceCardId: runningChildId, phase: 'running', requestedAt: '2026-08-15T00:00:00.000Z',
  });
  await admitExecution(taskState, {
    executionId: 'accordion-queued-execution', sourceCardId: queuedChildId, phase: 'queued', requestedAt: '2026-08-15T00:01:00.000Z',
  });
  await taskState.flush();
  return { root, projectId, masterCardId, runningChildId, queuedChildId, repositoryStatus: readRepositoryStatus() };
  } catch (error) {
    // WHAT: Remove the exact temporary workspace when deterministic fixture construction fails.
    // WHY: A pre-server setup rejection must not leave task-state or content artifacts behind.
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export async function settleAccordionExecutions(fixture: AccordionFixture): Promise<void> {
  const decisionOsRoot = join(fixture.root, 'accordion-project', '.decision-os');
  const state = createProjectTaskState({
    projectId: fixture.projectId,
    writerId: 'accordion-fixture-node',
    decisionOsRoot,
    tasksLedgerFile: join(decisionOsRoot, 'tasks.json'),
  });
  await state.executions.transition('accordion-running-execution', { phase: 'succeeded', result: { status: 'succeeded', summary: 'Fixture running child settled.' } });
  await state.executions.transition('accordion-queued-execution', { phase: 'cancelled', result: { status: 'cancelled', summary: 'Fixture queued child settled.' } });
  await state.flush();
}

export async function startMasterTaskSubtaskAccordionServer(fixture: AccordionFixture): Promise<StartedAccordionServer> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve(repoRoot, 'bin/decision-os-server.mjs')], {
    cwd: fixture.root,
    detached: true,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DECISION_OS_FRONTEND_ROOT: resolve(repoRoot, 'frontend'),
      TSX_TSCONFIG_PATH: resolve(repoRoot, 'backend/tsconfig.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError = '';
  const capture = (chunk: Buffer | string) => {
    output = `${output}${String(chunk)}`.slice(-32_000);
  };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);
  child.once('error', (error) => {
    // WHAT: Capture the exact asynchronous spawn rejection inside the bounded startup evidence.
    // WHY: Child-process errors do not settle through exit status and must remain observable.
    spawnError = error instanceof Error ? error.stack || error.message : String(error);
    capture(spawnError);
  });
  const startedServer = { process: child, url, output: () => output };
  // WHAT: Own readiness, federation isolation, and failure cleanup in one startup transaction.
  // WHY: No rejected server launch may retain a detached process beyond this function.
  try {
    await waitFor(async () => {
      assert.equal(spawnError, '', `Decision OS fixture server failed to spawn:\n${output}`);
      assert.equal(child.exitCode === null && child.signalCode === null, true, `Decision OS fixture server exited early:\n${output}`);
      return Boolean((await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(1_000) }).catch(() => undefined))?.ok);
    }, `Timed out waiting for Decision OS fixture server at ${url}.\n${output}`);
    const federation = await fetch(`${url}/api/settings/federation`, { signal: AbortSignal.timeout(2_000) })
      .then(async (response) => ({ ok: response.ok, body: await response.json() as { phase?: string } }));
    assert.equal(federation.ok, true, JSON.stringify(federation.body));
    assert.equal(federation.body.phase, 'not_configured');
    return startedServer;
  } catch (error) {
    // WHAT: Settle the fixture process before propagating any startup or isolation failure.
    // WHY: A rejected readiness boundary must not leak a detached server into later browser scenarios.
    await stopMasterTaskSubtaskAccordionServer(startedServer);
    throw error;
  }
}

export async function stopMasterTaskSubtaskAccordionServer(server: StartedAccordionServer): Promise<void> {
  const child = server.process;
  // WHAT: Treat a spawn rejection without a process identity as already settled.
  // WHY: Cleanup must not signal or await a process group that the operating system never created.
  if (!child.pid) return;
  // WHAT: Skip termination when the fixture server already settled.
  // WHY: Sending a signal to a reused process group would violate fixture process ownership.
  if (child.exitCode !== null || child.signalCode !== null) return;
  // WHAT: Terminate the detached fixture process group before escalating it.
  // WHY: The browser fixture must clean all descendants even when its server ignores SIGTERM.
  // WHAT: Signal the detached process group only when the launcher exposed its group leader PID.
  // WHY: A missing PID cannot safely identify a child process tree for fixture-owned cleanup.
  if (child.pid) signalOwnedProcessGroup(child.pid, 'SIGTERM');
  await Promise.race([onceExit(child), delay(2_000)]);
  // WHAT: Escalate only an unsettled process group after the bounded graceful shutdown window.
  // WHY: Awaited fixture cleanup cannot leave a server process behind for later browser scenarios.
  // WHAT: Send SIGKILL only to a still-live fixture group with an owned PID.
  // WHY: Escalation is needed for bounded cleanup but must not target an unresolved process identity.
  if (child.exitCode === null && child.signalCode === null && child.pid) signalOwnedProcessGroup(child.pid, 'SIGKILL');
  await Promise.race([onceExit(child), delay(2_000)]);
  assert.ok(child.exitCode !== null || child.signalCode !== null, `Decision OS fixture server did not settle after SIGKILL.\n${server.output()}`);
}

export function cleanupMasterTaskSubtaskAccordionFixture(fixture: AccordionFixture): void {
  rmSync(fixture.root, { recursive: true, force: true });
}

export function assertFixtureRepositoryStatusUnchanged(fixture: AccordionFixture): void {
  assert.deepEqual(readRepositoryStatus(), fixture.repositoryStatus);
}

export function updateAccordionMasterContent(fixture: AccordionFixture, revision: string): void {
  const contentFile = join(fixture.root, 'accordion-project', '.decision-os', 'cards', 'tasks', `${fixture.masterCardId}.md`);
  writeFileSync(contentFile, `## A. Goal\n\n1. Same-card refresh ${revision}.\n`);
}

async function admitExecution(state: ReturnType<typeof createProjectTaskState>, input: {
  executionId: string; sourceCardId: string; phase: 'running' | 'queued'; requestedAt: string;
}): Promise<void> {
  await state.executions.admit({
    executorNodeId: 'accordion-fixture-node',
    metadata: {
      executionId: input.executionId,
      requestId: `fixture-request-${input.executionId}`,
      sessionId: `fixture-session-${input.sourceCardId}`,
      projectId,
      ledgerId: 'tasks',
      taskId: masterCardId,
      sourceCardId: input.sourceCardId,
      ownerCardId: input.sourceCardId,
      kind: 'thread',
      requestedAt: input.requestedAt,
      model: null,
      effort: null,
      pipelineRunId: null,
      pipelineStepId: null,
      pipelineSkillRunId: null,
      predecessorExecutionId: null,
      restartOfExecutionId: null,
    },
  });
  await state.executions.transition(input.executionId, { phase: 'queued', changedAt: input.requestedAt });
  // WHAT: Advance only the seeded running execution through the canonical lifecycle.
  // WHY: The browser scenario must prove independently decorated running and queued mounted rows.
  if (input.phase === 'running') {
    await state.executions.transition(input.executionId, { phase: 'starting', changedAt: input.requestedAt });
    await state.executions.transition(input.executionId, { phase: 'running', changedAt: input.requestedAt });
  }
}

function readRepositoryStatus(): { parent: string; child: string } {
  // WHAT: Capture the parent status once without mutating the shared implementation worktree.
  // WHY: The fixture must prove that its own isolated workspace did not alter either repository boundary.
  const parent = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  const child = execFileSync('git', ['status', '--porcelain'], { cwd: join(repoRoot, '.decision-os'), encoding: 'utf8' });
  return { parent, child };
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

async function waitFor(check: () => Promise<boolean>, message: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  // WHAT: Poll the bounded readiness predicate until its deadline expires.
  // WHY: Server readiness must be finite so fixture failure cannot stall the browser suite indefinitely.
  while (Date.now() < deadline) {
    // WHAT: Stop polling when the bounded readiness predicate has become true.
    // WHY: The fixture must not delay browser execution after a verified ready server boundary.
    if (await check()) return;
    await delay(50);
  }
  assert.fail(message);
}

function onceExit(child: ChildProcess): Promise<void> {
  return new Promise((resolveExit) => child.once('exit', () => resolveExit()));
}

function signalOwnedProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    // WHAT: Ignore only the owned process group disappearing between liveness inspection and signaling.
    // WHY: An ESRCH race means cleanup already settled; every other signal failure remains actionable.
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

const delay = (milliseconds: number) => new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
