import assert from "node:assert/strict";
import { mkdir, readdir, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { doctor } from "../src/doctor.ts";
import { QbError } from "../src/errors.ts";
import { inspectChange } from "../src/inspect.ts";
import { fixture, ID, treeHash } from "./helpers.ts";

for (const tier of ["quick", "standard"] as const) {
  test(`doctor does not require a separate plan for ${tier}`, async (t) => {
    const fx = await fixture();
    t.after(fx.cleanup);
    await fx.writeDocument({ tier });
    const result = await doctor({ projectRoot: fx.root });
    assert.equal(
      result.findings.some((finding) => finding.code === "STRICT_PLAN_MISSING"),
      false,
    );
  });
}

test("doctor reports split lifecycle synchronization without calling it corrupt", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "strict", status: "active" });
  await fx.writeDocument({
    category: "plans",
    tier: "strict",
    status: "draft",
  });
  const result = await doctor({ projectRoot: fx.root, changeId: ID });
  assert.equal(
    result.findings.some((finding) => finding.code === "LIFECYCLE_SYNC_NEEDED"),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.code === "METADATA_MISMATCH"),
    false,
  );
});

test("doctor finds malformed metadata, locks, pending journals, and partial archives without writing", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument();
  const malformed = (await import("node:fs/promises")).readFile(source, "utf8");
  await writeFile(
    source,
    (await malformed).replace("status: active", "status: unknown"),
  );
  await writeFile(join(fx.docs, ".qb-change.lock"), "stale");
  const target = join(fx.docs, "archive", "2026", ID);
  await mkdir(target, { recursive: true });
  await writeFile(
    join(target, ".qb-pending.json"),
    JSON.stringify({ id: ID, files: [] }),
  );
  const before = await treeHash(fx.root);
  const result = await doctor({ projectRoot: fx.root });
  const after = await treeHash(fx.root);
  assert.equal(before, after);
  assert.equal(
    result.findings.some((finding) => finding.code === "QB_INVALID_STATE"),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.code === "LOCK_PRESENT"),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.code === "RECOVERY_PENDING"),
    true,
  );
  assert.equal(
    result.findings.some((finding) => finding.code === "PARTIAL_ARCHIVE"),
    true,
  );
});

test("doctor reports archived status below active specs/plans", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ status: "archived" });
  const result = await doctor({ projectRoot: fx.root, changeId: ID });
  assert.equal(
    result.findings.some((finding) => finding.code === "ACTIVE_STATUS_INVALID"),
    true,
  );
});

test("doctor reports split metadata mismatch", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "strict" });
  await fx.writeDocument({ category: "plans", tier: "standard" });
  const result = await doctor({ projectRoot: fx.root });
  assert.equal(
    result.findings.some((finding) => finding.code === "METADATA_MISMATCH"),
    true,
  );
});

test("doctor detects duplicate complete archives and cross-directory archive pairs", async (t) => {
  const duplicate = await fixture();
  t.after(duplicate.cleanup);
  const firstSeed = await duplicate.writeDocument({
    name: "seed-first.md",
    status: "archived",
  });
  const secondSeed = await duplicate.writeDocument({
    name: "seed-second.md",
    status: "archived",
  });
  const firstArchive = join(duplicate.docs, "archive", "2025", ID);
  const secondArchive = join(duplicate.docs, "archive", "2026", ID);
  await mkdir(firstArchive, { recursive: true });
  await mkdir(secondArchive, { recursive: true });
  await rename(firstSeed, join(firstArchive, "spec.md"));
  await rename(secondSeed, join(secondArchive, "spec.md"));
  const duplicateResult = await doctor({
    projectRoot: duplicate.root,
    changeId: ID,
  });
  assert.equal(
    duplicateResult.findings.some(
      (finding) => finding.code === "DUPLICATE_ARCHIVE_ID",
    ),
    true,
  );
  assert.equal(
    duplicateResult.findings.some(
      (finding) => finding.code === "ARCHIVE_SHAPE",
    ),
    true,
  );

  const split = await fixture();
  t.after(split.cleanup);
  const specSeed = await split.writeDocument({
    name: "seed-spec.md",
    tier: "strict",
    status: "archived",
  });
  const planSeed = await split.writeDocument({
    category: "plans",
    name: "seed-plan.md",
    tier: "strict",
    status: "archived",
  });
  const specArchive = join(split.docs, "archive", "2025", ID);
  const planArchive = join(split.docs, "archive", "2026", ID);
  await mkdir(specArchive, { recursive: true });
  await mkdir(planArchive, { recursive: true });
  await rename(specSeed, join(specArchive, "spec.md"));
  await rename(planSeed, join(planArchive, "plan.md"));
  const splitResult = await doctor({ projectRoot: split.root, changeId: ID });
  assert.equal(
    splitResult.findings.some((finding) => finding.code === "ARCHIVE_SHAPE"),
    true,
  );
});

test("doctor rejects archive folders whose id or year segment is malformed", async (t) => {
  const wrongId = await fixture();
  t.after(wrongId.cleanup);
  const wrongIdSeed = await wrongId.writeDocument({
    name: "seed.md",
    status: "archived",
  });
  const wrongIdArchive = join(wrongId.docs, "archive", "2026", "wrong-folder");
  await mkdir(wrongIdArchive, { recursive: true });
  await rename(wrongIdSeed, join(wrongIdArchive, "spec.md"));
  const wrongIdResult = await doctor({
    projectRoot: wrongId.root,
    changeId: ID,
  });
  assert.equal(
    wrongIdResult.findings.some((finding) => finding.code === "ARCHIVE_SHAPE"),
    true,
  );

  const wrongYear = await fixture();
  t.after(wrongYear.cleanup);
  const wrongYearSeed = await wrongYear.writeDocument({
    name: "seed.md",
    status: "archived",
  });
  const wrongYearArchive = join(wrongYear.docs, "archive", "year-2026", ID);
  await mkdir(wrongYearArchive, { recursive: true });
  await rename(wrongYearSeed, join(wrongYearArchive, "spec.md"));
  const wrongYearResult = await doctor({
    projectRoot: wrongYear.root,
    changeId: ID,
  });
  assert.equal(
    wrongYearResult.findings.some(
      (finding) => finding.code === "ARCHIVE_SHAPE",
    ),
    true,
  );
});

test("doctor reports a directory symlink without following it", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const outside = join(fx.root, "outside-archive");
  await mkdir(outside);
  await mkdir(join(fx.docs, "archive"), { recursive: true });
  try {
    await symlink(outside, join(fx.docs, "archive", "2026"), "dir");
  } catch {
    t.skip("directory symlinks are unavailable on this platform");
    return;
  }
  const result = await doctor({ projectRoot: fx.root });
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "QB_PATH_UNSAFE" || finding.code === "PATH_LINK",
    ),
    true,
  );
  await assert.rejects(
    () => inspectChange({ projectRoot: fx.root, changeId: ID }),
    (error: unknown) =>
      error instanceof QbError && error.code === "QB_PATH_UNSAFE",
  );
  assert.deepEqual(await readdir(outside), []);
});

test("doctor pagination reconstructs the complete sorted result and handles an out-of-range offset", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  for (let index = 0; index < 7; index += 1) {
    await fx.writeDocument({
      category: "plans",
      name: `orphan-${index}.md`,
      id: `QB-2026090${index + 1}-orphan`,
      tier: "standard",
    });
  }
  const all = await doctor({ projectRoot: fx.root, limit: 200 });
  const paged = [];
  let offset = 0;
  do {
    const page = await doctor({ projectRoot: fx.root, offset, limit: 2 });
    paged.push(...page.findings);
    if (page.nextOffset === null) break;
    assert.equal(page.nextOffset > offset, true);
    offset = page.nextOffset;
  } while (true);
  assert.deepEqual(paged, all.findings);
  assert.equal(all.total, all.findings.length);
  const beyond = await doctor({
    projectRoot: fx.root,
    offset: all.total + 10,
    limit: 2,
  });
  assert.deepEqual(beyond.findings, []);
  assert.equal(beyond.nextOffset, null);
  assert.equal(beyond.total, all.total);
});

test("doctor flags undefined trace ids and strict missing trace kinds", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({
    tier: "strict",
    body: "# Minimal\n\n### REQ-001\n\nReference AC-999.\n",
  });
  await fx.writeDocument({
    category: "plans",
    tier: "strict",
    body: "# Plan\n",
  });
  const result = await doctor({ projectRoot: fx.root });
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "TRACE_UNDEFINED" &&
        finding.message.includes("AC-999"),
    ),
    true,
  );
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "TRACE_MISSING_KIND" &&
        finding.message.includes("TASK"),
    ),
    true,
  );
  assert.equal(
    result.findings.some(
      (finding) =>
        finding.code === "TRACE_MISSING_KIND" &&
        finding.message.includes("VER"),
    ),
    true,
  );
});
