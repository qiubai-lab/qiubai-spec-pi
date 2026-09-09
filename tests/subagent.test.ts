import assert from "node:assert/strict";
import { chmod, lstat, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { mkdtemp } from "node:fs/promises";
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import { evaluateDelegation } from "../src/subagent/admission.ts";
import { ArtifactStore } from "../src/subagent/artifacts.ts";
import { evaluateBenchmark } from "../src/subagent/benchmark.ts";
import { assertAssistantSucceeded, boundTaskResult, createPiBackendFactory } from "../src/subagent/backend.ts";
import { SubagentCoordinator } from "../src/subagent/coordinator.ts";
import { SubagentFault } from "../src/subagent/errors.ts";
import { SafePathPolicy } from "../src/subagent/paths.ts";
import { getTaskProfile } from "../src/subagent/profiles.ts";
import { runVerification, validateVerificationCommand } from "../src/subagent/runner.ts";
import { parseTaskResult, taskRequestSchema, type TaskRequest, type VerificationCommand } from "../src/subagent/schema.ts";
import { listSelectableModels, restoreModelSelection } from "../src/subagent/state.ts";
import { createTaskTools } from "../src/subagent/tools.ts";
import { Value } from "typebox/value";

async function projectFixture() {
  const root = await mkdtemp(join(tmpdir(), "qb-subagent-test-"));
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "a.md"), "alpha\nbeta\n", "utf8");
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("dispatch schema exposes only fixed single task variants", () => {
  assert.equal(Value.Check(taskRequestSchema, {
    taskKind: "context_digest", taskId: "digest", paths: ["docs"], instruction: "summarize",
  }), true);
  assert.equal(Value.Check(taskRequestSchema, {
    taskKind: "doc_fact_scan", taskId: "facts", paths: ["docs/a.md"], instruction: "facts",
  }), true);
  assert.equal(Value.Check(taskRequestSchema, {
    taskKind: "test_report", taskId: "tests", paths: ["docs"], instruction: "report",
    verification: { executable: "npm", args: ["test"], cwd: ".", authorizationDeclared: true },
  }), true);
  for (const invalid of [
    { taskKind: "reviewer", taskId: "x", paths: ["docs"], instruction: "review" },
    { taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "x", tasks: [] },
    { taskKind: "test_report", taskId: "x", paths: ["docs"], instruction: "x" },
    { taskKind: "test_report", taskId: "x", paths: ["docs"], instruction: "x", verification: { executable: "npm", args: ["test"], cwd: "." } },
  ]) assert.equal(Value.Check(taskRequestSchema, invalid), false);
});

test("safe path policy accepts declared paths and rejects traversal, absolute paths, links, and undeclared paths", async (t) => {
  const fx = await projectFixture();
  t.after(fx.cleanup);
  await writeFile(join(fx.root, "secret.txt"), "secret", "utf8");
  await symlink(join(fx.root, "secret.txt"), join(fx.root, "docs", "linked.txt"));
  const policy = await SafePathPolicy.create(fx.root, ["docs"]);
  assert.equal(await policy.resolveFile("docs/a.md"), join(fx.root, "docs", "a.md"));
  assert.equal(await policy.resolveDirectory("docs"), join(fx.root, "docs"));
  await assert.rejects(() => policy.resolveFile("../outside"), (error: unknown) => error instanceof SubagentFault && error.code === "path_unsafe");
  await assert.rejects(() => policy.resolveFile(join(fx.root, "docs", "a.md")), /project-relative/);
  await assert.rejects(() => policy.resolveFile("secret.txt"), /allowlist/);
  await assert.rejects(() => policy.resolveFile("docs/linked.txt"), /link|alias/);
  await assert.rejects(() => policy.resolveFile("docs"), /file/);
});

test("verification command policy rejects shell/control and executable escapes", () => {
  assert.deepEqual(validateVerificationCommand({ executable: "npm", args: ["run", "typecheck"], cwd: ".", authorizationDeclared: true }), {
    executable: "npm", args: ["run", "typecheck"], cwd: ".", authorizationDeclared: true,
  });
  const rejected: VerificationCommand[] = [
    { executable: "/bin/sh", args: ["-c", "echo bad"], cwd: ".", authorizationDeclared: true },
    { executable: "node", args: ["-e", "process.exit()"], cwd: ".", authorizationDeclared: true },
    { executable: "npm", args: ["test", "&&", "echo"], cwd: ".", authorizationDeclared: true },
    { executable: "npm", args: ["@args"], cwd: ".", authorizationDeclared: true },
    { executable: "FOO=npm", args: ["test"], cwd: ".", authorizationDeclared: true },
  ];
  for (const command of rejected) assert.throws(() => validateVerificationCommand(command), SubagentFault);
  assert.throws(
    () => validateVerificationCommand({ executable: "npm", args: ["test"], cwd: "." } as never),
    /attestation/,
  );
});

test("verification runner records literal argv, output artifact, exit and abort", async (t) => {
  const fx = await projectFixture();
  const artifacts = new ArtifactStore();
  t.after(async () => { await artifacts.cleanup(); await fx.cleanup(); });
  const policy = await SafePathPolicy.create(fx.root, ["."]);
  const ok = await runVerification(
    { executable: "node", args: ["--version"], cwd: ".", authorizationDeclared: true },
    policy,
    artifacts,
    { timeoutMs: 10_000 },
  );
  assert.equal(ok.exitCode, 0);
  assert.equal(ok.command.executable, "node");
  assert.match(await readFile(ok.artifact.path, "utf8"), /^\[stdout\] v\d+/);
  assert.match(ok.outputPreview, /^\[stdout\] v\d+/);
  assert.equal((await lstat(ok.artifact.path)).mode & 0o777, 0o600);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => runVerification({ executable: "node", args: ["--version"], cwd: ".", authorizationDeclared: true }, policy, artifacts, { signal: controller.signal }),
    (error: unknown) => error instanceof SubagentFault && error.code === "aborted",
  );
});

test("verification runner distinguishes non-zero exit and timeout", async (t) => {
  const fx = await projectFixture();
  const artifacts = new ArtifactStore();
  t.after(async () => { await artifacts.cleanup(); await fx.cleanup(); });
  await writeFile(join(fx.root, "fail.cjs"), "process.exit(2)", "utf8");
  await writeFile(join(fx.root, "slow.cjs"), "setTimeout(() => {}, 10000)", "utf8");
  const policy = await SafePathPolicy.create(fx.root, ["."]);
  const failed = await runVerification({ executable: "node", args: ["fail.cjs"], cwd: ".", authorizationDeclared: true }, policy, artifacts);
  assert.equal(failed.exitCode, 2);
  await assert.rejects(
    () => runVerification({ executable: "node", args: ["slow.cjs"], cwd: ".", authorizationDeclared: true }, policy, artifacts, { timeoutMs: 20 }),
    (error: unknown) => error instanceof SubagentFault && error.code === "timeout",
  );
  const controller = new AbortController();
  const running = runVerification(
    { executable: "node", args: ["slow.cjs"], cwd: ".", authorizationDeclared: true },
    policy,
    artifacts,
    { signal: controller.signal, timeoutMs: 10_000 },
  );
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(running, (error: unknown) => error instanceof SubagentFault && error.code === "aborted");
});

test("test_report child can execute the attested command only once", async (t) => {
  const fx = await projectFixture();
  const artifacts = new ArtifactStore();
  t.after(async () => { await artifacts.cleanup(); await fx.cleanup(); });
  const policy = await SafePathPolicy.create(fx.root, ["."]);
  const tools = createTaskTools({
    taskKind: "test_report",
    taskId: "once",
    paths: ["."],
    instruction: "report",
    verification: { executable: "node", args: ["--version"], cwd: ".", authorizationDeclared: true },
  }, policy, artifacts);
  const runner = tools.find((tool) => tool.name === "qb_run_verification")!;
  const first = await runner.execute("one", {}, undefined, undefined, undefined as never);
  const firstContent = first.content[0];
  assert.match(firstContent?.type === "text" ? firstContent.text : "", /exitCode/);
  await assert.rejects(
    () => runner.execute("two", {}, undefined, undefined, undefined as never),
    (error: unknown) => error instanceof SubagentFault && error.code === "capability_violation",
  );
});

test("artifact store creates private hashed files and removes its root", async () => {
  const store = new ArtifactStore();
  const artifact = await store.write("log", "hello");
  assert.equal((await lstat(artifact.path)).mode & 0o777, 0o600);
  assert.equal(artifact.bytes, 5);
  assert.equal(artifact.sha256.length, 64);
  const root = store.rootPath;
  assert.ok(root);
  await chmod(root, 0o700);
  await store.cleanup();
  await assert.rejects(() => lstat(root));
});

test("task profiles and delegation thresholds remain fixed and conservative", () => {
  assert.equal(getTaskProfile("context_digest").maxTurns, 3);
  assert.match(getTaskProfile("doc_fact_scan").prompt({ taskKind: "doc_fact_scan", taskId: "x", paths: ["docs"], instruction: "scan" }), /untrusted data/);
  assert.equal(evaluateDelegation({ taskKind: "context_digest", sourceTokens: 3_999, sourceItems: 5, commandCount: 0, expectedParentRereadRatio: 0 }).reason, "short_input");
  assert.equal(evaluateDelegation({ taskKind: "test_report", sourceTokens: 8_000, sourceItems: 1, commandCount: 1, expectedParentRereadRatio: 0 }).reason, "mechanical_single");
  assert.equal(evaluateDelegation({ taskKind: "doc_fact_scan", sourceTokens: 8_000, sourceItems: 5, commandCount: 0, expectedParentRereadRatio: 0.6 }).reason, "high_reread");
  assert.equal(evaluateDelegation({ taskKind: "context_digest", sourceTokens: 8_000, sourceItems: 5, commandCount: 0, expectedParentRereadRatio: 0.2 }).delegate, true);
});

test("benchmark fixtures require quality preservation plus cost and parent-context benefit", () => {
  for (const taskKind of ["context_digest", "doc_fact_scan", "test_report"] as const) {
    const decision = evaluateBenchmark({
      taskKind,
      inline: { cost: 1, tokens: 10_000, parentContextBytes: 50_000, latencyMs: 100, completeness: 1 },
      delegated: { cost: 0.5, tokens: 8_000, parentContextBytes: 5_000, latencyMs: 300, completeness: 1 },
    });
    assert.equal(decision.eligible, true);
  }
  assert.equal(evaluateBenchmark({
    taskKind: "context_digest",
    inline: { cost: 1, tokens: 1, parentContextBytes: 1, latencyMs: 1, completeness: 1 },
    delegated: { cost: 2, tokens: 2, parentContextBytes: 1, latencyMs: 2, completeness: 1 },
  }).reason, "cost_regression");
  assert.equal(evaluateBenchmark({
    taskKind: "doc_fact_scan",
    inline: { cost: 1, tokens: 1, parentContextBytes: 10, latencyMs: 1, completeness: 1 },
    delegated: { cost: 0.5, tokens: 1, parentContextBytes: 5, latencyMs: 2, completeness: 0.5 },
  }).reason, "quality_regression");
});

test("model state uses scoped precedence and latest valid session entry", () => {
  const a = { provider: "p", id: "a", contextWindow: 20_000 } as never;
  const b = { provider: "p", id: "b", contextWindow: 20_000 } as never;
  assert.deepEqual(listSelectableModels([{ model: b }], [a, b]).map((model) => model.id), ["b"]);
  assert.deepEqual(listSelectableModels([], [a, b]).map((model) => model.id), ["a", "b"]);
  assert.equal(restoreModelSelection([
    { type: "custom", customType: "qb-subagent-model", data: { model: "p/a" } },
    { type: "custom", customType: "qb-subagent-model", data: { model: 3 } },
    { type: "custom", customType: "qb-subagent-model", data: { model: null } },
  ]), undefined);
});

test("task result parser accepts JSON only and enforces task-specific identity", () => {
  const parsed = parseTaskResult("context_digest", JSON.stringify({
    status: "completed", summary: "ok", findings: [], evidence: [], unresolvedQuestions: [],
  }));
  assert.equal(parsed.summary, "ok");
  assert.throws(() => parseTaskResult("context_digest", "```json\n{}\n```"), (error: unknown) => error instanceof SubagentFault && error.code === "invalid_result");
  assert.throws(() => parseTaskResult("context_digest", JSON.stringify({ status: "completed", summary: "ok" })), (error: unknown) => error instanceof SubagentFault && error.code === "invalid_result");
});

test("assistant backend errors are not misreported as schema failures", () => {
  assert.throws(
    () => assertAssistantSucceeded([{ role: "assistant", content: [], stopReason: "error", errorMessage: "model is not supported" }]),
    (error: unknown) => error instanceof SubagentFault && error.code === "model_unavailable",
  );
  assert.throws(
    () => assertAssistantSucceeded([{ role: "assistant", content: [], stopReason: "error", errorMessage: "provider failed" }]),
    (error: unknown) => error instanceof SubagentFault && error.code === "backend_unavailable",
  );
});

test("large task results are bounded before entering parent context", () => {
  const full = {
    status: "completed" as const,
    summary: "summary",
    findings: Array.from({ length: 100 }, (_, index) => ({ message: `${index}:${"x".repeat(7_900)}` })),
    evidence: [],
    unresolvedQuestions: [],
  };
  const bounded = boundTaskResult(full);
  assert.equal(bounded.truncated, true);
  assert.equal(Buffer.byteLength(JSON.stringify(bounded.result), "utf8") <= 48 * 1024, true);
  assert.match(bounded.result.summary, /bounded parent projection/);
});

test("Pi backend constructs an in-memory zero-resource custom-tool child", async (t) => {
  const fx = await projectFixture();
  const artifacts = new ArtifactStore();
  t.after(async () => { await artifacts.cleanup(); await fx.cleanup(); });
  let disposed = 0;
  let captured: any;
  const selectedModel = { provider: "p", id: "m", contextWindow: 20_000 };
  const fakeSession = {
    sessionFile: undefined,
    model: selectedModel,
    messages: [{ role: "assistant", content: [{ type: "text", text: JSON.stringify({ status: "completed", summary: "ok", findings: [], evidence: [], unresolvedQuestions: [] }) }] }],
    getActiveToolNames: () => captured.tools,
    subscribe: () => () => {},
    prompt: async () => {},
    abort: async () => {},
    dispose: () => { disposed += 1; },
    getSessionStats: () => ({ tokens: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, total: 15 }, cost: 0.001 }),
  };
  const createSession = (async (options: any) => {
    captured = options;
    assert.equal(options.sessionManager.getSessionFile(), undefined);
    assert.deepEqual(options.resourceLoader.getSkills().skills, []);
    assert.deepEqual(options.resourceLoader.getPrompts().prompts, []);
    assert.deepEqual(options.resourceLoader.getAgentsFiles().agentsFiles, []);
    return { session: fakeSession, extensionsResult: options.resourceLoader.getExtensions() } as never;
  }) as typeof createAgentSession;
  const factory = createPiBackendFactory(artifacts, { createSession });
  const backend = await factory(selectedModel as never, fx.root, {
    taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "digest",
  });
  const value = await backend.run({ taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "digest" });
  assert.deepEqual(captured.tools.sort(), ["qb_find", "qb_grep", "qb_ls", "qb_read"]);
  assert.deepEqual(captured.customTools.map((tool: any) => tool.name).sort(), captured.tools.sort());
  assert.equal("result" in value && value.result.summary, "ok");
  await backend.dispose();
  assert.equal(disposed, 1);
});

test("Pi backend allows one same-model schema repair and no escalation", async (t) => {
  const fx = await projectFixture();
  const artifacts = new ArtifactStore();
  t.after(async () => { await artifacts.cleanup(); await fx.cleanup(); });
  const selectedModel = { provider: "p", id: "m", contextWindow: 20_000 };
  let prompts = 0;
  let listener: ((event: any) => void) | undefined;
  const fakeSession: any = {
    sessionFile: undefined,
    model: selectedModel,
    messages: [],
    getActiveToolNames: () => ["qb_read", "qb_grep", "qb_find", "qb_ls"],
    subscribe: (value: (event: any) => void) => { listener = value; return () => {}; },
    async prompt() {
      prompts += 1;
      listener?.({ type: "turn_start" });
      const text = prompts === 1 ? "not-json" : JSON.stringify({ status: "completed", summary: "repaired", findings: [], evidence: [], unresolvedQuestions: [] });
      fakeSession.messages.push({ role: "assistant", content: [{ type: "text", text }] });
    },
    abort: async () => {},
    dispose: () => {},
    getSessionStats: () => ({ tokens: { input: 2, output: 2, cacheRead: 0, cacheWrite: 0, total: 4 }, cost: 0 }),
  };
  const createSession = (async (options: any) => ({ session: fakeSession, extensionsResult: options.resourceLoader.getExtensions() })) as typeof createAgentSession;
  const factory = createPiBackendFactory(artifacts, { createSession });
  const request: TaskRequest = { taskKind: "context_digest", taskId: "repair", paths: ["docs"], instruction: "digest" };
  const backend = await factory(selectedModel as never, fx.root, request);
  const result = await backend.run(request);
  assert.equal("result" in result && result.result.summary, "repaired");
  assert.equal(prompts, 2);
  assert.equal(fakeSession.model, selectedModel);
  await backend.dispose();
});

test("coordinator rejects a second child and always releases the slot", async () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => { release = resolve; });
  let disposed = 0;
  const coordinator = new SubagentCoordinator(async () => ({
    async run() { await wait; return { status: "completed", summary: "ok", findings: [], evidence: [], unresolvedQuestions: [] }; },
    dispose() { disposed += 1; },
  }));
  const request: TaskRequest = { taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "digest" };
  const first = coordinator.dispatch(request, { provider: "p", id: "m" } as never, "/tmp");
  await assert.rejects(() => coordinator.dispatch(request, { provider: "p", id: "m" } as never, "/tmp"), (error: unknown) => error instanceof SubagentFault && error.code === "busy");
  release();
  await first;
  assert.equal(disposed, 1);
});

test("coordinator disposes failed children and releases its slot", async () => {
  let disposed = 0;
  const coordinator = new SubagentCoordinator(async () => ({
    async run() { throw new SubagentFault("invalid_result", "bad output"); },
    dispose() { disposed += 1; },
  }));
  const request: TaskRequest = { taskKind: "context_digest", taskId: "x", paths: ["docs"], instruction: "digest" };
  await assert.rejects(() => coordinator.dispatch(request, { provider: "p", id: "m" } as never, "/tmp"), /INVALID_RESULT/);
  assert.equal(disposed, 1);
  assert.equal(coordinator.isActive, false);
});
