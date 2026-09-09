import type { Model } from "@earendil-works/pi-ai/compat";
import { subagentFault } from "./errors.ts";
import type {
  DispatchResult,
  SubagentUsage,
  TaskRequest,
  TaskResult,
} from "./schema.ts";
import { modelReference } from "./state.ts";

export interface BackendRunResult {
  result: TaskResult;
  usage?: Partial<SubagentUsage>;
  artifact?: DispatchResult["artifact"];
  truncated?: boolean;
  errorCode?: string;
}

export interface SubagentBackendSession {
  run(
    request: TaskRequest,
    signal?: AbortSignal,
    onUpdate?: (stage: string) => void,
  ): Promise<TaskResult | BackendRunResult>;
  dispose(): void | Promise<void>;
}

export type SubagentBackendFactory = (
  model: Model<any>,
  cwd: string,
  request: TaskRequest,
) => Promise<SubagentBackendSession>;

const ZERO_USAGE: SubagentUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: 0,
  turns: 0,
};

function normalize(value: TaskResult | BackendRunResult): BackendRunResult {
  return "result" in value ? value : { result: value };
}

export class SubagentCoordinator {
  private active = false;
  private readonly createBackend: SubagentBackendFactory;
  private readonly now: () => Date;

  constructor(
    createBackend: SubagentBackendFactory,
    now: () => Date = () => new Date(),
  ) {
    this.createBackend = createBackend;
    this.now = now;
  }

  get isActive(): boolean {
    return this.active;
  }

  async dispatch(
    request: TaskRequest,
    model: Model<any>,
    cwd: string,
    signal?: AbortSignal,
    onUpdate?: (stage: string) => void,
  ): Promise<DispatchResult> {
    if (this.active) throw subagentFault("busy", "A child session is already running");
    if (signal?.aborted) throw subagentFault("aborted", "Dispatch was aborted before start");
    this.active = true;
    const started = this.now();
    let backend: SubagentBackendSession | undefined;
    try {
      onUpdate?.("starting");
      backend = await this.createBackend(model, cwd, request);
      onUpdate?.("running");
      const value = normalize(await backend.run(request, signal, onUpdate));
      const ended = this.now();
      const usage: SubagentUsage = { ...ZERO_USAGE, ...value.usage };
      usage.total = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
      return {
        ...value.result,
        taskKind: request.taskKind,
        taskId: request.taskId,
        model: modelReference(model),
        selectionSource: "session",
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        elapsedMs: Math.max(0, ended.getTime() - started.getTime()),
        usage,
        ...(value.artifact ? { artifact: value.artifact } : {}),
        truncated: value.truncated ?? false,
        ...(value.errorCode ? { errorCode: value.errorCode } : {}),
      };
    } finally {
      try { await backend?.dispose(); } finally { this.active = false; }
    }
  }
}
