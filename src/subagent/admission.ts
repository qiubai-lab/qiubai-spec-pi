import type { TaskKind } from "./schema.ts";

export interface DelegationEstimate {
  taskKind: TaskKind;
  sourceTokens: number;
  sourceItems: number;
  commandCount: number;
  expectedParentRereadRatio: number;
}

export interface DelegationDecision {
  delegate: boolean;
  reason: "eligible" | "short_input" | "mechanical_single" | "high_reread";
}

export function evaluateDelegation(input: DelegationEstimate): DelegationDecision {
  if (input.sourceTokens < 4_000) return { delegate: false, reason: "short_input" };
  if (input.sourceItems <= 1 && input.commandCount <= 1)
    return { delegate: false, reason: "mechanical_single" };
  if (input.expectedParentRereadRatio > 0.5)
    return { delegate: false, reason: "high_reread" };
  return { delegate: true, reason: "eligible" };
}
