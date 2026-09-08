import { access, lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  CHANGE_ID_PATTERN,
  LOCK_FILE,
  MAX_DOCTOR_LIMIT,
  PENDING_FILE,
} from "./constants.ts";
import { listFiles, validateArchivedDocuments } from "./discovery.ts";
import { QbError, qbError } from "./errors.ts";
import { parseDocument } from "./frontmatter.ts";
import { assertSafeExistingPath, resolveProjectPaths } from "./paths.ts";
import { analyzePendingJournal, findRecoveryJournals } from "./recovery.ts";
import type {
  Category,
  Diagnostic,
  DoctorOptions,
  DoctorResult,
  ParsedDocument,
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

function add(findings: Diagnostic[], finding: Diagnostic): void {
  findings.push(finding);
}

function definitionIds(
  text: string,
  prefix: "REQ" | "AC" | "TASK" | "VER",
): Set<string> {
  const pattern = new RegExp(
    `^(?:#{1,6}\\s+|[-*]\\s+(?:\\*\\*)?|[|]\\s*)(?:\\*\\*)?(${prefix}-\\d{3})\\b`,
    "gm",
  );
  return new Set([...text.matchAll(pattern)].map((match) => match[1]!));
}

function referencedIds(
  text: string,
  prefix: "REQ" | "AC" | "TASK" | "VER",
): Set<string> {
  return new Set(
    [...text.matchAll(new RegExp(`\\b(${prefix}-\\d{3})\\b`, "g"))].map(
      (match) => match[1]!,
    ),
  );
}

function checkTrace(documents: ParsedDocument[], findings: Diagnostic[]): void {
  const spec = documents.find((document) => document.kind === "spec");
  if (!spec) return;
  const combined = documents.map((document) => document.text).join("\n");
  const required =
    spec.tier === "strict"
      ? (["REQ", "AC", "TASK", "VER"] as const)
      : spec.tier === "standard"
        ? (["REQ", "AC"] as const)
        : [];
  for (const prefix of ["REQ", "AC", "TASK", "VER"] as const) {
    const definitions = definitionIds(combined, prefix);
    const references = referencedIds(combined, prefix);
    if (
      (required as readonly string[]).includes(prefix) &&
      definitions.size === 0
    ) {
      add(findings, {
        code: "TRACE_MISSING_KIND",
        severity: "error",
        message: `${spec.tier} change has no ${prefix} definitions`,
        path: spec.path,
        changeId: spec.id,
      });
    }
    for (const id of references) {
      if (!definitions.has(id))
        add(findings, {
          code: "TRACE_UNDEFINED",
          severity: "error",
          message: `${id} is referenced but not defined`,
          path: spec.path,
          changeId: spec.id,
        });
    }
  }
}

async function archiveLeafDirectories(
  root: string,
  archiveRoot: string,
  findings: Diagnostic[],
): Promise<string[]> {
  if (!(await exists(archiveRoot))) return [];
  const leaves: string[] = [];
  for (const year of await readdir(archiveRoot, { withFileTypes: true })) {
    const yearPath = join(archiveRoot, year.name);
    try {
      if ((await lstat(yearPath)).isSymbolicLink()) {
        add(findings, {
          code: "PATH_LINK",
          severity: "error",
          message: "Archive tree contains a link",
          path: yearPath,
        });
        continue;
      }
      await assertSafeExistingPath(root, yearPath);
      if (!year.isDirectory()) continue;
      for (const entry of await readdir(yearPath, { withFileTypes: true })) {
        const leaf = join(yearPath, entry.name);
        if ((await lstat(leaf)).isSymbolicLink()) {
          add(findings, {
            code: "PATH_LINK",
            severity: "error",
            message: "Archive tree contains a link",
            path: leaf,
          });
          continue;
        }
        await assertSafeExistingPath(root, leaf);
        if (entry.isDirectory()) leaves.push(leaf);
      }
    } catch (error) {
      add(findings, {
        code: "PATH_UNSAFE",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
        path: yearPath,
      });
    }
  }
  return leaves;
}

export async function doctor(options: DoctorOptions): Promise<DoctorResult> {
  const paths = await resolveProjectPaths(
    options.projectRoot,
    options.docsRoot,
  );
  if (
    options.changeId !== undefined &&
    !CHANGE_ID_PATTERN.test(options.changeId)
  ) {
    throw qbError(
      "QB_INVALID_CHANGE_ID",
      `Invalid change id: ${options.changeId}`,
    );
  }
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_DOCTOR_LIMIT
  ) {
    throw qbError(
      "QB_INVALID_ARGUMENT",
      `offset must be >= 0 and limit must be 1..${MAX_DOCTOR_LIMIT}`,
    );
  }

  const findings: Diagnostic[] = [];
  const documents: ParsedDocument[] = [];
  try {
    for (const path of await findRecoveryJournals(paths, options.changeId)) {
      const folderId = basename(dirname(path));
      const analysis = await analyzePendingJournal(paths, path);
      if (
        options.changeId === undefined ||
        analysis.changeId === options.changeId ||
        folderId === options.changeId
      ) {
        add(findings, {
          code: "RECOVERY_PENDING",
          severity: "error",
          message: `Pending archive is ${analysis.state}; allowed actions: ${analysis.allowedActions.join(", ") || "none"}`,
          path,
          changeId: analysis.changeId,
          recovery: {
            state: analysis.state,
            journalSha256: analysis.journalSha256,
            allowedActions: analysis.allowedActions,
          },
        });
      }
    }
  } catch (error) {
    add(findings, {
      code: error instanceof QbError ? error.code : "SCAN_FAILED",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      path: join(paths.docs, "archive"),
    });
  }
  for (const category of ["specs", "plans", "archive"] as const) {
    let files: string[] = [];
    try {
      files = await listFiles(paths, category);
    } catch (error) {
      add(findings, {
        code: error instanceof QbError ? error.code : "SCAN_FAILED",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
        path: join(paths.docs, category),
      });
      continue;
    }
    for (const path of files) {
      if (basename(path) === PENDING_FILE) continue;
      try {
        const kind =
          category === "plans" || basename(path) === "plan.md"
            ? "plan"
            : "spec";
        const document = await parseDocument(path, category, kind);
        if (options.changeId === undefined || document.id === options.changeId)
          documents.push(document);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          options.changeId === undefined ||
          message.includes(options.changeId) ||
          (await readFile(path, "utf8")).includes(options.changeId)
        ) {
          add(findings, {
            code: error instanceof QbError ? error.code : "FRONTMATTER",
            severity: "error",
            message,
            path,
          });
        }
      }
    }
  }

  if (await exists(join(paths.docs, LOCK_FILE))) {
    add(findings, {
      code: "LOCK_PRESENT",
      severity: "error",
      message: "Operation lock exists; diagnose before retry",
      path: join(paths.docs, LOCK_FILE),
    });
  }

  const byId = new Map<string, ParsedDocument[]>();
  for (const document of documents)
    byId.set(document.id, [...(byId.get(document.id) ?? []), document]);
  for (const [changeId, group] of byId) {
    const specs = group.filter((document) => document.category === "specs");
    const plans = group.filter((document) => document.category === "plans");
    const archived = group.filter(
      (document) => document.category === "archive",
    );
    if (archived.length > 0) {
      const archiveSpecs = archived.filter(
        (document) =>
          document.kind === "spec" && basename(document.path) === "spec.md",
      );
      if (archiveSpecs.length > 1) {
        add(findings, {
          code: "DUPLICATE_ARCHIVE_ID",
          severity: "error",
          message: "Change id has multiple archived spec.md files",
          path: archiveSpecs[0]!.path,
          changeId,
        });
      }
      try {
        validateArchivedDocuments(archived, changeId);
      } catch (error) {
        add(findings, {
          code: "ARCHIVE_SHAPE",
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
          path: archived[0]!.path,
          changeId,
        });
      }
    }
    if (specs.length > 1 || plans.length > 1)
      add(findings, {
        code: "DUPLICATE_ACTIVE_ID",
        severity: "error",
        message: "Duplicate active change id",
        changeId,
      });
    if ((specs.length > 0 || plans.length > 0) && archived.length > 0)
      add(findings, {
        code: "ACTIVE_ARCHIVE_CONFLICT",
        severity: "error",
        message: "Active and archived documents coexist",
        changeId,
      });
    if (plans.length > 0 && specs.length === 0)
      add(findings, {
        code: "ORPHAN_PLAN",
        severity: "error",
        message: "Plan has no active spec",
        path: plans[0]!.path,
        changeId,
      });
    const active = [...specs, ...plans];
    for (const document of active.filter(
      (candidate) => candidate.status === "archived",
    )) {
      add(findings, {
        code: "ACTIVE_STATUS_INVALID",
        severity: "error",
        message: "Document below specs/plans must not have archived status",
        path: document.path,
        changeId,
      });
    }
    const primary =
      specs[0] ?? archived.find((document) => document.kind === "spec");
    if (primary) {
      const comparable = archived.length > 0 ? archived : active;
      if (
        comparable.some(
          (document) =>
            document.id !== primary.id ||
            document.type !== primary.type ||
            document.tier !== primary.tier,
        )
      ) {
        add(findings, {
          code: "METADATA_MISMATCH",
          severity: "error",
          message: "Spec/plan id, type, or tier mismatch",
          changeId,
        });
      }
      if (
        primary.tier === "strict" &&
        !comparable.some((document) => document.kind === "plan")
      ) {
        add(findings, {
          code: "STRICT_PLAN_MISSING",
          severity: "error",
          message: "Strict change requires a separate plan",
          path: primary.path,
          changeId,
        });
      }
      if (
        active.length > 1 &&
        new Set(active.map((document) => document.status)).size > 1
      ) {
        add(findings, {
          code: "LIFECYCLE_SYNC_NEEDED",
          severity: "warning",
          message:
            "Documents have individually valid but different lifecycle states",
          changeId,
        });
      }
      if (archived.some((document) => document.status !== "archived")) {
        add(findings, {
          code: "ARCHIVE_STATUS",
          severity: "error",
          message: "Archived document does not have archived status",
          changeId,
        });
      }
      checkTrace(comparable, findings);
    }
  }

  for (const leaf of await archiveLeafDirectories(
    paths.root,
    join(paths.docs, "archive"),
    findings,
  )) {
    const entries = await readdir(leaf);
    if (!entries.includes("spec.md")) {
      const id = basename(leaf);
      if (options.changeId === undefined || id === options.changeId) {
        add(findings, {
          code: "PARTIAL_ARCHIVE",
          severity: "error",
          message: "Archive directory has no spec.md",
          path: leaf,
          ...(CHANGE_ID_PATTERN.test(id) ? { changeId: id } : {}),
        });
      }
    }
  }

  findings.sort((left, right) =>
    `${left.changeId ?? ""}\0${left.code}\0${left.path ?? ""}`.localeCompare(
      `${right.changeId ?? ""}\0${right.code}\0${right.path ?? ""}`,
    ),
  );
  const total = findings.length;
  const page = findings.slice(offset, offset + limit);
  const nextOffset = offset + page.length < total ? offset + page.length : null;
  return {
    status: total === 0 ? "ok" : "findings",
    docsRoot: paths.docs,
    total,
    offset,
    limit,
    nextOffset,
    findings: page,
  };
}
