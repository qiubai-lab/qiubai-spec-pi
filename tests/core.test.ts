import assert from "node:assert/strict";
import { readFile, symlink, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { inspectChange } from "../src/inspect.ts";
import { transitionChange } from "../src/transition.ts";
import { DIRECT_QUEUE } from "../src/operations.ts";
import { QbError } from "../src/errors.ts";
import { fixture, ID } from "./helpers.ts";

const dependencies = { withFileMutationQueue: DIRECT_QUEUE };

async function rejectsCode(operation: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => error instanceof QbError && error.code === code);
}

test("inspect supports persisted quick and a unique active change", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "quick" });
  const result = await inspectChange({ projectRoot: fx.root });
  assert.equal(result.changeId, ID);
  assert.equal(result.documents.length, 1);
  assert.equal(result.syncNeeded, false);
});

test("inspect accepts split lifecycle drift but rejects strict without plan", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "strict", status: "active" });
  await rejectsCode(() => inspectChange({ projectRoot: fx.root, changeId: ID }), "QB_INVALID_STATE");
  await fx.writeDocument({ category: "plans", tier: "strict", status: "draft" });
  const result = await inspectChange({ projectRoot: fx.root, changeId: ID });
  assert.equal(result.syncNeeded, true);
  assert.deepEqual(result.documents.map((document) => document.status), ["active", "draft"]);
});

test("inspect rejects duplicate ids and linked document paths", async (t) => {
  const duplicate = await fixture();
  t.after(duplicate.cleanup);
  const source = await duplicate.writeDocument();
  await duplicate.writeDocument({ name: "duplicate.md" });
  await rejectsCode(() => inspectChange({ projectRoot: duplicate.root, changeId: ID }), "QB_DUPLICATE");

  const linked = await fixture();
  t.after(linked.cleanup);
  const linkedSource = await linked.writeDocument();
  try {
    await symlink(linkedSource, `${linkedSource}.linked.md`);
  } catch {
    t.diagnostic("symlink creation is unavailable on this platform");
    return;
  }
  await rejectsCode(() => inspectChange({ projectRoot: linked.root, changeId: ID }), "QB_PATH_UNSAFE");
  assert.match(await readFile(source, "utf8"), /# Fixture/);
});

test("transition requires authorization and preserves BOM, CRLF, body, and unknown fields", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const path = await fx.writeDocument({ status: "draft", bom: true });
  await rejectsCode(() => transitionChange({
    projectRoot: fx.root,
    changeId: ID,
    document: "spec",
    status: "approved",
    authorizationDeclared: false,
  }, dependencies), "QB_AUTH_REQUIRED");
  const result = await transitionChange({
    projectRoot: fx.root,
    changeId: ID,
    document: "spec",
    status: "approved",
    authorizationDeclared: true,
    date: "2026-09-09",
  }, dependencies);
  assert.equal(result.status, "updated");
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), true);
  const text = bytes.toString("utf8");
  assert.match(text, /status: approved\r\n/);
  assert.match(text, /updated: 2026-09-09\r\n/);
  assert.match(text, /custom: keep me\r\n/);
  assert.match(text, /status: active remains body text/);
});

test("transition updates only the requested split document and rejects illegal moves", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "strict", status: "active" });
  const plan = await fx.writeDocument({ category: "plans", tier: "strict", status: "draft" });
  await transitionChange({
    projectRoot: fx.root,
    changeId: ID,
    document: "plan",
    status: "approved",
    authorizationDeclared: true,
  }, dependencies);
  assert.match(await readFile(plan, "utf8"), /status: approved/);
  const inspected = await inspectChange({ projectRoot: fx.root, changeId: ID });
  assert.deepEqual(inspected.documents.map((document) => document.status), ["active", "approved"]);
  await rejectsCode(() => transitionChange({
    projectRoot: fx.root,
    changeId: ID,
    document: "plan",
    status: "draft",
    authorizationDeclared: true,
  }, dependencies), "QB_INVALID_STATE");
});

test("unsafe docs roots and pre-write cancellation fail without mutation", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const path = await fx.writeDocument({ status: "draft" });
  await rejectsCode(() => inspectChange({ projectRoot: fx.root, docsRoot: "../outside", changeId: ID }), "QB_PATH_UNSAFE");
  const controller = new AbortController();
  controller.abort();
  await rejectsCode(() => transitionChange({
    projectRoot: fx.root,
    changeId: ID,
    document: "spec",
    status: "approved",
    authorizationDeclared: true,
    signal: controller.signal,
  }, dependencies), "QB_ABORTED");
  assert.match(await readFile(path, "utf8"), /status: draft/);
});

test("transition re-reads after waiting in the mutation queue", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const path = await fx.writeDocument({ status: "draft" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let first = true;
  const queue = async <T>(_path: string, operation: () => Promise<T>): Promise<T> => {
    if (first) {
      first = false;
      await gate;
    }
    return operation();
  };
  const pending = transitionChange({
    projectRoot: fx.root,
    changeId: ID,
    document: "spec",
    status: "approved",
    authorizationDeclared: true,
  }, { withFileMutationQueue: queue });
  const before = await readFile(path, "utf8");
  await writeFile(path, before.replace("custom: keep me", "custom: edited while queued"));
  release();
  await pending;
  const after = await readFile(path, "utf8");
  assert.match(after, /custom: edited while queued/);
  assert.match(after, /status: approved/);
});
