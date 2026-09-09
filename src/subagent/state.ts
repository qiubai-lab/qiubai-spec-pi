import type { Api, Model } from "@earendil-works/pi-ai";
import type { ScopedModel } from "@earendil-works/pi-coding-agent";
import { subagentFault } from "./errors.ts";

export const MODEL_ENTRY_TYPE = "qb-subagent-model";

export interface ModelSelectionEntry {
  model: string | null;
}

export function modelReference(model: Pick<Model<Api>, "provider" | "id">): string {
  return `${model.provider}/${model.id}`;
}

export function listSelectableModels(
  scoped: readonly ScopedModel[],
  available: readonly Model<Api>[],
): Model<Api>[] {
  const source = scoped.length > 0 ? scoped.map((item) => item.model) : [...available];
  const seen = new Set<string>();
  return source.filter((model) => {
    const key = modelReference(model);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function restoreModelSelection(entries: readonly unknown[]): string | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index] as { type?: unknown; customType?: unknown; data?: unknown };
    if (entry?.type !== "custom" || entry.customType !== MODEL_ENTRY_TYPE) continue;
    const data = entry.data as { model?: unknown } | undefined;
    if (data?.model === null) return undefined;
    if (typeof data?.model === "string" && data.model.includes("/")) return data.model;
  }
  return undefined;
}

export function findSelectedModel(
  reference: string,
  models: readonly Model<Api>[],
): Model<Api> {
  const model = models.find((candidate) => modelReference(candidate) === reference);
  if (!model) throw subagentFault("model_unavailable", `Selected model is unavailable: ${reference}`);
  if ((model.contextWindow ?? 0) < 16_000)
    throw subagentFault("capability_violation", `Selected model context window is below 16k: ${reference}`);
  return model;
}
