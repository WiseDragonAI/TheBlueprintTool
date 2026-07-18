const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const text = (value) => String(value ?? '').trim();

function slug(value, name) {
  const normalized = text(value).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) throw new Error(`${name} must be a lowercase slug`);
  return normalized;
}

function required(value, name) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function limit(value) {
  const normalized = text(value || '10');
  if (!/^[1-9][0-9]*$/.test(normalized)) throw new Error('limit must be a positive integer');
  return Math.min(Number(normalized), 100);
}

function authorized(request, env) {
  const expected = text(env.MEMORY_API_TOKEN);
  return expected && request.headers.get('authorization') === `Bearer ${expected}`;
}

async function readMemories(request, env) {
  const url = new URL(request.url);
  const project = text(url.searchParams.get('project'));
  const type = text(url.searchParams.get('type')).toLowerCase();
  const tag = text(url.searchParams.get('tag')).toLowerCase();
  const subtag = text(url.searchParams.get('subtag')).toLowerCase();
  const query = text(url.searchParams.get('query'));
  const maximum = limit(url.searchParams.get('limit'));
  const result = await env.MEMORIES.prepare(`
    SELECT id, title, body, tag, subtag, project_id, type, source, created_at, updated_at
    FROM memories
    WHERE (? = '' OR project_id = ? OR project_id = 'global')
      AND (? = '' OR type = ?)
      AND (? = '' OR tag = ?)
      AND (? = '' OR subtag = ?)
      AND (? = '' OR instr(lower(title), lower(?)) > 0 OR instr(lower(body), lower(?)) > 0)
    ORDER BY updated_at DESC, id DESC
    LIMIT ?
  `).bind(project, project, type, type, tag, tag, subtag, subtag, query, query, query, maximum).all();
  return json(result.results ?? []);
}

async function upsertMemory(request, env) {
  const input = await request.json();
  const memory = {
    title: required(input.title, 'title'),
    body: required(input.body, 'body'),
    tag: slug(input.tag, 'tag'),
    subtag: slug(input.subtag, 'subtag'),
    projectId: required(input.projectId ?? input.project_id, 'project'),
    type: slug(input.type, 'type'),
    source: text(input.source),
  };
  const now = new Date().toISOString();
  const createdAt = text(input.createdAt ?? input.created_at) || now;
  const updatedAt = text(input.updatedAt ?? input.updated_at) || now;
  await env.MEMORIES.prepare(`
    INSERT INTO memories (title, body, tag, subtag, project_id, type, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(title, tag, subtag, project_id, type) DO UPDATE SET
      body = excluded.body,
      source = excluded.source,
      updated_at = excluded.updated_at
  `).bind(memory.title, memory.body, memory.tag, memory.subtag, memory.projectId, memory.type, memory.source, createdAt, updatedAt).run();
  const lookup = new URL('/memories', request.url);
  lookup.searchParams.set('project', memory.projectId);
  lookup.searchParams.set('type', memory.type);
  lookup.searchParams.set('query', memory.title);
  return readMemories(new Request(lookup, { headers: request.headers }), env);
}

export async function handleRequest(request, env) {
  if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401);
  const url = new URL(request.url);
  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      const row = await env.MEMORIES.prepare('SELECT COUNT(*) AS count FROM memories').first();
      return json({ ok: true, rows: Number(row?.count ?? 0) });
    }
    if (request.method === 'GET' && url.pathname === '/memories') return readMemories(request, env);
    if (request.method === 'POST' && url.pathname === '/memories') return upsertMemory(request, env);
    return json({ error: 'not_found' }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}

export default { fetch: handleRequest };
