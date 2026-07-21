/**
 * WHAT: Completes one master task through the canonical Decision OS server transaction.
 * WHY: Agents need one card-id command without constructing project-scoped HTTP requests.
 */
import { basename } from 'node:path';
import type { Result } from '../../../lib/types.js';
import { resolveMasterTaskGate } from './resolve-session-context.js';
import { readLedgerJson } from './read-ledger-json.js';

type Request = (input: string, init: RequestInit) => Promise<Pick<Response, 'headers' | 'ok' | 'status' | 'text'>>;
type Gate = (input: { ledgerJsonFile: string; cardId: string }) => Promise<Result<string>>;

const resolvePostCompletionGate: Gate = async (input) => {
  const current = await readLedgerJson(input.ledgerJsonFile);
  if (!current.ok) return current;
  return resolveMasterTaskGate({ ...input, ledger: current.value });
};

export async function completeMasterTask(input: {
  cardId?: string;
  ledgerJsonFile: string;
  projectId?: string;
  serverUrl?: string;
}, request: Request = fetch, gate: Gate = resolvePostCompletionGate): Promise<Result<string>> {
  const cardId = String(input.cardId ?? '').trim();
  const projectId = String(input.projectId ?? process.env.DECISION_OS_PROJECT_ID ?? '').trim();
  const serverUrl = String(input.serverUrl ?? process.env.DECISION_OS_SERVER_URL ?? '').trim().replace(/\/$/, '');
  const ledgerFile = String(input.ledgerJsonFile ?? '').trim();
  const ledgerId = basename(ledgerFile, '.json');

  if (!cardId) return { ok: false, error: 'master-task-complete requires --card-id.' };
  if (!ledgerFile || ledgerId === '.') return { ok: false, error: 'master-task-complete requires DECISION_OS_LEDGER_FILE or --ledger.' };
  if (!serverUrl) return { ok: false, error: 'master-task-complete requires DECISION_OS_SERVER_URL.' };
  if (!projectId) return { ok: false, error: 'master-task-complete requires DECISION_OS_PROJECT_ID.' };

  const url = `${serverUrl}/p/${encodeURIComponent(projectId)}/decision-os/${encodeURIComponent(ledgerId)}`;
  let response: Pick<Response, 'headers' | 'ok' | 'status' | 'text'>;
  try {
    response = await request(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete-master-task', masterTaskId: cardId }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const body = await response.text();
  if (!response.ok) return { ok: false, error: `Master task completion failed (${response.status}): ${body}` };
  const commitSha = response.headers.get('x-decision-os-completion-commit') ?? '';
  let gateResult: Result<string>;
  try {
    gateResult = await gate({ ledgerJsonFile: ledgerFile, cardId });
  } catch (error) {
    return { ok: false, error: `Master task completed, but its post-transaction gate failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!gateResult.ok) return { ok: false, error: `Master task completed, but its post-transaction gate failed: ${gateResult.error}` };
  return {
    ok: true,
    value: JSON.stringify({ version: 2, completed: true, projectId, ledgerId, masterCardId: cardId, commitSha, gate: JSON.parse(gateResult.value) }, null, 2),
  };
}
