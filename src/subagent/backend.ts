import type { Model } from "@earendil-works/pi-ai/compat";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { ArtifactStore } from "./artifacts.ts";
import type {
  BackendRunResult,
  SubagentBackendFactory,
  SubagentBackendSession,
} from "./coordinator.ts";
import { SubagentFault, subagentFault } from "./errors.ts";
import { SafePathPolicy } from "./paths.ts";
import { getTaskProfile } from "./profiles.ts";
import type { VerificationRunResult } from "./runner.ts";
import { parseTaskResult, type TaskRequest, type TaskResult } from "./schema.ts";
import { modelReference } from "./state.ts";
import { createTaskTools } from "./tools.ts";

const PARENT_RESULT_BYTES = 48 * 1024;

function lastAssistantFailure(messages: readonly unknown[]): { stopReason?: string; errorMessage?: string } | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: unknown; stopReason?: unknown; errorMessage?: unknown };
    if (message.role !== "assistant") continue;
    if (message.stopReason === "error" || message.stopReason === "aborted") {
      return {
        ...(typeof message.stopReason === "string" ? { stopReason: message.stopReason } : {}),
        ...(typeof message.errorMessage === "string" ? { errorMessage: message.errorMessage } : {}),
      };
    }
    return undefined;
  }
  return undefined;
}

export function assertAssistantSucceeded(messages: readonly unknown[]): void {
  const failure = lastAssistantFailure(messages);
  if (!failure) return;
  const message = failure.errorMessage ?? `Child stopped with ${failure.stopReason}`;
  if (failure.stopReason === "aborted") throw subagentFault("aborted", message);
  if (/model.*(?:not supported|unsupported|not available)/i.test(message))
    throw subagentFault("model_unavailable", message);
  throw subagentFault("backend_unavailable", message);
}

function finalAssistantText(messages: readonly unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: unknown; content?: unknown };
    if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
    const texts = message.content
      .filter((part): part is { type: "text"; text: string } => {
        const value = part as { type?: unknown; text?: unknown };
        return value.type === "text" && typeof value.text === "string";
      })
      .map((part) => part.text);
    if (texts.length > 0) return texts.join("\n");
  }
  return "";
}

export function boundTaskResult(result: TaskResult): { result: TaskResult; truncated: boolean } {
  const summaryLines = result.summary.split("\n");
  if (Buffer.byteLength(JSON.stringify(result), "utf8") <= PARENT_RESULT_BYTES && summaryLines.length <= 1_900)
    return { result, truncated: false };
  const boundedSummary = summaryLines.slice(0, 1_900).join("\n").slice(0, 8_000);
  const copy: TaskResult = {
    ...result,
    summary: `${boundedSummary}\n[bounded parent projection; see artifact]`,
    findings: [...result.findings],
    evidence: [...result.evidence],
    unresolvedQuestions: [...result.unresolvedQuestions],
  };
  while (Buffer.byteLength(JSON.stringify(copy), "utf8") > PARENT_RESULT_BYTES) {
    if (copy.findings.length > 0) copy.findings.pop();
    else if (copy.evidence.length > 0) copy.evidence.pop();
    else if (copy.unresolvedQuestions.length > 0) copy.unresolvedQuestions.pop();
    else if (copy.summary.length > 256) copy.summary = copy.summary.slice(0, Math.floor(copy.summary.length / 2));
    else break;
  }
  return { result: copy, truncated: true };
}

async function promptWithDeadline(
  session: Awaited<ReturnType<typeof createAgentSession>>["session"],
  prompt: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw subagentFault("aborted", "Child dispatch was aborted before prompt");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  const onAbort = () => { void session.abort(); };
  combined.addEventListener("abort", onAbort, { once: true });
  try {
    await session.prompt(prompt, { expandPromptTemplates: false, source: "extension" });
    if (signal?.aborted) throw subagentFault("aborted", "Child dispatch was aborted");
    if (timeout.signal.aborted) throw subagentFault("timeout", `Child dispatch exceeded ${timeoutMs}ms`);
  } catch (error) {
    if (signal?.aborted) throw subagentFault("aborted", "Child dispatch was aborted", error);
    if (timeout.signal.aborted) throw subagentFault("timeout", `Child dispatch exceeded ${timeoutMs}ms`, error);
    throw error;
  } finally {
    clearTimeout(timer);
    combined.removeEventListener("abort", onAbort);
  }
}

export interface PiBackendDependencies {
  createSession?: typeof createAgentSession;
}

export function createPiBackendFactory(
  artifacts: ArtifactStore,
  dependencies: PiBackendDependencies = {},
): SubagentBackendFactory {
  const createSession = dependencies.createSession ?? createAgentSession;
  return async (model: Model<any>, cwd: string, request: TaskRequest): Promise<SubagentBackendSession> => {
    const policy = await SafePathPolicy.create(cwd, request.paths);
    let verification: VerificationRunResult | undefined;
    const customTools = createTaskTools(request, policy, artifacts, (result) => { verification = result; });
    const settings = SettingsManager.inMemory(
      { compaction: { enabled: false }, retry: { enabled: false } },
      { projectTrusted: false },
    );
    const loader = new DefaultResourceLoader({
      cwd: policy.root,
      agentDir: getAgentDir(),
      settingsManager: settings,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      agentsFilesOverride: () => ({ agentsFiles: [] }),
      systemPromptOverride: () => "You are an isolated qiubai-spec task worker. Use only the supplied qb_* tools and return strict JSON.",
    });
    await loader.reload();
    const allowedNames = customTools.map((tool) => tool.name);
    const created = await createSession({
      cwd: policy.root,
      model,
      thinkingLevel: "low",
      tools: allowedNames,
      customTools,
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(policy.root),
      settingsManager: settings,
    });
    const session = created.session;
    try {
      if (session.sessionFile !== undefined)
        throw subagentFault("backend_unavailable", "Child session unexpectedly persisted to disk");
      if (!session.model || modelReference(session.model) !== modelReference(model))
        throw subagentFault("model_unavailable", "Child runtime did not preserve the explicitly selected model");
      if (session.getActiveToolNames().some((name) => !allowedNames.includes(name)))
        throw subagentFault("capability_violation", "Child session exposed a non-allowlisted tool");
      if (loader.getExtensions().extensions.length !== 0 || loader.getSkills().skills.length !== 0 || loader.getPrompts().prompts.length !== 0 || loader.getAgentsFiles().agentsFiles.length !== 0)
        throw subagentFault("capability_violation", "Child session loaded forbidden resources");
    } catch (error) {
      session.dispose();
      throw error;
    }

    let turns = 0;
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "turn_start") {
        turns += 1;
        if (turns > 4) void session.abort();
      }
    });
    const profile = getTaskProfile(request.taskKind);

    return {
      async run(_request, signal, onUpdate): Promise<BackendRunResult> {
        onUpdate?.("prompting");
        await promptWithDeadline(session, profile.prompt(request), profile.timeoutMs, signal);
        assertAssistantSucceeded(session.messages);
        let raw = finalAssistantText(session.messages);
        let parsed: TaskResult;
        try {
          parsed = parseTaskResult(request.taskKind, raw);
        } catch (error) {
          if (!(error instanceof SubagentFault) || error.code !== "invalid_result" || turns >= 4) throw error;
          onUpdate?.("repairing_schema");
          await promptWithDeadline(
            session,
            "Your previous answer was invalid. Return only one JSON object matching the required schema; no Markdown fences or commentary.",
            Math.min(profile.timeoutMs, 60_000),
            signal,
          );
          assertAssistantSucceeded(session.messages);
          raw = finalAssistantText(session.messages);
          try {
            parsed = parseTaskResult(request.taskKind, raw);
          } catch (repairError) {
            const invalidArtifact = await artifacts.write(
              `${request.taskKind}-invalid-result`,
              JSON.stringify(session.messages),
            );
            throw subagentFault(
              "invalid_result",
              `${request.taskKind} failed schema repair; artifact=${invalidArtifact.path}`,
              repairError,
            );
          }
        }
        let artifact = verification?.artifact;
        const commandFailed = verification !== undefined && verification.exitCode !== 0;
        if (verification) {
          const commandText = [verification.command.executable, ...verification.command.args].join(" ");
          if (!parsed.evidence.some((item) => item.command === commandText)) {
            parsed.evidence.push({
              path: verification.artifact.path,
              command: commandText,
              exitCode: verification.exitCode,
              detail: `cwd=${verification.command.cwd}; sha256=${verification.artifact.sha256}; bytes=${verification.artifact.bytes}`,
            });
          }
        }
        if (commandFailed && parsed.status === "completed") parsed.status = "failed";
        const bounded = boundTaskResult(parsed);
        if (bounded.truncated || Buffer.byteLength(raw, "utf8") > PARENT_RESULT_BYTES)
          artifact = await artifacts.write(`${request.taskKind}-result`, raw);
        const stats = session.getSessionStats();
        return {
          result: bounded.result,
          usage: {
            input: stats.tokens.input,
            output: stats.tokens.output,
            cacheRead: stats.tokens.cacheRead,
            cacheWrite: stats.tokens.cacheWrite,
            total: stats.tokens.total,
            cost: stats.cost,
            turns,
          },
          ...(artifact ? { artifact } : {}),
          truncated: bounded.truncated,
          ...(commandFailed ? { errorCode: "command_failed" } : {}),
        };
      },
      dispose() {
        unsubscribe();
        session.dispose();
      },
    };
  };
}
