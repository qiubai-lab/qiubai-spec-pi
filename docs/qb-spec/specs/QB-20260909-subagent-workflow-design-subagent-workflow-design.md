---
id: QB-20260909-subagent-workflow-design
type: design
tier: strict
status: draft
created: 2026-09-09
updated: 2026-09-09
supersedes: []
---

# qiubai-spec subagent workflow design

## Goal

为 `qiubai-spec-pi` 定义可实施的 subagent 委派边界与执行协议，在减少主会话上下文污染、增加独立审查能力的同时，保持现有集中路由、语义决策、授权 attestation、验收充分性和安全归档契约不变。

本 change 仍处于技术调研阶段，只完成参考方案沉淀、架构评估和设计，不实现 subagent runtime、agent profiles 或新工具。

## Drivers And Constraints

- Pi 核心不内置固定 subagent 工作流；可由 extension 通过独立 `AgentSession`，或参考官方示例启动隔离的 Pi 进程实现。
- `skills/shaping-requirements/references/workflow-routing.md` 必须继续作为 next-action 顺序的唯一事实源。
- `extensions/` 只负责注册和 transport adapter；`src/` 只负责机械规则；workflow 语义继续由 `skills/` 和主 agent 持有。
- subagent 输出是候选分析或执行证据，不是批准、授权、验收充分性或完成状态的独立证明。
- 任何 qb-spec 文档 mutation 仍须遵守 Pi mutation queue、qb-spec root lock、source stability 和现有 `qb_spec_*` 工具边界。
- 输出必须保持在 Pi 的 50KB / 2000 行限制内；完整日志应写入受控临时 artifact，并返回摘要、hash/路径和退出码。
- 项目级 agent prompt 属于仓库控制输入；不得默认信任或默认加载。

## Scope

### In scope

- 将 Superpowers 的 subagent 协作方案作为外部参考基线落盘，并明确采用、调整和不采用的部分。
- 对现有 workflow 节点进行可委派性分级。
- 定义 orchestrator、subagent runtime adapter、agent profile 和 artifact handoff 的职责边界。
- 定义单 pipeline 中顺序委派、失败停止、重试、取消和结果验证协议；当前方案不设计 agent 并行。
- 定义面向低成本小模型的固定轻量任务范围和明确排除项。
- 定义通过 slash command 从 Pi 可用模型目录选择 subagent 模型的交互与校验语义。
- 定义安全、兼容、测试和可观察验收。

### Out of scope

- 本 change 不新增 runtime tool、agent prompt、命令或 package dependency。
- 不改变 type/tier 规则、lifecycle 状态机、归档/recovery 语义或 workflow routing 顺序。
- 不自动提升长期 context，不自动修改 Agent 入口。
- 不承诺 subagent 提升质量或降低成本；这些需要实现后的度量证据。

## Delegation Matrix

| Workflow activity | Delegation | Fixed lightweight task | Required parent/orchestrator gate |
| --- | --- | --- | --- |
| 按给定范围定位代码/文档/context 并压缩摘要 | 推荐 | `context_digest` | 主 agent决定读取范围、相关性和是否需要原文 |
| 对既定 diff 生成文件分类和文档影响候选 | 推荐 | `diff_summary` | 主 agent决定是否触发 Directory Map/context/docs 工作 |
| 核验文档中的路径、命令、链接或符号是否存在 | 推荐 | `doc_fact_scan` | 只接受事实证据，不让 subagent决定文档语义 |
| 运行主 agent已选定的固定验证命令并压缩日志 | 推荐 | `test_report` | 主 agent检查退出码、失败数和必要原始日志，决定验收充分性 |
| 机械提取 REQ/AC/TASK/VER 引用与缺失候选 | 条件推荐 | `trace_scan` | 主 agent执行语义完整性和冲突审查 |
| 规格质量、需求取舍、type/tier 和澄清 | 不委派 | 无 | `shaping-requirements` / review skill 由主 agent执行 |
| plan 编写、依赖设计和任务拆解 | 不委派 | 无 | 主 agent保留规划责任 |
| 架构决策、测试策略和风险 gate | 不委派 | 无 | 对应 skills 与主 agent作决定 |
| 代码或文档编辑、提交和修复 | 不委派 | 无 | 当前轻量代理没有 edit/write 权限 |
| lifecycle transition、archive、recovery | 不委派 | 无 | 仅主 agent在授权/验收 gate 后调用 `qb_spec_*` |
| acceptance sufficiency、完成声明 | 不委派 | 无 | `verifying-before-completion` 最终判断 |
| 长期 context promotion、Agent 入口更新 | 不委派 | 无 | 保留现有显式授权规则 |

## Superpowers Reference Baseline

参考对象：Superpowers 的 `subagent-driven-development` 与 `verification-before-completion` 工作流。这里记录的是本 change 调研时采用的协作模型，不把外部项目作为运行时依赖或 qiubai-spec 规则事实源。

调研来源：

- <https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md>
- <https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md>

### Reference Flow

```text
读取并预检计划
→ 每个独立任务分派 fresh implementer subagent
→ implementer 实现、运行覆盖任务的测试、提交并自审
→ 独立 task reviewer 同时检查 spec compliance 与 task quality
→ 有 findings：原 implementer 修复、重跑覆盖测试、再次 review
→ 多轮不能收敛：更换 fresh implementer 或交回 orchestrator 裁决
→ 全部任务完成后进行 whole-branch review
→ 主流程执行 fresh final verification
→ 只有新鲜证据满足完成门禁后才声明完成
```

### Adopt

- 每个委派任务使用独立、最小上下文，不继承主会话历史堆积。
- task brief 只包含任务、直接接口、全局约束和 artifact 路径。
- 实现者自审不能替代独立 review；review 必须覆盖规格符合性和质量。
- subagent 的成功报告不构成完成证据；主流程必须读取 diff、命令和退出结果。
- findings 通过有界修复循环回到原责任角色，不能由 orchestrator 暗中代修后跳过复审。
- 所有任务结束后保留整体审查和 fresh verification，避免局部通过掩盖集成问题。

### Adapt For qiubai-spec

- Superpowers 以实现与独立 review 为核心；qiubai-spec 当前只借鉴“隔离上下文、最小 brief、artifact handoff、成功报告不等于完成证据”，不引入 implementer/reviewer 协作链。
- subagent 被收窄为低成本小模型执行的固定轻量任务：context/diff 摘要、文档事实扫描、机械 trace 扫描和测试日志压缩。
- 所有委派在主 pipeline 中一次执行一个；不实现 parallel 或 chain 模式。
- qiubai-spec 必须在 approval、attestation、acceptance sufficiency、archive/recovery 和长期 context 等既有 gate 前由主 agent处理。
- 测试任务要求结构化 evidence schema、退出码、artifact 路径和截断标记；主流程仍执行必要的 fresh verification 判断。
- qiubai-spec 的 next action 只能由本 package 的 `workflow-routing.md` 决定，不能由外部流程或 subagent result直接推进。

### Do Not Adopt In The Research-Only First Phase

- 不采用 fresh implementer per task、subagent commit、自动修复或并行写工作树。
- 不复制通用 subagent 工具的任意 prompt、任意 Bash、任意 cwd 或任意 project agent 加载能力。
- 不采用“所有任务无人工停顿连续执行”作为跨 approval/lifecycle gate 的默认行为。
- 不让 reviewer 重复决定需求是否批准、验收是否充分或是否归档。
- 不把 Superpowers 文档或仓库作为生产运行时依赖；本地集中路由继续是唯一流程事实源。

### Research Hypotheses To Validate Later

- fresh context 是否显著降低长会话中的上下文污染。
- 独立 review 是否提高 spec/plan 缺陷发现率，且成本可接受。
- 测试日志外置并返回结构化摘要是否同时改善证据质量和主上下文占用。
- reviewer 拆分与合并何者在 qiubai-spec 的 quick/standard/strict tier 上更经济。

以上假设不作为本 change 的完成声明；需要后续实现 change、基准场景和实际 usage 数据验证。

## Execution Topology Decision

推荐采用 **单一主 pipeline + 单次轻量代理调用**。当前目标是模型分层和上下文隔离，不是多 Agent 协作或吞吐优化，因此不提供 parallel、chain、peer coordination 或 subagent recursion。

```text
main agent（唯一 workflow authority）
→ 到达明确 stage，识别一个固定轻量任务
→ 选择 package-owned task kind 与低成本模型
→ 启动一次隔离 subagent session
→ subagent 使用最小只读/受限工具完成任务
→ 返回结构化摘要，完整工具日志留在隔离 artifact
→ main agent读取必要证据并完成当前 stage 的判断
→ 按 workflow-routing.md 进入下一动作
```

### Why This Fits qiubai-spec

- 当前 workflow 顺序、职责和 gate 已明确，subagent 无需重新规划或讨论 next action。
- 固定轻量任务容易定义窄 prompt、工具 allowlist、turn/time/token budget 和输出 schema，适合能力较小、成本更低的模型。
- 大量 search result、文件内容和测试日志保留在子上下文，主 agent只接收可控摘要与证据索引。
- 顺序调用避免并发调度、结果合并、共享资源冲突和多 Agent 状态管理，复杂度与当前收益相称。

### Dispatch Eligibility

仅当任务同时满足以下条件时委派：

- 输入和完成条件可在 task kind 中预定义；
- 不需要需求、规划、架构或验收裁决；
- 不编辑代码、文档、git 或 lifecycle 状态；
- 小模型失败时主 agent可安全重试或 inline fallback；
- 预期产生的中间工具结果明显多于最终摘要，隔离上下文确有价值。

不满足任一条件时由主 agent直接执行。非常短、单次读取即可完成的任务也不委派，避免 subagent 启动成本高于节省。

### Sequential And Failure Rules

- 任一时刻最多运行一个 subagent；不提供 tasks array、chain 或 `{previous}` 拼接。
- subagent 不得再次 dispatch；失败最多以同一 task kind 重试一次。
- invalid schema、低置信结果、超时、取消或 backend unavailable 时返回主 agent，不自动推进 stage。
- 主 agent可读取原始 artifact 或 inline 重做；fallback 必须保持现有 workflow 行为。

因此，当前产品定位应是 **lightweight sequential delegation proxy**，而不是 multi-agent workflow engine。并行能力只有在未来存在经过度量的独立吞吐需求时，才通过新的 change 重新评估。

## Cost Optimization Estimate

以下为技术调研阶段的区间估算，不是已验证收益。当前会话模型是 `openai-codex/gpt-5.6-sol`，其实际订阅/路由价格不能从 package 内可靠确定，因此使用相对价格和 token 流量建模，不声称对应用户账单。

公开 API 价格显示，同系列 economy model 的单 token 价格通常可比主力模型低约 2–25 倍，具体取决于模型、输入/输出、cache 和平台：

- Anthropic pricing：<https://docs.anthropic.com/en/docs/about-claude/pricing>
- OpenAI API pricing：<https://developers.openai.com/api/docs/pricing>

### Estimate Formula

```text
inline_cost
  = main_model(task brief + repeated tool/file/log context + answer)

delegated_cost
  = economy_model(narrow prompt + tool/file/log context + structured result)
  + main_model(dispatch/result summary + required evidence recheck)

saving_rate
  = 1 - delegated_cost / inline_cost
```

只有 child 单价显著更低、原始中间结果较大、返回摘要较短时才有稳定收益。若 child 价格约为 main 的 20–25%，最终摘要不超过原始结果的 10%，并且任务需要至少 3 次搜索/读取或产生长日志，可采用以下初始估算：

| Task kind | Estimated API/token cost reduction | Main-context reduction | Notes |
| --- | ---: | ---: | --- |
| `context_digest` | 55–85% | 70–95% | 读取 15k–50k tokens、只返回 1k–2k 摘要时收益最高 |
| `diff_summary` | 30–70% | 50–90% | 小于约 3k–5k tokens 的 diff 可能零收益或负收益 |
| `doc_fact_scan` | 50–80% | 70–95% | 多文件路径/命令核验适合；单链接检查直接工具更便宜 |
| `test_report` | 35–75% | 80–98% | 主要收益来自隔离长日志；命令执行本身不产生模型节省 |
| `trace_scan` via small model | -20–30% | 20–70% | 纯机械 ID 扫描通常不值得启动模型 |
| `trace_scan` via deterministic tool | 80–99% model cost | 80–99% | 应优先直接工具，只把异常解释交给主 agent |

区间不是可相加的整体节省。对一次完整 change，只有部分节点可委派，因此端到端成本优化更可能是 **10–35%**；当项目搜索/测试日志占主会话大部分 token 时可能达到 **35–50%**。非常短的 quick change 可能因启动 child、重复 system prompt 和主 agent消费摘要而增加 **5–25%** 成本。

### Initial Dispatch Thresholds

- 预计原始工具/文件/日志输入低于 4k tokens：默认 inline。
- 单次 read/grep 或纯确定性检查：默认直接工具。
- 预计至少 3 个工具调用，或原始结果超过 8k–16k tokens，且最终摘要可压到 2k tokens 内：进入 delegate 候选。
- child 估算单价高于 main 的 30%，或需要主 agent重读大部分原始内容：默认不委派。
- `test_report` 必须始终返回 command、cwd、exit code、pass/fail count 和原始日志 artifact；主 agent只在失败定位或验收需要时读取原文。

### Comparison With Mainstream Subagent Modes

| Dimension | Lightweight sequential proxy | Mainstream specialist/implementer/parallel subagents |
| --- | --- | --- |
| Primary goal | 降低模型成本、隔离非关键工具结果 | 提升复杂任务能力、独立审查或并行吞吐 |
| Authority | 主 agent保留全部语义和流程权 | subagent 常拥有任务级规划、编辑、测试或提交权 |
| Context | 最小固定 brief，返回短 schema | 每个 worker/reviewer 通常需要更完整 spec、代码和历史 handoff |
| Total token cost | 合适任务上通常下降 | 常因 implementer + reviewer + rework 增加；收益主要不是省 token |
| Latency | 顺序增加一次 child round-trip | 可并行降低 wall-clock，也可能受 worktree/merge/review拖累 |
| Safety | 无写入、无 lifecycle、无递归，冲突面小 | 需要 worktree、文件所有权、merge、权限和递归控制 |
| Quality upside | 主要是主上下文更干净；小模型能力是上限 | 独立视角和高能力模型可发现复杂缺陷 |
| Failure mode | 摘要遗漏、低能力误判、启动成本抵消收益 | 多 agent 分歧、重复劳动、陈旧上下文、冲突和成本放大 |
| Extensibility | task kind 固定，简单但不通用 | 灵活，可覆盖研究、规划、实现和审查 |

本方案的主要优势是与已经明确的 qb-spec pipeline 相配：不需要把 routing 或判断权复制给 child。主要劣势是不能获得 Superpowers 式独立实现/审查带来的质量提升，也不能通过并行降低耗时；其成功标准应是成本和上下文指标，而不是“更多 agent”。

## Pi Capability And Feasibility Assessment

评估基线为当前 package 首个验证版本 `@earendil-works/pi-coding-agent` 0.85.1。参考 Pi 的 `docs/sdk.md`、`docs/extensions.md`、`docs/tui.md` 与 `examples/extensions/subagent/`；实际 spike 未发起模型请求或修改生产代码。

### Recommended Backend

首期推荐 **extension 内创建 in-process isolated AgentSession**：

- 使用 `createAgentSession()` 创建 child；
- 使用 `SessionManager.inMemory()`，不保存 child session 文件；
- 使用 `DefaultResourceLoader` 的 `noExtensions/noSkills/noPromptTemplates/noThemes/noContextFiles` 和自定义 system prompt，只加载 package-owned task profile；
- 使用显式 `tools` allowlist 和按 task kind 注入的 `customTools`；
- 从 `ModelRuntime` / `ctx.modelRegistry` 解析已认证的 economy model，找不到即 fail closed；
- 订阅 child `AgentSession` events，将进度映射到 parent tool `onUpdate`；
- 结束后聚合 usage、保存必要 artifact，并 `dispose()` child。

不建议首期采用独立 `pi` subprocess。CLI 虽支持 `--mode json -p --no-session --no-extensions --no-skills --no-prompt-templates --no-context-files --tools --model`，但 subprocess 需要额外处理可执行文件定位、JSON stream、进程树取消、临时 prompt、安全 command tool 注入和跨平台行为。它可作为未来需要进程级故障隔离时的独立 backend change。

### Capability Matrix

| Planned capability | Pi interface/evidence | Status | Constraint or gap |
| --- | --- | --- | --- |
| 独立上下文 | `createAgentSession` + `SessionManager.inMemory` | 满足 | 同进程隔离是上下文隔离，不是 OS sandbox |
| 禁止递归加载 package | `DefaultResourceLoader` 的 `noExtensions/noSkills/noPromptTemplates/noContextFiles` | 满足 | 必须使用显式 loader，不能采用默认 discovery |
| 固定最小工具集 | `tools` allowlist、`excludeTools`、`customTools` | 满足 | built-in read tools 的 cwd 不是安全沙箱；路径限制需 wrapper |
| economy model 选择 | `ctx.scopedModels`、`ModelRegistry.getAvailable/find/hasConfiguredAuth` | 满足 | 使用精确 `provider/model-id`，不使用主模型 fallback |
| slash command picker | `pi.registerCommand` + `ctx.ui.select`/`SelectList` + `pi.appendEntry` | 满足 | Pi 内置命令实际为 `/model`；当前只持久化到 session |
| 结构化最终结果 | TypeBox custom tool + `terminate: true` | 满足 | child 未调用终止工具时必须判 schema failure |
| 实时运行可视性 | child `session.subscribe()` + parent `onUpdate` | 满足 | partial updates 只用于 UI，不应写入 parent model context |
| TUI 紧凑/展开显示 | custom tool `renderCall/renderResult`、`expanded/isPartial` | 满足 | print/json 模式只能依赖文本/event 输出 |
| 取消 | parent tool `signal` + `session.abort()` + `dispose()` | 满足但需 glue | SDK 没有单参数自动桥接，必须注册/清理 abort listener |
| timeout/turn budget | timer + event turn counting + `session.abort()` | 部分满足 | `createAgentSession` 无直接 `maxTurns`；需 adapter 强制计数 |
| token/cost accounting | assistant message usage + tool result顶层 `usage` | 满足 | 需要准确聚合 child 所有 assistant turns，避免重复计数 |
| 有界 parent 输出 | truncate helpers、artifact path、tool content/details 分离 | 满足 | full child messages 不应整体放入 tool `details` 或 content |
| 安全测试命令 | task-specific custom runner、`pi.exec`/无 shell argv | 部分满足 | Pi 不提供 qb-spec command allowlist；必须自行校验 executable/args/cwd |
| 项目路径约束 | custom read/find/grep/ls wrappers | 需要补充 | cwd 本身不能阻止绝对路径和 symlink escape |
| package-owned task profiles | extension 显式读取 package 资源 | 满足 | Pi package manifest 不原生声明 `agents`；不能依赖自动 agent discovery |
| inline fallback | proxy 返回 typed failure，由 skill/main agent继续 | 满足 | fallback 决策必须留在主 agent，不由 tool重放 workflow |

### Local Non-Model Spike Evidence

在当前依赖版本执行了两个不调用 LLM 的最小 spike：

1. 创建禁用 extensions、skills、prompts、themes 和 context files 的 `DefaultResourceLoader`，结果为 `extensions=0`、`skills=0`、`prompts=0`、`context=0`，且自定义 child system prompt 生效。
2. 以该 loader、`SessionManager.inMemory()` 和 `tools=['read','grep','find','ls']` 创建 child session，实际 tools 仅为四个 allowlisted read-only tools，`extensions=0` 且 `sessionFile` 未持久化。
3. 当前已认证模型目录中可见 `openai-codex/gpt-5.3-codex-spark` 与 `openai-codex/gpt-5.4-mini` 候选；这只证明模型可解析/认证，不证明质量或实际成本收益。

### Interaction And Runtime Visibility Design

默认不增加新的用户对话或确认步骤。subagent 是主 agent内部的一次 tool call，用户在 TUI 中看到：

```text
qb_delegate context_digest [gpt-5.4-mini]
  discovering → reading 4/7 → summarizing
  ✓ completed · 3 turns · tokens/cost/time
```

- `/qb-subagent-model`：在 TUI 中从 `/model` 同源可用目录选择 child model；选择结果不改变主模型。
- `renderCall`：显示 task kind、精确 child model、selection source、输入范围和 budget，不显示完整 prompt。
- `onUpdate`：只发送阶段、当前工具、已处理计数和累计 usage；不把原始文件/日志流回主上下文。
- collapsed `renderResult`：显示 status、摘要、证据数量、truncated/fallback、usage 和耗时。
- expanded `renderResult`：显示有界工具轨迹、关键 evidence paths、错误和 artifact path；仍不内嵌完整长日志。
- Ctrl+C / Esc 导致 parent signal abort，状态显示 `aborted`，child 不得返回 partial success。
- TUI 以外模式返回相同结构化 final content/details；不得依赖 `ctx.ui` 才能完成任务。

### Feasibility Verdict

**结论：可行，适合进入后续独立实现 change，但存在两个必须先解决的安全缺口。**

1. 不能把 built-in read tools 的 cwd 当成路径沙箱；需要 project-root realpath/symlink-safe wrappers。
2. `test_report` 不能开放通用 Bash；需要 executable/argv/cwd allowlist、timeout、输出 artifact 和取消传播的专用 runner。

除上述缺口外，Pi 0.85.1 已提供 child session、资源禁用、工具 allowlist、模型选择、事件流、TUI rendering、usage 和取消所需基础接口。首期无需 fork Pi，也无需复制官方通用 subagent extension。

## Design Options

### Option A — Skills-only, opportunistic delegation

由 skills 在检测到外部 `subagent` 工具时使用，否则 inline 执行。

- 优点：实现成本最低，不新增 extension surface。
- 缺点：package 行为依赖用户环境；agent 名称、权限和输出协议不可控，难以形成可测试契约。
- 结论：适合实验，不适合作为独立 package 的稳定能力。

### Option B — Bundle a general-purpose subagent tool

复制或封装 Pi 官方示例，允许任意 agent、prompt、tools、cwd 和并行链。

- 优点：能力完整，可覆盖实现、测试、文档和审查。
- 缺点：暴露面过宽；项目 prompt 信任、任意 Bash、递归委派、并行写冲突及生命周期越权风险高；会把 workflow 语义推入通用 transport 参数。
- 结论：不推荐作为 qiubai-spec 默认接口。

### Option C — Lightweight sequential qb-spec delegation proxy（推荐）

package 注册一个机械、受限的代理，只接受 package-owned task kind，不接受任意 agent/prompt/tools/cwd，也不提供并行或 chain；skills 决定何时分派，主 agent保留所有语义和 lifecycle 权限。

- 优点：与现有分层一致；实现和测试面小；可将固定非关键任务路由到低成本模型，并隔离工具日志和中间结果。
- 缺点：不覆盖开放式审查、规划或实现；每次调用有模型启动延迟，必须设置“值得委派”的阈值。
- 结论：作为当前调研的推荐方向；首期只覆盖 `context_digest`、`diff_summary`、`doc_fact_scan`、`test_report` 和可选 `trace_scan`。

## Foundation Decision

### Ownership

- `skills/`：决定是否委派、角色选择、任务 brief、handoff artifact、结果语义解释以及是否继续集中路由。
- 新增 runtime adapter（建议位于 `extensions/` 的薄注册层及 `src/subagent/` 的机械执行层）：只验证 role/capability allowlist、创建隔离 session、传播取消、收集 usage/exit/result、限制输出；不得决定 workflow next action。
- package-owned task profiles：为每个固定 task kind 声明窄 prompt、低成本模型策略、允许工具、预算和结构化输出；不提供开放式 agent 角色或第二套 workflow routing。
- 现有 `qb_spec_*`：继续独占生命周期 mutation、归档和恢复，不暴露给首期 subagent。
- 主 agent：独占批准解释、attestation、acceptance sufficiency、最终完成声明及长期 context promotion。

### Runtime

优先使用 Pi SDK `createAgentSession()` + `SessionManager.inMemory()` 创建独立上下文，并构造显式 ResourceLoader/system prompt/tool allowlist，避免子 session 自动加载当前 package 后递归获得 dispatch 能力。若 SDK 隔离能力在目标 Pi 版本不能满足 cwd、取消或资源控制，再采用官方示例的独立 `pi --mode json -p --no-session` 进程作为兼容 adapter；两种 backend 必须共享同一上层请求/结果契约。

首期不得从 `.pi/agents/` 加载 repo-owned profiles；仅加载 package-owned profiles。未来若允许项目级 profile，必须要求项目 trust 且由用户显式启用。

### Model Selection Command

Pi 0.85.1 的实际内置选择命令是 `/model`（不是 `/models`）；本设计要求 subagent picker 使用与 `/model` 相同的已认证可用模型目录。

建议注册独立命令：

```text
/qb-subagent-model                       # TUI 打开可用模型选择器
/qb-subagent-model <provider/model-id>   # 直接设置当前 session override
/qb-subagent-model status                # 查看当前选择、来源与可用状态
/qb-subagent-model reset                 # 清除 override，恢复 package 配置/default policy
```

- 不带参数且 `ctx.hasUI=true` 时，使用 `ctx.ui.select`/`SelectList` 显示模型；不能修改主 agent当前模型。
- 可选模型来源：`ctx.scopedModels` 非空时只显示该集合，否则使用 `ctx.modelRegistry.getAvailable()`；这与 Pi 文档建议的 picker 语义一致，并排除未配置认证的模型。
- picker 每项显示 `provider/model-id`、context window、reasoning、价格元数据是否可用，并标记当前 subagent 选择；不按名称猜测“mini/cheap”。
- 选择后再次通过 `modelRegistry.find(provider,id)`、`hasConfiguredAuth()` 和 task 所需能力校验；使用稳定的 `provider/model-id` 保存，不保存模糊 pattern。
- 当前研究范围默认只定义 **session-scoped override**：通过 `pi.appendEntry` 保存不进入 LLM context 的配置记录，使同一 session reload/resume 可重建；不静默写全局或项目 settings。
- 非 TUI 模式调用不带参数时返回可用模型的有界列表和用法，不阻塞等待 UI；RPC/print automation 使用显式 `provider/model-id`。
- `/model` 改变主 agent模型时不自动改变已选择的 subagent 模型；只有 reset 后才重新应用 default policy。
- 已选模型在后续调用前变为不可用时返回 `model_unavailable`，不得静默继承主模型或升级到其他模型。

跨 session/global/project 持久化不包含在当前要求中；若后续需要，必须单独确定 scope、trust、配置文件位置和冲突优先级。

### Model And Cost Routing

- session command override 优先于 package/default economy policy；每个 task kind 仍须验证所选模型满足工具与上下文要求。
- 未配置 override 时，每个 task kind 显式映射到 package/config 允许的 economy model，不默认继承主 agent模型。
- economy model 不可用时返回 `backend_unavailable` 或 `model_unavailable` 并由主 agent inline fallback；不得静默切换到同等或更昂贵模型。
- 每次调用记录 model、selection source、turn、input/output/cache tokens、估算费用、耗时和是否 fallback，支持后续比较“主 agent inline”与“lightweight delegate”的总成本。
- 成本评估包含代理 system prompt、task brief、工具轨迹和主 agent消费摘要的成本；不能只比较模型单 token 单价。
- 默认仅委派预计需要多次搜索、读取或长日志处理的任务；单次短读取、纯机械检查和直接工具调用更便宜时不启动模型。

### Capability Sets

- `read_only_repo`：供 `context_digest`、`diff_summary`、`doc_fact_scan`、`trace_scan` 使用，只开放 `read/grep/find/ls`，不提供 shell。
- `verification_commands`：供 `test_report` 使用，不提供通用 Bash，只允许运行主 agent传入且已由当前 plan/项目验证入口确定的命令；完整 stdout/stderr 写入隔离 artifact。
- 不定义 `artifact_write`、`worktree_implementation` 或任何源码/文档 mutation capability；这些不属于当前轻量代理目标。

### Handoff Contract

每次 dispatch 请求至少包含：

- `changeId`、`role`、`taskId`/检查范围；
- 只包含当前任务需要的 spec/plan/context 路径，不复制完整主会话；
- capability set 和允许的 cwd/path/command；
- 输出 schema、证据要求、大小限制和停止条件；
- 禁止自行 dispatch 下级 agent、禁止 lifecycle mutation、禁止把摘要当成功证明。

每次结果至少包含：

- `status: completed | failed | blocked | aborted`；
- role/task identity、backend/model、开始/结束时间；
- findings 或 command results；
- evidence paths、exit codes、truncation 标记；
- usage；
- touched paths（首期必须为空）；
- unresolved questions。

### Orchestration Protocol

1. 主 agent依据集中 routing 到达一个真实 workflow 节点。
2. skill 判断是否存在一个符合 dispatch eligibility 的固定轻量 task kind，并生成最小 brief；短到无需隔离的任务直接 inline。
3. proxy 校验 task kind、模型策略、capability、路径、命令、预算和输出上限；校验失败时 fail closed。
4. proxy 创建单个隔离 session，禁用 proxy 自身、`qb_spec_transition/archive/recover`、edit/write 和通用 bash。
5. 小模型从给定路径读取材料，或通过受限 runner 执行已选命令，返回结构化结果；取消信号必须传播。
6. proxy 校验结果 schema，将完整工具轨迹和超限输出保存在受控临时 artifact，仅向主 agent返回有界摘要和证据索引。
7. 主 agent按任务风险选择检查摘要、退出码或原始 artifact；subagent 的 `completed` 不自动推进 lifecycle、todo 或 acceptance。
8. 无效或低置信结果最多以相同 task kind 重试一次；再次失败后由主 agent inline 处理或报告 blocker。
9. 当前设计一次只运行一个 subagent，不提供 parallel、chain、嵌套 dispatch 或 peer communication。
10. 主 agent按唯一 workflow routing 继续下一动作。

## Requirements

- **REQ-001 — Delegation authority:** subagent 只能执行主 agent在当前 workflow 节点明确分派的窄任务，不得自行改变 scope、type/tier、requirements、next action 或 lifecycle。
- **REQ-002 — Semantic authority:** 用户批准解释、attestation、acceptance sufficiency、完成声明、长期 context promotion 和 recovery action 选择必须保留在主 agent。
- **REQ-003 — Least privilege:** 每个 package-owned task kind 必须使用固定最小 capability set；当前 task kinds 不得获得通用写权限、任意 shell 或 mutation 类 `qb_spec_*` tools。
- **REQ-004 — Isolation:** 每次调用必须有独立上下文；子 session 不得自动继承完整主会话，也不得递归获得 dispatch 能力。
- **REQ-005 — Evidence contract:** 所有审查和验证结果必须结构化并关联具体路径、检查项、命令、退出码或原始 artifact；agent 成功摘要不是完成证据。
- **REQ-006 — Bounded output:** 返回主会话的内容必须满足 50KB/2000 行限制，截断时保留可定位的完整 artifact，并明确标记截断。
- **REQ-007 — Sequential execution:** 当前 proxy 一次最多运行一个 subagent，不提供 parallel、chain、嵌套 dispatch 或共享 child state。
- **REQ-008 — Trust boundary:** 默认只加载 package-owned task profiles；项目级 profiles 不属于当前范围，未来只有在项目受信任且用户显式启用后才可使用。
- **REQ-009 — Failure semantics:** unknown task kind、越权 capability、无效 schema、非零退出、超时、取消和 child session 异常必须可区分并 fail closed；失败后不得启动另一个 child 或推进当前 stage。
- **REQ-010 — Backend compatibility:** 首期只支持 SDK in-process backend；未来若增加 subprocess backend，必须遵循相同的 dispatch/result、安全和 usage accounting 契约，不得改变 workflow 语义。
- **REQ-011 — Fixed lightweight scope:** 当前只研究 `context_digest`、`diff_summary`、`doc_fact_scan`、`test_report` 和可选 `trace_scan`；reviewer、planner、architect、test designer、writer 和 implementer 均不属于代理能力。
- **REQ-012 — Existing behavior preservation:** 没有可用 subagent backend 或 delegation 被禁用时，现有 11 个 skills、两个 prompt 入口和五个 `qb_spec_*` tools 必须继续按当前 inline workflow 工作。
- **REQ-013 — Reference traceability:** 技术调研必须明确记录 Superpowers 的参考流程，以及 qiubai-spec 对其采用、调整、不采用和待验证假设，且不得把外部流程变成本 package 的 next-action 事实源。
- **REQ-014 — Execution topology:** subagent 必须作为单一主 pipeline 中的顺序、一次性轻量调用；只有固定、非关键、无编辑且隔离收益高于启动成本的任务可委派，所有 stage 推进和语义 gate 由主 agent执行。
- **REQ-015 — Cost routing:** 每个 task kind 必须显式选择 economy model 并记录完整 usage/cost；模型不可用时不得静默升级到更昂贵模型，且纯机械或单次短读取任务不得仅为“使用 subagent”而委派。
- **REQ-016 — Measured benefit:** delegation 策略必须以 inline baseline 对比完整 child + parent 成本和主上下文增量；未达到配置阈值的 task kind 保持 inline，不得以理论模型价差代替端到端证据。
- **REQ-017 — Pi-native feasibility:** 首期 backend 必须使用隔离的 in-memory AgentSession、显式禁用默认资源、固定 tool/model allowlist、结构化终止结果、可取消事件桥接和有界可视化；路径访问和测试命令必须由 adapter 额外收敛，不能把 cwd 或 prompt 约束当成安全边界。
- **REQ-018 — User model selection:** 用户必须能通过 `/qb-subagent-model` 从 Pi `/model` 同源的已认证可用模型中选择精确 `provider/model-id` 作为当前 session 的 subagent override，查询/reset 该选择，且不得改变主 agent模型或静默 fallback。

## Acceptance Criteria

- **AC-001**（REQ-001, REQ-002）：设计评审可逐项确认所有不可委派的语义/lifecycle 决策仍由主 agent拥有，且 subagent result 不触发 metadata transition 或 archive。
- **AC-002**（REQ-003, REQ-004, REQ-008）：实现设计能够列出每个 task kind 的工具 allowlist，并证明子 session 不加载 dispatch tool、mutation tools 或未获授权的项目 profile。
- **AC-003**（REQ-005, REQ-006）：每个首期 task kind 都有机器可校验 result schema；超过限制的模拟输出返回截断标记和完整 artifact 路径，主返回不超过 Pi 限制。
- **AC-004**（REQ-007）：proxy schema 和运行状态不包含 tasks array、chain 或并发参数；第二个调用在已有 child 运行时被拒绝或排队，且 child 无法再次 dispatch。
- **AC-005**（REQ-009）：unknown task kind、越权、schema error、command failure、timeout 和 abort 均有不同错误码；失败后不启动新的 child，也不推进当前 stage。
- **AC-006**（REQ-010）：SDK backend 满足完整 contract；未来 backend 只有通过相同 fixture 的状态、证据字段、截断和 usage 等价测试后才可加入。
- **AC-007**（REQ-011）：task-kind allowlist 只包含固定轻量任务，不包含 reviewer/planner/architect/test designer/writer/implementer 或任何写能力。
- **AC-008**（REQ-012）：关闭 delegation 或模拟 backend unavailable 后，现有 workflow resource tests、机械工具 tests、typecheck 和 package smoke test 全部通过。
- **AC-009**（REQ-001, REQ-005, REQ-012）：用 context digest、diff summary、test report、doc fact scan 和 trace scan 场景验证 subagent 只提供摘要/artifact/evidence，主 agent仍按 `workflow-routing.md` 选择唯一 next action。
- **AC-010**（REQ-013）：设计文档包含可复述的 Superpowers per-task 与 final verification 流程，并分别列出 Adopt、Adapt、Do Not Adopt 和待验证假设；任何引用都不改变本地集中路由或授权边界。
- **AC-011**（REQ-014）：固定轻量任务在隔离收益高于启动成本时可委派；开放式规划、代码编辑、语义审查及单次短读取均不委派，且任何结果不得直接推进 stage 或 lifecycle。
- **AC-012**（REQ-015）：场景记录能展示 child model 与 cost class、完整 token/费用/耗时及 fallback；economy model 不可用时返回主 agent而非静默升级，并能与 inline baseline 比较总成本。
- **AC-013**（REQ-016）：每个候选 task kind 均有相同 fixture 的 inline/delegated 对比，至少记录端到端费用、总 tokens、主上下文增量、耗时和结果完整性；默认启用项达到获批阈值，负收益场景保持 inline。
- **AC-014**（REQ-017）：无模型 spike 和后续测试证明 child 为 in-memory、零默认 extensions/skills/prompts/context、仅具 task allowlist tools；TUI/JSON 均可观察状态与最终证据，abort/timeout 生效，绝对路径/symlink escape 和未允许命令被拒绝。
- **AC-015**（REQ-018）：TUI command 只列出 `ctx.scopedModels`（若非空）或 `modelRegistry.getAvailable()` 的模型；显式参数、选择、查询、reset、reload/resume 重建、不可用模型和无 UI 场景均有确定结果，并证明主 agent模型保持不变。

## Behavior Delta

不适用。本 change 只产出设计决策，不修改已发布 workflow 或 runtime 行为。后续实现 change 必须分别记录新增 dispatch surface、fallback 和兼容行为。

## Risks And Mitigations

- **Prompt injection / repo-controlled profiles：** 首期只用 package profiles；项目 profiles 默认关闭并受 trust + explicit opt-in 双重约束。
- **递归委派和成本失控：** 子 session不加载 dispatch tool；设置单次并发、turn、时间、输出和重试上限并记录 usage。
- **测试命令可执行任意代码：** 不给通用 Bash；command 必须来自主 agent已选验证步骤及机械 allowlist，并在结果中回显精确 argv/cwd。
- **subagent 幻觉成功：** 结构化 evidence + 主 agent新鲜核验；完成 gate 不消费单一成功布尔值。
- **代理过度使用：** 仅在中间工具结果明显多于最终摘要时委派；短读取直接 inline，避免启动成本抵消模型节省。
- **SDK/resource 递归加载：** 使用显式 ResourceLoader 和 tool list；加入测试证明子 session看不到 dispatch 和 mutation tools。
- **版本兼容：** 保留 backend capability detection 和 inline fallback，不将 Pi 官方示例内部实现视为稳定 API。

## Rollback / Exit Conditions

- 设计阶段无需 runtime rollback；删除本 draft 即可退出。
- 后续实现若不能证明资源隔离、取消传播、权限收敛或 inline fallback，不启用默认 delegation。
- 若 capability detection 或 backend 启动失败，必须回退现有 inline workflow，而不是部分推进 change lifecycle。

## Assumptions

- subagent 是优化上下文隔离和独立视角的执行机制，而不是新的 workflow authority。
- 当前价值通过固定轻量任务的低成本执行与上下文隔离验证，不承担多 Agent 协作、并行或写入风险。
- package 可以新增 package-owned task profile 资源，并由 adapter 显式加载；不依赖 Pi package manifest 的 agent 自动发现。

## Open Questions Before Implementation

### Product/Workflow Decisions

1. **Model selection persistence scope**：当前设计为 session-scoped override。推荐首期维持该范围，不写全局或项目配置；跨 session persistence 后续单独设计。
2. **No-selection behavior**：尚未明确用户未选择模型时是否自动挑选 economy model。推荐首期不自动猜测，保持 delegation disabled/inline fallback，直到用户通过 `/qb-subagent-model` 选择或存在显式 package default。
3. **MVP task kinds**：当前候选有五类。推荐首期只实现 `context_digest`、`doc_fact_scan`、`test_report`；`diff_summary` 先由 context digest 覆盖，`trace_scan` 优先保留为确定性工具。
4. **Activation policy**：推荐模型已配置后由 skills 根据 dispatch thresholds 自动调用，不在每次轻量任务前询问；用户可通过 reset 禁用 session override。

### Engineering Contracts To Finalize In The Implementation Change

- `test_report` command 来源与 allowlist：推荐只能接收当前 approved plan/项目既有验证入口中的 executable + argv，禁止 shell string。
- artifact 生命周期：推荐使用 mode 0600 的临时目录，保留到 parent session shutdown；需要成为 acceptance evidence 的摘要/hash 由主 agent写入 change，原始临时日志不自动归档。
- 每个 task kind 的 TypeBox request/result schema、默认 timeout、max turns、token/output budget 和低置信判定。
- model capability gate：除可用认证外，定义最小 context window、工具调用能力和 structured-output 失败处理。
- command collision 和无 UI 行为：确认 `/qb-subagent-model` 被同名 extension 占用时的诊断，以及 print/JSON/RPC 的稳定文本/结构化返回。

以上产品决定会改变默认行为或首期范围，应在创建后续实现 change 前明确；工程项可在同一实现 change 的 plan 中定稿并接受测试，不需要改动本次集中 workflow 规则。
