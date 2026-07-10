/**
 * WHAT: Defines the shared contracts for normalized Codex run events and their stream ingestor.
 * WHY: Parsing, persistence, status reads, and stream scheduling need one dependency-neutral event vocabulary.
 */
export type ParsedRunLine = {
  line: number;
  event: Record<string, unknown>;
};

export type NormalizedRunEvent = {
  line: number;
  type: string;
  kind: string;
  title: string;
  text: string;
  status: string;
  itemId: string;
  tool: string;
  exitCode: string;
  persist: boolean;
};

export type CardSkillRunEventIngestor = {
  ingest(chunk: Buffer | string): void;
  flush(): number;
};
