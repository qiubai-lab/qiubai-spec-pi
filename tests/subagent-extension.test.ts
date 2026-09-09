import assert from "node:assert/strict";
import { lstat } from "node:fs/promises";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import qiubaiSpecPi, { registerQbSubagent } from "../extensions/index.ts";
import { ArtifactStore } from "../src/subagent/artifacts.ts";
import type { SubagentBackendFactory } from "../src/subagent/coordinator.ts";

interface CapturedCommand {
  description: string;
  handler(args: string, ctx: any): Promise<void> | void;
}
interface CapturedTool {
  name: string;
  execute(...args: any[]): Promise<any>;
}

function harness() {
  const tools: CapturedTool[] = [];
  const commands = new Map<string, CapturedCommand>();
  const handlers = new Map<string, Array<(event: any, ctx: any) => any>>();
  const entries: Array<{ customType: string; data: unknown }> = [];
  const fake = {
    registerTool(tool: CapturedTool) { tools.push(tool); },
    registerCommand(name: string, command: CapturedCommand) { commands.set(name, command); },
    on(name: string, handler: (event: any, ctx: any) => any) {
      const existing = handlers.get(name) ?? [];
      existing.push(handler);
      handlers.set(name, existing);
    },
    appendEntry(customType: string, data: unknown) { entries.push({ customType, data }); },
  };
  return { fake: fake as unknown as ExtensionAPI, tools, commands, handlers, entries };
}

function context(models: any[], scopedModels: any[] = [], sessionEntries: unknown[] = []) {
  const mainModel = { provider: "main", id: "large", contextWindow: 100_000 };
  return {
    cwd: process.cwd(),
    hasUI: false,
    mode: "print",
    model: mainModel,
    scopedModels,
    sessionManager: { getEntries: () => sessionEntries },
    modelRegistry: {
      getAvailable: () => models,
      hasConfiguredAuth: () => true,
    },
    isProjectTrusted: () => true,
    ui: { notify() {}, select: async () => undefined },
  };
}

test("default extension registers six tools and the model command", () => {
  const h = harness();
  qiubaiSpecPi(h.fake);
  assert.deepEqual(h.tools.map((tool) => tool.name), [
    "qb_spec_inspect", "qb_spec_transition", "qb_spec_archive", "qb_spec_recover", "qb_spec_doctor", "qb_subagent_dispatch",
  ]);
  assert.deepEqual([...h.commands.keys()], ["qb-subagent-model"]);
});

test("model command persists exact session selection, restores latest entry, and reset disables", async () => {
  const h = harness();
  const output: string[] = [];
  const backend: SubagentBackendFactory = async () => ({
    async run() { return { status: "completed", summary: "ok", findings: [], evidence: [], unresolvedQuestions: [] }; },
    dispose() {},
  });
  registerQbSubagent(h.fake, { artifacts: new ArtifactStore(), backendFactory: backend, writeNonUi: (text) => output.push(text) });
  const small = { provider: "p", id: "small", contextWindow: 20_000 };
  const large = { provider: "p", id: "large", contextWindow: 20_000 };
  const ctx = context([small, large], [{ model: small }]);
  for (const handler of h.handlers.get("session_start") ?? []) await handler({}, ctx);
  const command = h.commands.get("qb-subagent-model")!;
  await command.handler("p/small", ctx);
  assert.deepEqual(h.entries.at(-1), { customType: "qb-subagent-model", data: { model: "p/small" } });
  assert.equal(ctx.model.id, "large");
  await command.handler("status", ctx);
  assert.match(output.at(-1)!, /p\/small.*available=true/);

  const dispatch = h.tools.find((tool) => tool.name === "qb_subagent_dispatch")!;
  const result = await dispatch.execute("id", {
    taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "digest",
  }, undefined, undefined, ctx);
  assert.equal(result.details.model, "p/small");

  await command.handler("reset", ctx);
  assert.deepEqual(h.entries.at(-1), { customType: "qb-subagent-model", data: { model: null } });
  await assert.rejects(() => dispatch.execute("id", {
    taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "digest",
  }, undefined, undefined, ctx), /MODEL_UNAVAILABLE/);

  const restoredCtx = context([small], [], [
    { type: "custom", customType: "qb-subagent-model", data: { model: "p/small" } },
  ]);
  for (const handler of h.handlers.get("session_start") ?? []) await handler({}, restoredCtx);
  await command.handler("status", restoredCtx);
  assert.match(output.at(-1)!, /p\/small/);
});

test("session shutdown removes owned artifacts", async () => {
  const h = harness();
  const artifacts = new ArtifactStore();
  registerQbSubagent(h.fake, { artifacts, backendFactory: async () => { throw new Error("unused"); } });
  await artifacts.write("owned", "secret");
  const root = artifacts.rootPath!;
  for (const handler of h.handlers.get("session_shutdown") ?? []) await handler({}, context([]));
  await assert.rejects(() => lstat(root));
});

test("non-UI picker prints bounded available list and scoped models take precedence", async () => {
  const h = harness();
  const output: string[] = [];
  registerQbSubagent(h.fake, {
    backendFactory: async () => { throw new Error("unused"); },
    writeNonUi: (text) => output.push(text),
  });
  const a = { provider: "p", id: "a", contextWindow: 20_000 };
  const b = { provider: "p", id: "b", contextWindow: 20_000 };
  await h.commands.get("qb-subagent-model")!.handler("", context([a, b], [{ model: b }]));
  assert.match(output[0]!, /p\/b/);
  assert.doesNotMatch(output[0]!, /p\/a/);
});
