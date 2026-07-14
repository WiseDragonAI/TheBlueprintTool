/**
 * WHAT: Loads the Skills ledger and prepares its canonical server registry projection.
 * WHY: The first skill command must provision the server-owned ledger without a separate setup step.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type RecordValue = Record<string, any>;

export type PreparedServerSkillsLedger = {
  ledger: RecordValue;
  registryWrites: Array<{ file: string; value: RecordValue }>;
};

const ledgerPath = '.decision-os/skills.json';
const ledgerCardId = 'ledger-card:skills';

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(file: string): RecordValue {
  const value = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (!isRecord(value)) throw new Error(`Expected a JSON object at ${file}.`);
  return value;
}

function initialLedger(): RecordValue {
  return {
    modelName: 'skills',
    diagramSize: { width: 5200, height: 2600 },
    viewport: { x: 0, y: 0, scale: 1 },
    cards: [],
    annotations: [],
    relationships: [],
    notes: {},
    threadFiles: {},
  };
}

function canonicalState(raw: RecordValue): RecordValue {
  const source = Array.isArray(raw.ledgers) ? raw.ledgers : Array.isArray(raw.tabs) ? raw.tabs : [];
  const ledgers = source.filter(isRecord).map((entry) => ({
    id: String(entry.id ?? '').trim(),
    title: String(entry.title ?? entry.id ?? '').trim(),
    ledgerFile: String(entry.ledgerFile ?? '').trim(),
    ...(String(entry.cardId ?? '').trim() ? { cardId: String(entry.cardId).trim() } : {}),
  })).filter((entry) => entry.id && entry.title && entry.ledgerFile);
  const idConflict = ledgers.find((entry) => entry.id === 'skills' && entry.ledgerFile !== ledgerPath);
  const fileConflict = ledgers.find((entry) => entry.id !== 'skills' && entry.ledgerFile === ledgerPath);
  if (idConflict || fileConflict) throw new Error('Server state contains a conflicting Skills ledger registration.');
  const existing = ledgers.find((entry) => entry.id === 'skills');
  const skillEntry = { id: 'skills', title: 'Skills', ledgerFile: ledgerPath, cardId: ledgerCardId };
  return { ledgers: existing ? ledgers.map((entry) => entry.id === 'skills' ? skillEntry : entry) : [...ledgers, skillEntry] };
}

function canonicalOverview(raw: RecordValue, ledgers: RecordValue[]): RecordValue {
  const cards = Array.isArray(raw.cards) ? raw.cards.filter(isRecord) : [];
  const existing = cards.find((card) => String(card.id ?? '') === ledgerCardId || String(card.targetLedgerId ?? '') === 'skills');
  const index = Math.max(0, ledgers.findIndex((entry) => entry.id === 'skills'));
  const skillCard = {
    ...(existing ?? {}),
    id: ledgerCardId,
    targetLedgerId: 'skills',
    cardType: 'ledger',
    domainId: 'ledgers',
    title: 'Skills',
    ledgerFile: ledgerPath,
    status: existing?.status ?? 'todo',
    x: Number(existing?.x ?? (index % 4) * 460),
    y: Number(existing?.y ?? Math.floor(index / 4) * 280),
    w: Math.max(220, Number(existing?.w ?? 360)),
    h: Math.max(132, Number(existing?.h ?? 180)),
    comment: existing?.comment ?? { what: 'Ledger: Skills' },
  };
  return {
    ...raw,
    modelName: 'ledgers-canvas',
    diagramSize: isRecord(raw.diagramSize) ? raw.diagramSize : { width: 5200, height: 2600 },
    viewport: isRecord(raw.viewport) ? raw.viewport : { x: 0, y: 0, scale: 0.42 },
    cards: [...cards.filter((card) => card !== existing), skillCard],
    annotations: Array.isArray(raw.annotations) ? raw.annotations : [],
    relationships: Array.isArray(raw.relationships) ? raw.relationships : [],
    notes: isRecord(raw.notes) ? raw.notes : {},
  };
}

export function prepareServerSkillsLedger(input: { operation: 'create' | 'update'; root: string }): PreparedServerSkillsLedger {
  const skillsFile = resolve(input.root, ledgerPath);
  const skillsExists = existsSync(skillsFile);
  if (!skillsExists && input.operation === 'update') throw new Error('Cannot update a skill before the server Skills ledger is provisioned.');
  const ledger = skillsExists ? readJson(skillsFile) : initialLedger();
  const stateFile = resolve(input.root, '.decision-os', 'state.json');
  const rawState = existsSync(stateFile) ? readJson(stateFile) : {};
  const state = canonicalState(rawState);
  const overviewFile = resolve(input.root, '.decision-os', 'ledgers-canvas.json');
  const rawOverview = existsSync(overviewFile) ? readJson(overviewFile) : {};
  const overview = canonicalOverview(rawOverview, state.ledgers);
  const registryWrites: PreparedServerSkillsLedger['registryWrites'] = [];
  if (!skillsExists || !existsSync(stateFile) || JSON.stringify(rawState) !== JSON.stringify(state)) registryWrites.push({ file: '.decision-os/state.json', value: state });
  if (!skillsExists || !existsSync(overviewFile) || JSON.stringify(rawOverview) !== JSON.stringify(overview)) registryWrites.push({ file: '.decision-os/ledgers-canvas.json', value: overview });
  return { ledger, registryWrites };
}
