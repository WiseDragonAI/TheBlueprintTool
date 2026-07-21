import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tasksLedgerForProject, type DecisionOsProject } from '../../server/helper/project-catalog.js';
import { applyLedgerMutation } from '../../ledger/helper/apply-ledger-mutation.js';
import { stripHydratedThreadNotes } from '../../ledger/helper/thread-content-file.js';
import { persistLedgerProjection } from '../../task-state/helper/persist-ledger-projection.js';
import { readLedgerProjection } from '../../task-state/helper/read-ledger-projection.js';

type AnyRecord = Record<string, unknown>;

export async function admitProjectSyncMasterTask(input: {
  project: DecisionOsProject;
  runtime: AnyRecord;
  sourceProjectId: string;
  sourceProjectName: string;
  sourceProjectColor: string;
  originFingerprint: string;
  syncId: string;
  waitingSince: string;
}): Promise<{ ledgerId: string; masterCardId: string; zoneId: string }> {
  const ledger = tasksLedgerForProject(input.project);
  const ledgerPath = resolve(input.project.decisionOsRoot, ledger.ledgerFile.replace(/^\.decision-os\//, ''));
  const document = readLedgerProjection({ ledgerId: ledger.id, ledgerPath, runtime: input.runtime }) as AnyRecord & {
    cards?: AnyRecord[];
    annotations?: AnyRecord[];
    relationships?: AnyRecord[];
  };
  const safeSyncId = input.syncId.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const masterCardId = `card-project-sync-${safeSyncId}`;
  const zoneId = `zone-project-sync-${safeSyncId}`;
  const existingCard = (document.cards ?? []).find((card) => String(card.id ?? '') === masterCardId);
  if (existingCard) return { ledgerId: ledger.id, masterCardId, zoneId };
  const existingZones = document.annotations ?? [];
  const rightEdge = existingZones.reduce((maximum, zone) => Math.max(maximum, Number(zone.x ?? 0) + Number(zone.width ?? 0)), 0);
  const x = rightEdge + 80;
  const mutate = (mutation: Parameters<typeof applyLedgerMutation>[0]['mutation']): void => {
    const result = applyLedgerMutation({ decisionOsRoot: input.project.decisionOsRoot, ledgerPath, ledger: document, mutation });
    if (!result.ok) throw new Error(String(result.error?.body.error ?? 'Could not persist synchronization task.'));
  };
  mutate({ action: 'create-zone', annotation: { id: zoneId, variant: 'zone', label: `Synchronization · ${input.sourceProjectName}`, color: input.sourceProjectColor, x, y: 80, width: 1120, height: 720 } });
  mutate({
    action: 'create-card',
    card: {
      id: masterCardId,
      title: `Synchronize ${input.sourceProjectName}`,
      status: 'todo',
      cardType: 'note',
      labels: ['master-task', 'synchronization'],
      x: x + 60,
      y: 140,
      w: 360,
      h: 300,
      comment: {
        what: [
          `Waiting since: ${input.waitingSince}`,
          '',
          '## A. Synchronization',
          '',
          `1. **Sync ID:** \`${input.syncId}\`.`,
          `2. **Source project:** \`${input.sourceProjectId}\`.`,
          `3. **Origin fingerprint:** \`${input.originFingerprint}\`.`,
          '4. **Execution:** The canonical pipeline is owned by the initiating node; source publish and source finalize execute on the source owner node.',
          '',
          '---',
          '',
          '## B. Closeout',
          '',
          '1. This master task remains open after terminal pipeline execution for operator verification and closeout.',
        ].join('\n'),
      },
    },
  });
  stripHydratedThreadNotes(document);
  await persistLedgerProjection({
    decisionOsRoot: input.project.decisionOsRoot,
    ledgerId: ledger.id,
    ledgerPath,
    ledger: document,
    runtime: input.runtime,
    command: { kind: 'admit-project-sync-task', cardIds: [masterCardId], annotationIds: [zoneId] },
  });
  return { ledgerId: ledger.id, masterCardId, zoneId };
}
