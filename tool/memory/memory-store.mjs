import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const text = (value) => String(value ?? '').trim();

function required(value, name) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function positiveInteger(value, name, fallback) {
  if (value === undefined || value === null) return fallback;
  const normalized = text(value);
  if (!/^[1-9][0-9]*$/.test(normalized)) throw new Error(`${name} must be a positive integer`);
  return Number(normalized);
}

function settings(root) {
  const candidates = [
    resolve(homedir(), '.decision-os', '.settings.json'),
    resolve(required(root, 'root'), 'decision-os', '.decision-os', '.settings.json'),
    resolve(required(root, 'root'), '.decision-os', '.settings.json'),
  ];
  return candidates.filter(existsSync).reduce(
    (merged, path) => Object.assign(merged, JSON.parse(readFileSync(path, 'utf8'))),
    {},
  );
}

export function memoryServiceConfig(root) {
  const configured = settings(root);
  const url = text(process.env.DECISION_OS_MEMORY_URL ?? configured.memoryServiceUrl).replace(/\/$/, '');
  const token = text(process.env.DECISION_OS_MEMORY_TOKEN ?? configured.memoryServiceToken);
  if (!url) throw new Error('DECISION_OS_MEMORY_URL or memoryServiceUrl is required');
  if (!token) throw new Error('DECISION_OS_MEMORY_TOKEN or memoryServiceToken is required');
  return { url, token };
}

async function request(root, path, init = {}) {
  const config = memoryServiceConfig(root);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${config.url}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      });
      const responseText = await response.text();
      let payload;
      try { payload = JSON.parse(responseText); } catch { payload = null; }
      if (response.ok && payload !== null) return payload;
      const message = payload?.error ?? `memory service returned HTTP ${response.status}`;
      if (response.status < 500 && response.status !== 429) {
        const error = new Error(message);
        error.retryable = false;
        throw error;
      }
      lastError = new Error(message);
    } catch (error) {
      if (error?.retryable === false) throw error;
      lastError = error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 200));
  }
  throw lastError;
}

export async function addMemory(root, input) {
  return request(root, '/memories', { method: 'POST', body: JSON.stringify(input) });
}

export async function readMemories(root, filters = {}) {
  const parameters = new URLSearchParams();
  const values = {
    project: text(filters.projectId), type: text(filters.type).toLowerCase(),
    tag: text(filters.tag).toLowerCase(), subtag: text(filters.subtag).toLowerCase(),
    query: text(filters.query), limit: String(positiveInteger(filters.limit, 'limit', 10)),
  };
  for (const [name, value] of Object.entries(values)) if (value) parameters.set(name, value);
  return request(root, `/memories?${parameters}`);
}

export async function migrateMemories(input) {
  const sourcePath = resolve(required(input.source, 'source'));
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    const columns = new Set(source.prepare('PRAGMA table_info(memories)').all().map((row) => String(row.name)));
    const rows = source.prepare('SELECT * FROM memories ORDER BY id').all();
    for (const row of rows) {
      await addMemory(input.root, {
        title: row.title, body: row.body, tag: row.tag, subtag: row.subtag,
        projectId: columns.has('project_id') ? row.project_id : required(input.projectId, 'project'),
        type: columns.has('type') ? row.type : required(input.type, 'type'), source: row.source,
        createdAt: row.created_at, updatedAt: row.updated_at,
      });
    }
    const health = await request(input.root, '/health');
    return { source: sourcePath, sourceRows: rows.length, migratedRows: rows.length, destinationRows: health.rows };
  } finally {
    source.close();
  }
}
