/**
 * WHAT: Derives and persists complete responsive project settings.
 * WHY: Project metadata must remain editable without a separate frontend.
 */
const projectColorSaturation = 0.7;
const projectColorValue = 0.8;

function channelHex(channel) {
  return Math.round(channel * 255).toString(16).padStart(2, '0');
}

export function defaultProjectColor(random = Math.random) {
  const sampledHue = Number(random());
  const hue = Number.isFinite(sampledHue) ? ((sampledHue % 1) + 1) % 1 : 0;
  const sector = hue * 6;
  const chroma = projectColorValue * projectColorSaturation;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = projectColorValue - chroma;
  const [red, green, blue] = sector < 1
    ? [chroma, secondary, 0]
    : sector < 2
      ? [secondary, chroma, 0]
      : sector < 3
        ? [0, chroma, secondary]
        : sector < 4
          ? [0, secondary, chroma]
          : sector < 5
            ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return `#${channelHex(red + offset)}${channelHex(green + offset)}${channelHex(blue + offset)}`;
}

export function projectSettingsValues(project, random = Math.random) {
  const savedColor = String(project?.color ?? '').trim();
  return {
    name: String(project?.name ?? ''),
    description: String(project?.description ?? ''),
    color: /^#[0-9a-f]{6}$/i.test(savedColor) ? savedColor : defaultProjectColor(random),
  };
}

export async function saveProjectSettingsRequest({ fetchImpl, projects, projectId, values }) {
  const response = await fetchImpl(`/decision-os/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(values),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.project) throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  return {
    project: payload.project,
    projects: projects.map((entry) => entry.id === payload.project.id ? payload.project : entry),
  };
}

export async function startProjectSyncRequest({ fetchImpl, sourceProjectId, sourceNodeId, idempotencyKey }) {
  const response = await fetchImpl('/api/project-sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ sourceProjectId, sourceNodeId, idempotencyKey }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.run?.syncId || !payload?.projectId) {
    throw new Error(payload?.error || `Request failed with HTTP ${response.status}.`);
  }
  return {
    run: payload.run,
    duplicate: payload.duplicate === true,
    masterCardId: String(payload.masterCardId || ''),
    ledgerId: String(payload.ledgerId || ''),
    pipelineRunId: String(payload.pipelineRunId || ''),
    projectId: payload.projectId,
  };
}
