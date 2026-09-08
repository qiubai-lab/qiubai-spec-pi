import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { Status, Tier } from "../src/types.ts";

export const ID = "QB-20260908-fixture";

export interface Fixture {
  root: string;
  docs: string;
  cleanup(): Promise<void>;
  writeDocument(options?: {
    category?: "specs" | "plans";
    name?: string;
    id?: string;
    tier?: Tier;
    status?: Status;
    type?: "design" | "feature" | "bugfix";
    bom?: boolean;
    crlf?: boolean;
    body?: string;
  }): Promise<string>;
}

export async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), "qb pi 中文 "));
  const docs = join(root, "docs", "qb-spec");
  await mkdir(join(docs, "specs"), { recursive: true });
  await mkdir(join(docs, "plans"), { recursive: true });
  return {
    root,
    docs,
    cleanup: () => rm(root, { recursive: true, force: true }),
    async writeDocument(options = {}) {
      const category = options.category ?? "specs";
      const name = options.name ?? (category === "specs" ? "change.md" : "plan.md");
      const newline = options.crlf === false ? "\n" : "\r\n";
      const body = options.body ?? [
        "# Fixture",
        "",
        "### REQ-001 — behavior",
        "",
        "### AC-001 [REQ-001]",
        "",
        "### TASK-001 [REQ-001, AC-001]",
        "",
        "### VER-001 [AC-001]",
        "",
        "status: active remains body text",
        "",
      ].join(newline);
      const text = [
        "---",
        `id: ${options.id ?? ID}`,
        `type: ${options.type ?? "design"}`,
        `tier: ${options.tier ?? "standard"}`,
        `status: ${options.status ?? "active"}`,
        "created: 2026-09-08",
        "updated: 2026-09-08",
        "supersedes: []",
        "custom: keep me",
        "---",
        body,
      ].join(newline);
      const path = join(docs, category, name);
      await mkdir(join(docs, category), { recursive: true });
      const bytes = Buffer.from(text, "utf8");
      await writeFile(path, options.bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]) : bytes);
      return path;
    },
  };
}

export async function treeHash(root: string): Promise<string> {
  const hash = createHash("sha256");
  const walk = async (directory: string): Promise<void> => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      hash.update(relative(root, path));
      if (entry.isDirectory()) await walk(path);
      else hash.update(await readFile(path));
    }
  };
  await walk(root);
  return hash.digest("hex");
}
