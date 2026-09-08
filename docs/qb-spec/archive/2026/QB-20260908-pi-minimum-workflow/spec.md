---
id: QB-20260908-pi-minimum-workflow
type: feature
tier: strict
status: archived
created: 2026-09-08
updated: 2026-09-08
supersedes: []
---

# Pi-native Minimum qiubai-spec Workflow

## Approval State

用户已确认首期只提供 `/qiubai-spec` 与 `/qiubai-init` 两个用户入口，接受“最低可用”完整打包 11 个互相引用的 workflow skills，确认两个入口统一采用 Pi Prompt Templates、不使用 `registerCommand`，并采纳 `/qiubai-init` 的 `entry | bootstrap | adopt` 三模式及无参数 fail-closed 行为。用户随后明确批准按本文与对应 plan 实施；spec 与 plan 已依法推进至 `active`。

## Goal

在现有四个安全机械工具之上，加入可由 Pi package 独立发现的 qiubai-spec workflow skills 与两个 prompt-template 入口，使用户能够从普通开发请求或显式项目初始化请求进入一条无悬空路由、保留授权边界、最终可验证并归档的最低可用开发生命周期。

## Scope

- 在生产 package 内新增独立维护的 `skills/`，承载 qiubai-spec v0.6.0 的需求塑形、集中路由、计划、条件检查、验证、关闭、初始化与长期 context 规则。
- skills 可以基于冻结基线审阅后迁移，但安装后的生产资源不得读取、导入或链接 `upstream/`。
- 新增且仅新增两个 prompt templates：
  - `/qiubai-spec <开发请求>`：普通开发的统一主入口。
  - `/qiubai-init [entry|bootstrap|adopt] [补充说明]`：显式初始化、创建或采用入口。
- 更新 package manifest、发布文件白名单、README、契约文档与测试，使安装后同时发现 extension、skills 和 prompts。
- 保持现有四个工具及其机械/语义责任边界；skill 负责语义判断，工具只负责 inspect、transition、archive 和 doctor。
- 覆盖从 request → shaping → review/planning → conditional gates → implementation → verification → archive 的主路径，以及 init、manual close/recovery 和非阻塞 context promotion 路径。

## Non-goals

- 首期不增加 `/qiubai-status`、`/qiubai-doctor`、`/qiubai-close` 或逐阶段快捷命令。
- 不通过 `pi.registerCommand` 实现这两个入口，不新增交互式 TUI wizard、shortcut、hook 或常驻状态。
- 不让 prompt template 直接把 `authorizationDeclared` 或 `verificationConfirmed` 设为 true。
- 不让 TypeScript 工具选择 type/tier、判断 requirement/AC 质量、推断批准、判断验收充分性、决定 Directory Map 更新或提升长期 context。
- 不自动修改目标项目的 `AGENTS.md`、context、Directory Map 或 change 文档；这些修改必须发生在相应 skill 的显式授权与工作流范围内。
- 不在首期增加模板生成器、自动恢复 pending archive、legacy 批量迁移或第三个用户入口。
- 不把 `docs/history/` 或 `upstream/` 作为安装时规则来源。

## Terminology

- **用户入口**：可在 Pi 编辑器中直接输入的 `/qiubai-spec` 或 `/qiubai-init` prompt-template command。
- **workflow skill**：Pi 按 Agent Skills 规范发现、按需加载的 `SKILL.md` 及其 references/assets。
- **最低可用**：所有集中路由中可达的动作都有本 package 内的 skill 或明确的 Pi 内建能力承接，不留下指向未打包 skill 的默认路径；不表示每个阶段都有独立 slash command。

## Requirements

### REQ-001 — Independent production workflow resources

package 必须从自身 `skills/` 和 `prompts/` 提供运行时规则。生产 skill、prompt、extension 和 `src/` 不得读取、执行、动态同步或通过链接引用 `upstream/qiubai-spec-v0.6.0/`。冻结基线只用于开发期差分审查和测试。

打包的每个 skill 必须具有有效的 `name` 与 `description`，引用使用 skill 内相对路径；不得存在越出 package、指向 `upstream/` 或安装后缺失的本地链接。

### REQ-002 — Complete minimum routing graph

生产 skills 必须形成一张无悬空默认边的集中路由图，并保持 v0.6.0 的职责分离。最低集合应覆盖：

- `shaping-requirements`
- `reviewing-spec-quality`
- `writing-qb-plans`
- `checking-architecture-boundaries`
- `protecting-critical-behavior`
- `verifying-before-completion`
- `closing-qb-change`
- `updating-directory-map`
- `maintaining-project-context`
- `initializing-qb-spec`
- `establishing-project-foundations`

`shaping-requirements/references/workflow-routing.md` 是 next-action 顺序的唯一事实源。其他 skills 只提供结果、条件信号和局部规则，不复制或建立冲突的默认顺序。

### REQ-003 — `/qiubai-spec` primary entry

`prompts/qiubai-spec.md` 必须注册为 `/qiubai-spec`，接受必填开发请求并将完整参数原样纳入展开后的 prompt。入口必须要求 Agent：

1. 从 `shaping-requirements` 开始，并遵守集中路由；
2. 按需读取代码和已存在的 qb-spec context，不默认全量加载；
3. 独立选择 type 与 tier，只在材料不确定性阻塞时逐项澄清；
4. 复用已有授权，但不得把调用命令或创建文档本身视为需求批准；
5. 语义内容由 Agent 处理，机械状态和归档优先使用现有 `qb_spec_*` 工具；
6. 按 tier 完成实施、证据记录、最终验证和安全关闭。

模板不得内嵌整套 workflow 正文或复制所有 skill 内容，避免形成第二套规则。

### REQ-004 — `/qiubai-init` explicit initialization entry

`prompts/qiubai-init.md` 必须注册为 `/qiubai-init`，支持 `entry`、`bootstrap`、`adopt` 三种显式模式：

- `entry`：只授权 `initializing-qb-spec` 检查并新增或刷新规范 Agent 入口的 managed context-routing block。
- `bootstrap`：用于用户明确创建新项目或建立必要工程基线；通过 `establishing-project-foundations` 路由必要 context、Directory Map 和 Agent 入口任务，不授权捏造产品规则或长期偏好。
- `adopt`：评估或按明确范围让已有项目采用 qb-spec；不得把非空项目当作空项目覆盖，Agent 入口仍需独立明确意图。

无模式、未知模式或语义含糊时，入口只能检查/解释模式并请求用户选择，不得执行持久化修改。附加参数只作为当前模式的范围说明，不扩大授权。

### REQ-005 — Lifecycle and semantic authority boundaries

skills 和 prompts 必须保留以下约束：

- 新持久化 artifact 从 `draft` 开始；只有现有明确授权覆盖 shaped scope 时才能进入 `approved`，实际实施开始时进入 `active`。
- quick 默认 inline；standard 默认合并 spec；strict 使用独立 plan 和完整 REQ/AC/TASK/VER traceability。
- `authorizationDeclared` 和 `verificationConfirmed` 始终只是调用方 attestations，不是独立证据。
- `verifying-before-completion` 必须先依据 tier 汇总实际 acceptance evidence，满足条件后才调用 archive；不得由 prompt 直接归档。
- Directory Map 与长期 context 分别由专属 skill 维护；归档和 Behavior Delta 不自动授权 context promotion。
- 普通成功关闭在 verification 步骤完成；`closing-qb-change` 只处理显式、legacy、冲突或恢复路径。

### REQ-006 — Pi-native packaging and command surface

`package.json` 必须显式声明 extension、skills 和 prompts，并将 `skills/`、`prompts/` 纳入 npm `files`。安装后的用户 command surface 在本 package 范围内应包含：

- prompt：`/qiubai-spec`、`/qiubai-init`
- skill：Pi 原生 `/skill:<name>` 命令
- extension：仍只注册四个 `qb_spec_*` tools

不得通过 extension 再注册同名 `/qiubai-spec` 或 `/qiubai-init`，避免命令优先级覆盖 prompt expansion；不得新增其他 package prompt commands。

### REQ-007 — Bounded context and progressive disclosure

启动时只暴露 skill name/description 和两个 prompt 的简短元数据。详细 workflow、references 和条件规则必须按 Pi skill progressive disclosure 读取；prompt 不复制完整 references。新增资源不能把全部 qiubai-spec 正文无条件注入每一轮 system prompt。

### REQ-008 — Verification and distribution contract

自动测试和真实 Pi smoke 必须验证：

- manifest 只声明预期 extension、11 个 workflow skills 与两个 prompts；
- 两个 prompt 的名称、description、argument hint、参数展开和无参数安全行为；
- 11 个 skills 可发现、frontmatter 合法、名称唯一、references 无断链且运行时不依赖 `upstream/`；
- `/qiubai-spec` 和三个 `/qiubai-init` 模式的关键授权/路由文本存在且无直接 attestation；
- extension 仍只注册四个工具，原有 41 项机械测试不回归；
- `npm pack --dry-run --json` 包含生产 skills/prompts，排除 `tests/`、`docs/` 和 `upstream/`；
- 至少一次临时真实 Pi 加载能发现两个 prompt、11 个 skills 和四个 tools。

## Behavior Delta

### ADDED

- REQ-001、REQ-002：新增 Pi-native workflow skill 层和完整最低路由图。
- REQ-003：新增普通开发统一入口 `/qiubai-spec`。
- REQ-004：新增显式初始化入口 `/qiubai-init` 及三种授权模式。
- REQ-006、REQ-007：新增 package resources、command surface 和渐进披露约束。
- REQ-008：新增 workflow resource、prompt expansion 和真实 Pi discovery 验证。

### MODIFIED

- REQ-005：将当前“仅机械工具”的交付形态扩展为“skills 负责语义、tools 负责机械”的完整分层；不改变四个工具的既有机械行为。
- README 中“不声明 skills/prompts”和相应非目标说明需要更新为新的实际能力边界。

## Acceptance Criteria

### AC-001 [REQ-001, REQ-006]

从 package 根安装或临时加载时，Pi 从包内路径发现 11 个 skills、两个 prompts 和一个 extension；将 package 复制到不含 `upstream/` 的临时目录后，资源发现、prompt expansion 和核心测试仍可执行。生产资源扫描不存在 `upstream/` 读取、绝对开发路径或越界链接。

### AC-002 [REQ-002, REQ-007]

自动检查构建完整路由关系，确认 `workflow-routing.md` 中命名的每个 skill 都存在，所有 Markdown 相对链接解析到打包文件，且没有另一个文件声明自己为默认流程顺序事实源。启动元数据不包含完整 skill 正文。

### AC-003 [REQ-003, REQ-005]

`/qiubai-spec 修复并保护登录重试回归` 展开后保留完整请求，明确从 shaping 和集中路由开始，区分 type/tier、授权与文档创建，并要求验证后才能安全归档；模板不直接声称批准、验收通过，且不包含 `authorizationDeclared: true` 或 `verificationConfirmed: true`。

### AC-004 [REQ-004, REQ-005]

`/qiubai-init entry`、`bootstrap`、`adopt` 分别路由到规定职责。无参数及未知模式的测试确认只要求解释/选择而不授权写入；`adopt` 不隐含 Agent 入口修改，`bootstrap` 的入口/context 授权只覆盖已知工程基线和创建范围。

### AC-005 [REQ-002, REQ-005]

契约审查确认 quick、standard、strict 主路径均可从请求走到验证/完成；strict review、架构边界、关键行为保护、Directory Map、普通自动关闭、异常关闭和非阻塞 context promotion 各有唯一可达承接者，没有由机械工具作语义决定。

### AC-006 [REQ-006, REQ-008]

fake API 与真实 Pi smoke 均确认 extension 仍只注册 `qb_spec_inspect`、`qb_spec_transition`、`qb_spec_archive`、`qb_spec_doctor`，不存在同名 extension commands；`pi.getCommands()` 或等价可观察接口将 `qiubai-spec`、`qiubai-init` 标识为 prompt source，而 workflow skills 标识为 skill source。

### AC-007 [REQ-008]

`npm ci`、`npm run typecheck`、完整 Node tests 和 `npm pack --dry-run --json` 通过；tarball 包含全部运行时 skill/reference/asset 与两个 prompt，且不包含 `tests/`、`docs/`、`upstream/`。现有机械行为测试保持通过。

### AC-008 [REQ-003, REQ-004, REQ-005, REQ-008]

在临时 fixture 项目完成两个受控场景审查：一个 `/qiubai-spec` standard 路径和一个无参数 `/qiubai-init` 路径。前者保留批准与验证边界并能路由到现有工具；后者在未选择模式前不产生文件修改。模型输出不作为唯一测试证据，关键约束由静态/结构化测试验证。

## Verification Evidence

- **AC-001、AC-002：** 生产 package 已加入 11 个 workflow skills、24 个 skill/reference/asset 文件和两个 prompts。新增 Pi resource-loader 测试确认 skill/prompt diagnostics 为空、名称唯一、所有 Markdown 相对链接存在且不越界，生产资源无 symlink、`upstream/`、`qb_change.py` 或插件绝对路径依赖。集中 routing 已显式命名全部 11 个承接 skill，并由测试确认唯一默认顺序事实源。
- **AC-003、AC-004：** 使用 Pi 0.85.1 的实际 prompt expander 验证 `/qiubai-spec` 保留中文多词请求，无请求时不写入；`/qiubai-init` 的 entry/bootstrap/adopt、无参数和未知参数展开均保留规定授权边界。两个模板均不包含 true attestation。
- **AC-005：** 生产 `workflow-routing.md` 覆盖 quick、standard、strict、架构、行为保护、Directory Map、verification、普通自动关闭、异常关闭和非阻塞 context 路径。Python change-tool guidance 已替换为 Pi-native `qb_spec_*` tool contract，语义判断仍留在 skills/Agent。新增顶层 `skills/`、`prompts/` 后已创建 `docs/qb-spec/DIRECTORY_MAP.md` 记录稳定职责与禁止内容。
- **AC-006：** 真实 `pi -e . --mode rpc --no-session` 的 `get_commands` 返回两个 prompt source：`qiubai-spec`、`qiubai-init`，以及 11 个 skill source；extension fake API 与既有测试确认仍只注册四个 `qb_spec_*` tools，未注册同名 extension command。
- **AC-007：** `npm ci` 通过且 audit 为 0 vulnerabilities；`npm run typecheck` 通过；Node suite 为 45/45 通过；`npm pack --dry-run --json` 为 44 entries，含 24 个 skill 文件和两个 prompt，且不含 `tests/`、`docs/`、`upstream/`。
- **AC-008：** prompt expansion 的确定性测试覆盖 standard 风格开发请求和无参数 init 安全路径；关键授权约束由静态资源、实际 Pi loader/expander 和 RPC discovery 共同验证，不以模型输出作为唯一证据。
- Linux 已验证。Windows runner 未提供；沿用现有文件系统平台缺口。

## Risks And Recovery

- 大量 skill 文本直接复制可能保留不适用于 Pi 的 Python fallback 或旧路径；迁移时逐文件审查、改为现有 `qb_spec_*` 工具，并用断链/禁用路径测试控制。
- `/qiubai-init` 名称可能被理解为全面写入授权；通过显式 mode、无参数 fail-closed 和模板/skill 双层授权文字控制。
- prompt 与 skill 重复规则会产生 drift；prompt 只负责入口意图，详细规则集中在 skills/references。
- skill 自动选择并不保证所有模型都会加载正确 skill；两个显式 prompt 入口要求首个动作加载对应 skill，同时保留 `/skill:<name>` 原生命令作为诊断与强制入口。
- 真实模型端到端行为具有非确定性；静态资源图、prompt expansion 和 fake/real Pi discovery 是主证据，受控 smoke 只作为补充。
- 若新 workflow 资源导致错误授权或错误归档倾向，回滚 package manifest 的 skills/prompts 声明和对应生产目录即可；现有四个工具及文档数据不应被迁移本身修改。

## Confirmed Decisions

- “最低可用但无悬空路由”完整打包当前 11 个 workflow skills，而不仅是 shaping/planning/verifying 三个核心 skill。
- 首期 `/qiubai-spec` 与 `/qiubai-init` 均采用 Pi Prompt Templates，不使用 `registerCommand`。
- `/qiubai-init` 首期采用 `entry`、`bootstrap`、`adopt` 三种模式；无参数、未知模式或授权含糊时只解释并请求选择，不持久化修改。
- 用户已批准按本文和对应 plan 实施。
