import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(resolve(moduleDirectory, 'schema.sql'), 'utf8');

function text(value) {
  return String(value ?? '').trim();
}

function slug(value, name) {
  const normalized = text(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
    throw new Error(`${name} must be a lowercase slug`);
  }
  return normalized;
}

function required(value, name) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function hasTable(database, table) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function tableColumns(database, table) {
  return new Set(database.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)));
}

function migrateLegacyDestination(database) {
  if (!hasTable(database, 'memories')) return;
  const columns = tableColumns(database, 'memories');
  if (columns.has('project_id') && columns.has('type')) return;
  database.exec(`
    BEGIN IMMEDIATE;
    DROP INDEX IF EXISTS memories_tag_subtag_idx;
    DROP INDEX IF EXISTS memories_updated_at_idx;
    ALTER TABLE memories RENAME TO memories_legacy;
    CREATE TABLE memories (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT NOT NULL,
      subtag TEXT NOT NULL,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(title, tag, subtag, project_id, type)
    );
    INSERT INTO memories (id, title, body, tag, subtag, project_id, type, source, created_at, updated_at)
    SELECT id, title, body, tag, subtag, 'global', 'code', source, created_at, updated_at
    FROM memories_legacy;
    DROP TABLE memories_legacy;
    COMMIT;
  `);
}

export function memoryDatabasePath(root) {
  return resolve(required(root, 'root'), '.decision-os', 'memories.sqlite3');
}

export function ensureMemoryStore(root) {
  const databasePath = memoryDatabasePath(root);
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  try {
    migrateLegacyDestination(database);
    database.exec(schemaSql);
  } finally {
    database.close();
  }
  return databasePath;
}

function openMemoryStore(root) {
  const databasePath = ensureMemoryStore(root);
  return new DatabaseSync(databasePath);
}

function memoryInput(input) {
  return {
    title: required(input.title, 'title'),
    body: required(input.body, 'body'),
    tag: slug(input.tag, 'tag'),
    subtag: slug(input.subtag, 'subtag'),
    projectId: required(input.projectId, 'project'),
    type: slug(input.type, 'type'),
    source: text(input.source),
  };
}

function upsertMemory(database, input, timestamps = {}) {
  const memory = memoryInput(input);
  const now = new Date().toISOString();
  const createdAt = text(timestamps.createdAt) || now;
  const updatedAt = text(timestamps.updatedAt) || now;
  database.prepare(`
    INSERT INTO memories (title, body, tag, subtag, project_id, type, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(title, tag, subtag, project_id, type) DO UPDATE SET
      body = excluded.body,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).run(memory.title, memory.body, memory.tag, memory.subtag, memory.projectId, memory.type, memory.source, createdAt, updatedAt);
}

export function addMemory(root, input) {
  const database = openMemoryStore(root);
  try {
    upsertMemory(database, input);
    return readMemories(root, { projectId: input.projectId, type: input.type, query: input.title });
  } finally {
    database.close();
  }
}

export function readMemories(root, filters = {}) {
  const database = openMemoryStore(root);
  try {
    const projectId = text(filters.projectId);
    const type = text(filters.type).toLowerCase();
    const tag = text(filters.tag).toLowerCase();
    const subtag = text(filters.subtag).toLowerCase();
    const query = text(filters.query);
    return database.prepare(`
      SELECT id, title, body, tag, subtag, project_id, type, source, created_at, updated_at
      FROM memories
      WHERE (? = '' OR project_id = ? OR project_id = 'global')
        AND (? = '' OR type = ?)
        AND (? = '' OR tag = ?)
        AND (? = '' OR subtag = ?)
        AND (? = '' OR title LIKE '%' || ? || '%' OR body LIKE '%' || ? || '%')
      ORDER BY updated_at DESC, id DESC
    `).all(projectId, projectId, type, type, tag, tag, subtag, subtag, query, query, query);
  } finally {
    database.close();
  }
}

export function migrateMemories(input) {
  const sourcePath = resolve(required(input.source, 'source'));
  const projectId = required(input.projectId, 'project');
  const type = slug(input.type, 'type');
  const destinationPath = ensureMemoryStore(input.root);
  if (sourcePath === destinationPath) throw new Error('source must differ from the central memory database');
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const destination = new DatabaseSync(destinationPath);
  try {
    if (!hasTable(source, 'memories')) throw new Error('source has no memories table');
    const columns = tableColumns(source, 'memories');
    const rows = source.prepare('SELECT * FROM memories ORDER BY id').all();
    destination.exec('BEGIN IMMEDIATE');
    try {
      for (const row of rows) {
        upsertMemory(destination, {
          title: row.title,
          body: row.body,
          tag: row.tag,
          subtag: row.subtag,
          projectId: columns.has('project_id') ? row.project_id : projectId,
          type: columns.has('type') ? row.type : type,
          source: row.source,
        }, { createdAt: row.created_at, updatedAt: row.updated_at });
      }
      destination.exec('COMMIT');
    } catch (error) {
      destination.exec('ROLLBACK');
      throw error;
    }
    const quickCheck = String(destination.prepare('PRAGMA quick_check').get().quick_check);
    const destinationRows = Number(destination.prepare('SELECT COUNT(*) AS count FROM memories').get().count);
    return { source: sourcePath, destination: destinationPath, sourceRows: rows.length, destinationRows, migratedRows: rows.length, quickCheck };
  } finally {
    destination.close();
    source.close();
  }
}
