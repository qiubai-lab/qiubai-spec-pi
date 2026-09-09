import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { subagentFault } from "./errors.ts";

type PathKind = "file" | "directory";
interface AllowedPath { absolute: string; kind: PathKind }

function insideOrEqual(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

function validateRelative(input: string): void {
  if (!input.trim()) throw subagentFault("path_unsafe", "Path is required");
  if (input.includes("\0")) throw subagentFault("path_unsafe", "Path contains NUL");
  if (isAbsolute(input))
    throw subagentFault("path_unsafe", `Path must be project-relative: ${input}`);
  if (input.split(/[\\/]+/).includes(".."))
    throw subagentFault("path_unsafe", `Path contains parent traversal: ${input}`);
}

async function canonicalExisting(root: string, input: string): Promise<{ absolute: string; kind: PathKind }> {
  validateRelative(input);
  const absolute = resolve(root, input);
  if (!insideOrEqual(root, absolute))
    throw subagentFault("path_unsafe", `Path escapes project: ${input}`);
  const rel = relative(root, absolute);
  let current = root;
  for (const part of rel.split(sep).filter(Boolean)) {
    current = join(current, part);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      throw subagentFault("path_unsafe", `Path does not exist: ${input}`, error);
    }
    if (info.isSymbolicLink())
      throw subagentFault("path_unsafe", `Path traverses a link: ${input}`);
    const actual = await realpath(current);
    if (actual !== current)
      throw subagentFault("path_unsafe", `Path resolves through an alias: ${input}`);
  }
  const info = await lstat(absolute);
  const kind = info.isFile() ? "file" : info.isDirectory() ? "directory" : undefined;
  if (!kind)
    throw subagentFault("path_unsafe", `Path is not a regular file or directory: ${input}`);
  return { absolute, kind };
}

export class SafePathPolicy {
  readonly root: string;
  readonly allowed: readonly AllowedPath[];

  private constructor(root: string, allowed: AllowedPath[]) {
    this.root = root;
    this.allowed = allowed;
  }

  static async create(projectRoot: string, declaredPaths: readonly string[]): Promise<SafePathPolicy> {
    let root: string;
    try {
      root = await realpath(resolve(projectRoot));
    } catch (error) {
      throw subagentFault("path_unsafe", `Project root is unavailable: ${projectRoot}`, error);
    }
    const rootInfo = await lstat(root);
    if (!rootInfo.isDirectory())
      throw subagentFault("path_unsafe", `Project root is not a directory: ${root}`);
    const allowed: AllowedPath[] = [];
    for (const path of declaredPaths) allowed.push(await canonicalExisting(root, path));
    return new SafePathPolicy(root, allowed);
  }

  private async resolve(input: string, expected: PathKind): Promise<string> {
    const candidate = await canonicalExisting(this.root, input);
    if (candidate.kind !== expected)
      throw subagentFault("path_unsafe", `Path must be a ${expected}: ${input}`);
    const permitted = this.allowed.some((entry) =>
      entry.kind === "directory"
        ? insideOrEqual(entry.absolute, candidate.absolute)
        : entry.absolute === candidate.absolute,
    );
    if (!permitted)
      throw subagentFault("path_unsafe", `Path is outside the dispatch allowlist: ${input}`);
    return candidate.absolute;
  }

  async resolveAny(input: string): Promise<{ path: string; kind: PathKind }> {
    const candidate = await canonicalExisting(this.root, input);
    const permitted = this.allowed.some((entry) =>
      entry.kind === "directory"
        ? insideOrEqual(entry.absolute, candidate.absolute)
        : entry.absolute === candidate.absolute,
    );
    if (!permitted)
      throw subagentFault("path_unsafe", `Path is outside the dispatch allowlist: ${input}`);
    return { path: candidate.absolute, kind: candidate.kind };
  }

  resolveFile(input: string): Promise<string> {
    return this.resolve(input, "file");
  }

  resolveDirectory(input: string): Promise<string> {
    return this.resolve(input, "directory");
  }
}
