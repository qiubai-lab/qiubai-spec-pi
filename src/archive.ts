import { access, mkdir, readFile, unlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { LOCK_FILE } from "./constants.ts";
import { assertDocumentUnchanged, patchDocument } from "./frontmatter.ts";
import { locateChange } from "./discovery.ts";
import { qbError } from "./errors.ts";
import {
  digest,
  localDate,
  requireChangeId,
  requireDate,
  throwIfAborted,
  verifyBytes,
  withMutationQueues,
  writeExclusive,
} from "./operations.ts";
import {
  assertSafeFuturePath,
  ensureSafeDirectory,
  resolveProjectPaths,
  withRootLock,
} from "./paths.ts";
import type {
  ArchiveOptions,
  ArchiveResult,
  ParsedDocument,
  ServiceDependencies,
} from "./types.ts";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

interface Payload {
  document: ParsedDocument;
  name: "spec.md" | "plan.md";
  path: string;
  data: Buffer;
}

export async function archiveChange(
  options: ArchiveOptions,
  dependencies: ServiceDependencies,
): Promise<ArchiveResult> {
  requireChangeId(options.changeId);
  if (!options.verificationConfirmed) {
    throw qbError(
      "QB_VERIFICATION_REQUIRED",
      "Archive requires caller verification confirmation; a declaration is not independent evidence",
    );
  }
  const date = options.date ?? localDate();
  requireDate(date);
  const paths = await resolveProjectPaths(
    options.projectRoot,
    options.docsRoot,
  );
  const initial = await locateChange(paths, options.changeId);
  if (initial.state === "already_archived") {
    const folder = dirname(
      initial.documents.find((document) => document.kind === "spec")!.path,
    );
    return {
      status: "already_archived",
      changeId: options.changeId,
      path: folder,
      files: initial.documents.map((document) => document.path),
      verificationNote: "caller-attested; not independent evidence",
    };
  }
  const target = await assertSafeFuturePath(
    paths.root,
    join(paths.docs, "archive", date.slice(0, 4), options.changeId),
  );
  const predictedTargets = initial.documents.map((document) =>
    join(target, document.kind === "spec" ? "spec.md" : "plan.md"),
  );
  if (initial.documents.some((document) => document.status !== "active")) {
    throw qbError(
      "QB_INVALID_STATE",
      "Archive requires active spec and every separate plan",
    );
  }
  if (await exists(target))
    throw qbError("QB_ARCHIVE_CONFLICT", `Archive target exists: ${target}`);
  if (options.dryRun) {
    return {
      status: "dry_run",
      changeId: options.changeId,
      path: target,
      files: predictedTargets,
      verificationNote: "caller-attested; not independent evidence",
    };
  }
  const pending = join(target, ".qb-pending.json");
  const queuePaths = [
    join(paths.docs, LOCK_FILE),
    ...initial.documents.map((document) => document.path),
    target,
    ...predictedTargets,
    pending,
  ];

  return withMutationQueues(dependencies, queuePaths, async () =>
    withRootLock(paths, async () => {
      const located = await locateChange(paths, options.changeId);
      if (located.state === "already_archived") {
        const folder = dirname(
          located.documents.find((document) => document.kind === "spec")!.path,
        );
        return {
          status: "already_archived",
          changeId: options.changeId,
          path: folder,
          files: located.documents.map((document) => document.path),
          verificationNote: "caller-attested; not independent evidence",
        };
      }
      const initialPaths = initial.documents
        .map((document) => document.path)
        .sort();
      const currentPaths = located.documents
        .map((document) => document.path)
        .sort();
      if (
        initialPaths.length !== currentPaths.length ||
        initialPaths.some((path, index) => path !== currentPaths[index])
      ) {
        throw qbError(
          "QB_SOURCE_CHANGED",
          `Document set changed while waiting for mutation queues: ${options.changeId}`,
        );
      }
      if (located.documents.some((document) => document.status !== "active")) {
        throw qbError(
          "QB_INVALID_STATE",
          "Archive requires active spec and every separate plan",
        );
      }
      if (await exists(target))
        throw qbError(
          "QB_ARCHIVE_CONFLICT",
          `Archive target exists: ${target}`,
        );
      throwIfAborted(options.signal);
      await dependencies.fault?.("archive-before-commit", target);
      throwIfAborted(options.signal);
      const payloads: Payload[] = located.documents.map((document) => {
        const name =
          document.kind === "spec"
            ? ("spec.md" as const)
            : ("plan.md" as const);
        return {
          document,
          name,
          path: join(target, name),
          data: patchDocument(document, { status: "archived", updated: date }),
        };
      });
      await ensureSafeDirectory(paths.root, dirname(target));
      try {
        await mkdir(target, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
          throw qbError(
            "QB_ARCHIVE_CONFLICT",
            `Archive target exists: ${target}`,
          );
        throw error;
      }
      await dependencies.fault?.("archive-after-target", target);

      const journal = {
        version: 1,
        id: options.changeId,
        files: payloads.map((payload) => ({
          source: relative(paths.root, payload.document.path),
          target: payload.name,
          source_sha256: digest(payload.document.raw),
          target_sha256: digest(payload.data),
        })),
      };
      await writeExclusive(pending, `${JSON.stringify(journal, null, 2)}\n`);
      await dependencies.fault?.("archive-after-journal", pending);

      for (const payload of payloads) {
        await writeExclusive(payload.path, payload.data);
        await dependencies.fault?.("archive-after-copy", payload.path);
        await verifyBytes(payload.path, payload.data);
      }
      await dependencies.fault?.("archive-after-copies", target);
      for (const payload of payloads)
        await assertDocumentUnchanged(payload.document);
      for (const payload of payloads) {
        await assertDocumentUnchanged(payload.document);
        await unlink(payload.document.path);
        await dependencies.fault?.(
          "archive-after-delete",
          payload.document.path,
        );
      }
      await unlink(pending);
      await dependencies.fault?.("archive-after-complete", target);
      return {
        status: "archived",
        changeId: options.changeId,
        path: target,
        files: payloads.map((payload) => payload.path),
        verificationNote: "caller-attested; not independent evidence",
      };
    }),
  );
}
