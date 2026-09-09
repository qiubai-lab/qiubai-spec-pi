import type { TaskKind } from "./schema.ts";

export interface BenchmarkSide {
  cost: number;
  tokens: number;
  parentContextBytes: number;
  latencyMs: number;
  completeness: number;
}

export interface DelegationBenchmark {
  taskKind: TaskKind;
  inline: BenchmarkSide;
  delegated: BenchmarkSide;
}

export interface BenchmarkDecision {
  eligible: boolean;
  costSavingsRatio: number;
  contextSavingsRatio: number;
  reason: "eligible" | "quality_regression" | "cost_regression" | "context_regression";
}

function savings(baseline: number, candidate: number): number {
  return baseline <= 0 ? 0 : (baseline - candidate) / baseline;
}

export function evaluateBenchmark(sample: DelegationBenchmark): BenchmarkDecision {
  const costSavingsRatio = savings(sample.inline.cost, sample.delegated.cost);
  const contextSavingsRatio = savings(
    sample.inline.parentContextBytes,
    sample.delegated.parentContextBytes,
  );
  if (sample.delegated.completeness < sample.inline.completeness)
    return { eligible: false, costSavingsRatio, contextSavingsRatio, reason: "quality_regression" };
  if (costSavingsRatio <= 0)
    return { eligible: false, costSavingsRatio, contextSavingsRatio, reason: "cost_regression" };
  if (contextSavingsRatio <= 0)
    return { eligible: false, costSavingsRatio, contextSavingsRatio, reason: "context_regression" };
  return { eligible: true, costSavingsRatio, contextSavingsRatio, reason: "eligible" };
}
