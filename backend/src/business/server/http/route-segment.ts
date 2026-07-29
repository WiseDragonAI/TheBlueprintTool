/**
 * WHAT: Decodes one URL path segment without allowing malformed encoding to escape routing.
 * WHY: Every capability route needs the same stable malformed-segment behavior.
 */
export function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return '';
  }
}
