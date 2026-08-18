/**
 * WHAT: Projects source-positioned stack frames onto static functions, branches, rationale, coverage, and findings.
 * WHY: Trace Evidence stacks need a direct logical control-flow view without reparsing source files.
 */
import type { QualityMap } from '../types.js';

export function projectStack(report: QualityMap, stack: string): unknown[] {
  return stack.split('\n').flatMap((frame) => {
    const match = frame.match(/(?:\(|\s|^)([^()\s]+):(\d+):(\d+)\)?$/);
    // WHAT: Keep only stack frames carrying an exact source position.
    // WHY: Unpositioned frames cannot be joined to AST control flow.
    if (!match) return [];
    const normalized = match[1].replaceAll('\\', '/');
    const file = report.files.find((candidate) => normalized.endsWith(candidate.path));
    // WHAT: Preserve unresolved source positions as explicit stack evidence.
    // WHY: A missing static match must remain visible rather than disappear.
    if (!file) return [{ frame, status: 'unmapped' }];
    const line = Number(match[2]);
    const callable = file.functions.find((candidate) => candidate.range.startLine <= line && candidate.range.endLine >= line);
    const branches = callable?.branches.filter((branch) => branch.range.startLine <= line && branch.range.endLine >= line) ?? [];
    const functionEvidence = /* WHAT: Attach the containing callable when the frame resolves inside one. WHY: File-level frames still need a valid mapped result. */ callable ? { id: callable.id, name: callable.name, kind: callable.kind, comments: callable.comments, callers: callable.callers, callees: callable.callees } : null;
    return [{ frame, status: 'mapped', file: file.path, role: file.role, fileComments: file.header, function: functionEvidence, activeBranches: branches, controlFlow: callable?.branches ?? [], coverage: { file: file.lineCoverage, function: callable?.coverage ?? null }, findings: file.findings.filter((finding) => finding.symbolId === null || finding.symbolId === callable?.id) }];
  });
}
