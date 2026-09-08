import { open, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  CHANGE_ID_PATTERN,
  CHANGE_TYPES,
  STATUSES,
  TIERS,
} from "./constants.ts";
import { qbError } from "./errors.ts";
import type {
  Category,
  ChangeType,
  DocumentKind,
  ParsedDocument,
  Status,
  Tier,
} from "./types.ts";

const REQUIRED_FIELDS = [
  "id",
  "type",
  "tier",
  "status",
  "created",
  "updated",
] as const;
const SCALAR_PATTERN = /^[A-Za-z0-9-]+$/;

function scalar(fields: Record<string, string>, key: string): string {
  const raw = fields[key];
  if (raw === undefined)
    throw qbError("QB_FRONTMATTER", `Missing metadata field: ${key}`);
  const value =
    raw.length >= 2 &&
    raw[0] === raw.at(-1) &&
    (raw[0] === '"' || raw[0] === "'")
      ? raw.slice(1, -1)
      : raw;
  if (!SCALAR_PATTERN.test(value))
    throw qbError("QB_FRONTMATTER", `Unsupported scalar syntax for ${key}`);
  return value;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export async function parseDocument(
  path: string,
  category: Category,
  kind: DocumentKind,
): Promise<ParsedDocument> {
  const raw = await readFile(path);
  const bom = raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      bom ? raw.subarray(3) : raw,
    );
  } catch (error) {
    throw qbError(
      "QB_FRONTMATTER",
      `Document is not valid UTF-8: ${path}`,
      error,
    );
  }
  const lines =
    text.match(/.*(?:\r\n|\n|$)/g)?.filter((line) => line.length > 0) ?? [];
  if (lines.length === 0 || lines[0]!.trim() !== "---") {
    throw qbError("QB_FRONTMATTER", `Missing frontmatter: ${path}`);
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (end < 0) throw qbError("QB_FRONTMATTER", `Unclosed frontmatter: ${path}`);

  const fields: Record<string, string> = {};
  const positions: Record<string, number> = {};
  for (let index = 1; index < end; index += 1) {
    const match = /^([A-Za-z_][\w-]*):[ \t]*(.*?)(?:\r?\n)?$/.exec(
      lines[index]!,
    );
    if (!match) continue;
    const key = match[1]!;
    if (fields[key] !== undefined)
      throw qbError("QB_FRONTMATTER", `Duplicate metadata key ${key}: ${path}`);
    fields[key] = match[2]!;
    positions[key] = index;
  }
  for (const key of REQUIRED_FIELDS) scalar(fields, key);
  const id = scalar(fields, "id");
  const type = scalar(fields, "type") as ChangeType;
  const tier = scalar(fields, "tier") as Tier;
  const status = scalar(fields, "status") as Status;
  const created = scalar(fields, "created");
  const updated = scalar(fields, "updated");
  if (!CHANGE_ID_PATTERN.test(id))
    throw qbError("QB_INVALID_CHANGE_ID", `Invalid change id in ${path}`);
  if (!(CHANGE_TYPES as readonly string[]).includes(type))
    throw qbError("QB_FRONTMATTER", `Invalid change type in ${path}`);
  if (!(TIERS as readonly string[]).includes(tier))
    throw qbError("QB_FRONTMATTER", `Invalid tier in ${path}`);
  if (!(STATUSES as readonly string[]).includes(status))
    throw qbError("QB_INVALID_STATE", `Unsupported lifecycle state in ${path}`);
  if (!validDate(created) || !validDate(updated))
    throw qbError("QB_FRONTMATTER", `Invalid lifecycle date in ${path}`);
  return {
    path,
    category,
    kind,
    raw,
    text,
    bom,
    lines,
    fields,
    positions,
    id,
    type,
    tier,
    status,
    created,
    updated,
    stat: await stat(path),
  };
}

export function patchDocument(
  document: ParsedDocument,
  changes: Partial<Record<"status" | "updated", string>>,
): Buffer {
  const lines = [...document.lines];
  for (const [key, value] of Object.entries(changes)) {
    const index = document.positions[key];
    if (index === undefined)
      throw qbError("QB_FRONTMATTER", `Missing metadata field: ${key}`);
    const old = lines[index]!;
    const ending = old.endsWith("\r\n")
      ? "\r\n"
      : old.endsWith("\n")
        ? "\n"
        : "";
    lines[index] = `${key}: ${value}${ending}`;
  }
  const encoded = Buffer.from(lines.join(""), "utf8");
  return document.bom
    ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), encoded])
    : encoded;
}

export async function assertDocumentUnchanged(
  document: ParsedDocument,
): Promise<void> {
  const current = await readFile(document.path);
  if (!current.equals(document.raw))
    throw qbError(
      "QB_SOURCE_CHANGED",
      `Source changed during operation: ${document.path}`,
    );
}

export async function atomicReplace(
  document: ParsedDocument,
  data: Buffer,
): Promise<void> {
  await assertDocumentUnchanged(document);
  const temporary = join(dirname(document.path), `.qb-update-${randomUUID()}`);
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await assertDocumentUnchanged(document);
    await rename(temporary, document.path);
  } finally {
    await handle?.close();
    try {
      await unlink(temporary);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
