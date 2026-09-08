import { readFile, rmdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LOCK_FILE } from "./constants.ts";
import { locateChange } from "./discovery.ts";
import { qbError } from "./errors.ts";
import { digest, requireChangeId, throwIfAborted, withMutationQueues } from "./operations.ts";
import { resolveProjectPaths, withRootLock } from "./paths.ts";
import {
  analyzeRecovery,
  isSha256,
  recoveryPathExists,
  verifyRecoverySnapshot,
} from "./recovery-analysis.ts";
export {
  analyzePendingJournal,
  analyzeRecovery,
  findRecoveryJournals,
} from "./recovery-analysis.ts";

import type {
  RecoverOptions,
  RecoverResult,
  ServiceDependencies,
} from "./types.ts";

function result(
  options: RecoverOptions,
  status: RecoverResult["status"],
  path: string,
  journalSha256: string | null,
  files: string[],
): RecoverResult {
  return {
    status,
    changeId: options.changeId,
    action: options.action,
    path,
    journalSha256,
    files,
    authorizationNote: "caller-attested; not independent evidence",
  };
}

async function idempotentResult(
  paths: Awaited<ReturnType<typeof resolveProjectPaths>>,
  options: RecoverOptions,
): Promise<RecoverResult> {
  try {
    const located = await locateChange(paths, options.changeId);
    if (options.action === "complete" && located.state === "already_archived")
      return result(
        options,
        "already_completed",
        dirname(located.documents[0]!.path),
        null,
        located.documents.map((document) => document.path),
      );
    if (options.action === "restore" && located.state === "active")
      return result(
        options,
        "already_restored",
        paths.docs,
        null,
        located.documents.map((document) => document.path),
      );
  } catch {
    // Prefer one stable recovery error over an unrelated locate failure.
  }
  throw qbError(
    "QB_NOT_FOUND",
    `No recoverable or already recovered change: ${options.changeId}`,
  );
}

export async function recoverChange(
  options: RecoverOptions,
  dependencies: ServiceDependencies,
): Promise<RecoverResult> {
  requireChangeId(options.changeId);
  if (!isSha256(options.expectedJournalSha256))
    throw qbError(
      "QB_INVALID_ARGUMENT",
      "expectedJournalSha256 must be a lowercase SHA-256 hex digest",
    );
  if (!options.authorizationDeclared)
    throw qbError(
      "QB_AUTH_REQUIRED",
      "Recovery action requires caller authorization; a declaration is not independent evidence",
    );
  const paths = await resolveProjectPaths(options.projectRoot, options.docsRoot);
  let initial;
  try {
    initial = await analyzeRecovery(paths, options.changeId);
  } catch (error) {
    if ((error as { code?: string }).code === "QB_NOT_FOUND")
      return idempotentResult(paths, options);
    throw error;
  }
  if (initial.journalSha256 !== options.expectedJournalSha256)
    throw qbError(
      "QB_SOURCE_CHANGED",
      "Recovery journal hash does not match expectedJournalSha256",
    );
  if (!initial.allowedActions.includes(options.action))
    throw qbError(
      "QB_RECOVERY_AMBIGUOUS",
      `${options.action} is not mechanically safe in recovery state ${initial.state}`,
    );
  const affected = initial.files.flatMap((file) => [file.source, file.target]);
  if (options.dryRun)
    return result(
      options,
      "dry_run",
      initial.targetDirectory,
      initial.journalSha256,
      affected,
    );

  const queuePaths = [
    join(paths.docs, LOCK_FILE),
    initial.journalPath,
    initial.targetDirectory,
    ...affected,
  ];
  return withMutationQueues(dependencies, queuePaths, () =>
    withRootLock(paths, async () => {
      const current = await analyzeRecovery(paths, options.changeId);
      if (current.journalSha256 !== options.expectedJournalSha256)
        throw qbError(
          "QB_SOURCE_CHANGED",
          "Recovery journal changed while waiting for mutation queues",
        );
      if (!current.allowedActions.includes(options.action))
        throw qbError(
          "QB_RECOVERY_AMBIGUOUS",
          `${options.action} is no longer mechanically safe in recovery state ${current.state}`,
        );
      throwIfAborted(options.signal);
      await dependencies.fault?.(
        "recovery-before-commit",
        current.targetDirectory,
      );
      throwIfAborted(options.signal);
      const journal = await verifyRecoverySnapshot(current, options.action);

      if (options.action === "complete") {
        for (const file of current.files) {
          if (await recoveryPathExists(file.source)) {
            const entry = journal.files.find(
              (candidate) =>
                join(current.targetDirectory, candidate.target) === file.target,
            )!;
            if (digest(await readFile(file.source)) !== entry.source_sha256)
              throw qbError(
                "QB_SOURCE_CHANGED",
                `Recovery source changed: ${file.source}`,
              );
            await unlink(file.source);
            await dependencies.fault?.(
              "recovery-after-delete-source",
              file.source,
            );
          }
        }
        await unlink(current.journalPath);
        await dependencies.fault?.(
          "recovery-after-complete",
          current.targetDirectory,
        );
        return result(
          options,
          "completed",
          current.targetDirectory,
          current.journalSha256,
          current.files.map((file) => file.target),
        );
      }

      for (const file of current.files) {
        if (await recoveryPathExists(file.target)) {
          await unlink(file.target);
          await dependencies.fault?.(
            "recovery-after-delete-target",
            file.target,
          );
        }
      }
      await unlink(current.journalPath);
      await rmdir(current.targetDirectory);
      await dependencies.fault?.(
        "recovery-after-restore",
        current.targetDirectory,
      );
      return result(
        options,
        "restored",
        current.targetDirectory,
        current.journalSha256,
        current.files.map((file) => file.source),
      );
    }),
  );
}
