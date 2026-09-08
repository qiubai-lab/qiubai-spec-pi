import assert from "node:assert/strict";
import { access, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { archiveChange } from "../src/archive.ts";
import { LOCK_FILE } from "../src/constants.ts";
import { doctor } from "../src/doctor.ts";
import { QbError } from "../src/errors.ts";
import { DIRECT_QUEUE } from "../src/operations.ts";
import { analyzeRecovery, recoverChange } from "../src/recovery.ts";
import { resolveProjectPaths } from "../src/paths.ts";
import { fixture, ID, treeHash } from "./helpers.ts";

const direct = { withFileMutationQueue: DIRECT_QUEUE };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function rejectsCode(operation: () => Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: unknown) => error instanceof QbError && error.code === code);
}

async function interruptArchive(
  fx: Awaited<ReturnType<typeof fixture>>,
  phase: string,
  strict = false,
) {
  await fx.writeDocument({ tier: strict ? "strict" : "standard" });
  if (strict) await fx.writeDocument({ category: "plans", tier: "strict" });
  await assert.rejects(
    () => archiveChange(
      { projectRoot: fx.root, changeId: ID, verificationConfirmed: true, date: "2026-09-08" },
      {
        withFileMutationQueue: DIRECT_QUEUE,
        fault(current) {
          if (current === phase) throw new Error(`stop at ${phase}`);
        },
      },
    ),
    new RegExp(`stop at ${phase}`),
  );
  return analyzeRecovery(await resolveProjectPaths(fx.root), ID);
}

test("doctor classifies recovery without modifying the tree", async (t) => {
  const restore = await fixture();
  t.after(restore.cleanup);
  const analysis = await interruptArchive(restore, "archive-after-journal");
  assert.equal(analysis.state, "safe_to_restore");
  assert.deepEqual(analysis.allowedActions, ["restore"]);
  const before = await treeHash(restore.root);
  const diagnosed = await doctor({ projectRoot: restore.root, changeId: ID });
  assert.equal(await treeHash(restore.root), before);
  const finding = diagnosed.findings.find((item) => item.code === "RECOVERY_PENDING")!;
  assert.deepEqual(finding.recovery, {
    state: "safe_to_restore",
    journalSha256: analysis.journalSha256,
    allowedActions: ["restore"],
  });

  const choice = await fixture();
  t.after(choice.cleanup);
  const choiceAnalysis = await interruptArchive(choice, "archive-after-copies");
  assert.equal(choiceAnalysis.state, "choice_required");
  assert.deepEqual(choiceAnalysis.allowedActions, ["complete", "restore"]);

  const complete = await fixture();
  t.after(complete.cleanup);
  const completeAnalysis = await interruptArchive(complete, "archive-after-delete", true);
  assert.equal(completeAnalysis.state, "safe_to_complete");
  assert.deepEqual(completeAnalysis.allowedActions, ["complete"]);
});

test("recover safely restores or completes and is idempotent", async (t) => {
  const restore = await fixture();
  t.after(restore.cleanup);
  const source = join(restore.docs, "specs", "change.md");
  const restoreAnalysis = await interruptArchive(restore, "archive-after-journal");
  const restored = await recoverChange({
    projectRoot: restore.root,
    changeId: ID,
    action: "restore",
    expectedJournalSha256: restoreAnalysis.journalSha256,
    authorizationDeclared: true,
  }, direct);
  assert.equal(restored.status, "restored");
  assert.equal(await exists(source), true);
  assert.equal(await exists(restoreAnalysis.targetDirectory), false);
  assert.equal((await recoverChange({
    projectRoot: restore.root,
    changeId: ID,
    action: "restore",
    expectedJournalSha256: restoreAnalysis.journalSha256,
    authorizationDeclared: true,
  }, direct)).status, "already_restored");

  const complete = await fixture();
  t.after(complete.cleanup);
  const completeAnalysis = await interruptArchive(complete, "archive-after-delete", true);
  const completed = await recoverChange({
    projectRoot: complete.root,
    changeId: ID,
    action: "complete",
    expectedJournalSha256: completeAnalysis.journalSha256,
    authorizationDeclared: true,
  }, direct);
  assert.equal(completed.status, "completed");
  assert.equal(await exists(join(completed.path, ".qb-pending.json")), false);
  assert.equal(await exists(join(completed.path, "spec.md")), true);
  assert.equal(await exists(join(completed.path, "plan.md")), true);
  assert.equal((await recoverChange({
    projectRoot: complete.root,
    changeId: ID,
    action: "complete",
    expectedJournalSha256: completeAnalysis.journalSha256,
    authorizationDeclared: true,
  }, direct)).status, "already_completed");
});

test("choice-required recovery executes only the user-selected safe action", async (t) => {
  for (const action of ["complete", "restore"] as const) {
    const fx = await fixture();
    t.after(fx.cleanup);
    const analysis = await interruptArchive(fx, "archive-after-copies");
    const result = await recoverChange({
      projectRoot: fx.root,
      changeId: ID,
      action,
      expectedJournalSha256: analysis.journalSha256,
      authorizationDeclared: true,
    }, direct);
    assert.equal(result.status, action === "complete" ? "completed" : "restored");
  }
});

test("recover requires authorization, exact journal hash, and a safe action", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const analysis = await interruptArchive(fx, "archive-after-journal");
  const base = {
    projectRoot: fx.root,
    changeId: ID,
    action: "restore" as const,
    expectedJournalSha256: analysis.journalSha256,
    authorizationDeclared: true,
  };
  await rejectsCode(() => recoverChange({ ...base, authorizationDeclared: false }, direct), "QB_AUTH_REQUIRED");
  await rejectsCode(() => recoverChange({ ...base, expectedJournalSha256: "0".repeat(64) }, direct), "QB_SOURCE_CHANGED");
  await rejectsCode(() => recoverChange({ ...base, action: "complete" }, direct), "QB_RECOVERY_AMBIGUOUS");
  const before = await treeHash(fx.root);
  const dry = await recoverChange({ ...base, dryRun: true }, direct);
  assert.equal(dry.status, "dry_run");
  assert.equal(await treeHash(fx.root), before);
});

test("changed payloads and unexpected archive files remain ambiguous", async (t) => {
  const targetChanged = await fixture();
  t.after(targetChanged.cleanup);
  const targetAnalysis = await interruptArchive(targetChanged, "archive-after-copies");
  await writeFile(targetAnalysis.files[0]!.target, "changed target");
  const changed = await analyzeRecovery(await resolveProjectPaths(targetChanged.root), ID);
  assert.equal(changed.state, "ambiguous");
  assert.deepEqual(changed.allowedActions, []);

  const extra = await fixture();
  t.after(extra.cleanup);
  const extraAnalysis = await interruptArchive(extra, "archive-after-journal");
  await writeFile(join(extraAnalysis.targetDirectory, "unexpected.txt"), "keep");
  const unexpected = await analyzeRecovery(await resolveProjectPaths(extra.root), ID);
  assert.equal(unexpected.state, "ambiguous");
  assert.match(unexpected.issues.join("\n"), /Unexpected archive entry/);

  const linked = await fixture();
  t.after(linked.cleanup);
  const linkedAnalysis = await interruptArchive(linked, "archive-after-copies");
  await unlink(linkedAnalysis.files[0]!.target);
  await symlink(linkedAnalysis.files[0]!.source, linkedAnalysis.files[0]!.target);
  const linkedResult = await analyzeRecovery(await resolveProjectPaths(linked.root), ID);
  assert.equal(linkedResult.state, "ambiguous");
  assert.match(linkedResult.issues.join("\n"), /link/i);

  const malformed = await fixture();
  t.after(malformed.cleanup);
  const malformedAnalysis = await interruptArchive(malformed, "archive-after-journal");
  await writeFile(malformedAnalysis.journalPath, "not-json");
  const malformedResult = await analyzeRecovery(await resolveProjectPaths(malformed.root), ID);
  assert.equal(malformedResult.state, "ambiguous");
  assert.deepEqual(malformedResult.allowedActions, []);
});

test("recover queues sorted paths, takes the root lock, and fails closed on change", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const analysis = await interruptArchive(fx, "archive-after-copies");
  const queued: string[] = [];
  let lockObserved = false;
  await recoverChange({
    projectRoot: fx.root,
    changeId: ID,
    action: "restore",
    expectedJournalSha256: analysis.journalSha256,
    authorizationDeclared: true,
  }, {
    withFileMutationQueue: async <T>(path: string, operation: () => Promise<T>) => {
      queued.push(path);
      return operation();
    },
    async fault(phase) {
      if (phase === "recovery-before-commit") lockObserved = await exists(join(fx.docs, LOCK_FILE));
    },
  });
  assert.equal(lockObserved, true);
  assert.deepEqual(queued, [...queued].sort((a, b) => a.localeCompare(b)));
  assert.equal(new Set(queued).size, queued.length);

  const changed = await fixture();
  t.after(changed.cleanup);
  const changedAnalysis = await interruptArchive(changed, "archive-after-copies");
  await rejectsCode(() => recoverChange({
    projectRoot: changed.root,
    changeId: ID,
    action: "complete",
    expectedJournalSha256: changedAnalysis.journalSha256,
    authorizationDeclared: true,
  }, {
    withFileMutationQueue: DIRECT_QUEUE,
    async fault(phase) {
      if (phase === "recovery-before-commit")
        await writeFile(changedAnalysis.files[0]!.source, "changed source");
    },
  }), "QB_SOURCE_CHANGED");
  assert.equal(await exists(changedAnalysis.journalPath), true);
});

test("recover rejects a residual root lock without changing recovery state", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const analysis = await interruptArchive(fx, "archive-after-copies");
  await writeFile(join(fx.docs, LOCK_FILE), "stale");
  await rejectsCode(() => recoverChange({
    projectRoot: fx.root,
    changeId: ID,
    action: "complete",
    expectedJournalSha256: analysis.journalSha256,
    authorizationDeclared: true,
  }, direct), "QB_LOCKED");
  assert.equal(await exists(analysis.journalPath), true);
  assert.equal((await analyzeRecovery(await resolveProjectPaths(fx.root), ID)).state, "choice_required");
});

test("recover cancellation writes nothing and mid-commit failure remains recoverable", async (t) => {
  const cancelled = await fixture();
  t.after(cancelled.cleanup);
  const cancelledAnalysis = await interruptArchive(cancelled, "archive-after-copies");
  const controller = new AbortController();
  controller.abort();
  const before = await treeHash(cancelled.root);
  await rejectsCode(() => recoverChange({
    projectRoot: cancelled.root,
    changeId: ID,
    action: "complete",
    expectedJournalSha256: cancelledAnalysis.journalSha256,
    authorizationDeclared: true,
    signal: controller.signal,
  }, direct), "QB_ABORTED");
  assert.equal(await treeHash(cancelled.root), before);

  const interrupted = await fixture();
  t.after(interrupted.cleanup);
  const interruptedAnalysis = await interruptArchive(interrupted, "archive-after-copies", true);
  await assert.rejects(() => recoverChange({
    projectRoot: interrupted.root,
    changeId: ID,
    action: "complete",
    expectedJournalSha256: interruptedAnalysis.journalSha256,
    authorizationDeclared: true,
  }, {
    withFileMutationQueue: DIRECT_QUEUE,
    fault(phase) {
      if (phase === "recovery-after-delete-source") throw new Error("recovery interruption");
    },
  }), /recovery interruption/);
  const remaining = await analyzeRecovery(await resolveProjectPaths(interrupted.root), ID);
  assert.equal(remaining.state, "safe_to_complete");
});
