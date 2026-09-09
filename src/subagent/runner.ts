import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { ArtifactStore } from "./artifacts.ts";
import { subagentFault } from "./errors.ts";
import type { SafePathPolicy } from "./paths.ts";
import type { ArtifactMetadata, VerificationCommand } from "./schema.ts";

const ALLOWED_EXECUTABLES = new Set([
  "npm", "npx", "node", "pnpm", "yarn", "bun", "deno",
  "python", "python3", "pytest", "cargo", "go", "make", "just",
  "gradle", "gradlew", "mvn", "mvnw",
]);
const FORBIDDEN_NODE_ARGS = new Set(["-e", "--eval", "-p", "--print"]);
const CONTROL_TOKEN = /[;&|`$<>\r\n]/;
const MAX_LOG_BYTES = 2 * 1024 * 1024;

export interface VerificationRunResult {
  command: VerificationCommand;
  exitCode: number;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  truncated: boolean;
  outputPreview: string;
  artifact: ArtifactMetadata;
}

export function validateVerificationCommand(input: VerificationCommand): VerificationCommand {
  if ((input as { authorizationDeclared?: unknown }).authorizationDeclared !== true)
    throw subagentFault("command_rejected", "Verification command requires caller attestation");
  const executable = input.executable.trim();
  if (!ALLOWED_EXECUTABLES.has(executable) || /[\\/=]/.test(executable))
    throw subagentFault("command_rejected", `Executable is not allowlisted: ${input.executable}`);
  if (!Array.isArray(input.args) || input.args.length > 64)
    throw subagentFault("command_rejected", "Command args exceed the allowed count");
  const args = input.args.map((arg) => {
    if (typeof arg !== "string" || arg.length > 2_048 || arg.includes("\0"))
      throw subagentFault("command_rejected", "Command argument is invalid");
    if (CONTROL_TOKEN.test(arg) || arg.startsWith("@"))
      throw subagentFault("command_rejected", `Shell/control argument is forbidden: ${arg}`);
    return arg;
  });
  if ((executable === "node" || executable === "deno") && args.some((arg) => FORBIDDEN_NODE_ARGS.has(arg)))
    throw subagentFault("command_rejected", `${executable} inline evaluation is forbidden`);
  if (Buffer.byteLength([executable, ...args].join(" "), "utf8") > 4_000)
    throw subagentFault("command_rejected", "Rendered command exceeds 4000 bytes");
  if (!input.cwd.trim()) throw subagentFault("command_rejected", "Command cwd is required");
  return { executable, args, cwd: input.cwd, authorizationDeclared: true };
}

function terminate(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== "win32" && child.pid) {
    try { process.kill(-child.pid, signal); return; } catch { /* fall through */ }
  }
  child.kill(signal);
}

export async function runVerification(
  input: VerificationCommand,
  policy: SafePathPolicy,
  artifacts: ArtifactStore,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<VerificationRunResult> {
  const command = validateVerificationCommand(input);
  if (options.signal?.aborted) throw subagentFault("aborted", "Verification was aborted before start");
  const cwd = await policy.resolveDirectory(command.cwd);
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? 600_000, 600_000));

  return new Promise<VerificationRunResult>((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let truncated = false;
    let timedOut = false;
    let aborted = false;
    let settled = false;

    const append = (stream: "stdout" | "stderr", value: Buffer | string) => {
      const prefix = Buffer.from(`[${stream}] `, "utf8");
      const data = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
      const remaining = MAX_LOG_BYTES - bytes;
      if (remaining <= 0) { truncated = true; return; }
      const combined = Buffer.concat([prefix, data]);
      const selected = combined.subarray(0, remaining);
      chunks.push(selected);
      bytes += selected.length;
      if (selected.length < combined.length) truncated = true;
    };
    child.stdout.on("data", (data) => append("stdout", data));
    child.stderr.on("data", (data) => append("stderr", data));

    let forceTimer: NodeJS.Timeout | undefined;
    const stop = () => {
      terminate(child, "SIGTERM");
      forceTimer ??= setTimeout(() => terminate(child, "SIGKILL"), 1_000);
    };
    const timeout = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const onAbort = () => { aborted = true; stop(); };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const finish = (error?: unknown) => {
      clearTimeout(timeout);
      if (forceTimer) clearTimeout(forceTimer);
      options.signal?.removeEventListener("abort", onAbort);
      if (settled) return false;
      settled = true;
      if (error) reject(subagentFault("backend_unavailable", "Could not execute verification command", error));
      return !error;
    };

    child.once("error", (error) => { finish(error); });
    child.once("close", async (code, signal) => {
      if (!finish()) return;
      if (aborted) { reject(subagentFault("aborted", "Verification command was aborted")); return; }
      if (timedOut) { reject(subagentFault("timeout", `Verification command exceeded ${timeoutMs}ms`)); return; }
      try {
        const log = Buffer.concat(chunks);
        const previewBytes = log.subarray(Math.max(0, log.length - 32 * 1024));
        const outputPreview = previewBytes.toString("utf8");
        const artifact = await artifacts.write("verification", log);
        resolve({ command, exitCode: code ?? -1, signal, timedOut: false, truncated, outputPreview, artifact });
      } catch (error) {
        reject(subagentFault("backend_unavailable", "Could not persist verification output", error));
      }
    });
  });
}
