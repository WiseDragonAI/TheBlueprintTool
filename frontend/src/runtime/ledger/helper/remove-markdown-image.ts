/** WHAT: Removes the first matching Markdown image token from hydrated card text. */

function markdownImageSource(token: string): string {
  return token.replace(/^!\[[^\]]*\]\(/, '').replace(/\)$/, '');
}

function canonicalSource(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Preserve malformed literal sources. */ }
  const withoutQuery = decoded.split('#')[0]?.split('?')[0] ?? '';
  return withoutQuery.startsWith('/.decision-os/') ? withoutQuery.slice(1) : withoutQuery;
}

export function sameMarkdownImageSource(left: string, right: string): boolean {
  return left === right || canonicalSource(left) === canonicalSource(right);
}

export function removeMarkdownImage(markdown: string, imageSrc: string): { markdown: string; removed: boolean } {
  let removed = false;
  const lines = markdown.split('\n').map((line) => {
    if (removed) return line;
    const pattern = /!\[[^\]\n]*\]\([^)\n]+\)/g;
    const matches = Array.from(line.matchAll(pattern));
    if (!matches.some((match) => sameMarkdownImageSource(markdownImageSource(match[0]), imageSrc))) return line;
    removed = true;
    const next = line.replace(pattern, (token) => sameMarkdownImageSource(markdownImageSource(token), imageSrc) ? '' : token);
    return next.trim() ? next : '';
  });
  return { markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n'), removed };
}
