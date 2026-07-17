/**
 * WHAT: Derives repository-aware project-filter groups and their visible chip presentation.
 * WHY: Equivalent projects from multiple terminals share one filter while task ownership stays terminal-specific.
 */

const yiqForegroundThreshold = 186;

export function projectFilterForeground(color) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color ?? '') ? color.slice(1) : '000000';
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = ((299 * red) + (587 * green) + (114 * blue)) / 1000;

  return brightness > yiqForegroundThreshold ? '#000000' : '#ffffff';
}

export function projectFilterChipPresentation(project) {
  return {
    label: project.name,
    showRemoteMarker: project.remote === true,
    foreground: projectFilterForeground(project.color),
  };
}

function projectFilterGroupKey(project) {
  const originFingerprint = String(project.originFingerprint ?? '').trim();
  const logicalProjectId = String(project.localProjectId ?? project.id ?? '').trim();
  return originFingerprint && logicalProjectId
    ? `repository:${originFingerprint}:${logicalProjectId}`
    : `project:${String(project.id ?? '').trim()}`;
}

function projectFilterGroupLedgers(projects, canonicalProject) {
  const orderedProjects = [canonicalProject, ...projects.filter((project) => project !== canonicalProject)];
  const ledgers = new Map();
  for (const project of orderedProjects) {
    for (const ledger of project.ledgers ?? []) {
      if (!ledgers.has(ledger.id)) ledgers.set(ledger.id, ledger);
    }
  }
  return [...ledgers.values()];
}

export function projectFilterGroups(projects) {
  const groupedProjects = new Map();
  for (const project of projects) {
    const key = projectFilterGroupKey(project);
    const members = groupedProjects.get(key) ?? [];
    members.push(project);
    groupedProjects.set(key, members);
  }

  return [...groupedProjects.entries()].map(([id, members]) => {
    const canonicalProject = members.find((project) => project.remote !== true) ?? members[0];
    return {
      ...canonicalProject,
      id,
      projects: members,
      projectIds: members.map((project) => project.id),
      ledgers: projectFilterGroupLedgers(members, canonicalProject),
      online: members.some((project) => project.online !== false),
    };
  });
}

export function projectFilterIncludes(group, projectId) {
  return group?.projectIds?.includes(projectId) === true;
}
