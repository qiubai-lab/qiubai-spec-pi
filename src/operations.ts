import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { CHANGE_ID_PATTERN } from "./constants.ts";
import { qbError } from "./errors.ts";
import type { MutationQueue, ServiceDependencies } from "./types.ts";

export const DIRECT_QUEUE: MutationQueue = async <T>(_path: string, operation: () => Promise<T>) => operation();

export function requireChangeId(changeId: string): void {
  if (!CHANGE_ID_PATTERN.test(changeId)) throw qbError("QB_INVALID_CHANGE_ID", `Invalid change id: ${changeId}`);
}

export function localDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function requireDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw qbError("QB_INVALID_ARGUMENT", `Invalid date: ${value}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw qbError("QB_INVALID_ARGUMENT", `Invalid date: ${value}`);
  }
}

export function digest(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function writeExclusive(path: string, data: Uint8Array | string): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function verifyBytes(path: string, expected: Uint8Array): Promise<void> {
  const actual = await readFile(path);
  if (!actual.equals(expected)) throw qbError("QB_IO", `Written content verification failed: ${path}`);
}

export async function withMutationQueues<T>(
  dependencies: ServiceDependencies,
  paths: string[],
  operation: () => Promise<T>,
): Promise<T> {
  const ordered = [...new Set(paths)].sort((left, right) => left.localeCompare(right));
  const enter = (index: number): Promise<T> => {
    const path = ordered[index];
    if (path === undefined) return operation();
    return dependencies.withFileMutationQueue(path, () => enter(index + 1));
  };
  return enter(0);
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw qbError("QB_ABORTED", "Operation cancelled before persistent mutation");
}
