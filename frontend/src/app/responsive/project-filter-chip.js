/**
 * WHAT: Derives the visible project-filter chip presentation from catalog data.
 * WHY: Chip content and contrast must remain deterministic without coupling them to DOM rendering.
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
