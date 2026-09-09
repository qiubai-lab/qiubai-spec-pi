import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import type { ArtifactStore } from "./artifacts.ts";
import { subagentFault } from "./errors.ts";
import type { SafePathPolicy } from "./paths.ts";
import { runVerification } from "./runner.ts";
import type { TaskRequest } from "./schema.ts";

const MAX_READ_BYTES = 256 * 1024;
const MAX_ENTRIES = 2_000;
const MAX_TOOL_BYTES = 2 * 1024 * 1024;

class ToolBudget {
  private used = 0;
  consume(text: string): string {
    this.used += Buffer.byteLength(text, "utf8");
    if (this.used > MAX_TOOL_BYTES)
      throw subagentFault("capability_violation", "Child tool output budget exceeded");
    return text;
  }
}

const pathSchema = Type.Object({
  path: Type.String({ minLength: 1, maxLength: 1_024 }),
}, { additionalProperties: false });
const readSchema = Type.Object({
  path: Type.String({ minLength: 1, maxLength: 1_024 }),
  offset: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 2_000 })),
}, { additionalProperties: false });
const grepSchema = Type.Object({
  path: Type.String({ minLength: 1, maxLength: 1_024 }),
  text: Type.String({ minLength: 1, maxLength: 500 }),
}, { additionalProperties: false });
const findSchema = Type.Object({
  path: Type.String({ minLength: 1, maxLength: 1_024 }),
  nameContains: Type.String({ minLength: 1, maxLength: 200 }),
}, { additionalProperties: false });

type PathInput = Static<typeof pathSchema>;
type ReadInput = Static<typeof readSchema>;
type GrepInput = Static<typeof grepSchema>;
type FindInput = Static<typeof findSchema>;

async function walk(policy: SafePathPolicy, start: string): Promise<string[]> {
  const resolved = await policy.resolveAny(start);
  if (resolved.kind === "file") return [resolved.path];
  const result: string[] = [];
  const pending = [resolved.path];
  while (pending.length > 0 && result.length < MAX_ENTRIES) {
    const directory = pending.pop()!;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (result.length >= MAX_ENTRIES) break;
      const path = join(directory, entry.name);
      const info = await lstat(path);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) pending.push(path);
      else if (info.isFile()) result.push(path);
    }
  }
  return result;
}

function toolResult(text: string, budget: ToolBudget) {
  return { content: [{ type: "text" as const, text: budget.consume(text) }], details: {} };
}

export function createTaskTools(
  request: TaskRequest,
  policy: SafePathPolicy,
  artifacts: ArtifactStore,
  onVerification?: (result: Awaited<ReturnType<typeof runVerification>>) => void,
): ToolDefinition[] {
  const budget = new ToolBudget();
  const read = defineTool({
    name: "qb_read",
    label: "Read allowed project file",
    description: "Read a UTF-8 file from the dispatch path allowlist.",
    parameters: readSchema,
    async execute(_id, input: ReadInput) {
      const path = await policy.resolveFile(input.path);
      const bytes = await readFile(path);
      if (bytes.length > MAX_READ_BYTES)
        throw subagentFault("capability_violation", `File exceeds ${MAX_READ_BYTES} bytes: ${input.path}`);
      const lines = bytes.toString("utf8").split("\n");
      const offset = input.offset ?? 1;
      const selected = lines.slice(offset - 1, offset - 1 + (input.limit ?? 2_000));
      return toolResult(selected.map((line, index) => `${offset + index}: ${line}`).join("\n"), budget);
    },
  });
  const ls = defineTool({
    name: "qb_ls",
    label: "List allowed project directory",
    description: "List one directory from the dispatch path allowlist; links are marked and cannot be followed.",
    parameters: pathSchema,
    async execute(_id, input: PathInput) {
      const path = await policy.resolveDirectory(input.path);
      const entries = (await readdir(path, { withFileTypes: true })).slice(0, MAX_ENTRIES);
      return toolResult(entries.map((entry) => `${entry.isDirectory() ? "d" : entry.isSymbolicLink() ? "l" : "f"} ${entry.name}`).join("\n"), budget);
    },
  });
  const find = defineTool({
    name: "qb_find",
    label: "Find allowed project files",
    description: "Find files by a literal case-insensitive name fragment under an allowed path.",
    parameters: findSchema,
    async execute(_id, input: FindInput) {
      const paths = await walk(policy, input.path);
      const needle = input.nameContains.toLowerCase();
      const matches = paths.filter((path) => path.toLowerCase().includes(needle)).slice(0, 200);
      return toolResult(matches.map((path) => relative(policy.root, path)).join("\n"), budget);
    },
  });
  const grep = defineTool({
    name: "qb_grep",
    label: "Search allowed project files",
    description: "Search UTF-8 files for a literal case-insensitive text fragment under an allowed path.",
    parameters: grepSchema,
    async execute(_id, input: GrepInput) {
      const paths = await walk(policy, input.path);
      const needle = input.text.toLowerCase();
      const matches: string[] = [];
      for (const path of paths) {
        const info = await lstat(path);
        if (info.size > MAX_READ_BYTES) continue;
        const lines = (await readFile(path, "utf8")).split("\n");
        for (let index = 0; index < lines.length && matches.length < 200; index += 1) {
          if (lines[index]!.toLowerCase().includes(needle))
            matches.push(`${relative(policy.root, path)}:${index + 1}:${lines[index]}`);
        }
        if (matches.length >= 200) break;
      }
      return toolResult(matches.join("\n"), budget);
    },
  });
  const tools: ToolDefinition[] = [read, grep, find, ls];
  if (request.taskKind === "test_report") {
    let verificationStarted = false;
    tools.push(defineTool({
      name: "qb_run_verification",
      label: "Run the approved verification command",
      description: "Run exactly the verification argv supplied by the parent dispatch. Takes no command arguments.",
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute(_id, _input, signal) {
        if (verificationStarted)
          throw subagentFault("capability_violation", "The approved verification command may run only once");
        verificationStarted = true;
        const result = await runVerification(request.verification, policy, artifacts, {
          ...(signal ? { signal } : {}),
          timeoutMs: 600_000,
        });
        onVerification?.(result);
        const text = JSON.stringify(result);
        return {
          content: [{ type: "text", text: budget.consume(text) }],
          details: result,
          isError: result.exitCode !== 0,
        };
      },
    }));
  }
  return tools;
}
