/**
 * WHAT: Presents canonical logical projects as Control Room filters.
 * WHY: Replica routing belongs to project.replicas, never to filter identity.
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
    showRemoteMarker: false,
    foreground: projectFilterForeground(project.color),
  };
}

export function projectFilterGroups(projects) {
  return projects.map((project) => ({ ...project, projects: [project], projectIds: [project.id] }));
}

export function projectFilterIncludes(group, projectId) {
  return group?.projectIds?.includes(projectId) === true;
}
