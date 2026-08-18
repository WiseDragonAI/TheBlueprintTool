/**
 * WHAT: Defines the static quality-map evidence exchanged by analysis, queries, and Trace Evidence.
 * WHY: Stable machine-readable contracts let agents traverse source control flow without reparsing a repository.
 */
export type WhatWhy = { what: string | null; why: string | null; raw: string[] };

export type SourceRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type QualityBranch = {
  id: string;
  kind: 'if' | 'else' | 'conditional' | 'case' | 'catch';
  range: SourceRange;
  comments: WhatWhy;
  compliant: boolean;
};

export type QualityFunction = {
  id: string;
  name: string;
  kind: string;
  range: SourceRange;
  comments: WhatWhy;
  branches: QualityBranch[];
  callers: string[];
  callees: string[];
  coverage: number | null;
};

export type QualityFinding = {
  code: string;
  path: string;
  line: number | null;
  symbolId: string | null;
  message: string;
};

export type QualityFileRole = 'input' | 'action' | 'controller' | 'helper' | 'effect' | 'route' | 'screen-page' | 'component' | 'state' | 'contract' | 'test' | 'fixture' | 'entrypoint' | 'unclassified';

export type QualityFile = {
  path: string;
  contentHash: string | null;
  language: string;
  loc: number;
  applicable: boolean;
  exclusion: string | null;
  role: QualityFileRole | null;
  header: WhatWhy;
  decomposition: { loc: number; date: string; justification: string } | null;
  functions: QualityFunction[];
  dependencies: string[];
  dependents: string[];
  lineCoverage: number | null;
  findings: QualityFinding[];
};

export type QualityMap = {
  version: 1;
  root: string;
  scope: 'filesystem';
  generatedAt: string;
  excludedDirectories: string[];
  graphify: { package: 'graphifyy'; version: '0.9.22'; license: 'MIT'; graphPath: string };
  files: QualityFile[];
  findings: QualityFinding[];
};
