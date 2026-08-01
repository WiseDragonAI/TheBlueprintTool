/**
 * WHAT: Defines the shared contracts for normalized Codex run events and their stream ingestor.
 * WHY: Parsing, persistence, status reads, and stream scheduling need one dependency-neutral event vocabulary.
 */
export type ParsedRunLine = {
  line: number;
  event: Record<string, unknown>;
};

export type RunEventSource = 'jsonl' | 'stderr';
export type RunEventSeverity = 'info' | 'warning' | 'error';

export type NormalizedRunEvent = {
  line: number;
  source: RunEventSource;
  sourceLine: number;
  type: string;
  kind: string;
  title: string;
  text: string;
  status: string;
  itemId: string;
  tool: string;
  output: string;
  exitCode: string;
  severity: RunEventSeverity;
  persist: boolean;
  collaborationAgents?: readonly {
    threadId: string;
    status: string;
  }[];
};

export type CardSkillRunEventIngestor = {
  ingest(chunk: Buffer | string): void;
  flush(): number;
};
