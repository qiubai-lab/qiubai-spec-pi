import { join } from "node:path";
import { LOCK_FILE } from "./constants.ts";
import { atomicReplace, patchDocument } from "./frontmatter.ts";
import { locateChange } from "./discovery.ts";
import { qbError } from "./errors.ts";
import {
  localDate,
  requireChangeId,
  requireDate,
  throwIfAborted,
  withMutationQueues,
} from "./operations.ts";
import { resolveProjectPaths, withRootLock } from "./paths.ts";
import type {
  ParsedDocument,
  ServiceDependencies,
  Status,
  TransitionOptions,
  TransitionResult,
} from "./types.ts";

const ALLOWED: Record<Status, ReadonlySet<Status>> = {
  draft: new Set(["draft", "approved"]),
  approved: new Set(["approved", "active"]),
  active: new Set(["active"]),
  archived: new Set(),
  superseded: new Set(),
};

function selectDocument(
  documents: ParsedDocument[],
  kind: TransitionOptions["document"],
): ParsedDocument {
  const selected = documents.find((document) => document.kind === kind);
  if (!selected)
    throw qbError(
      "QB_NOT_FOUND",
      kind === "plan" ? "No separate plan" : "No spec found",
    );
  return selected;
}

function validateTransition(
  document: ParsedDocument,
  options: TransitionOptions,
): void {
  if (!ALLOWED[document.status].has(options.status)) {
    throw qbError(
      "QB_INVALID_STATE",
      `Unsupported transition ${document.status} -> ${options.status}; archived only via archive`,
    );
  }
  if (document.status !== options.status && !options.authorizationDeclared) {
    throw qbError(
      "QB_AUTH_REQUIRED",
      "Lifecycle promotion requires caller authorization; a declaration is not independent evidence",
    );
  }
}

function resultFor(
  document: ParsedDocument,
  options: TransitionOptions,
  status: "updated" | "dry_run",
): TransitionResult {
  return {
    status,
    changeId: options.changeId,
    document: options.document,
    path: document.path,
    previousStatus: document.status,
    newStatus: options.status,
    authorizationNote: "caller-attested; not independent evidence",
  };
}

export async function transitionChange(
  options: TransitionOptions,
  dependencies: ServiceDependencies,
): Promise<TransitionResult> {
  requireChangeId(options.changeId);
  const date = options.date ?? localDate();
  requireDate(date);
  const paths = await resolveProjectPaths(
    options.projectRoot,
    options.docsRoot,
  );
  const initial = await locateChange(paths, options.changeId);
  if (initial.state === "already_archived")
    throw qbError("QB_INVALID_STATE", "Archived metadata is immutable");
  const initialDocument = selectDocument(initial.documents, options.document);
  validateTransition(initialDocument, options);
  if (options.dryRun) return resultFor(initialDocument, options, "dry_run");

  return withMutationQueues(
    dependencies,
    [join(paths.docs, LOCK_FILE), initialDocument.path],
    async () =>
      withRootLock(paths, async () => {
        const located = await locateChange(paths, options.changeId);
        if (located.state === "already_archived")
          throw qbError("QB_INVALID_STATE", "Archived metadata is immutable");
        const document = selectDocument(located.documents, options.document);
        if (document.path !== initialDocument.path) {
          throw qbError(
            "QB_SOURCE_CHANGED",
            `Document path changed while waiting for mutation queue: ${options.changeId}`,
          );
        }
        validateTransition(document, options);
        const result = resultFor(document, options, "updated");
        throwIfAborted(options.signal);
        await dependencies.fault?.("transition-before-write", document.path);
        throwIfAborted(options.signal);
        await atomicReplace(
          document,
          patchDocument(document, { status: options.status, updated: date }),
        );
        await dependencies.fault?.("transition-after-write", document.path);
        return result;
      }),
  );
}
