import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Value } from "typebox/value";
import { registerQbSpecTools } from "../extensions/index.ts";
import { DIRECT_QUEUE } from "../src/operations.ts";
import { fixture, ID } from "./helpers.ts";

interface CapturedTool {
  name: string;
  parameters: Parameters<typeof Value.Check>[0];
  execute: (
    ...args: unknown[]
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
    details: unknown;
  }>;
}

function captureTools(): CapturedTool[] {
  const tools: CapturedTool[] = [];
  const fake = {
    registerTool(tool: CapturedTool) {
      tools.push(tool);
    },
  };
  // SAFETY: registration uses only ExtensionAPI.registerTool; the fake deliberately implements that observed surface.
  registerQbSpecTools(fake as unknown as ExtensionAPI, DIRECT_QUEUE);
  return tools;
}

test("extension registers only the four approved tools with strict schemas", () => {
  const tools = captureTools();
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "qb_spec_inspect",
      "qb_spec_transition",
      "qb_spec_archive",
      "qb_spec_doctor",
    ],
  );
  const inspect = tools[0]!;
  assert.equal(Value.Check(inspect.parameters, { changeId: ID }), true);
  assert.equal(
    Value.Check(inspect.parameters, { changeId: ID, unexpected: true }),
    false,
  );
  const transition = tools[1]!;
  assert.equal(
    Value.Check(transition.parameters, {
      changeId: ID,
      document: "spec",
      status: "active",
      authorizationDeclared: true,
    }),
    true,
  );
  assert.equal(
    Value.Check(transition.parameters, {
      changeId: ID,
      document: "both",
      status: "active",
      authorizationDeclared: true,
    }),
    false,
  );
});

test("registered inspect and doctor tools return bounded structured results", async (t) => {
  const fx = await fixture();
  t.after(fx.cleanup);
  await fx.writeDocument();
  const tools = captureTools();
  const context = { cwd: fx.root };
  const inspect = await tools[0]!.execute(
    "inspect",
    { changeId: ID },
    undefined,
    undefined,
    context,
  );
  assert.match(inspect.content[0]!.text, /QB-20260908-fixture: active/);
  assert.equal((inspect.details as { changeId: string }).changeId, ID);
  const doctor = await tools[3]!.execute(
    "doctor",
    { offset: 0, limit: 1 },
    undefined,
    undefined,
    context,
  );
  assert.equal(
    Buffer.byteLength(JSON.stringify(doctor.details)) <= 50 * 1024,
    true,
  );
  assert.equal(doctor.content[0]!.text.split("\n").length <= 2_000, true);
  await assert.rejects(
    () =>
      tools[0]!.execute(
        "inspect-error",
        { changeId: "invalid" },
        undefined,
        undefined,
        context,
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message.startsWith("[QB_INVALID_CHANGE_ID]"),
  );
});
