import { MAX_RESULT_BYTES, MAX_RESULT_LINES } from "./constants.ts";
import type { Diagnostic, DoctorResult } from "./types.ts";

function truncateField(value: string, max = 500): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function boundedFinding(finding: Diagnostic): Diagnostic {
  return {
    ...finding,
    message: truncateField(finding.message),
    ...(finding.path ? { path: truncateField(finding.path) } : {}),
  };
}

export function boundDoctorResult(result: DoctorResult): DoctorResult {
  const findings = result.findings.map(boundedFinding);
  while (findings.length > 0) {
    const candidate = {
      ...result,
      findings,
      nextOffset:
        result.offset + findings.length < result.total
          ? result.offset + findings.length
          : null,
    };
    if (
      Buffer.byteLength(JSON.stringify(candidate), "utf8") <= MAX_RESULT_BYTES
    )
      return candidate;
    findings.pop();
  }
  return {
    ...result,
    findings: [],
    nextOffset: result.offset < result.total ? result.offset : null,
  };
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const points = [...value];
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(points.slice(0, middle).join(""), "utf8") <= maxBytes)
      low = middle;
    else high = middle - 1;
  }
  return points.slice(0, low).join("");
}

export function boundedText(
  lines: string[],
  notice = "… output truncated; request the next doctor page.",
): string {
  const complete = lines.join("\n");
  if (
    lines.length <= MAX_RESULT_LINES &&
    Buffer.byteLength(complete, "utf8") <= MAX_RESULT_BYTES
  )
    return complete;

  const noticeBytes = Buffer.byteLength(`\n${notice}`, "utf8");
  const contentBudget = MAX_RESULT_BYTES - noticeBytes;
  const selected = lines.slice(0, Math.max(0, MAX_RESULT_LINES - 1));
  while (
    selected.length > 1 &&
    Buffer.byteLength(selected.join("\n"), "utf8") > contentBudget
  )
    selected.pop();

  let content = selected.join("\n");
  if (Buffer.byteLength(content, "utf8") > contentBudget) {
    const ellipsis = "…";
    const ellipsisBytes = Buffer.byteLength(ellipsis, "utf8");
    content = `${truncateUtf8(content, Math.max(0, contentBudget - ellipsisBytes))}${ellipsis}`;
  }
  const output = content.length > 0 ? `${content}\n${notice}` : notice;
  // The notice budget and code-point truncation guarantee both Pi limits.
  return output;
}
