import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  stat,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { DEFAULT_DOCS_ROOT, LOCK_FILE } from "./constants.ts";
import { qbError } from "./errors.ts";

export interface ProjectPaths {
  root: string;
  docs: string;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

async function rejectLinkedSegments(
  root: string,
  candidate: string,
  allowMissing: boolean,
): Promise<void> {
  if (!isInside(root, candidate))
    throw qbError("QB_PATH_UNSAFE", `Path escapes project: ${candidate}`);
  const rel = relative(root, candidate);
  const parts = rel.split(sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]!);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink())
        throw qbError("QB_PATH_UNSAFE", `Path traverses a link: ${current}`);
      const actual = await realpath(current);
      if (actual !== current)
        throw qbError(
          "QB_PATH_UNSAFE",
          `Path resolves through an alias: ${current}`,
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && allowMissing)
        return;
      throw error;
    }
  }
}

export async function resolveProjectPaths(
  projectRoot: string,
  docsRoot = DEFAULT_DOCS_ROOT,
): Promise<ProjectPaths> {
  if (!projectRoot.trim())
    throw qbError("QB_INVALID_ARGUMENT", "projectRoot is required");
  if (isAbsolute(docsRoot))
    throw qbError("QB_PATH_UNSAFE", "docsRoot must be project-relative");
  const requestedRoot = resolve(projectRoot.replace(/^@/, ""));
  let root: string;
  try {
    root = await realpath(requestedRoot);
    if (!(await stat(root)).isDirectory())
      throw qbError(
        "QB_PATH_UNSAFE",
        `Project root is not a directory: ${root}`,
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw qbError(
        "QB_PATH_UNSAFE",
        `Project root does not exist: ${requestedRoot}`,
      );
    }
    throw error;
  }
  const docs = resolve(root, docsRoot.replace(/^@/, ""));
  try {
    await rejectLinkedSegments(root, docs, false);
    if (!(await stat(docs)).isDirectory())
      throw qbError(
        "QB_DOCS_NOT_FOUND",
        `Document root is not a directory: ${docs}`,
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw qbError(
        "QB_DOCS_NOT_FOUND",
        `Document root does not exist: ${docs}`,
      );
    throw error;
  }
  return { root, docs };
}

export async function assertSafeExistingPath(
  root: string,
  candidate: string,
): Promise<string> {
  const absolute = resolve(candidate);
  await rejectLinkedSegments(root, absolute, false);
  return absolute;
}

export async function assertSafeFuturePath(
  root: string,
  candidate: string,
): Promise<string> {
  const absolute = resolve(candidate);
  await rejectLinkedSegments(root, absolute, true);
  return absolute;
}

export async function ensureSafeDirectory(
  root: string,
  directory: string,
): Promise<void> {
  await assertSafeFuturePath(root, directory);
  await mkdir(directory, { recursive: true });
  await assertSafeExistingPath(root, directory);
}

export async function withRootLock<T>(
  paths: ProjectPaths,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = await assertSafeFuturePath(
    paths.root,
    join(paths.docs, LOCK_FILE),
  );
  const token = `${process.pid}:${randomUUID()}\n`;
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(token, "utf8");
    await handle.sync();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw qbError(
        "QB_LOCKED",
        `Operation lock exists; diagnose before retry: ${lockPath}`,
      );
    }
    throw error;
  } finally {
    await handle?.close();
  }
  try {
    return await operation();
  } finally {
    let current: string;
    try {
      current = await readFile(lockPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw qbError(
          "QB_LOCKED",
          `Operation lock disappeared during use: ${lockPath}`,
        );
      throw error;
    }
    if (current !== token)
      throw qbError(
        "QB_LOCKED",
        `Operation lock changed during use; preserved for diagnosis: ${lockPath}`,
      );
    await unlink(lockPath);
  }
}
