import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { SNAPSHOT } from "../src/constants.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const upstreamSnapshot = join(
  packageRoot,
  "upstream",
  "qiubai-spec-v0.6.0",
);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function sourceFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await sourceFiles(path)));
    else if (entry.name.endsWith(".ts")) result.push(path);
  }
  return result;
}

test("standalone manifest exposes the extension and workflow resources", async () => {
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  ) as {
    name: string;
    pi: Record<string, unknown>;
  };
  assert.equal(manifest.name, "qiubai-spec-pi");
  assert.deepEqual(manifest.pi, {
    extensions: ["./extensions/index.ts"],
    skills: ["./skills"],
    prompts: ["./prompts"],
  });
});

test("production TypeScript has no legacy Python/plugin runtime and child_process is confined to the verification runner", async () => {
  const files = [
    ...(await sourceFiles(join(packageRoot, "src"))),
    ...(await sourceFiles(join(packageRoot, "extensions"))),
  ];
  for (const path of files) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /qb_change\.py|plugins[\\/]qiubai-spec[\\/]/, relative(packageRoot, path));
    if (/node:child_process|spawn\s*\(|execFile\s*\(/.test(source)) {
      assert.equal(relative(packageRoot, path), "src/subagent/runner.ts");
      assert.match(source, /shell:\s*false/);
    }
  }
});

test("vendored qiubai-spec v0.6.0 snapshot retains the development contract", async () => {
  assert.equal(await exists(upstreamSnapshot), true);
  const manifest = JSON.parse(
    await readFile(join(upstreamSnapshot, ".codex-plugin", "plugin.json"), "utf8"),
  ) as { version: string };
  assert.equal(manifest.version, SNAPSHOT.version);
  const lifecycle = await readFile(
    join(
      upstreamSnapshot,
      "skills",
      "shaping-requirements",
      "references",
      "lifecycle-and-traceability.md",
    ),
    "utf8",
  );
  assert.match(
    lifecycle,
    /draft \| approved \| active \| archived \| superseded/,
  );
  assert.match(lifecycle, /strict.*require all four ID types/i);
  const changeTool = await readFile(
    join(
      upstreamSnapshot,
      "skills",
      "closing-qb-change",
      "references",
      "change-tool.md",
    ),
    "utf8",
  );
  assert.match(changeTool, /inspect.*update.*archive/s);
  assert.match(changeTool, /not.*proof|不是验证结果的证明/i);
  const pythonTests = await readFile(
    join(
      upstreamSnapshot,
      "skills",
      "closing-qb-change",
      "scripts",
      "test_qb_change.py",
    ),
    "utf8",
  );
  assert.equal([...pythonTests.matchAll(/^ {4}def test_/gm)].length, 14);
});
