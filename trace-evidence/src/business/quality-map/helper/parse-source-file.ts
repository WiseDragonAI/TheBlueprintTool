/**
 * WHAT: Parses JavaScript and TypeScript functions, branches, and attached WHAT/WHY comments.
 * WHY: Quality queries need the stated control-flow intent beside exact AST source ranges.
 */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { QualityBranch, QualityFunction, SourceRange, WhatWhy } from '../types.js';

function stableId(parts: Array<string | number>): string {
  return createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 20);
}

function rangeOf(sourceFile: ts.SourceFile, node: ts.Node): SourceRange {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return { startLine: start.line + 1, startColumn: start.character + 1, endLine: end.line + 1, endColumn: end.character + 1 };
}

function parseWhatWhy(raw: string[]): WhatWhy {
  const lines = raw.flatMap((comment) => comment.replace(/^\s*\/\*+|\*+\/\s*$/g, '').split('\n')).map((line) => line.replace(/^\s*(?:\/\/|\*)?\s?/, '').trim());
  const whatLine = lines.find((line) => line.startsWith('WHAT:'));
  const whyLine = lines.find((line) => line.startsWith('WHY:') || line.includes(' WHY:'));
  const what = whatLine?.slice('WHAT:'.length).split('WHY:')[0]?.trim() || null;
  const why = whyLine?.slice(whyLine.indexOf('WHY:') + 'WHY:'.length).trim() || null;
  return { what, why, raw };
}

function commentStrings(source: string, position: number): string[] {
  return (ts.getLeadingCommentRanges(source, position) ?? []).map((range) => source.slice(range.pos, range.end));
}

function commentsForNode(sourceFile: ts.SourceFile, node: ts.Node): WhatWhy {
  const direct = commentStrings(sourceFile.text, node.getFullStart());
  const parsed = parseWhatWhy(direct);
  // WHAT: Return directly attached comments when they contain complete rationale.
  // WHY: Parent-range fallback exists only for inline conditional comments.
  if (parsed.what && parsed.why) return parsed;
  // WHAT: Inspect parent syntax before a conditional expression for inline rationale.
  // WHY: A comment after assignment syntax belongs logically to the following ternary.
  if (ts.isConditionalExpression(node)) {
    const segmentStart = node.parent.getStart(sourceFile);
    const segment = sourceFile.text.slice(segmentStart, node.getStart(sourceFile));
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, segment);
    const inline: string[] = [];
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      // WHAT: Retain only lexical comments preceding the conditional expression.
      // WHY: Operators may place the mandatory rationale after assignment syntax.
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) inline.push(scanner.getTokenText());
    }
    const fallback = parseWhatWhy(inline);
    return { what: parsed.what ?? fallback.what, why: parsed.why ?? fallback.why, raw: [...parsed.raw, ...fallback.raw] };
  }
  return parsed;
}

function commentsForBranchBody(sourceFile: ts.SourceFile, node: ts.Node): WhatWhy {
  const own = commentsForNode(sourceFile, node);
  // WHAT: Prefer comments attached directly to the branch token.
  // WHY: A directly adjacent rationale is more precise than a comment inside its body.
  if (own.what && own.why) return own;
  // WHAT: Read the first branch-body statement when the branch uses a block.
  // WHY: WHAT/WHY comments conventionally sit inside an else or catch block.
  const first = /* WHAT: Select the first block statement. WHY: A non-block node already owns its leading comment. */ ts.isBlock(node) ? node.statements[0] : node;
  // WHAT: Preserve an empty rationale when the branch body has no statement.
  // WHY: Empty branches must fail the same mandatory comment gate.
  const nested = /* WHAT: Parse the available first statement. WHY: A missing statement has no comment source. */ first ? commentsForNode(sourceFile, first) : { what: null, why: null, raw: [] };
  return { what: own.what ?? nested.what, why: own.why ?? nested.why, raw: [...own.raw, ...nested.raw] };
}

function functionName(node: ts.Node, sourceFile: ts.SourceFile): string {
  const nameNode = (node as ts.Node & { name?: ts.Node }).name;
  // WHAT: Read a declared name only when the AST node owns one.
  // WHY: Anonymous callables require parent-derived fallback identity.
  const named = /* WHAT: Use the declared syntax name. WHY: Missing names must remain available for fallback. */ nameNode ? nameNode.getText(sourceFile) : '';
  // WHAT: Retain declared names before deriving assignment ownership.
  // WHY: Named symbols produce the most stable cross-tool identity.
  if (named) return named;
  const parent = node.parent;
  // WHAT: Name arrow and expression functions from their variable declaration.
  // WHY: Anonymous implementation syntax still has a stable source owner.
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  // WHAT: Name property-owned functions from their property key.
  // WHY: Object callbacks must remain queryable without inventing line-only labels.
  if (ts.isPropertyAssignment(parent)) return parent.name.getText(sourceFile);
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `<anonymous:${position.line + 1}:${position.character + 1}>`;
}

function functionKind(node: ts.Node): string {
  return ts.SyntaxKind[node.kind] ?? 'Function';
}

function collectBranches(sourceFile: ts.SourceFile, owner: ts.Node, ownerId: string): QualityBranch[] {
  const branches: QualityBranch[] = [];
  const append = (kind: QualityBranch['kind'], node: ts.Node, comments = commentsForNode(sourceFile, node)): void => {
    const range = rangeOf(sourceFile, node);
    branches.push({ id: stableId([ownerId, kind, range.startLine, range.startColumn]), kind, range, comments, compliant: Boolean(comments.what && comments.why) });
  };
  const visit = (node: ts.Node): void => {
    // WHAT: Stop descent when a nested function owns its own branches.
    // WHY: Branches must appear under exactly one callable in control-flow queries.
    if (node !== owner && ts.isFunctionLike(node)) return;
    // WHAT: Record the decision and alternate path of each if statement independently.
    // WHY: Both control-flow outcomes require explicit rationale.
    if (ts.isIfStatement(node)) {
      append('if', node);
      // WHAT: Record an else path only when the source declares one.
      // WHY: Missing alternate paths must not create synthetic quality findings.
      if (node.elseStatement) append('else', node.elseStatement, commentsForBranchBody(sourceFile, node.elseStatement));
    }
    // WHAT: Record conditional expressions as explicit two-outcome decisions.
    // WHY: Ternaries are branches even when they occupy one source expression.
    if (ts.isConditionalExpression(node)) append('conditional', node);
    // WHAT: Record each switch case and default arm.
    // WHY: Case-specific control flow requires its own WHAT/WHY rationale.
    if (ts.isCaseClause(node) || ts.isDefaultClause(node)) append('case', node);
    // WHAT: Record catch paths as failure branches.
    // WHY: Recovery behavior must expose its intended action and reason.
    if (ts.isCatchClause(node)) append('catch', node);
    ts.forEachChild(node, visit);
  };
  visit(owner);
  return branches;
}

function leadingComments(sourceFile: ts.SourceFile, maximumLine: number): string[] {
  const comments: string[] = [];
  for (const statement of sourceFile.statements) {
    const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
    // WHAT: Stop scanning after the configured near-file-beginning boundary.
    // WHY: Later implementation comments cannot satisfy file-header and decomposition gates.
    if (line > maximumLine) break;
    comments.push(...commentStrings(sourceFile.text, statement.getFullStart()));
  }
  return [...new Set(comments)];
}

export function parseSourceFile(path: string, source: string): { header: WhatWhy; functions: QualityFunction[]; decomposition: { loc: number; date: string; justification: string } | null } {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
  const scriptKinds: Record<string, ts.ScriptKind> = { tsx: ts.ScriptKind.TSX, jsx: ts.ScriptKind.JSX, js: ts.ScriptKind.JS, mjs: ts.ScriptKind.JS, cjs: ts.ScriptKind.JS };
  const scriptKind = scriptKinds[extension] ?? ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind);
  const comments = leadingComments(sourceFile, 60);
  const header = parseWhatWhy(comments);
  const decompositionText = comments.join('\n');
  const decompositionMatch = decompositionText.match(/DECOMPOSITION_ANALYSIS\s*\n(?:\s*(?:\/\/|\*)?\s*)?LOC:\s*(\d+)\s*\n(?:\s*(?:\/\/|\*)?\s*)?DATE:\s*(\d{4}-\d{2}-\d{2})\s*\n(?:\s*(?:\/\/|\*)?\s*)?JUSTIFICATION:\s*([^\n*]+)/);
  // WHAT: Materialize decomposition data only when every required field parses.
  // WHY: Partial blocks must remain missing quality evidence.
  const decomposition = /* WHAT: Build the parsed decomposition record. WHY: A failed match has no trustworthy fields. */ decompositionMatch ? { loc: Number(decompositionMatch[1]), date: decompositionMatch[2], justification: decompositionMatch[3].trim() } : null;
  const functions: QualityFunction[] = [];
  const visit = (node: ts.Node): void => {
    // WHAT: Materialize every callable declaration with its exact owned branches.
    // WHY: Function counts and control-flow queries must include named and anonymous callables.
    if (ts.isFunctionLike(node) && node.kind !== ts.SyntaxKind.ConstructorType && node.kind !== ts.SyntaxKind.FunctionType) {
      const range = rangeOf(sourceFile, node);
      const name = functionName(node, sourceFile);
      const id = stableId([path, name, range.startLine, range.startColumn, range.endLine, range.endColumn]);
      functions.push({ id, name, kind: functionKind(node), range, comments: commentsForNode(sourceFile, node), branches: collectBranches(sourceFile, node, id), callers: [], callees: [], coverage: null });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { header, functions, decomposition };
}
