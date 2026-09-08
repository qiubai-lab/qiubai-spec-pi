import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_RESULT_BYTES, MAX_RESULT_LINES } from "../src/constants.ts";
import { boundDoctorResult, boundedText } from "../src/result.ts";
import type { Diagnostic, DoctorResult } from "../src/types.ts";

test("boundedText reserves UTF-8 budget for its truncation notice", () => {
  const nearLimit = "界".repeat(Math.floor(MAX_RESULT_BYTES / 3));
  const output = boundedText([nearLimit, "尾"]);
  assert.equal(Buffer.byteLength(output, "utf8") <= MAX_RESULT_BYTES, true);
  assert.equal(output.split("\n").length <= MAX_RESULT_LINES, true);
  assert.match(output, /output truncated/);
  assert.doesNotMatch(output, /�/);

  const manyLines = boundedText(
    Array.from({ length: MAX_RESULT_LINES + 10 }, (_, index) => `行-${index}`),
  );
  assert.equal(manyLines.split("\n").length <= MAX_RESULT_LINES, true);
  assert.equal(Buffer.byteLength(manyLines, "utf8") <= MAX_RESULT_BYTES, true);
  assert.match(manyLines, /output truncated/);
});

test("boundDoctorResult shrinks pages with monotonic continuation until complete", () => {
  const findings: Diagnostic[] = Array.from({ length: 200 }, (_, index) => ({
    code: `LONG_${String(index).padStart(3, "0")}`,
    severity: "error",
    message: `问题-${index}-`.repeat(150),
    path: `/tmp/${`目录-${index}-`.repeat(150)}`,
    changeId: `QB-20260908-long-${index}`,
  }));
  const base: Omit<DoctorResult, "offset" | "findings" | "nextOffset"> = {
    status: "findings",
    docsRoot: "/tmp/docs/qb-spec",
    total: findings.length,
    limit: 200,
  };
  const reconstructed: Diagnostic[] = [];
  let offset = 0;
  do {
    const page = boundDoctorResult({
      ...base,
      offset,
      findings: findings.slice(offset),
      nextOffset: null,
    });
    assert.equal(
      Buffer.byteLength(JSON.stringify(page), "utf8") <= MAX_RESULT_BYTES,
      true,
    );
    assert.equal(page.findings.length > 0, true);
    reconstructed.push(...page.findings);
    if (page.nextOffset === null) break;
    assert.equal(page.nextOffset > offset, true);
    offset = page.nextOffset;
  } while (true);
  assert.equal(reconstructed.length, findings.length);
  assert.deepEqual(
    reconstructed.map((finding) => finding.code),
    findings.map((finding) => finding.code),
  );
});
