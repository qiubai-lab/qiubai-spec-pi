import { access, lstat, readFile, readdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { CHANGE_ID_PATTERN, MAX_SCAN_ENTRIES, PENDING_FILE } from "./constants.ts";
import { qbError } from "./errors.ts";
import { digest, requireChangeId } from "./operations.ts";
import {
  assertSafeExistingPath,
  assertSafeFuturePath,
  type ProjectPaths,
} from "./paths.ts";
import type {
  RecoveryAction,
  RecoveryAnalysis,
  RecoveryFileAnalysis,
  RecoveryFileState,
} from "./types.ts";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface RecoveryJournalFile {
  source: string;
  target: "spec.md" | "plan.md";
  source_sha256: string;
  target_sha256: string;
}

export interface RecoveryJournal {
  version: 1;
  id: string;
  files: RecoveryJournalFile[];
}

export function isSha256(value: string): boolean {
  return HASH_PATTERN.test(value);
}

export async function recoveryPathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function issueAnalysis(
  changeId: string,
  journalPath: string,
  journalSha256: string,
  issues: string[],
): RecoveryAnalysis {
  return {
    changeId,
    state: "ambiguous",
    journalPath,
    journalSha256,
    targetDirectory: dirname(journalPath),
    allowedActions: [],
    files: [],
    issues,
  };
}

export function parseRecoveryJournal(
  raw: Buffer,
  journalPath: string,
  expectedId?: string,
): RecoveryJournal {
  let value: unknown;
  try {
    value = JSON.parse(raw.toString("utf8"));
  } catch {
    throw qbError("QB_RECOVERY_AMBIGUOUS", `Malformed recovery journal: ${journalPath}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw qbError("QB_RECOVERY_AMBIGUOUS", `Invalid recovery journal object: ${journalPath}`);
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== "string" ||
    !CHANGE_ID_PATTERN.test(candidate.id) ||
    (expectedId !== undefined && candidate.id !== expectedId) ||
    !Array.isArray(candidate.files) ||
    candidate.files.length < 1 ||
    candidate.files.length > 2
  )
    throw qbError("QB_RECOVERY_AMBIGUOUS", `Invalid recovery journal header: ${journalPath}`);

  const files: RecoveryJournalFile[] = [];
  for (const entry of candidate.files) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw qbError("QB_RECOVERY_AMBIGUOUS", `Invalid recovery journal entry: ${journalPath}`);
    const item = entry as Record<string, unknown>;
    if (
      typeof item.source !== "string" ||
      (item.target !== "spec.md" && item.target !== "plan.md") ||
      typeof item.source_sha256 !== "string" ||
      typeof item.target_sha256 !== "string" ||
      !isSha256(item.source_sha256) ||
      !isSha256(item.target_sha256)
    )
      throw qbError("QB_RECOVERY_AMBIGUOUS", `Invalid recovery journal entry fields: ${journalPath}`);
    files.push({
      source: item.source,
      target: item.target,
      source_sha256: item.source_sha256,
      target_sha256: item.target_sha256,
    });
  }
  if (
    new Set(files.map((file) => file.source)).size !== files.length ||
    new Set(files.map((file) => file.target)).size !== files.length ||
    !files.some((file) => file.target === "spec.md")
  )
    throw qbError("QB_RECOVERY_AMBIGUOUS", `Duplicate or missing recovery payload: ${journalPath}`);
  return { version: 1, id: candidate.id, files };
}

async function fileState(
  path: string,
  expectedHash: string,
  root: string,
): Promise<RecoveryFileState> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) return "changed";
    await assertSafeExistingPath(root, path);
    return digest(await readFile(path)) === expectedHash ? "matching" : "changed";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await assertSafeFuturePath(root, path);
      return "missing";
    }
    throw error;
  }
}

function resolveSource(paths: ProjectPaths, source: string, target: string): string {
  if (isAbsolute(source))
    throw qbError("QB_RECOVERY_AMBIGUOUS", "Recovery source must be project-relative");
  const absolute = resolve(paths.root, source);
  const expectedFolder = target === "spec.md" ? join(paths.docs, "specs") : join(paths.docs, "plans");
  if (!isInside(expectedFolder, absolute) || !absolute.endsWith(".md"))
    throw qbError("QB_RECOVERY_AMBIGUOUS", `Recovery source has unexpected location: ${source}`);
  return absolute;
}

export async function analyzePendingJournal(
  paths: ProjectPaths,
  journalPath: string,
  expectedId?: string,
): Promise<RecoveryAnalysis> {
  await assertSafeExistingPath(paths.root, journalPath);
  const raw = await readFile(journalPath);
  const journalSha256 = digest(raw);
  let journal: RecoveryJournal;
  try {
    journal = parseRecoveryJournal(raw, journalPath, expectedId);
  } catch (error) {
    return issueAnalysis(
      expectedId ?? basename(dirname(journalPath)),
      journalPath,
      journalSha256,
      [error instanceof Error ? error.message : String(error)],
    );
  }
  const targetDirectory = dirname(journalPath);
  const issues: string[] = [];
  if (basename(targetDirectory) !== journal.id)
    issues.push("Journal id does not match archive directory");
  if (!/^\d{4}$/.test(basename(dirname(targetDirectory))))
    issues.push("Archive year directory is invalid");

  const files: RecoveryFileAnalysis[] = [];
  for (const item of journal.files) {
    let source: string;
    try {
      source = resolveSource(paths, item.source, item.target);
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const target = join(targetDirectory, item.target);
    files.push({
      kind: item.target === "spec.md" ? "spec" : "plan",
      source,
      target,
      sourceState: await fileState(source, item.source_sha256, paths.root),
      targetState: await fileState(target, item.target_sha256, paths.root),
    });
  }

  const expectedEntries = new Set([PENDING_FILE, ...journal.files.map((file) => file.target)]);
  for (const entry of await readdir(targetDirectory, { withFileTypes: true })) {
    if (!expectedEntries.has(entry.name)) issues.push(`Unexpected archive entry: ${entry.name}`);
    if (entry.isSymbolicLink()) issues.push(`Archive entry is a link: ${entry.name}`);
  }
  if (files.length !== journal.files.length) issues.push("Not every journal file has a safe path");

  const noIssues = issues.length === 0;
  const canComplete =
    noIssues &&
    files.every((file) => file.targetState === "matching") &&
    files.every((file) => file.sourceState !== "changed");
  const canRestore =
    noIssues &&
    files.every((file) => file.sourceState === "matching") &&
    files.every((file) => file.targetState !== "changed");
  const allowedActions: RecoveryAction[] = [
    ...(canComplete ? (["complete"] as const) : []),
    ...(canRestore ? (["restore"] as const) : []),
  ];
  const state =
    allowedActions.length === 2
      ? "choice_required"
      : allowedActions[0] === "complete"
        ? "safe_to_complete"
        : allowedActions[0] === "restore"
          ? "safe_to_restore"
          : "ambiguous";
  return {
    changeId: journal.id,
    state,
    journalPath,
    journalSha256,
    targetDirectory,
    allowedActions,
    files,
    issues,
  };
}

export async function findRecoveryJournals(
  paths: ProjectPaths,
  changeId?: string,
): Promise<string[]> {
  const archiveRoot = join(paths.docs, "archive");
  if (!(await recoveryPathExists(archiveRoot))) return [];
  await assertSafeExistingPath(paths.root, archiveRoot);
  const journals: string[] = [];
  let visited = 0;
  for (const year of await readdir(archiveRoot, { withFileTypes: true })) {
    if (++visited > MAX_SCAN_ENTRIES)
      throw qbError("QB_INVALID_ARGUMENT", `Archive tree exceeds ${MAX_SCAN_ENTRIES} entries`);
    const yearPath = join(archiveRoot, year.name);
    const yearInfo = await lstat(yearPath);
    if (yearInfo.isSymbolicLink())
      throw qbError("QB_PATH_UNSAFE", `Archive tree contains a link: ${yearPath}`);
    if (!yearInfo.isDirectory()) continue;
    await assertSafeExistingPath(paths.root, yearPath);
    for (const entry of await readdir(yearPath, { withFileTypes: true })) {
      if (++visited > MAX_SCAN_ENTRIES)
        throw qbError("QB_INVALID_ARGUMENT", `Archive tree exceeds ${MAX_SCAN_ENTRIES} entries`);
      if (changeId !== undefined && entry.name !== changeId) continue;
      const directory = join(yearPath, entry.name);
      const info = await lstat(directory);
      if (info.isSymbolicLink())
        throw qbError("QB_PATH_UNSAFE", `Archive tree contains a link: ${directory}`);
      if (!info.isDirectory()) continue;
      await assertSafeExistingPath(paths.root, directory);
      const journal = join(directory, PENDING_FILE);
      if (await recoveryPathExists(journal)) {
        await assertSafeExistingPath(paths.root, journal);
        journals.push(journal);
      }
    }
  }
  return journals.sort();
}

export async function analyzeRecovery(
  paths: ProjectPaths,
  changeId: string,
): Promise<RecoveryAnalysis> {
  requireChangeId(changeId);
  const pending = await findRecoveryJournals(paths, changeId);
  if (pending.length === 0)
    throw qbError("QB_NOT_FOUND", `No pending recovery journal: ${changeId}`);
  if (pending.length !== 1)
    throw qbError("QB_RECOVERY_AMBIGUOUS", `Multiple recovery journals: ${changeId}`);
  return analyzePendingJournal(paths, pending[0]!, changeId);
}

export async function verifyRecoverySnapshot(
  analysis: RecoveryAnalysis,
  action: RecoveryAction,
): Promise<RecoveryJournal> {
  const raw = await readFile(analysis.journalPath);
  if (digest(raw) !== analysis.journalSha256)
    throw qbError("QB_SOURCE_CHANGED", "Recovery journal changed during operation");
  const journal = parseRecoveryJournal(raw, analysis.journalPath, analysis.changeId);
  for (const file of analysis.files) {
    const entry = journal.files.find(
      (candidate) => join(analysis.targetDirectory, candidate.target) === file.target,
    );
    if (!entry)
      throw qbError("QB_RECOVERY_AMBIGUOUS", `Recovery payload changed: ${file.target}`);
    if (
      (action === "complete" || file.targetState === "matching") &&
      (!(await recoveryPathExists(file.target)) || digest(await readFile(file.target)) !== entry.target_sha256)
    )
      throw qbError("QB_SOURCE_CHANGED", `Recovery target changed: ${file.target}`);
    if (action === "restore" || file.sourceState === "matching") {
      if (
        !(await recoveryPathExists(file.source)) ||
        digest(await readFile(file.source)) !== entry.source_sha256
      )
        throw qbError("QB_SOURCE_CHANGED", `Recovery source changed: ${file.source}`);
    }
  }
  return journal;
}
