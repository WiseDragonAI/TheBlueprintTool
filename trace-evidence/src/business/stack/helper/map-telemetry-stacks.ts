/**
 * WHAT: Parses raw telemetry stacks and maps generated frames through exact source maps.
 * WHY: Runtime telemetry stays lightweight while reports retain original production and source locations.
 */
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { AnyMap, originalPositionFor, type TraceMap } from '@jridgewell/trace-mapping';
import type { RawTelemetryEvent } from '../../../lib/types.js';

export type MappedFrame = { raw: string; generatedFile: string; generatedLine: number; generatedColumn: number; originalFile: string | null; originalLine: number | null; originalColumn: number | null; symbol: string | null; sourceMap: string | null; failure: string | null };
export type MappedEventStack = { eventId: string; name: string; rawStack: string; frames: MappedFrame[] };

const framePattern = /^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/;

async function loadMaps(paths: string[], signal?: AbortSignal): Promise<Array<{ path: string; generatedFile: string; map: TraceMap | null; error: string | null }>> {
  return Promise.all(paths.map(async (path) => {
    try { return { path, generatedFile: path.replace(/\.map$/, ''), map: new AnyMap(JSON.parse(await readFile(path, { encoding: 'utf8', signal }))), error: null }; }
    catch (error) { return { path, generatedFile: path.replace(/\.map$/, ''), map: null, error: error instanceof Error ? error.message : String(error) }; }
  }));
}

export async function mapTelemetryStacks(events: RawTelemetryEvent[], sourceMapPaths: string[], signal?: AbortSignal): Promise<MappedEventStack[]> {
  const maps = await loadMaps(sourceMapPaths, signal);
  return events.map((event) => ({ eventId: event.eventId, name: event.name, rawStack: event.rawStack, frames: event.rawStack.split('\n').slice(1).filter(Boolean).map((raw) => {
    const match = raw.match(framePattern);
    // WHAT: Retain an unparsed raw frame as an explicit mapping failure.
    // WHY: Unknown stack syntax must not disappear from the evidence report.
    if (!match) return { raw, generatedFile: '', generatedLine: 0, generatedColumn: 0, originalFile: null, originalLine: null, originalColumn: null, symbol: null, sourceMap: null, failure: 'unparsed_frame' };
    const generatedFile = match[2].startsWith('file://') ? new URL(match[2]).pathname : match[2];
    const generatedLine = Number(match[3]);
    const generatedColumn = Number(match[4]);
    const candidates = maps.filter((entry) => resolve(entry.generatedFile) === resolve(generatedFile));
    // WHAT: Reject several maps claiming the same generated file.
    // WHY: Ambiguous build identity cannot produce an authoritative original position.
    if (candidates.length > 1) return { raw, generatedFile, generatedLine, generatedColumn, originalFile: null, originalLine: null, originalColumn: null, symbol: match[1] || null, sourceMap: null, failure: 'source_map_ambiguous' };
    const selected = candidates[0];
    // WHAT: Preserve generated coordinates when no exact source map owns the file.
    // WHY: Mapping through an unrelated map would create false source evidence.
    if (!selected) return { raw, generatedFile, generatedLine, generatedColumn, originalFile: null, originalLine: null, originalColumn: null, symbol: match[1] || null, sourceMap: null, failure: 'source_map_missing' };
    // WHAT: Preserve an incompatible source map as an explicit frame failure.
    // WHY: One corrupt map must not discard raw stacks from the complete trace.
    if (!selected.map) return { raw, generatedFile, generatedLine, generatedColumn, originalFile: null, originalLine: null, originalColumn: null, symbol: match[1] || null, sourceMap: selected.path, failure: 'source_map_incompatible' };
    const original = originalPositionFor(selected.map, { line: generatedLine, column: generatedColumn });
    // WHAT: Preserve an explicit unmapped-segment failure.
    // WHY: A valid map may not contain the generated coordinate.
    if (!original.source || original.line === null || original.column === null) return { raw, generatedFile, generatedLine, generatedColumn, originalFile: null, originalLine: null, originalColumn: null, symbol: match[1] || null, sourceMap: selected.path, failure: 'source_position_missing' };
    const originalFile = isAbsolute(original.source) ? original.source : resolve(dirname(selected.path), original.source);
    return { raw, generatedFile, generatedLine, generatedColumn, originalFile, originalLine: original.line, originalColumn: original.column, symbol: original.name || match[1] || null, sourceMap: selected.path, failure: null };
  }) }));
}
