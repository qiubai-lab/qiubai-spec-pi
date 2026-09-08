import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  CHANGE_ID_PATTERN,
  MAX_SCAN_ENTRIES,
  PENDING_FILE,
} from "./constants.ts";
import { qbError } from "./errors.ts";
import { assertSafeExistingPath, type ProjectPaths } from "./paths.ts";
import { parseDocument } from "./frontmatter.ts";
import type {
  Category,
  DocumentKind,
  LocatedChange,
  ParsedDocument,
} from "./types.ts";

export interface Inventory {
  specs: ParsedDocument[];
  plans: ParsedDocument[];
  archive: ParsedDocument[];
  pending: string[];
}

function kindFor(category: Category, path: string): DocumentKind {
  if (
    category === "plans" ||
    (category === "archive" && basename(path) === "plan.md")
  )
    return "plan";
  return "spec";
}

export async function listFiles(
  paths: ProjectPaths,
  category: Category,
): Promise<string[]> {
  const folder = join(paths.docs, category);
  try {
    await assertSafeExistingPath(paths.root, folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  const stack = [folder];
  let visited = 0;
  while (stack.length > 0) {
    const parent = stack.pop()!;
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      visited += 1;
      if (visited > MAX_SCAN_ENTRIES)
        throw qbError(
          "QB_INVALID_ARGUMENT",
          `Document tree exceeds ${MAX_SCAN_ENTRIES} entries`,
        );
      const candidate = join(parent, entry.name);
      const info = await lstat(candidate);
      if (info.isSymbolicLink())
        throw qbError(
          "QB_PATH_UNSAFE",
          `Document tree contains a link: ${candidate}`,
        );
      await assertSafeExistingPath(paths.root, candidate);
      if (info.isDirectory()) stack.push(candidate);
      else if (
        info.isFile() &&
        (candidate.endsWith(".md") || entry.name === PENDING_FILE)
      )
        files.push(candidate);
    }
  }
  return files.sort();
}

function quickIds(raw: Buffer): string[] {
  const text = raw.toString("utf8").replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return [];
  const end = text.indexOf("---", 3);
  if (end < 0) return [];
  const head = text.slice(3, end);
  return [...head.matchAll(/^id:[ \t]*["']?([^\r\n"']+)["']?[ \t]*$/gm)].map(
    (match) => match[1]!.trim(),
  );
}

export async function inventoryChange(
  paths: ProjectPaths,
  changeId: string,
): Promise<Inventory> {
  if (!CHANGE_ID_PATTERN.test(changeId))
    throw qbError("QB_INVALID_CHANGE_ID", `Invalid change id: ${changeId}`);
  const result: Inventory = { specs: [], plans: [], archive: [], pending: [] };
  for (const category of ["specs", "plans", "archive"] as const) {
    for (const path of await listFiles(paths, category)) {
      if (basename(path) === PENDING_FILE) {
        const raw = await readFile(path, "utf8");
        if (
          path.includes(
            `${join("", changeId)}${process.platform === "win32" ? "\\" : "/"}`,
          ) ||
          raw.includes(`"id": "${changeId}"`)
        ) {
          result.pending.push(path);
        }
        continue;
      }
      const raw = await readFile(path);
      if (!quickIds(raw).includes(changeId)) continue;
      result[category].push(
        await parseDocument(path, category, kindFor(category, path)),
      );
    }
  }
  return result;
}

function ensureCompatible(documents: ParsedDocument[]): void {
  const spec = documents.find((document) => document.kind === "spec");
  if (!spec) throw qbError("QB_INVALID_STATE", "Document set has no spec");
  for (const document of documents) {
    if (
      document.id !== spec.id ||
      document.type !== spec.type ||
      document.tier !== spec.tier
    ) {
      throw qbError(
        "QB_INVALID_STATE",
        `Spec/plan id, type, or tier mismatch for ${spec.id}`,
      );
    }
  }
}

/** Validate the one-directory archive shape shared by locate and doctor. */
export function validateArchivedDocuments(
  documents: ParsedDocument[],
  changeId: string,
): void {
  const specs = documents.filter(
    (document) =>
      document.kind === "spec" && basename(document.path) === "spec.md",
  );
  const plans = documents.filter(
    (document) =>
      document.kind === "plan" && basename(document.path) === "plan.md",
  );
  const folder = specs[0] ? dirname(specs[0].path) : undefined;
  const yearFolder = folder ? dirname(folder) : undefined;
  if (
    specs.length !== 1 ||
    plans.length > 1 ||
    documents.length !== specs.length + plans.length ||
    folder === undefined ||
    basename(folder) !== changeId ||
    yearFolder === undefined ||
    !/^\d{4}$/.test(basename(yearFolder)) ||
    documents.some(
      (document) =>
        dirname(document.path) !== folder || document.status !== "archived",
    )
  ) {
    throw qbError(
      "QB_RECOVERY_REQUIRED",
      `Incomplete, duplicate, or incompatible archive: ${changeId}`,
    );
  }
  ensureCompatible(documents);
  if (specs[0]!.tier === "strict" && plans.length !== 1) {
    throw qbError(
      "QB_RECOVERY_REQUIRED",
      `Strict archive missing plan: ${changeId}`,
    );
  }
}

export async function locateChange(
  paths: ProjectPaths,
  changeId: string,
): Promise<LocatedChange> {
  const found = await inventoryChange(paths, changeId);
  if (found.pending.length > 0) {
    throw qbError(
      "QB_RECOVERY_REQUIRED",
      `Recovery required; preserve sources and archive: ${found.pending[0]}`,
    );
  }
  if (found.specs.length > 1 || found.plans.length > 1) {
    throw qbError("QB_DUPLICATE", `Duplicate active change id: ${changeId}`);
  }
  if (found.archive.length > 0) {
    if (found.specs.length > 0 || found.plans.length > 0)
      throw qbError(
        "QB_ARCHIVE_CONFLICT",
        `Active/archive conflict: ${changeId}`,
      );
    validateArchivedDocuments(found.archive, changeId);
    return {
      state: "already_archived",
      changeId,
      documents: found.archive,
      syncNeeded: false,
    };
  }
  if (found.specs.length !== 1)
    throw qbError("QB_NOT_FOUND", `No unique active spec found: ${changeId}`);
  const documents = [...found.specs, ...found.plans];
  ensureCompatible(documents);
  if (found.specs[0]!.tier === "strict" && found.plans.length === 0) {
    throw qbError(
      "QB_INVALID_STATE",
      `Strict change requires a separate plan: ${changeId}`,
    );
  }
  const statuses = new Set(documents.map((document) => document.status));
  if (statuses.has("archived"))
    throw qbError(
      "QB_INVALID_STATE",
      `Active source has archived status: ${changeId}`,
    );
  return {
    state: "active",
    changeId,
    documents,
    syncNeeded: statuses.size > 1,
  };
}

export async function findUniqueActiveChangeId(
  paths: ProjectPaths,
): Promise<string> {
  const ids = new Set<string>();
  for (const path of await listFiles(paths, "specs")) {
    if (basename(path) === PENDING_FILE) continue;
    for (const id of quickIds(await readFile(path)))
      if (CHANGE_ID_PATTERN.test(id)) ids.add(id);
  }
  if (ids.size !== 1)
    throw qbError(
      "QB_NOT_FOUND",
      `Expected one active change, found ${ids.size}`,
    );
  return [...ids][0]!;
}
