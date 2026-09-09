import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { subagentFault } from "./errors.ts";

export const TASK_KINDS = [
  "context_digest",
  "doc_fact_scan",
  "test_report",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

const baseRequest = {
  taskId: Type.String({ minLength: 1, maxLength: 100 }),
  changeId: Type.Optional(Type.String({ pattern: "^QB-[0-9]{8}-[a-z0-9]+(?:-[a-z0-9]+)*$" })),
  paths: Type.Array(Type.String({ minLength: 1, maxLength: 1_024 }), {
    minItems: 1,
    maxItems: 32,
  }),
  instruction: Type.String({ minLength: 1, maxLength: 4_000 }),
};

export const verificationCommandSchema = Type.Object(
  {
    executable: Type.String({ minLength: 1, maxLength: 64 }),
    args: Type.Array(Type.String({ maxLength: 2_048 }), { maxItems: 64 }),
    cwd: Type.String({ minLength: 1, maxLength: 1_024 }),
    authorizationDeclared: Type.Literal(true, { description: "Caller attests this exact argv is already selected by the approved plan/project verification entry; not independent evidence" }),
  },
  { additionalProperties: false },
);

export const taskRequestSchema = Type.Union([
  Type.Object(
    { taskKind: StringEnum(["context_digest"] as const), ...baseRequest },
    { additionalProperties: false },
  ),
  Type.Object(
    { taskKind: StringEnum(["doc_fact_scan"] as const), ...baseRequest },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      taskKind: StringEnum(["test_report"] as const),
      ...baseRequest,
      verification: verificationCommandSchema,
    },
    { additionalProperties: false },
  ),
]);

export type TaskRequest = Static<typeof taskRequestSchema>;
export type VerificationCommand = Static<typeof verificationCommandSchema>;

const findingSchema = Type.Object(
  {
    message: Type.String({ maxLength: 8_000 }),
    path: Type.Optional(Type.String({ maxLength: 1_024 })),
    line: Type.Optional(Type.Integer({ minimum: 1 })),
    severity: Type.Optional(StringEnum(["info", "warning", "error"] as const)),
  },
  { additionalProperties: false },
);

const evidenceSchema = Type.Object(
  {
    path: Type.Optional(Type.String({ maxLength: 1_024 })),
    command: Type.Optional(Type.String({ maxLength: 4_000 })),
    exitCode: Type.Optional(Type.Integer()),
    detail: Type.Optional(Type.String({ maxLength: 8_000 })),
  },
  { additionalProperties: false },
);

export const taskResultSchema = Type.Object(
  {
    status: StringEnum(["completed", "failed", "blocked"] as const),
    summary: Type.String({ maxLength: 32_000 }),
    findings: Type.Array(findingSchema, { maxItems: 100 }),
    evidence: Type.Array(evidenceSchema, { maxItems: 100 }),
    unresolvedQuestions: Type.Array(Type.String({ maxLength: 4_000 }), {
      maxItems: 20,
    }),
  },
  { additionalProperties: false },
);

export type TaskResult = Static<typeof taskResultSchema>;

export interface ArtifactMetadata {
  path: string;
  sha256: string;
  bytes: number;
}

export interface SubagentUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost: number;
  turns: number;
}

export interface DispatchResult extends TaskResult {
  taskKind: TaskKind;
  taskId: string;
  model: string;
  selectionSource: "session";
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  usage: SubagentUsage;
  artifact?: ArtifactMetadata;
  truncated: boolean;
  errorCode?: string;
}

export function parseTaskResult(kind: TaskKind, text: string): TaskResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw subagentFault(
      "invalid_result",
      `${kind} returned non-JSON output`,
      error,
    );
  }
  if (!Value.Check(taskResultSchema, value))
    throw subagentFault(
      "invalid_result",
      `${kind} returned output that does not match the result schema`,
    );
  return value as TaskResult;
}
