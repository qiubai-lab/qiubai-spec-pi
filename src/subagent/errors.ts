export type SubagentErrorCode =
  | "aborted"
  | "backend_unavailable"
  | "busy"
  | "capability_violation"
  | "command_failed"
  | "command_rejected"
  | "invalid_result"
  | "invalid_task"
  | "model_unavailable"
  | "path_unsafe"
  | "timeout";

export class SubagentFault extends Error {
  readonly code: SubagentErrorCode;

  constructor(code: SubagentErrorCode, message: string, options?: ErrorOptions) {
    super(`[QB_SUBAGENT_${code.toUpperCase()}] ${message}`, options);
    this.name = "SubagentFault";
    this.code = code;
  }
}

export function subagentFault(
  code: SubagentErrorCode,
  message: string,
  cause?: unknown,
): SubagentFault {
  return new SubagentFault(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

export function asSubagentFault(error: unknown): SubagentFault {
  if (error instanceof SubagentFault) return error;
  if (error instanceof Error)
    return subagentFault("backend_unavailable", error.message, error);
  return subagentFault("backend_unavailable", String(error));
}
