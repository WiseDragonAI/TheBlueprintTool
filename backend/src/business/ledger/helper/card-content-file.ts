/**
 * WHAT: Reads and writes card markdown content files referenced from ledger JSON.
 * WHY: card bodies should be patchable as individual Markdown files while the browser keeps its hydrated runtime contract.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, basename } from 'node:path';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeSegment(value: unknown): string {
  return String(value || 'untitled').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function ledgerStem(ledgerPath: string): string {
  return basename(ledgerPath, extname(ledgerPath));
}

function isInside(parent: string, child: string): boolean {
  const inner = relative(parent, child);
  return Boolean(inner) && !inner.startsWith('..') && !isAbsolute(inner);
}

function isAllowedImageAsset(filePath: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extname(filePath).toLowerCase());
}

function commentFor(card: AnyRecord): AnyRecord {
  return isRecord(card.comment) ? card.comment : {};
}

export function cardContentFileRef(ledgerPath: string, card: AnyRecord): string {
  return `.decision-os/cards/${safeSegment(ledgerStem(ledgerPath))}/${safeSegment(card.id)}.md`;
}

export function resolveCardContentFile(decisionOsRoot: string, contentFile: unknown): string | null {
  if (typeof contentFile !== 'string' || !contentFile.endsWith('.md')) return null;
  const relativePath = contentFile.replace(/^\.decision-os\//, '');
  const file = resolve(decisionOsRoot, relativePath);
  return isInside(decisionOsRoot, file) ? file : null;
}

export function hydrateLedgerCardContent(ledger: AnyRecord, decisionOsRoot: string): AnyRecord {
  const cards = Array.isArray(ledger.cards) ? ledger.cards as AnyRecord[] : [];
  for (const card of cards) {
    const comment = commentFor(card);
    const file = resolveCardContentFile(decisionOsRoot, comment.contentFile);
    if (!file || !existsSync(file)) continue;
    card.comment = { ...comment, what: readFileSync(file, 'utf8') };
  }
  return ledger;
}

export function writeCardDescriptionFile(input: { decisionOsRoot: string; card: AnyRecord; description: string; ledgerPath: string }): void {
  const comment = commentFor(input.card);
  const contentFile = typeof comment.contentFile === 'string' ? comment.contentFile : cardContentFileRef(input.ledgerPath, input.card);
  const file = resolveCardContentFile(input.decisionOsRoot, contentFile);
  if (!file) throw new Error(`Invalid card content file for ${String(input.card.id ?? '')}`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, input.description, 'utf8');
  const nextComment: AnyRecord = { ...comment, contentFile };
  delete nextComment.what;
  input.card.comment = nextComment;
}

export function readCardDescription(input: { decisionOsRoot: string; card: AnyRecord }): string {
  const comment = commentFor(input.card);
  const file = resolveCardContentFile(input.decisionOsRoot, comment.contentFile);
  if (file && existsSync(file)) return readFileSync(file, 'utf8');
  return typeof comment.what === 'string' ? comment.what : '';
}

function markdownImageSource(markdownImage: string): string {
  const body = markdownImage.slice(markdownImage.indexOf('](') + 2, -1).trim();
  if (body.startsWith('<')) {
    const end = body.indexOf('>');
    return end >= 0 ? body.slice(1, end) : '';
  }
  const quoted = body.match(/^"([^"]+)"|^'([^']+)'/);
  if (quoted) return quoted[1] ?? quoted[2] ?? '';
  return body.split(/\s+/)[0] ?? '';
}

function decodedImageSource(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

function canonicalWorkspaceImageSource(source: string): string {
  const decodedSource = decodedImageSource(source).split('#')[0]?.split('?')[0] ?? '';
  if (decodedSource.startsWith('/.decision-os/')) return decodedSource.slice(1);
  if (decodedSource.startsWith('.decision-os/')) return decodedSource;
  return decodedSource;
}

export function sameMarkdownImageSource(left: string, right: string): boolean {
  return left === right || canonicalWorkspaceImageSource(left) === canonicalWorkspaceImageSource(right);
}

export function removeMarkdownImage(markdown: string, imageSrc: string): { markdown: string; removed: boolean } {
  let removed = false;
  const lines = markdown.split('\n');
  const nextLines = lines.map((line) => {
    if (removed) return line;
    const imagePattern = /!\[[^\]\n]*\]\([^)\n]+\)/g;
    const matches = Array.from(line.matchAll(imagePattern));
    if (!matches.some((match) => sameMarkdownImageSource(markdownImageSource(match[0]), imageSrc))) return line;
    removed = true;
    const nextLine = line.replace(imagePattern, (token) => sameMarkdownImageSource(markdownImageSource(token), imageSrc) ? '' : token);
    return nextLine.trim() ? nextLine : '';
  });
  return { markdown: nextLines.join('\n').replace(/\n{3,}/g, '\n\n'), removed };
}

function resolveWorkspaceImageFile(decisionOsRoot: string, imageSrc: string): string | null {
  const sourcePath = canonicalWorkspaceImageSource(imageSrc);
  const relativePath = sourcePath.startsWith('/.decision-os/')
    ? sourcePath.slice('/.decision-os/'.length)
    : sourcePath.startsWith('.decision-os/')
      ? sourcePath.slice('.decision-os/'.length)
      : '';
  if (!relativePath) return null;
  const file = resolve(decisionOsRoot, relativePath);
  return isInside(decisionOsRoot, file) && isAllowedImageAsset(file) ? file : null;
}

export function deleteCardMarkdownImage(input: { decisionOsRoot: string; card: AnyRecord; imageSrc: string; ledgerPath: string }): { removedMarkdown: boolean; deletedFile: boolean } {
  const description = readCardDescription({ decisionOsRoot: input.decisionOsRoot, card: input.card });
  const removal = removeMarkdownImage(description, input.imageSrc);
  if (!removal.removed) {
    return { removedMarkdown: false, deletedFile: false };
  }
  writeCardDescriptionFile({
    decisionOsRoot: input.decisionOsRoot,
    card: input.card,
    description: removal.markdown,
    ledgerPath: input.ledgerPath,
  });
  const imageFile = resolveWorkspaceImageFile(input.decisionOsRoot, input.imageSrc);
  const deletedFile = Boolean(imageFile && existsSync(imageFile));
  if (imageFile && existsSync(imageFile)) unlinkSync(imageFile);
  return { removedMarkdown: removal.removed, deletedFile };
}

export function externalizeCardContent(input: { decisionOsRoot: string; card: AnyRecord; ledgerPath: string }): void {
  const comment = commentFor(input.card);
  if (typeof comment.what === 'string') {
    writeCardDescriptionFile({
      decisionOsRoot: input.decisionOsRoot,
      card: input.card,
      description: comment.what,
      ledgerPath: input.ledgerPath,
    });
    return;
  }

  const contentFile = typeof comment.contentFile === 'string' ? comment.contentFile : cardContentFileRef(input.ledgerPath, input.card);
  const file = resolveCardContentFile(input.decisionOsRoot, contentFile);
  if (!file) throw new Error(`Invalid card content file for ${String(input.card.id ?? '')}`);
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, '', 'utf8');
  input.card.comment = { ...comment, contentFile };
}

export function duplicateCardContentFile(input: { decisionOsRoot: string; ledgerPath: string; sourceCard: AnyRecord; targetCard: AnyRecord }): void {
  const sourceComment = commentFor(input.sourceCard);
  const sourceFile = resolveCardContentFile(input.decisionOsRoot, sourceComment.contentFile);
  const sourceBody = sourceFile && existsSync(sourceFile)
    ? readFileSync(sourceFile, 'utf8')
    : typeof sourceComment.what === 'string'
      ? sourceComment.what
      : undefined;
  if (sourceBody === undefined) return;
  writeCardDescriptionFile({
    decisionOsRoot: input.decisionOsRoot,
    card: input.targetCard,
    description: sourceBody,
    ledgerPath: input.ledgerPath,
  });
}
