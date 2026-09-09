import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { boundedText } from "../result.ts";
import { ArtifactStore } from "./artifacts.ts";
import { createPiBackendFactory } from "./backend.ts";
import { SubagentCoordinator, type SubagentBackendFactory } from "./coordinator.ts";
import { asSubagentFault, subagentFault } from "./errors.ts";
import { taskRequestSchema } from "./schema.ts";
import type { DispatchResult } from "./schema.ts";
import {
  findSelectedModel,
  listSelectableModels,
  MODEL_ENTRY_TYPE,
  modelReference,
  restoreModelSelection,
} from "./state.ts";

export interface SubagentExtensionDependencies {
  artifacts?: ArtifactStore;
  backendFactory?: SubagentBackendFactory;
  writeNonUi?: (text: string) => void;
}

type TaskInput = Static<typeof taskRequestSchema>;

function availableModels(ctx: ExtensionContext): Model<Api>[] {
  return listSelectableModels(ctx.scopedModels, ctx.modelRegistry.getAvailable())
    .filter((model) => ctx.modelRegistry.hasConfiguredAuth(model) && (model.contextWindow ?? 0) >= 16_000);
}

function describeModel(model: Model<Api>): string {
  const context = model.contextWindow ? ` ctx:${model.contextWindow}` : "";
  const text = `${modelReference(model)}${context}`;
  return text.length <= 300 ? text : `${text.slice(0, 299)}…`;
}

function boundedModelList(models: readonly Model<Api>[]): string {
  const visible = models.slice(0, 100).map(describeModel);
  if (models.length > visible.length) visible.push(`… ${models.length - visible.length} more model(s)`);
  return visible.join("\n") || "(none)";
}

function outputCommand(ctx: ExtensionCommandContext, text: string, writeNonUi: (text: string) => void): void {
  if (ctx.hasUI) ctx.ui.notify(text, "info");
  else writeNonUi(text);
}

function splitCommand(args: string): string {
  return args.trim();
}

export function registerQbSubagent(
  pi: ExtensionAPI,
  dependencies: SubagentExtensionDependencies = {},
): void {
  const artifacts = dependencies.artifacts ?? new ArtifactStore();
  const coordinator = new SubagentCoordinator(
    dependencies.backendFactory ?? createPiBackendFactory(artifacts),
  );
  const writeNonUi = dependencies.writeNonUi ?? ((text: string) => console.log(text));
  let selected: string | undefined;

  pi.on("session_start", (_event, ctx) => {
    selected = restoreModelSelection(ctx.sessionManager.getEntries());
  });
  pi.on("session_shutdown", async () => {
    selected = undefined;
    await artifacts.cleanup();
  });

  pi.registerCommand("qb-subagent-model", {
    description: "Select, inspect, or reset the session-scoped qb subagent model",
    handler: async (rawArgs, ctx) => {
      const args = splitCommand(rawArgs);
      const models = availableModels(ctx);
      if (args === "status") {
        if (!selected) {
          outputCommand(ctx, "qb subagent model: disabled (inline workflow)", writeNonUi);
          return;
        }
        const available = models.some((model) => modelReference(model) === selected);
        outputCommand(ctx, `qb subagent model: ${selected} source=session available=${available}`, writeNonUi);
        return;
      }
      if (args === "reset") {
        selected = undefined;
        pi.appendEntry(MODEL_ENTRY_TYPE, { model: null });
        outputCommand(ctx, "qb subagent model reset; delegation disabled", writeNonUi);
        return;
      }
      let choice = args;
      if (!choice) {
        if (!ctx.hasUI) {
          outputCommand(ctx, `Usage: /qb-subagent-model <provider/model-id>|status|reset\nAvailable:\n${boundedModelList(models)}`, writeNonUi);
          return;
        }
        const labels = models.map(describeModel);
        const picked = await ctx.ui.select("Select qb subagent model", labels);
        if (!picked) return;
        choice = picked.split(" ", 1)[0]!;
      }
      const model = models.find((candidate) => modelReference(candidate) === choice);
      if (!model) throw subagentFault("model_unavailable", `Model is not selectable in this session: ${choice}`);
      findSelectedModel(choice, models);
      selected = choice;
      pi.appendEntry(MODEL_ENTRY_TYPE, { model: choice });
      outputCommand(ctx, `qb subagent model selected: ${choice} source=session`, writeNonUi);
    },
  });

  pi.registerTool({
    name: "qb_subagent_dispatch",
    label: "Run lightweight qb subagent task",
    description: "Run one fixed read-only lightweight task in an isolated in-memory child session. Requires an explicit /qb-subagent-model selection.",
    promptSnippet: "Delegate eligible high-volume context_digest, doc_fact_scan, or test_report work to the configured lightweight model",
    promptGuidelines: [
      "Use only for context_digest, doc_fact_scan, or test_report after explicit model selection and when source/log volume justifies child startup.",
      "Do not use for planning, review decisions, editing, lifecycle operations, short reads, or deterministic trace scans.",
      "Treat the result as evidence input; it never proves acceptance or chooses the next workflow action.",
    ],
    parameters: taskRequestSchema,
    async execute(_id, params: TaskInput, signal, onUpdate, ctx) {
      try {
        if (!selected) throw subagentFault("model_unavailable", "No session subagent model is selected; use inline workflow");
        const models = availableModels(ctx);
        const model = findSelectedModel(selected, models);
        if (params.taskKind === "test_report" && !ctx.isProjectTrusted())
          throw subagentFault("capability_violation", "test_report requires a trusted project session");
        const result = await coordinator.dispatch(
          params,
          model,
          ctx.cwd,
          signal,
          (stage) => onUpdate?.({
            content: [{ type: "text", text: `${params.taskKind}: ${stage} (${selected})` }],
            details: { stage, taskKind: params.taskKind, model: selected },
          }),
        );
        return {
          content: [{ type: "text", text: formatDispatchResult(result) }],
          details: result,
        };
      } catch (error) {
        throw asSubagentFault(error);
      }
    },
  });
}

export function formatDispatchResult(result: DispatchResult): string {
  const lines = [
    `${result.taskKind}/${result.taskId}: ${result.status}${result.errorCode ? ` (${result.errorCode})` : ""}`,
    `model=${result.model} elapsedMs=${result.elapsedMs} turns=${result.usage.turns} tokens=${result.usage.total} cost=${result.usage.cost}`,
    result.summary,
  ];
  if (result.artifact)
    lines.push(`artifact=${result.artifact.path} sha256=${result.artifact.sha256} bytes=${result.artifact.bytes}`);
  if (result.truncated) lines.push("output truncated; inspect artifact");
  return boundedText(
    lines.join("\n").split("\n"),
    "… subagent output truncated; inspect the reported artifact.",
  );
}
