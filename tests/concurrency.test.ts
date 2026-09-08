import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  createWriteTool,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { archiveChange } from "../src/archive.ts";
import { LOCK_FILE } from "../src/constants.ts";
import { QbError } from "../src/errors.ts";
import { withMutationQueues } from "../src/operations.ts";
import { transitionChange } from "../src/transition.ts";
import { fixture, ID } from "./helpers.ts";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("real mutation queues serialize two archives of the same change", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument();
  const options = {
    projectRoot: fx.root,
    changeId: ID,
    verificationConfirmed: true,
  } as const;
  const dependencies = { withFileMutationQueue };
  const results = await Promise.all([
    archiveChange(options, dependencies),
    archiveChange(options, dependencies),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [
    "already_archived",
    "archived",
  ]);
  assert.equal(
    await exists(join(fx.docs, "archive", "2026", ID, "spec.md")),
    true,
  );
  assert.equal(
    await exists(join(fx.docs, "archive", "2026", ID, ".qb-pending.json")),
    false,
  );
});

test("archive queues every unique path in sorted order before taking the root lock", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument({ tier: "strict" });
  await fx.writeDocument({ category: "plans", tier: "strict" });
  const queued: string[] = [];
  let checkedLock = false;
  const queue = async <T>(
    path: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    queued.push(path);
    return operation();
  };
  await archiveChange(
    { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
    {
      withFileMutationQueue: queue,
      async fault(phase) {
        if (phase === "archive-before-commit") {
          checkedLock = await exists(join(fx.docs, LOCK_FILE));
          assert.equal(queued.length >= 7, true);
        }
      },
    },
  );
  assert.equal(checkedLock, true);
  assert.deepEqual(
    queued,
    [...queued].sort((left, right) => left.localeCompare(right)),
  );
  assert.equal(new Set(queued).size, queued.length);

  const directQueued: string[] = [];
  await withMutationQueues(
    {
      withFileMutationQueue: async <T>(
        path: string,
        operation: () => Promise<T>,
      ): Promise<T> => {
        directQueued.push(path);
        return operation();
      },
    },
    ["/tmp/b", "/tmp/a", "/tmp/b"],
    async () => undefined,
  );
  assert.deepEqual(directQueued, ["/tmp/a", "/tmp/b"]);
});

test("built-in write completes before a competing archive reads and deletes the source", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument();
  const replacement = (await readFile(source, "utf8")).replace(
    "custom: keep me",
    "custom: written by built-in write",
  );
  const enteredWrite = deferred();
  const releaseWrite = deferred();
  const write = createWriteTool(fx.root, {
    operations: {
      mkdir: (path) => mkdir(path, { recursive: true }).then(() => undefined),
      async writeFile(path, content) {
        enteredWrite.resolve();
        await releaseWrite.promise;
        await writeFile(path, content);
      },
    },
  });
  const writePromise = write.execute("write-archive-race", {
    path: source,
    content: replacement,
  });
  await enteredWrite.promise;
  const archivePromise = archiveChange(
    { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
    { withFileMutationQueue },
  );
  releaseWrite.resolve();
  await Promise.all([writePromise, archivePromise]);
  const archived = await readFile(
    join(fx.docs, "archive", "2026", ID, "spec.md"),
    "utf8",
  );
  assert.match(archived, /custom: written by built-in write/);
  assert.equal(await exists(source), false);
});

test("different changes serialize through the root lock queue without overwriting each other", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const secondId = "QB-20260908-second";
  await fx.writeDocument({ name: "first.md", id: ID });
  await fx.writeDocument({ name: "second.md", id: secondId });
  const dependencies = { withFileMutationQueue };
  const [first, second] = await Promise.all([
    archiveChange(
      { projectRoot: fx.root, changeId: ID, verificationConfirmed: true },
      dependencies,
    ),
    archiveChange(
      { projectRoot: fx.root, changeId: secondId, verificationConfirmed: true },
      dependencies,
    ),
  ]);
  assert.equal(first.status, "archived");
  assert.equal(second.status, "archived");
  assert.equal(await exists(join(first.path, "spec.md")), true);
  assert.equal(await exists(join(second.path, "spec.md")), true);
});

test("abort while waiting for the real file queue produces no transition write", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  const source = await fx.writeDocument({ status: "draft" });
  const entered = deferred();
  const release = deferred();
  const holder = withFileMutationQueue(source, async () => {
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const controller = new AbortController();
  const pending = transitionChange(
    {
      projectRoot: fx.root,
      changeId: ID,
      document: "spec",
      status: "approved",
      authorizationDeclared: true,
      signal: controller.signal,
    },
    { withFileMutationQueue },
  );
  controller.abort();
  release.resolve();
  await holder;
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof QbError && error.code === "QB_ABORTED",
  );
  assert.match(await readFile(source, "utf8"), /status: draft/);
  assert.equal(await exists(join(fx.docs, LOCK_FILE)), false);
});
