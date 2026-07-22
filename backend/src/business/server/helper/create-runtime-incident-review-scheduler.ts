/**
 * WHAT: Periodically synchronizes central runtime incidents into the admin review task.
 * WHY: Incident admission must retry transient bootstrap gates without duplicating tasks or crashing the server.
 */
import { isTaskStateBootstrapGate } from '../../task-state/helper/is-task-state-bootstrap-gate.js';
import type { ProjectTaskState } from '../../task-state/helper/project-task-state.js';
import type { DecisionOsProject } from './project-catalog.js';
import { RuntimeScopePausedError, type RuntimeIncidentLedger } from './runtime-incident-ledger.js';
import { runtimeIncidentReviewCardId, synchronizeRuntimeIncidentReviewTask } from './synchronize-runtime-incident-review-task.js';

export function createRuntimeIncidentReviewScheduler(input: {
  incidentLedger: RuntimeIncidentLedger;
  intervalMs: number;
  targetProject: () => DecisionOsProject | null;
  taskState: (project: DecisionOsProject) => ProjectTaskState;
  paused: () => boolean;
  onChanged: (projectId: string) => void;
  onBootstrapGate: (error: unknown, context: Record<string, unknown>) => void;
  onFailure: (error: unknown, context: Record<string, unknown>) => void;
}) {
  let inFlight = false;
  let synchronizedDigest = '';
  let recordedBootstrapDigest = '';

  const run = async (): Promise<void> => {
    // WHAT: Serialize periodic passes and respect an explicitly paused scheduler scope.
    // WHY: Concurrent task-state writes and repeated permanent failures would create avoidable load.
    if (inFlight || input.paused()) return;
    inFlight = true;
    let project: DecisionOsProject | null = null;
    let digest = '';
    try {
      const snapshot = input.incidentLedger.snapshot();
      const incidents = snapshot.incidents.filter((incident) => incident.component !== 'runtime-incident-review');
      // WHAT: Avoid creating an empty operational task before the first retained incident exists.
      // WHY: The task is evidence-backed and begins when there is concrete runtime history to review.
      if (incidents.length === 0) return;
      digest = JSON.stringify(incidents.map((incident) => [
        incident.id,
        incident.status,
        incident.lastObservedAt,
        incident.occurrences,
        incident.resolvedAt,
      ]));
      // WHAT: Skip a snapshot already represented by the deterministic task body.
      // WHY: Periodic checking must not rewrite content or replicate unchanged task resources.
      if (digest === synchronizedDigest) return;
      project = input.targetProject();
      // WHAT: Wait for the configured admin project instead of inventing another task owner.
      // WHY: The central operational task has one deterministic project boundary.
      if (!project) return;
      const result = await synchronizeRuntimeIncidentReviewTask({
        project,
        taskState: input.taskState(project),
        updatedAt: snapshot.updatedAt,
        incidents,
        incidentLedgerFile: input.incidentLedger.file,
      });
      synchronizedDigest = digest;
      recordedBootstrapDigest = '';
      // WHAT: Invalidate the operator projection only when the task content changed.
      // WHY: Stable snapshots must not force unrelated Control Room recomputation.
      if (result.changed) input.onChanged(project.id);
    } catch (error) {
      // WHAT: Let the owning paused task scope retain its original incident.
      // WHY: Creating a second incident would obscure the fault that already blocks this project.
      if (error instanceof RuntimeScopePausedError) return;
      if (isTaskStateBootstrapGate(error)) {
        // WHAT: Record one stopped operation per incident snapshot and keep retrying it.
        // WHY: Relay bootstrap is non-fatal, but its rejected write remains diagnosable.
        if (recordedBootstrapDigest !== digest) {
          input.onBootstrapGate(error, { projectId: project?.id ?? '', cardId: runtimeIncidentReviewCardId });
          recordedBootstrapDigest = digest;
        }
        return;
      }
      // WHAT: Pause only this scheduler after an unexpected synchronization failure.
      // WHY: The catalog and every unrelated runtime scope must remain available.
      input.onFailure(error, { projectId: project?.id ?? '', cardId: runtimeIncidentReviewCardId });
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => void run(), Math.max(10, input.intervalMs));
  timer.unref?.();
  return { run, stop: () => clearInterval(timer) };
}
