import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  createEditTool,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { archiveChange } from "../src/archive.ts";
import { inspectChange } from "../src/inspect.ts";
import { transitionChange } from "../src/transition.ts";
import { DIRECT_QUEUE } from "../src/operations.ts";
import { QbError } from "../src/errors.ts";
import { fixture, ID } from "./helpers.ts";

const direct = { withFileMutationQueue: DIRECT_QUEUE };

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function rejectsCode(
  operation: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) => error instanceof QbError && error.code === code,
  );
}

test("archive moves a combined document, preserves body, and is idempotent", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument({ tier: "quick" });
  const before = await readFile(source);
  const result = await archiveChange(
    { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
    direct,
  );
  assert.equal(result.status, "archived");
  assert.equal(await pathExists(source), false);
  assert.equal(await pathExists(join(result.path, ".qb-pending.json")), false);
  const archived = await readFile(join(result.path, "spec.md"));
  assert.equal(
    archived.equals(
      Buffer.from(
        before.toString("utf8").replace("status: active", "status: archived"),
      ),
    ),
    true,
  );
  const again = await archiveChange(
    { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
    direct,
  );
  assert.equal(again.status, "already_archived");
  assert.equal(
    (await inspectChange({ projectRoot: fx.root, changeId: ID })).status,
    "already_archived",
  );
});

test("archive keeps historical split-standard and strict plan shapes", async (t) => {
  for (const tier of ["standard", "strict"] as const) {
    const fx = await fixture();
    t.after(fx.cleanup);
    await fx.writeDocument({ tier });
    await fx.writeDocument({ category: "plans", tier });
    const result = await archiveChange(
      { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
      direct,
    );
    assert.equal(await pathExists(join(result.path, "spec.md")), true);
    assert.equal(await pathExists(join(result.path, "plan.md")), true);
  }
});

test("transition and archive dry runs perform no writes, including locks", async (t) => {
  const transitionFixture = await fixture();
  t.after(transitionFixture.cleanup);
  const transitionSource = await transitionFixture.writeDocument({
    status: "draft",
  });
  const transitionBefore = await readFile(transitionSource);
  const transitionResult = await transitionChange(
    {
      projectRoot: transitionFixture.root,
      changeId: ID,
      document: "spec",
      status: "approved",
      authorizationDeclared: true,
      dryRun: true,
    },
    direct,
  );
  assert.equal(transitionResult.status, "dry_run");
  assert.equal(
    (await readFile(transitionSource)).equals(transitionBefore),
    true,
  );
  assert.equal(
    await pathExists(join(transitionFixture.docs, ".qb-change.lock")),
    false,
  );

  const archiveFixture = await fixture();
  t.after(archiveFixture.cleanup);
  const archiveSource = await archiveFixture.writeDocument();
  const archiveBefore = await readFile(archiveSource);
  const archiveResult = await archiveChange(
    {
      projectRoot: archiveFixture.root,
      changeId: ID,
      verificationConfirmed: true,
      dryRun: true,
    },
    direct,
  );
  assert.equal(archiveResult.status, "dry_run");
  assert.equal((await readFile(archiveSource)).equals(archiveBefore), true);
  assert.equal(
    await pathExists(join(archiveFixture.docs, ".qb-change.lock")),
    false,
  );
  assert.equal(await pathExists(join(archiveFixture.docs, "archive")), false);
});

test("archive requires verification and all source documents active", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "strict" });
  await fx.writeDocument({
    category: "plans",
    tier: "strict",
    status: "approved",
  });
  await rejectsCode(
    () =>
      archiveChange(
        { projectRoot: fx.root, changeId: ID, verificationConfirmed: false },
        direct,
      ),
    "QB_VERIFICATION_REQUIRED",
  );
  await rejectsCode(
    () =>
      archiveChange(
        { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
        direct,
      ),
    "QB_INVALID_STATE",
  );
});

test("archive rejects an existing target without overwriting it", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument();
  const target = join(fx.docs, "archive", "2026", ID);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "keep.txt"), "keep");
  await rejectsCode(
    () =>
      archiveChange(
        {
          projectRoot: fx.root,
          changeId: ID,
          verificationConfirmed: true,
          date: "2026-09-08",
        },
        direct,
      ),
    "QB_ARCHIVE_CONFLICT",
  );
  assert.equal(await readFile(join(target, "keep.txt"), "utf8"), "keep");
});

test("archive failure after journal preserves source and diagnostic state", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument();
  await assert.rejects(
    () =>
      archiveChange(
        { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
        {
          withFileMutationQueue: DIRECT_QUEUE,
          fault(phase) {
            if (phase === "archive-after-journal")
              throw new Error("simulated copy failure");
          },
        },
      ),
    /simulated copy failure/,
  );
  const target = join(fx.docs, "archive", "2026", ID);
  assert.equal(await pathExists(source), true);
  assert.equal(await pathExists(join(target, ".qb-pending.json")), true);
  await rejectsCode(
    () => inspectChange({ projectRoot: fx.root, changeId: ID }),
    "QB_RECOVERY_REQUIRED",
  );
});

test("archive verification failure and interrupted deletion retain diagnostic state", async (t) => {
  const verification = await fixture();
  t.after(verification.cleanup);
  const verificationSource = await verification.writeDocument();
  await rejectsCode(
    () =>
      archiveChange(
        {
          projectRoot: verification.root,
          changeId: ID,
          verificationConfirmed: true,
        },
        {
          withFileMutationQueue: DIRECT_QUEUE,
          async fault(phase, path) {
            if (phase === "archive-after-copy")
              await writeFile(path!, "corrupt");
          },
        },
      ),
    "QB_IO",
  );
  assert.equal(await pathExists(verificationSource), true);
  assert.equal(
    await pathExists(
      join(verification.docs, "archive", "2026", ID, ".qb-pending.json"),
    ),
    true,
  );

  const deletion = await fixture();
  t.after(deletion.cleanup);
  const spec = await deletion.writeDocument({ tier: "strict" });
  const plan = await deletion.writeDocument({
    category: "plans",
    tier: "strict",
  });
  await assert.rejects(
    () =>
      archiveChange(
        {
          projectRoot: deletion.root,
          changeId: ID,
          verificationConfirmed: true,
        },
        {
          withFileMutationQueue: DIRECT_QUEUE,
          fault(phase) {
            if (phase === "archive-after-delete")
              throw new Error("simulated deletion interruption");
          },
        },
      ),
    /simulated deletion interruption/,
  );
  assert.equal(await pathExists(spec), false);
  assert.equal(await pathExists(plan), true);
  assert.equal(
    await pathExists(
      join(deletion.docs, "archive", "2026", ID, ".qb-pending.json"),
    ),
    true,
  );
});

test("archive detects source changes before deletion and retains journal", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument();
  await rejectsCode(
    () =>
      archiveChange(
        { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
        {
          withFileMutationQueue: DIRECT_QUEUE,
          async fault(phase) {
            if (phase === "archive-after-copies")
              await writeFile(
                source,
                Buffer.concat([await readFile(source), Buffer.from("changed")]),
              );
          },
        },
      ),
    "QB_SOURCE_CHANGED",
  );
  const target = join(fx.docs, "archive", "2026", ID);
  assert.equal(await pathExists(source), true);
  assert.equal(await pathExists(join(target, "spec.md")), true);
  assert.equal(await pathExists(join(target, ".qb-pending.json")), true);
});

test("abort before commit writes nothing; abort after journal completes safely", async (t) => {
  const before = await fixture();
  t.after(before.cleanup);
  const beforeSource = await before.writeDocument();
  const stopped = new AbortController();
  stopped.abort();
  await rejectsCode(
    () =>
      archiveChange(
        {
          projectRoot: before.root,
          changeId: ID,
          verificationConfirmed: true,
          signal: stopped.signal,
        },
        direct,
      ),
    "QB_ABORTED",
  );
  assert.equal(await pathExists(beforeSource), true);
  assert.equal(await pathExists(join(before.docs, "archive")), false);

  const committed = await fixture();
  t.after(committed.cleanup);
  await committed.writeDocument();
  const late = new AbortController();
  const result = await archiveChange(
    {
      projectRoot: committed.root,
      changeId: ID,
      verificationConfirmed: true,
      signal: late.signal,
    },
    {
      withFileMutationQueue: DIRECT_QUEUE,
      fault(phase) {
        if (phase === "archive-after-journal") late.abort();
      },
    },
  );
  assert.equal(result.status, "archived");
  assert.equal(await pathExists(join(result.path, ".qb-pending.json")), false);
});

test("archive and transition reject a residual root lock", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ status: "active" });
  await writeFile(join(fx.docs, ".qb-change.lock"), "stale");
  await rejectsCode(
    () =>
      transitionChange(
        {
          projectRoot: fx.root,
          changeId: ID,
          document: "spec",
          status: "active",
          authorizationDeclared: true,
        },
        direct,
      ),
    "QB_LOCKED",
  );
  await rejectsCode(
    () =>
      archiveChange(
        { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
        direct,
      ),
    "QB_LOCKED",
  );
});

test("real Pi mutation queue serializes a built-in edit with transition", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument({ status: "draft" });
  const edit = createEditTool(fx.root);
  const editPromise = edit.execute("edit-1", {
    path: source,
    edits: [
      {
        oldText: "custom: keep me",
        newText: "custom: edited by built-in tool",
      },
    ],
  });
  const transitionPromise = transitionChange(
    {
      projectRoot: fx.root,
      changeId: ID,
      document: "spec",
      status: "approved",
      authorizationDeclared: true,
    },
    { withFileMutationQueue },
  );
  await Promise.all([editPromise, transitionPromise]);
  const text = await readFile(source, "utf8");
  assert.match(text, /custom: edited by built-in tool/);
  assert.match(text, /status: approved/);
});
